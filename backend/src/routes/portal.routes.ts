/**
 * Portal Routes
 *
 * Public endpoints for client portal (token-based, no authentication required).
 * Clients upload creatives using secure portal tokens.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import multer from 'multer';
import PortalAuthService from '../services/portal-auth.service';
import S3Service from '../services/s3.service';
import { createUploadMiddleware } from '../middleware/upload.middleware';
import { Logger } from '../utils/logger';
import path from 'path';

const logger = new Logger('PortalRoutes');

export function createPortalRoutes(db: Pool): Router {
  const router = Router();
  const portalAuth = new PortalAuthService(db);
  const s3Service = new S3Service();
  const uploadMiddleware = createUploadMiddleware();

  /**
   * GET /api/portal/:token/validate
   * Validate portal token and get campaign details
   */
  router.get('/:token/validate', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      const session = await portalAuth.validateToken(token);

      res.json({
        success: true,
        data: {
          campaign: {
            id: session.campaign.id,
            name: session.campaign.name,
            client_name: session.campaign.client_name,
            celtra_integration_enabled: session.campaign.celtra_integration_enabled
          },
          isValid: session.isValid,
          expiresAt: session.token.expires_at
        }
      });
    } catch (error: any) {
      logger.error('Token validation failed', error);
      res.status(401).json({
        error: error.message || 'Invalid or expired portal link'
      });
    }
  });

  /**
   * GET /api/portal/:token/creatives
   * Get creatives uploaded via this portal token
   */
  router.get('/:token/creatives', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      // Validate token
      const session = await portalAuth.validateToken(token);

      // Get creatives for this campaign submitted by this client
      const result = await db.query(
        `SELECT
          id, name, creative_type, dimensions, status,
          s3_file_url, file_size_bytes, mime_type,
          submitted_at, approved_at, rejection_reason,
          client_notes, priority
         FROM creatives
         WHERE campaign_id = $1 AND submitted_by = $2
         ORDER BY submitted_at DESC`,
        [session.campaign.id, session.token.client_email]
      );

      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length
      });
    } catch (error: any) {
      logger.error('Failed to get portal creatives', error);
      res.status(401).json({
        error: error.message || 'Invalid or expired portal link'
      });
    }
  });

  /**
   * POST /api/portal/:token/upload
   * Upload creative via portal
   */
  router.post('/:token/upload', uploadMiddleware.single('file'), async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const file = req.file as Express.Multer.File;

      if (!file) {
        return res.status(400).json({
          error: 'No file uploaded'
        });
      }

      // Validate token
      const session = await portalAuth.validateToken(token);

      // Check upload permission
      const canUpload = await portalAuth.canUpload(token);
      if (!canUpload) {
        return res.status(403).json({
          error: 'Cannot upload to this campaign. Campaign may be archived or completed.'
        });
      }

      const {
        creative_name,
        creative_type,
        dimensions,
        landing_url,
        demo_link,
        client_notes,
        priority
      } = req.body;

      // Validate required fields
      if (!creative_name) {
        return res.status(400).json({
          error: 'creative_name is required'
        });
      }

      if (!creative_type) {
        return res.status(400).json({
          error: 'creative_type is required'
        });
      }

      // Upload to S3
      const s3Key = `campaigns/${session.campaign.id}/creatives/${Date.now()}_${file.originalname}`;
      const s3Url = await s3Service.uploadFile(file.buffer, s3Key, file.mimetype);

      // Get presigned URL for viewing
      const presignedUrl = await s3Service.getPresignedUrl(s3Key);

      // Insert creative into database
      const creativeResult = await db.query(
        `INSERT INTO creatives (
          campaign_id, name, creative_type, dimensions,
          s3_file_key, s3_file_url, file_size_bytes, mime_type,
          landing_url, demo_link, client_notes, priority,
          status, submitted_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          session.campaign.id,
          creative_name,
          creative_type,
          dimensions || null,
          s3Key,
          s3Url,
          file.size,
          file.mimetype,
          landing_url || session.campaign.default_landing_url || null,
          demo_link || null,
          client_notes || null,
          priority || 'normal',
          'pending',
          session.token.client_email
        ]
      );

      const creative = creativeResult.rows[0];

      logger.info('Creative uploaded via portal', {
        creativeId: creative.id,
        campaignId: session.campaign.id,
        clientEmail: session.token.client_email
      });

      res.status(201).json({
        success: true,
        data: {
          creative: {
            id: creative.id,
            name: creative.name,
            creative_type: creative.creative_type,
            dimensions: creative.dimensions,
            status: creative.status,
            file_size_bytes: creative.file_size_bytes,
            mime_type: creative.mime_type,
            submitted_at: creative.submitted_at,
            presignedUrl
          }
        },
        message: 'Creative uploaded successfully. Kargo team will review shortly.'
      });
    } catch (error: any) {
      logger.error('Portal upload failed', error);

      if (error.message && error.message.includes('expired')) {
        return res.status(401).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to upload creative',
        message: error.message
      });
    }
  });

  /**
   * POST /api/portal/:token/upload-batch
   * Upload multiple creatives at once
   */
  router.post('/:token/upload-batch', uploadMiddleware.array('files', 50), async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          error: 'No files uploaded'
        });
      }

      // Validate token
      const session = await portalAuth.validateToken(token);

      // Check upload permission
      const canUpload = await portalAuth.canUpload(token);
      if (!canUpload) {
        return res.status(403).json({
          error: 'Cannot upload to this campaign. Campaign may be archived or completed.'
        });
      }

      const {
        creative_type,
        landing_url,
        client_notes,
        priority,
        package_name // For future package tracking
      } = req.body;

      if (!creative_type) {
        return res.status(400).json({
          error: 'creative_type is required'
        });
      }

      const results = [];
      const errors = [];

      // Upload each file
      for (const file of files) {
        try {
          // Upload to S3
          const s3Key = `campaigns/${session.campaign.id}/creatives/${Date.now()}_${file.originalname}`;
          const s3Url = await s3Service.uploadFile(file.buffer, s3Key, file.mimetype);

          // Extract dimensions from filename if present (e.g., "banner-300x250.jpg")
          const dimensionMatch = file.originalname.match(/(\d+)x(\d+)/);
          const dimensions = dimensionMatch ? `${dimensionMatch[1]}x${dimensionMatch[2]}` : null;

          // Insert creative
          const creativeResult = await db.query(
            `INSERT INTO creatives (
              campaign_id, name, creative_type, dimensions,
              s3_file_key, s3_file_url, file_size_bytes, mime_type,
              landing_url, client_notes, priority,
              status, submitted_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id, name, creative_type, dimensions, status, file_size_bytes, submitted_at`,
            [
              session.campaign.id,
              path.parse(file.originalname).name, // Use filename without extension
              creative_type,
              dimensions,
              s3Key,
              s3Url,
              file.size,
              file.mimetype,
              landing_url || session.campaign.default_landing_url || null,
              client_notes || null,
              priority || 'normal',
              'pending',
              session.token.client_email
            ]
          );

          results.push(creativeResult.rows[0]);
        } catch (fileError: any) {
          logger.error('Failed to upload file in batch', {
            filename: file.originalname,
            error: fileError
          });
          errors.push({
            filename: file.originalname,
            error: fileError.message
          });
        }
      }

      logger.info('Batch upload via portal', {
        campaignId: session.campaign.id,
        totalFiles: files.length,
        successful: results.length,
        failed: errors.length
      });

      res.status(201).json({
        success: true,
        data: {
          creatives: results,
          errors
        },
        summary: {
          total: files.length,
          successful: results.length,
          failed: errors.length
        },
        message: `${results.length} creative(s) uploaded successfully. ${errors.length} failed.`
      });
    } catch (error: any) {
      logger.error('Batch portal upload failed', error);

      if (error.message && error.message.includes('expired')) {
        return res.status(401).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to upload creatives',
        message: error.message
      });
    }
  });

  /**
   * GET /api/portal/:token/creative/:creativeId
   * Get single creative details (for client to view their upload)
   */
  router.get('/:token/creative/:creativeId', async (req: Request, res: Response) => {
    try {
      const { token, creativeId } = req.params;

      // Validate token
      const session = await portalAuth.validateToken(token);

      // Get creative (ensure it belongs to this campaign and was submitted by this client)
      const result = await db.query(
        `SELECT
          id, name, creative_type, dimensions, status,
          s3_file_key, s3_file_url, file_size_bytes, mime_type,
          submitted_at, approved_at, rejection_reason,
          client_notes, priority
         FROM creatives
         WHERE id = $1 AND campaign_id = $2 AND submitted_by = $3`,
        [creativeId, session.campaign.id, session.token.client_email]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Creative not found or access denied'
        });
      }

      const creative = result.rows[0];

      // Get presigned URL if needed
      const presignedUrl = await s3Service.getPresignedUrl(creative.s3_file_key);

      res.json({
        success: true,
        data: {
          ...creative,
          presignedUrl
        }
      });
    } catch (error: any) {
      logger.error('Failed to get portal creative', error);

      if (error.message && error.message.includes('expired')) {
        return res.status(401).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to get creative',
        message: error.message
      });
    }
  });

  return router;
}

export default createPortalRoutes;
