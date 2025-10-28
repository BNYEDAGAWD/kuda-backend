/**
 * Asset Package API Routes
 *
 * Endpoints for uploading and managing asset packages.
 */

import { Router, Request, Response } from 'express';
import { uploadMultiple, handleUploadErrors } from '../middleware/upload.middleware';
import { AssetOrganizerService } from '../services/asset-organizer.service';
import { s3Service } from '../services/s3.service';
import { ZipExtractor, ExtractedFile } from '../utils/zip-extractor';
import { db } from '../config/database.config';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const logger = new Logger('AssetPackageRoutes');
const assetOrganizer = new AssetOrganizerService();

/**
 * POST /api/assets/package
 * Upload asset package (multiple files or ZIP)
 */
router.post(
  '/package',
  uploadMultiple,
  handleUploadErrors,
  async (req: Request, res: Response) => {
    try {
      const { campaignId, packageName, packageType, version, notes, uploadedBy } = req.body;

      // Validate required fields
      if (!campaignId) {
        return res.status(400).json({
          error: 'Missing required field: campaignId',
        });
      }

      if (!uploadedBy) {
        return res.status(400).json({
          error: 'Missing required field: uploadedBy',
        });
      }

      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          error: 'No files uploaded',
        });
      }

      logger.info('Processing asset package upload', {
        campaignId,
        fileCount: files.length,
        uploadedBy,
      });

      // Create asset package record
      const packageId = uuidv4();
      const packageResult = await db.query(
        `INSERT INTO asset_packages
        (id, campaign_id, package_name, package_type, version, uploaded_by, notes, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          packageId,
          campaignId,
          packageName || `Upload ${new Date().toISOString()}`,
          packageType || 'mixed',
          version || 'v1',
          uploadedBy,
          notes || null,
          'processing',
        ]
      );

      const assetPackage = packageResult.rows[0];

      // Process files
      const filesToProcess: { filename: string; buffer: Buffer }[] = [];

      for (const file of files) {
        // Check if file is a ZIP
        if (ZipExtractor.isZipFile(file.originalname, file.mimetype)) {
          logger.info('Extracting ZIP file', { filename: file.originalname });

          // Extract ZIP contents
          const extractedFiles = await ZipExtractor.extractFiles(
            file.buffer,
            file.originalname
          );

          // Add extracted files to processing queue
          extractedFiles.forEach((extracted) => {
            filesToProcess.push({
              filename: extracted.filename,
              buffer: extracted.buffer,
            });
          });
        } else {
          // Add individual file to processing queue
          filesToProcess.push({
            filename: file.originalname,
            buffer: file.buffer,
          });
        }
      }

      logger.info('Files ready for processing', {
        packageId,
        totalFiles: filesToProcess.length,
      });

      // Process all files through asset organizer
      await assetOrganizer.processAssetPackage(
        packageId,
        campaignId,
        filesToProcess
      );

      // Update package status to completed
      await db.query(
        `UPDATE asset_packages
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
        ['completed', packageId]
      );

      // Get package summary
      const summaryResult = await db.query(
        `SELECT * FROM asset_package_summary WHERE package_id = $1`,
        [packageId]
      );

      res.status(201).json({
        message: 'Asset package uploaded successfully',
        package: assetPackage,
        summary: summaryResult.rows[0],
      });
    } catch (error) {
      logger.error('Asset package upload failed', error);
      res.status(500).json({
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/packages/:id
 * Get asset package details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get package details
    const packageResult = await db.query(
      `SELECT * FROM asset_packages WHERE id = $1`,
      [id]
    );

    if (packageResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Package not found',
      });
    }

    // Get package summary
    const summaryResult = await db.query(
      `SELECT * FROM asset_package_summary WHERE package_id = $1`,
      [id]
    );

    res.json({
      package: packageResult.rows[0],
      summary: summaryResult.rows[0],
    });
  } catch (error) {
    logger.error('Failed to get package details', error);
    res.status(500).json({
      error: 'Failed to retrieve package',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/packages/:id/assets
 * Get all assets in a package
 */
router.get('/:id/assets', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { category, isFinalCreative } = req.query;

    let query = `SELECT * FROM assets WHERE package_id = $1`;
    const params: any[] = [id];

    if (category) {
      query += ` AND file_category = $${params.length + 1}`;
      params.push(category);
    }

    if (isFinalCreative !== undefined) {
      query += ` AND is_final_creative = $${params.length + 1}`;
      params.push(isFinalCreative === 'true');
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.query(query, params);

    res.json({
      packageId: id,
      assets: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Failed to get package assets', error);
    res.status(500).json({
      error: 'Failed to retrieve assets',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/packages/campaign/:campaignId
 * Get all packages for a campaign
 */
router.get('/campaign/:campaignId', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;

    const result = await db.query(
      `SELECT ap.*, aps.*
       FROM asset_packages ap
       LEFT JOIN asset_package_summary aps ON ap.id = aps.package_id
       WHERE ap.campaign_id = $1
       ORDER BY ap.created_at DESC`,
      [campaignId]
    );

    res.json({
      campaignId,
      packages: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Failed to get campaign packages', error);
    res.status(500).json({
      error: 'Failed to retrieve packages',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
