/**
 * Asset Pack Service - Enhanced Phase 1 Implementation
 *
 * Manages client-uploaded source materials with optimized workflow:
 * - Extension-based categorization (10-100x faster than AI)
 * - Logo detection via dimension heuristics (milliseconds per file)
 * - Selective color extraction (3-5 logos maximum)
 * - Document keyword flagging (no OCR)
 * - Minimal brief generation (<1 second)
 *
 * Target: <2 minutes total processing time
 */

import { Pool } from 'pg';
import AdmZip from 'adm-zip';
import path from 'path';
import S3Service from './s3.service';
import { Logger } from '../utils/logger';

// Enhanced utilities
import { categorizeByExtension, getCategoryStats, batchCategorize } from '../utils/extension-categorizer';
import { detectLogo, batchDetectLogos, selectTopLogos } from '../utils/logo-detector';
import { batchExtractColors, aggregateBrandColors, ColorExtractionResult } from '../utils/color-extractor';
import { batchScanDocuments, identifyBrandGuidelines, identifyCampaignBrief, DocumentScanResult } from '../utils/document-scanner';
import { generateMinimalBrief, formatBriefAsText, MinimalBrief } from '../utils/minimal-brief-generator';

const logger = new Logger('AssetPackService');

export interface AssetPack {
  id: string;
  campaign_id: string;
  uploaded_by: string;
  upload_method: 'portal' | 'manual_am';
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: Date | null;
  rejection_note: string | null;
  total_files: number;
  total_size_bytes: number;
  client_notes: string | null;
  internal_notes: string | null;
  processing_time_ms: number | null;
  categorization_method: string;
  quick_scan_flags: any;
  brand_colors: any;
  minimal_brief: string | null;
  minimal_brief_json: any;
  created_at: Date;
  updated_at: Date;
}

export interface AssetPackFile {
  id: string;
  asset_pack_id: string;
  original_filename: string;
  s3_key: string;
  s3_url: string;
  file_size_bytes: number;
  mime_type: string;
  category: string | null;
  is_extracted_from_zip: boolean;
  is_likely_logo: boolean;
  logo_confidence: string | null;
  logo_detection_reasons: any;
  dimensions: any;
  filename_patterns: any;
  suggested_starting_file: boolean;
  uploaded_at: Date;
}

export interface CreateAssetPackInput {
  campaign_id: string;
  uploaded_by: string;
  upload_method?: 'portal' | 'manual_am';
  client_notes?: string;
}

export interface ProcessedAssetPack extends AssetPack {
  files: AssetPackFile[];
  brief: MinimalBrief;
}

export class AssetPackService {
  private s3Service: S3Service;

  constructor(private db: Pool) {
    this.s3Service = new S3Service();
  }

  /**
   * Create asset pack and upload files with enhanced Phase 1 processing
   * Target: <2 minutes total processing time
   */
  async createAssetPack(
    input: CreateAssetPackInput,
    files: Express.Multer.File[]
  ): Promise<ProcessedAssetPack> {
    const overallStartTime = Date.now();
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Create asset pack record
      const packResult = await client.query(
        `INSERT INTO asset_packs (
          campaign_id, uploaded_by, upload_method, client_notes, status, categorization_method
        ) VALUES ($1, $2, $3, $4, 'pending', 'extension-based')
        RETURNING *`,
        [
          input.campaign_id,
          input.uploaded_by,
          input.upload_method || 'portal',
          input.client_notes || null
        ]
      );

      const assetPack: AssetPack = packResult.rows[0];
      logger.info('Asset pack created', { assetPackId: assetPack.id, campaignId: input.campaign_id });

      // Process each file (with ZIP extraction)
      let totalSizeBytes = 0;
      let totalFilesCount = 0;
      const allFiles: Express.Multer.File[] = [];

      for (const file of files) {
        if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
          const extractedFiles = await this.extractZipFile(file);
          allFiles.push(...extractedFiles);
        } else {
          allFiles.push(file);
        }
      }

      logger.info('Files prepared for processing', {
        assetPackId: assetPack.id,
        totalFiles: allFiles.length
      });

