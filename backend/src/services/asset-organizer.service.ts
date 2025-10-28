/**
 * Asset Organizer Service
 *
 * Intelligent file categorization, organization, and metadata extraction
 * for the Creative Approval System's Digital Asset Management capabilities.
 *
 * Features:
 * - Auto-categorization using taxonomy rules
 * - Metadata extraction (dimensions, transparency, layers, duration)
 * - Thumbnail generation for images and videos
 * - Duplicate detection via file hashing
 * - Search tag generation
 * - Organized path determination
 */

import crypto from 'crypto';
import path from 'path';
import { Pool } from 'pg';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Interfaces
interface UploadedFile {
  originalFilename: string;
  s3Key: string;
  mimeType: string;
  size: number;
  folderPath?: string;
  buffer?: Buffer; // For processing
}

interface TaxonomyRule {
  pattern: string;
  mimeTypePattern?: string;
  category: string;
  subcategory?: string;
  suggestedFolder: string;
  autoTags: string[];
  isFinalCreative: boolean;
  priority: number;
  confidenceBoost: number;
}

interface FileCategory {
  category: string;
  subcategory?: string;
  suggestedFolder: string;
  confidence: number;
  isFinalCreative: boolean;
  tags: string[];
}

interface FileMetadata {
  dimensions?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  colorSpace?: string;
  hasTransparency?: boolean;
  hasLayers?: boolean;
  layerCount?: number;
  dpi?: number;
  codec?: string;
  bitrate?: number;
  frameRate?: number;
  [key: string]: any;
}

export class AssetOrganizerService {
  private db: Pool;
  private s3: S3Client;
  private taxonomyRules: TaxonomyRule[] = [];

  constructor(db: Pool, s3: S3Client) {
    this.db = db;
    this.s3 = s3;
  }

  /**
   * Initialize the service by loading taxonomy rules from database
   */
  async initialize(): Promise<void> {
    const result = await this.db.query(`
      SELECT pattern, mime_type_pattern, category, subcategory,
             suggested_folder, auto_tags, is_final_creative,
             priority, confidence_boost
      FROM file_taxonomy_rules
      WHERE active = true
      ORDER BY priority DESC
    `);

    this.taxonomyRules = result.rows.map(row => ({
      pattern: row.pattern,
      mimeTypePattern: row.mime_type_pattern,
      category: row.category,
      subcategory: row.subcategory,
      suggestedFolder: row.suggested_folder,
      autoTags: row.auto_tags || [],
      isFinalCreative: row.is_final_creative,
      priority: row.priority,
      confidenceBoost: row.confidence_boost || 0
    }));

    console.log(`Loaded ${this.taxonomyRules.length} taxonomy rules`);
  }

