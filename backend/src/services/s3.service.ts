/**
 * AWS S3 Service
 *
 * Handles file uploads, downloads, and management in AWS S3.
 * Supports presigned URLs for direct browser uploads.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { Logger } from '../utils/logger';

const logger = new Logger('S3Service');

interface UploadOptions {
  key: string;
  body: Buffer | Readable;
  contentType?: string;
  metadata?: Record<string, string>;
}

interface PresignedUrlOptions {
  key: string;
  contentType?: string;
  expiresIn?: number; // seconds
}

interface S3Config {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export class S3Service {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const config = this.getConfig();

    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    this.bucket = config.bucket;
    logger.info('S3 Service initialized', { bucket: this.bucket });
  }

  /**
   * Upload a file to S3
   */
  public async upload(options: UploadOptions): Promise<string> {
    const { key, body, contentType, metadata } = options;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      });

      await this.client.send(command);

      const url = `https://${this.bucket}.s3.amazonaws.com/${key}`;
      logger.info('File uploaded to S3', { key, url });

      return url;
    } catch (error) {
      logger.error('S3 upload failed', { key, error });
      throw error;
    }
  }

  /**
   * Download a file from S3
   */
  public async download(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('No body in S3 response');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as Readable) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      logger.debug('File downloaded from S3', { key, size: buffer.length });

      return buffer;
    } catch (error) {
      logger.error('S3 download failed', { key, error });
      throw error;
    }
  }

  /**
   * Delete a file from S3
   */
  public async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      logger.info('File deleted from S3', { key });
    } catch (error) {
      logger.error('S3 delete failed', { key, error });
      throw error;
    }
  }

  /**
   * Check if a file exists in S3
   */
  public async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata from S3
   */
  public async getMetadata(key: string): Promise<{
    contentType?: string;
    contentLength?: number;
    lastModified?: Date;
    metadata?: Record<string, string>;
  }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch (error) {
      logger.error('Failed to get S3 metadata', { key, error });
      throw error;
    }
  }

  /**
   * Generate presigned URL for upload
   */
  public async getUploadUrl(
    options: PresignedUrlOptions
  ): Promise<string> {
    const { key, contentType, expiresIn = 3600 } = options;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });

      logger.debug('Generated presigned upload URL', {
        key,
        expiresIn,
      });

      return url;
    } catch (error) {
      logger.error('Failed to generate presigned upload URL', { key, error });
      throw error;
    }
  }

  /**
   * Generate presigned URL for download
   */
  public async getDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });

      logger.debug('Generated presigned download URL', {
        key,
        expiresIn,
      });

      return url;
    } catch (error) {
      logger.error('Failed to generate presigned download URL', { key, error });
      throw error;
    }
  }

  /**
   * List files in a prefix
   */
  public async listFiles(prefix: string): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      });

      const response = await this.client.send(command);

      const keys = response.Contents?.map((obj) => obj.Key || '') || [];

      logger.debug('Listed S3 files', { prefix, count: keys.length });

      return keys;
    } catch (error) {
      logger.error('Failed to list S3 files', { prefix, error });
      throw error;
    }
  }

  /**
   * Generate S3 key for asset
   */
  public generateAssetKey(
    campaignId: string,
    packageId: string,
    filename: string
  ): string {
    // Format: campaigns/{campaignId}/packages/{packageId}/{filename}
    return `campaigns/${campaignId}/packages/${packageId}/${filename}`;
  }

  /**
   * Generate S3 key for thumbnail
   */
  public generateThumbnailKey(
    campaignId: string,
    packageId: string,
    filename: string
  ): string {
    // Format: campaigns/{campaignId}/packages/{packageId}/thumbnails/{filename}
    return `campaigns/${campaignId}/packages/${packageId}/thumbnails/${filename}`;
  }

  /**
   * Get S3 configuration from environment
   */
  private getConfig(): S3Config {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const bucket = process.env.S3_BUCKET;

    if (!region || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error(
        'Missing required S3 environment variables: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET'
      );
    }

    return {
      region,
      accessKeyId,
      secretAccessKey,
      bucket,
    };
  }
}

// Export singleton instance
export const s3Service = new S3Service();