      // Phase 1: Extension-based categorization (< 1 second for thousands of files)
      const categoryStatsStartTime = Date.now();
      const categoryStats = getCategoryStats(allFiles.map(f => f.originalname));
      const categoryStatsTime = Date.now() - categoryStatsStartTime;
      logger.info('Extension categorization complete', {
        assetPackId: assetPack.id,
        timeMs: categoryStatsTime,
        stats: categoryStats
      });

      // Phase 2: Upload files to S3 and create database records
      const uploadStartTime = Date.now();
      const uploadedFiles: AssetPackFile[] = [];

      for (const file of allFiles) {
        const uploadedFile = await this.uploadAndRecordFile(
          file,
          assetPack.id,
          input.campaign_id,
          client
        );
        uploadedFiles.push(uploadedFile);
        totalFilesCount++;
        totalSizeBytes += uploadedFile.file_size_bytes;
      }
      const uploadTime = Date.now() - uploadStartTime;
      logger.info('File upload complete', {
        assetPackId: assetPack.id,
        timeMs: uploadTime,
        files: totalFilesCount
      });

      // Phase 3: Logo detection and selective color extraction
      const logoStartTime = Date.now();
      const imageFiles = uploadedFiles.filter(f => f.category === 'images');
      const logoResults = await this.detectAndExtractLogos(
        imageFiles,
        assetPack.id,
        client
      );
      const logoTime = Date.now() - logoStartTime;
      logger.info('Logo detection complete', {
        assetPackId: assetPack.id,
        timeMs: logoTime,
        logosFound: logoResults.logoFiles.length,
        colorsExtracted: logoResults.brandColors.length
      });

      // Phase 4: Document scanning
      const docScanStartTime = Date.now();
      const documentFiles = uploadedFiles.filter(f => f.category === 'reference');
      const documentScans = await this.scanDocuments(documentFiles);
      const docScanTime = Date.now() - docScanStartTime;
      logger.info('Document scanning complete', {
        assetPackId: assetPack.id,
        timeMs: docScanTime,
        docsScanned: documentFiles.length
      });

      // Phase 5: Generate minimal brief
      const briefStartTime = Date.now();
      const sourceFiles = uploadedFiles
        .filter(f => f.category === 'source_files')
        .map(f => f.original_filename);

      const brief = generateMinimalBrief(
        input.campaign_id,
        categoryStats,
        logoResults.brandColors,
        documentScans,
        sourceFiles
      );

      // Populate logo files in brief
      if (brief.brandBasics && logoResults.logoFiles.length > 0) {
        brief.brandBasics.logoFiles = logoResults.logoFiles;
      }

      const briefTime = Date.now() - briefStartTime;
      logger.info('Brief generation complete', {
        assetPackId: assetPack.id,
        timeMs: briefTime
      });

      // Phase 6: Update suggested starting file
      if (brief.suggestedStartingFile) {
        await client.query(
          `UPDATE asset_pack_files
           SET suggested_starting_file = TRUE
           WHERE asset_pack_id = $1 AND original_filename = $2`,
          [assetPack.id, brief.suggestedStartingFile]
        );
      }

      // Update asset pack with all processing results
      const processingTimeMs = Date.now() - overallStartTime;
      const quickScanFlags = {
        logo_count: logoResults.logoFiles.length,
        brand_guidelines_found: !!identifyBrandGuidelines(documentScans),
        campaign_brief_found: !!identifyCampaignBrief(documentScans),
        category_stats: categoryStats
      };

      await client.query(
        `UPDATE asset_packs
         SET total_files = $1,
             total_size_bytes = $2,
             processing_time_ms = $3,
             quick_scan_flags = $4,
             brand_colors = $5,
             minimal_brief = $6,
             minimal_brief_json = $7
         WHERE id = $8`,
        [
          totalFilesCount,
          totalSizeBytes,
          processingTimeMs,
          JSON.stringify(quickScanFlags),
          JSON.stringify(logoResults.brandColors),
          formatBriefAsText(brief),
          JSON.stringify(brief),
          assetPack.id
        ]
      );