  /**
   * Process an entire asset package
   */
  async processAssetPackage(
    packageId: string,
    campaignId: string,
    files: UploadedFile[]
  ): Promise<void> {
    console.log(`Processing asset package ${packageId} with ${files.length} files`);

    // Update package status to processing
    await this.db.query(
      `UPDATE asset_packages
       SET status = 'processing', processing_started_at = NOW()
       WHERE id = $1`,
      [packageId]
    );

    let processedCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        await this.processIndividualAsset(packageId, campaignId, file);
        processedCount++;
      } catch (error) {
        console.error(`Error processing file ${file.originalFilename}:`, error);
        errorCount++;

        // Log failed asset
        await this.db.query(
          `INSERT INTO assets (
            package_id, campaign_id, original_filename, s3_file_key,
            file_size_bytes, mime_type, processing_status, processing_error
          ) VALUES ($1, $2, $3, $4, $5, $6, 'failed', $7)`,
          [
            packageId,
            campaignId,
            file.originalFilename,
            file.s3Key,
            file.size,
            file.mimeType,
            error.message
          ]
        );
      }
    }

    // Calculate package statistics
    const stats = await this.db.query(
      `SELECT
        COUNT(*) as total_files,
        SUM(file_size_bytes) as total_size,
        COUNT(*) FILTER (WHERE is_final_creative = true) as final_count,
        COUNT(*) FILTER (WHERE is_final_creative = false) as source_count
       FROM assets
       WHERE package_id = $1 AND processing_status = 'ready'`,
      [packageId]
    );

    const { total_files, total_size, final_count, source_count } = stats.rows[0];

    // Update package with final statistics
    await this.db.query(
      `UPDATE asset_packages
       SET status = $1,
           processing_completed_at = NOW(),
           total_files = $2,
           total_size_bytes = $3,
           final_creative_count = $4,
           source_file_count = $5
       WHERE id = $6`,
      [
        errorCount === 0 ? 'ready' : 'ready', // Still mark as ready even with some errors
        total_files,
        total_size,
        final_count,
        source_count,
        packageId
      ]
    );

    console.log(`Package ${packageId} processed: ${processedCount} success, ${errorCount} errors`);
  }

  /**
   * Process a single asset file
   */
  private async processIndividualAsset(
    packageId: string,
    campaignId: string,
    file: UploadedFile
  ): Promise<string> {
    console.log(`Processing asset: ${file.originalFilename}`);

    // 1. Categorize file
    const category = await this.categorizeFile(file);

    // 2. Generate organized filename
    const organizedFilename = this.generateOrganizedFilename(file, category);

    // 3. Extract metadata
    const metadata = await this.extractFileMetadata(file);

    // 4. Generate file hash (for duplicate detection)
    const fileHash = await this.generateFileHash(file);

    // 5. Generate thumbnail
    const thumbnailUrl = await this.generateThumbnail(file, metadata);

    // 6. Generate search tags
    const tags = this.generateSearchTags(file, category, metadata);

    // 7. Determine organized path
    const organizedPath = this.determineOrganizedPath(category, metadata);

    // 8. Get file extension
    const fileExtension = this.getFileExtension(file.originalFilename);

    // 9. Insert asset into database
    const result = await this.db.query(
      `INSERT INTO assets (
        package_id, campaign_id, original_filename, organized_filename,
        file_category, file_subcategory, confidence_score,
        s3_file_key, file_size_bytes, mime_type, file_extension, file_hash,
        dimensions, width, height, duration_seconds, color_space,
        has_transparency, has_layers, layer_count, dpi,
        folder_path, organized_path, tags,
        is_final_creative, approval_status,
        thumbnail_url, processing_status, extracted_metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27, 'ready', $28
      ) RETURNING id`,
      [
        packageId,
        campaignId,
        file.originalFilename,
        organizedFilename,
        category.category,
        category.subcategory,
        category.confidence,
        file.s3Key,
        file.size,
        file.mimeType,
        fileExtension,
        fileHash,
        metadata.dimensions,
        metadata.width,
        metadata.height,
        metadata.durationSeconds,
        metadata.colorSpace,
        metadata.hasTransparency,
        metadata.hasLayers,
        metadata.layerCount,
        metadata.dpi,
        file.folderPath,
        organizedPath,
        tags,
        category.isFinalCreative,
        category.isFinalCreative ? 'pending' : 'not_applicable',
        thumbnailUrl,
        JSON.stringify(metadata)
      ]
    );

    const assetId = result.rows[0].id;
    console.log(`Asset ${file.originalFilename} processed successfully (${assetId})`);

    return assetId;
  }

  /**
   * Categorize file based on taxonomy rules
   */
  private async categorizeFile(file: UploadedFile): Promise<FileCategory> {
    let bestMatch: FileCategory | null = null;
    let highestPriority = -1;

    for (const rule of this.taxonomyRules) {
      // Check filename pattern
      const regex = new RegExp(rule.pattern, 'i');
      const filenameMatches = regex.test(file.originalFilename);

      // Check MIME type if specified
      let mimeMatches = true;
      if (rule.mimeTypePattern) {
        const mimeRegex = new RegExp(rule.mimeTypePattern, 'i');
        mimeMatches = mimeRegex.test(file.mimeType);
      }

      if (filenameMatches && mimeMatches && rule.priority > highestPriority) {
        bestMatch = {
          category: rule.category,
          subcategory: rule.subcategory,
          suggestedFolder: rule.suggestedFolder,
          confidence: 0.85 + rule.confidenceBoost, // Base confidence for regex match
          isFinalCreative: rule.isFinalCreative,
          tags: [...rule.autoTags]
        };
        highestPriority = rule.priority;
      }
    }

    // Fallback to MIME type categorization
    if (!bestMatch) {
      bestMatch = this.categorizeByMimeType(file.mimeType);
    }

    return bestMatch;
  }

  /**
   * Fallback categorization based on MIME type
   */
  private categorizeByMimeType(mimeType: string): FileCategory {
    if (mimeType.startsWith('image/')) {
      return {
        category: 'image',
        subcategory: 'generic_image',
        suggestedFolder: 'images/uncategorized',
        confidence: 0.50,
        isFinalCreative: false,
        tags: ['image', 'uncategorized']
      };
    } else if (mimeType.startsWith('video/')) {
      return {
        category: 'video_creative',
        subcategory: 'video',
        suggestedFolder: 'video/uncategorized',
        confidence: 0.60,
        isFinalCreative: true, // Videos are usually final creatives
        tags: ['video', 'uncategorized']
      };
    } else if (mimeType === 'application/pdf') {
      return {
        category: 'document',
        subcategory: 'pdf',
        suggestedFolder: 'documents',
        confidence: 0.50,
        isFinalCreative: false,
        tags: ['document', 'pdf']
      };
    } else if (mimeType.startsWith('application/')) {
      return {
        category: 'document',
        subcategory: 'generic',
        suggestedFolder: 'documents',
        confidence: 0.40,
        isFinalCreative: false,
        tags: ['document']
      };
    } else {
      return {
        category: 'other',
        subcategory: 'unknown',
        suggestedFolder: 'other',
        confidence: 0.30,
        isFinalCreative: false,
        tags: ['uncategorized']
      };
    }
  }

  /**
   * Generate organized filename with consistent naming
   */
  private generateOrganizedFilename(
    file: UploadedFile,
    category: FileCategory
  ): string {
    // Extract dimensions if present
    const dimensionMatch = file.originalFilename.match(/(\d+)x(\d+)/i);
    const dimensions = dimensionMatch ? `${dimensionMatch[1]}x${dimensionMatch[2]}` : '';

    // Extract version if present
    const versionMatch = file.originalFilename.match(/v(\d+)/i);
    const version = versionMatch ? `v${versionMatch[1]}` : 'v1';

    // Clean filename (remove special chars, lowercase)
    const baseName = path.basename(file.originalFilename, path.extname(file.originalFilename))
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .toLowerCase();

    const extension = this.getFileExtension(file.originalFilename);

    // Construct organized name based on category
    if (category.category === 'display_creative' && dimensions) {
      return `${category.subcategory}_${dimensions}_${version}.${extension}`;
    } else if (category.category === 'video_creative') {
      const durationMatch = file.originalFilename.match(/(\d+)s/i);
      const duration = durationMatch ? `${durationMatch[1]}s` : '';
      return `video_${duration}_${version}.${extension}`;
    } else if (category.category === 'source_file') {
      return `${baseName}_source.${extension}`;
    } else {
      return `${baseName}.${extension}`;
    }
  }

  /**
   * Extract file metadata (dimensions, transparency, etc.)
   *
   * NOTE: This is a placeholder implementation. In production, you would use:
   * - Sharp for image processing
   * - FFmpeg/FFprobe for video processing
   * - PSD.js for Photoshop file parsing
   */
  private async extractFileMetadata(file: UploadedFile): Promise<FileMetadata> {
    const metadata: FileMetadata = {};

    // Image metadata extraction
    if (file.mimeType.startsWith('image/')) {
      // TODO: Implement with Sharp
      // const sharp = require('sharp');
      // const s3Object = await this.s3.send(new GetObjectCommand({ ... }));
      // const imageMetadata = await sharp(buffer).metadata();

      // For now, extract from filename
      const dimensionMatch = file.originalFilename.match(/(\d+)x(\d+)/i);
      if (dimensionMatch) {
        metadata.width = parseInt(dimensionMatch[1]);
        metadata.height = parseInt(dimensionMatch[2]);
        metadata.dimensions = `${metadata.width}x${metadata.height}`;
      }

      // Check for transparency indicators in filename
      if (file.originalFilename.toLowerCase().includes('transparent') ||
          file.originalFilename.toLowerCase().includes('alpha') ||
          file.mimeType === 'image/png') {
        metadata.hasTransparency = true;
      }

      // Check for layered file formats
      if (file.originalFilename.endsWith('.psd') ||
          file.originalFilename.endsWith('.ai')) {
        metadata.hasLayers = true;
      }
    }

    // Video metadata extraction
    else if (file.mimeType.startsWith('video/')) {
      // TODO: Implement with FFprobe
      // const ffprobe = require('fluent-ffmpeg').ffprobe;
      // const videoInfo = await promisify(ffprobe)(file.s3Key);

      // For now, extract from filename
      const dimensionMatch = file.originalFilename.match(/(\d+)x(\d+)/i);
      if (dimensionMatch) {
        metadata.width = parseInt(dimensionMatch[1]);
        metadata.height = parseInt(dimensionMatch[2]);
        metadata.dimensions = `${metadata.width}x${metadata.height}`;
      }

      // Extract duration from filename (e.g., "video_15s.mp4")
      const durationMatch = file.originalFilename.match(/(\d+)s/i);
      if (durationMatch) {
        metadata.durationSeconds = parseInt(durationMatch[1]);
      }
    }

    return metadata;
  }

  /**
   * Generate file hash for duplicate detection
   */
  private async generateFileHash(file: UploadedFile): Promise<string> {
    // TODO: In production, download file from S3 and hash it
    // For now, hash the S3 key + size as a simple unique identifier
    const hash = crypto
      .createHash('sha256')
      .update(file.s3Key + file.size.toString())
      .digest('hex');

    return hash;
  }

  /**
   * Generate thumbnail for preview
   *
   * NOTE: Placeholder implementation. Use Sharp for images, FFmpeg for videos.
   */
  private async generateThumbnail(
    file: UploadedFile,
    metadata: FileMetadata
  ): Promise<string | null> {
    // Image thumbnail
    if (file.mimeType.startsWith('image/')) {
      // TODO: Implement with Sharp
      // const thumbnail = await sharp(buffer)
      //   .resize(400, 400, { fit: 'inside' })
      //   .jpeg({ quality: 80 })
      //   .toBuffer();

      // For now, return the original file URL as thumbnail
      return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${file.s3Key}`;
    }

    // Video thumbnail
    else if (file.mimeType.startsWith('video/')) {
      // TODO: Implement with FFmpeg to extract frame at 1 second
      // For now, return null (no thumbnail)
      return null;
    }

    // PDF thumbnail
    else if (file.mimeType === 'application/pdf') {
      // TODO: Implement with pdf-thumbnail or similar
      return null;
    }

    return null;
  }

  /**
   * Generate search tags for asset discovery
   */
  private generateSearchTags(
    file: UploadedFile,
    category: FileCategory,
    metadata: FileMetadata
  ): string[] {
    const tags: string[] = [...category.tags];

    // Add category tags
    tags.push(category.category);
    if (category.subcategory) {
      tags.push(category.subcategory);
    }

    // Add dimension tags
    if (metadata.dimensions) {
      tags.push(metadata.dimensions);
      tags.push(`size_${metadata.dimensions}`);
    }

    // Add file type tags
    const extension = this.getFileExtension(file.originalFilename);
    tags.push(extension);
    tags.push(file.mimeType.split('/')[0]); // image, video, etc.

    // Add filename keywords (words longer than 2 chars)
    const keywords = file.originalFilename
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .filter(word => word.length > 2)
      .map(word => word.toLowerCase());

    tags.push(...keywords);

    // Add special feature tags
    if (metadata.hasTransparency) tags.push('transparent', 'alpha');
    if (metadata.hasLayers) tags.push('layered', 'editable');
    if (file.originalFilename.toLowerCase().includes('final')) tags.push('final');
    if (file.originalFilename.toLowerCase().includes('draft')) tags.push('draft');
    if (file.originalFilename.toLowerCase().includes('source')) tags.push('source');

    // Remove duplicates and return
    return [...new Set(tags)];
  }

  /**
   * Determine organized folder path
   */
  private determineOrganizedPath(
    category: FileCategory,
    metadata: FileMetadata
  ): string {
    let basePath = category.suggestedFolder;

    // Add dimension-based sub-folder for display creatives
    if (category.category === 'display_creative' && metadata.dimensions) {
      basePath = `${basePath}/${metadata.dimensions}`;
    }

    // Add duration-based sub-folder for video creatives
    if (category.category === 'video_creative' && metadata.durationSeconds) {
      basePath = `${basePath}/${metadata.durationSeconds}s`;
    }

    return basePath;
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    return ext.startsWith('.') ? ext.substring(1) : ext;
  }

  /**
   * Search assets by query
   */
  async searchAssets(
    campaignId: string,
    query: string,
    filters?: {
      category?: string;
      isFinalCreative?: boolean;
      dimensions?: string;
    }
  ): Promise<any[]> {
    let sql = `
      SELECT id, original_filename, organized_filename, file_category,
             file_subcategory, dimensions, thumbnail_url, tags,
             is_final_creative, approval_status, created_at
      FROM assets
      WHERE campaign_id = $1
        AND processing_status = 'ready'
    `;

    const params: any[] = [campaignId];
    let paramCount = 1;

    // Text search in filename and tags
    if (query) {
      paramCount++;
      sql += ` AND (
        original_filename ILIKE $${paramCount}
        OR organized_filename ILIKE $${paramCount}
        OR $${paramCount} = ANY(tags)
      )`;
      params.push(`%${query}%`);
    }

    // Category filter
    if (filters?.category) {
      paramCount++;
      sql += ` AND file_category = $${paramCount}`;
      params.push(filters.category);
    }

    // Final creative filter
    if (filters?.isFinalCreative !== undefined) {
      paramCount++;
      sql += ` AND is_final_creative = $${paramCount}`;
      params.push(filters.isFinalCreative);
    }

    // Dimensions filter
    if (filters?.dimensions) {
      paramCount++;
      sql += ` AND dimensions = $${paramCount}`;
      params.push(filters.dimensions);
    }

    sql += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await this.db.query(sql, params);
    return result.rows;
  }
}

export default AssetOrganizerService;
