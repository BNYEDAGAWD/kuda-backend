/**
 * Asset Pack Routes - Client asset upload, AM review, approval/rejection
 */
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import multer from 'multer';
import AssetPackService from '../services/asset-pack.service';
import { Logger } from '../utils/logger';

const router = Router();
const logger = new Logger('AssetPackRoutes');
const upload = multer({ storage: multer.memoryStorage() });

export const createAssetPackRouter = (db: Pool) => {
  const assetPackService = new AssetPackService(db);

  // Upload asset pack (single or multiple files, ZIP supported)
  // Enhanced Phase 1: Returns processing_time_ms, brand_colors, minimal_brief, and all enhanced metadata
  router.post('/', upload.array('files', 50), async (req: Request, res: Response) => {
    try {
      const { campaign_id, uploaded_by_email, upload_method, client_notes } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      const processedAssetPack = await assetPackService.createAssetPack(
        {
          campaign_id,
          uploaded_by: uploaded_by_email,
          upload_method: upload_method || 'portal',
          client_notes
        },
        files
      );

      logger.info('Asset pack uploaded and processed', {
        assetPackId: processedAssetPack.id,
        fileCount: files.length,
        processingTimeMs: processedAssetPack.processing_time_ms,
        targetMet: processedAssetPack.processing_time_ms! < 120000
      });

      // Return enhanced response with all Phase 1 metadata
      res.status(201).json({
        ...processedAssetPack,
        performance: {
          processing_time_ms: processedAssetPack.processing_time_ms,
          target_ms: 120000,
          target_met: processedAssetPack.processing_time_ms! < 120000
        }
      });
    } catch (error) {
      logger.error('Error uploading asset pack', error);
      res.status(500).json({ error: 'Failed to upload asset pack' });
    }
  });

  // Get asset pack by ID with files
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const assetPack = await assetPackService.getAssetPackById(req.params.id);
      if (!assetPack) {
        return res.status(404).json({ error: 'Asset pack not found' });
      }
      res.json(assetPack);
    } catch (error) {
      logger.error('Error fetching asset pack', error);
      res.status(500).json({ error: 'Failed to fetch asset pack' });
    }
  });

  // Get asset packs by campaign
  router.get('/campaign/:campaignId', async (req: Request, res: Response) => {
    try {
      const assetPacks = await assetPackService.getAssetPacksByCampaign(req.params.campaignId);
      res.json(assetPacks);
    } catch (error) {
      logger.error('Error fetching asset packs', error);
      res.status(500).json({ error: 'Failed to fetch asset packs' });
    }
  });

  // Approve asset pack (starts 48h SLA timer)
  router.post('/:id/approve', async (req: Request, res: Response) => {
    try {
      const { reviewed_by } = req.body;
      const assetPack = await assetPackService.approveAssetPack(req.params.id, reviewed_by);
      logger.info('Asset pack approved', { assetPackId: req.params.id, reviewedBy: reviewed_by });
      res.json(assetPack);
    } catch (error) {
      logger.error('Error approving asset pack', error);
      res.status(500).json({ error: 'Failed to approve asset pack' });
    }
  });

  // Reject asset pack (MANDATORY rejection note)
  router.post('/:id/reject', async (req: Request, res: Response) => {
    try {
      const { reviewed_by, rejection_note } = req.body;

      if (!rejection_note || rejection_note.trim().length === 0) {
        return res.status(400).json({ 
          error: 'Rejection note is MANDATORY when rejecting asset pack' 
        });
      }

      const assetPack = await assetPackService.rejectAssetPack(
        req.params.id,
        reviewed_by,
        rejection_note
      );

      logger.info('Asset pack rejected', { assetPackId: req.params.id, reviewedBy: reviewed_by });
      res.json(assetPack);
    } catch (error) {
      logger.error('Error rejecting asset pack', error);
      res.status(500).json({ error: error.message || 'Failed to reject asset pack' });
    }
  });

  // Get asset pack files with enhanced metadata (logo detection, dimensions, etc.)
  router.get('/:id/files', async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT
          id, asset_pack_id, original_filename, s3_key, s3_url,
          file_size_bytes, mime_type, category, is_extracted_from_zip,
          is_likely_logo, logo_confidence, logo_detection_reasons,
          dimensions, filename_patterns, suggested_starting_file,
          uploaded_at
         FROM asset_pack_files
         WHERE asset_pack_id = $1
         ORDER BY
           suggested_starting_file DESC NULLS LAST,
           category,
           uploaded_at`,
        [req.params.id]
      );
      res.json(result.rows);
    } catch (error) {
      logger.error('Error fetching asset pack files', error);
      res.status(500).json({ error: 'Failed to fetch asset pack files' });
    }
  });

  // Get minimal brief for asset pack
  router.get('/:id/brief', async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT minimal_brief, minimal_brief_json FROM asset_packs WHERE id = $1`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Asset pack not found' });
      }

      const { minimal_brief, minimal_brief_json } = result.rows[0];
      res.json({
        text: minimal_brief,
        structured: minimal_brief_json
      });
    } catch (error) {
      logger.error('Error fetching minimal brief', error);
      res.status(500).json({ error: 'Failed to fetch minimal brief' });
    }
  });

  // Get processing performance metrics for asset pack
  router.get('/:id/performance', async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT
          processing_time_ms,
          categorization_method,
          quick_scan_flags,
          brand_colors,
          total_files,
          total_size_bytes,
          created_at
         FROM asset_packs
         WHERE id = $1`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Asset pack not found' });
      }

      const pack = result.rows[0];
      res.json({
        processing_time_ms: pack.processing_time_ms,
        target_ms: 120000,
        target_met: pack.processing_time_ms < 120000,
        categorization_method: pack.categorization_method,
        total_files: pack.total_files,
        total_size_bytes: pack.total_size_bytes,
        quick_scan_flags: pack.quick_scan_flags,
        brand_colors: pack.brand_colors,
        processed_at: pack.created_at
      });
    } catch (error) {
      logger.error('Error fetching performance metrics', error);
      res.status(500).json({ error: 'Failed to fetch performance metrics' });
    }
  });

  // Delete asset pack file
  router.delete('/files/:fileId', async (req: Request, res: Response) => {
    try {
      await assetPackService.deleteAssetPackFile(req.params.fileId);
      logger.info('Asset pack file deleted', { fileId: req.params.fileId });
      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting asset pack file', error);
      res.status(500).json({ error: 'Failed to delete asset pack file' });
    }
  });

  return router;
};

export default createAssetPackRouter;