      await client.query('COMMIT');

      logger.info('Asset pack processing complete', {
        assetPackId: assetPack.id,
        totalProcessingTimeMs: processingTimeMs,
        breakdown: {
          categorization: categoryStatsTime,
          upload: uploadTime,
          logoDetection: logoTime,
          documentScan: docScanTime,
          briefGeneration: briefTime
        },
        targetMet: processingTimeMs < 120000 // <2 minutes
      });

      return {
        ...assetPack,
        total_files: totalFilesCount,
        total_size_bytes: totalSizeBytes,
        processing_time_ms: processingTimeMs,
        quick_scan_flags: quickScanFlags,
        brand_colors: logoResults.brandColors,
        minimal_brief: formatBriefAsText(brief),
        minimal_brief_json: brief,
        files: uploadedFiles,
        brief
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create asset pack', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Extract ZIP file contents
   */
  private async extractZipFile(zipFile: Express.Multer.File): Promise<Express.Multer.File[]> {
    try {
      const zip = new AdmZip(zipFile.buffer);
      const zipEntries = zip.getEntries();
      const extractedFiles: Express.Multer.File[] = [];

      logger.info('Extracting ZIP file', {
        filename: zipFile.originalname,
        entries: zipEntries.length
      });

      for (const entry of zipEntries) {
        // Skip directories and hidden files
        if (entry.isDirectory || entry.entryName.startsWith('.') || entry.entryName.includes('__MACOSX')) {
          continue;
        }

        const fileBuffer = entry.getData();
        const filename = path.basename(entry.entryName);
        const mimeType = this.getMimeTypeFromFilename(filename);

        const extractedFile: Express.Multer.File = {
          buffer: fileBuffer,
          originalname: filename,
          mimetype: mimeType,
          size: fileBuffer.length,
          fieldname: 'files',
          encoding: '7bit',
          stream: null as any,
          destination: '',
          filename: filename,
          path: ''
        };

        extractedFiles.push(extractedFile);
      }

      logger.info('ZIP extraction complete', {
        zipFilename: zipFile.originalname,
        extractedFiles: extractedFiles.length
      });

      return extractedFiles;
    } catch (error) {
      logger.error('Failed to extract ZIP file', { filename: zipFile.originalname, error });
      throw new Error(`Failed to extract ZIP file: ${zipFile.originalname}`);
    }
  }

  /**
   * Upload file to S3 and create database record with enhanced metadata
   */
  private async uploadAndRecordFile(
    file: Express.Multer.File,
    assetPackId: string,
    campaignId: string,
    client: any
  ): Promise<AssetPackFile> {
    try {
      // Upload to S3
      const s3Key = `campaigns/${campaignId}/asset-packs/${assetPackId}/${Date.now()}_${file.originalname}`;
      const s3Url = await this.s3Service.uploadFile(file.buffer, s3Key, file.mimetype);

      // Extension-based categorization
      const category = categorizeByExtension(file.originalname);

      // Insert file record (logo detection and other metadata will be updated separately)
      const result = await client.query(
        `INSERT INTO asset_pack_files (
          asset_pack_id, original_filename, s3_key, s3_url,
          file_size_bytes, mime_type, category, is_extracted_from_zip
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
        RETURNING *`,
        [
          assetPackId,
          file.originalname,
          s3Key,
          s3Url,
          file.size,
          file.mimetype,
          category
        ]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to upload file', { filename: file.originalname, error });
      throw error;
    }
  }

  /**
   * Detect logos and extract colors from top 3-5 candidates
   */
  private async detectAndExtractLogos(
    imageFiles: AssetPackFile[],
    assetPackId: string,
    client: any
  ): Promise<{ logoFiles: string[]; brandColors: any[] }> {
    if (imageFiles.length === 0) {
      return { logoFiles: [], brandColors: [] };
    }

    try {
      // Download image files from S3 for analysis
      const filesWithBuffers = await Promise.all(
        imageFiles.slice(0, 50).map(async (file) => {
          const buffer = await this.s3Service.downloadFile(file.s3_key);
          return {
            filename: file.original_filename,
            buffer,
            fileId: file.id
          };
        })
      );

      // Batch logo detection
      const logoResults = await batchDetectLogos(
        filesWithBuffers.map(f => ({ filename: f.filename, buffer: f.buffer }))
      );

      // Update database with logo detection results
      for (const result of logoResults) {
        const fileWithBuffer = filesWithBuffers.find(f => f.filename === result.filename);
        if (!fileWithBuffer) continue;

        await client.query(
          `UPDATE asset_pack_files
           SET is_likely_logo = $1,
               logo_confidence = $2,
               logo_detection_reasons = $3,
               dimensions = $4
           WHERE id = $5`,
          [
            result.result.isLikelyLogo,
            result.result.confidence,
            JSON.stringify(result.result.reasons),
            JSON.stringify(result.result.dimensions),
            fileWithBuffer.fileId
          ]
        );
      }

      // Select top 3-5 logos for color extraction
      const topLogoFilenames = selectTopLogos(logoResults, 5);
      const topLogoFilesWithBuffers = filesWithBuffers.filter(f =>
        topLogoFilenames.includes(f.filename)
      );

      if (topLogoFilesWithBuffers.length === 0) {
        return { logoFiles: [], brandColors: [] };
      }

      // Extract colors from top logos only (critical: max 5)
      const colorResults = await batchExtractColors(
        topLogoFilesWithBuffers.map(f => ({ filename: f.filename, buffer: f.buffer })),
        5
      );

      // Aggregate brand colors
      const brandColors = aggregateBrandColors(colorResults);

      logger.info('Logo color extraction complete', {
        assetPackId,
        logosAnalyzed: topLogoFilesWithBuffers.length,
        colorsExtracted: brandColors.length,
        processingTimes: colorResults.map(r => r.processingTimeMs)
      });

      return {
        logoFiles: topLogoFilenames,
        brandColors
      };
    } catch (error) {
      logger.error('Logo detection failed', { assetPackId, error });
      // Non-fatal error - continue without logo detection
      return { logoFiles: [], brandColors: [] };
    }
  }

  /**
   * Scan documents for keywords (no deep OCR)
   */
  private async scanDocuments(documentFiles: AssetPackFile[]): Promise<DocumentScanResult[]> {
    if (documentFiles.length === 0) {
      return [];
    }

    try {
      // Download documents from S3
      const docsWithBuffers = await Promise.all(
        documentFiles.map(async (file) => {
          const buffer = await this.s3Service.downloadFile(file.s3_key);
          const type = file.mime_type === 'application/pdf' ? 'pdf' : 'document';
          return {
            filename: file.original_filename,
            buffer,
            type: type as 'pdf' | 'document'
          };
        })
      );

      // Batch scan documents (keyword flagging only, no deep OCR)
      const scanResults = await batchScanDocuments(docsWithBuffers, false);

      logger.info('Document scanning complete', {
        docsScanned: documentFiles.length,
        brandGuidelinesFound: scanResults.filter(s => s.flaggedAs.includes('brand_guidelines')).length,
        campaignBriefFound: scanResults.filter(s => s.flaggedAs.includes('campaign_brief')).length
      });

      return scanResults;
    } catch (error) {
      logger.error('Document scanning failed', { error });
      // Non-fatal error - continue without document scans
      return [];
    }
  }

  /**
   * Get MIME type from filename extension
   */
  private getMimeTypeFromFilename(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.psd': 'image/vnd.adobe.photoshop',
      '.ai': 'application/postscript',
      '.indd': 'application/x-indesign',
      '.sketch': 'application/sketch',
      '.fig': 'application/figma',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.txt': 'text/plain',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm',
      '.ttf': 'font/ttf',
      '.otf': 'font/otf',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Get asset pack by ID with enhanced metadata
   */
  async getAssetPackById(assetPackId: string): Promise<AssetPack | null> {
    try {
      const result = await this.db.query(
        `SELECT * FROM asset_packs WHERE id = $1`,
        [assetPackId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get asset pack', { assetPackId, error });
      throw error;
    }
  }

  /**
   * Get asset packs for campaign
   */
  async getAssetPacksForCampaign(campaignId: string): Promise<AssetPack[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM asset_packs
         WHERE campaign_id = $1
         ORDER BY created_at DESC`,
        [campaignId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get asset packs for campaign', { campaignId, error });
      throw error;
    }
  }

  /**
   * Get files in asset pack with enhanced metadata
   */
  async getAssetPackFiles(assetPackId: string): Promise<AssetPackFile[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM asset_pack_files
         WHERE asset_pack_id = $1
         ORDER BY
           CASE
             WHEN suggested_starting_file = TRUE THEN 0
             WHEN is_likely_logo = TRUE THEN 1
             ELSE 2
           END,
           category, original_filename`,
        [assetPackId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get asset pack files', { assetPackId, error });
      throw error;
    }
  }

  /**
   * Approve asset pack (starts 48h SLA timer)
   */
  async approveAssetPack(assetPackId: string, reviewedBy: string): Promise<AssetPack> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE asset_packs
         SET status = 'approved',
             reviewed_by = $1,
             reviewed_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [reviewedBy, assetPackId]
      );

      if (result.rows.length === 0) {
        throw new Error('Asset pack not found');
      }

      const assetPack: AssetPack = result.rows[0];

      // Create 48-hour SLA timer for static mock production
      await client.query(
        `INSERT INTO sla_timers (
          reference_type, reference_id, duration_hours, started_at, status
        ) VALUES ('asset_pack_review', $1, 48, NOW(), 'active')`,
        [assetPackId]
      );

      // Update campaign phase
      await client.query(
        `UPDATE campaigns
         SET current_phase = 'static_mock_production'
         WHERE id = $1`,
        [assetPack.campaign_id]
      );

      await client.query('COMMIT');

      logger.info('Asset pack approved, 48h SLA started', {
        assetPackId,
        reviewedBy,
        campaignId: assetPack.campaign_id
      });

      return assetPack;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to approve asset pack', { assetPackId, error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject asset pack (MANDATORY rejection note required)
   */
  async rejectAssetPack(
    assetPackId: string,
    reviewedBy: string,
    rejectionNote: string
  ): Promise<AssetPack> {
    if (!rejectionNote || rejectionNote.trim().length === 0) {
      throw new Error('Rejection note is mandatory when rejecting asset pack');
    }

    try {
      const result = await this.db.query(
        `UPDATE asset_packs
         SET status = 'rejected',
             reviewed_by = $1,
             reviewed_at = NOW(),
             rejection_note = $2
         WHERE id = $3
         RETURNING *`,
        [reviewedBy, rejectionNote.trim(), assetPackId]
      );

      if (result.rows.length === 0) {
        throw new Error('Asset pack not found');
      }

      const assetPack: AssetPack = result.rows[0];

      logger.info('Asset pack rejected', {
        assetPackId,
        reviewedBy,
        rejectionNoteLength: rejectionNote.length
      });

      return assetPack;
    } catch (error) {
      logger.error('Failed to reject asset pack', { assetPackId, error });
      throw error;
    }
  }

  /**
   * Delete asset pack file
   */
  async deleteAssetPackFile(fileId: string): Promise<void> {
    try {
      // Get file details for S3 deletion
      const fileResult = await this.db.query(
        `SELECT s3_key FROM asset_pack_files WHERE id = $1`,
        [fileId]
      );

      if (fileResult.rows.length === 0) {
        throw new Error('File not found');
      }

      const s3Key = fileResult.rows[0].s3_key;

      // Delete from S3
      await this.s3Service.deleteFile(s3Key);

      // Delete from database
      await this.db.query(
        `DELETE FROM asset_pack_files WHERE id = $1`,
        [fileId]
      );

      logger.info('Asset pack file deleted', { fileId, s3Key });
    } catch (error) {
      logger.error('Failed to delete asset pack file', { fileId, error });
      throw error;
    }
  }
}

export default AssetPackService;
