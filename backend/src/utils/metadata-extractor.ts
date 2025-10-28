/**
 * Metadata Extractor Utility
 *
 * Extracts metadata from various file types:
 * - Images: Sharp library
 * - Videos: FFmpeg (via fluent-ffmpeg)
 * - PDFs: pdf-parse
 */

import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import pdf from 'pdf-parse';
import { Logger } from './logger';
import { Readable } from 'stream';

const logger = new Logger('MetadataExtractor');

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  hasAlpha: boolean; // Transparency
  space: string; // Color space
  channels: number;
  size: number; // File size in bytes
}

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number; // Seconds
  format: string;
  codec: string;
  frameRate: number;
  bitrate: number;
  size: number; // File size in bytes
}

export interface PDFMetadata {
  pageCount: number;
  title?: string;
  author?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  size: number; // File size in bytes
}

export interface GenericMetadata {
  size: number;
  mimeType?: string;
}

export class MetadataExtractor {
  /**
   * Extract metadata from image file
   */
  public static async extractImageMetadata(
    buffer: Buffer
  ): Promise<ImageMetadata> {
    try {
      const metadata = await sharp(buffer).metadata();

      if (!metadata.width || !metadata.height || !metadata.format) {
        throw new Error('Invalid image metadata');
      }

      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        hasAlpha: metadata.hasAlpha || false,
        space: metadata.space || 'srgb',
        channels: metadata.channels || 3,
        size: buffer.length,
      };
    } catch (error) {
      logger.error('Failed to extract image metadata', error);
      throw error;
    }
  }

  /**
   * Extract metadata from video file
   */
  public static async extractVideoMetadata(
    buffer: Buffer,
    tempFilePath?: string
  ): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      try {
        // FFmpeg requires a file path, so we need to write to temp file
        // In production, this could be optimized with stream processing
        if (!tempFilePath) {
          throw new Error('Temp file path required for video metadata extraction');
        }

        ffmpeg.ffprobe(tempFilePath, (err, metadata) => {
          if (err) {
            logger.error('FFprobe failed', err);
            return reject(err);
          }

          const videoStream = metadata.streams.find(
            (s) => s.codec_type === 'video'
          );

          if (!videoStream) {
            return reject(new Error('No video stream found'));
          }

          resolve({
            width: videoStream.width || 0,
            height: videoStream.height || 0,
            duration: metadata.format.duration || 0,
            format: metadata.format.format_name || 'unknown',
            codec: videoStream.codec_name || 'unknown',
            frameRate: this.parseFrameRate(videoStream.r_frame_rate),
            bitrate: parseInt(metadata.format.bit_rate || '0'),
            size: buffer.length,
          });
        });
      } catch (error) {
        logger.error('Failed to extract video metadata', error);
        reject(error);
      }
    });
  }

  /**
   * Extract metadata from PDF file
   */
  public static async extractPDFMetadata(
    buffer: Buffer
  ): Promise<PDFMetadata> {
    try {
      const data = await pdf(buffer);

      return {
        pageCount: data.numpages,
        title: data.info?.Title,
        author: data.info?.Author,
        creator: data.info?.Creator,
        producer: data.info?.Producer,
        creationDate: data.info?.CreationDate
          ? new Date(data.info.CreationDate)
          : undefined,
        size: buffer.length,
      };
    } catch (error) {
      logger.error('Failed to extract PDF metadata', error);
      throw error;
    }
  }

  /**
   * Check if file is an image
   */
  public static isImage(filename: string, mimeType?: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.tiff'];
    const imageMimeTypes = ['image/'];

    const ext = filename.toLowerCase().split('.').pop();
    return (
      imageExtensions.includes(`.${ext}`) ||
      (mimeType ? imageMimeTypes.some((type) => mimeType.startsWith(type)) : false)
    );
  }

  /**
   * Check if file is a video
   */
  public static isVideo(filename: string, mimeType?: string): boolean {
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi'];
    const videoMimeTypes = ['video/'];

    const ext = filename.toLowerCase().split('.').pop();
    return (
      videoExtensions.includes(`.${ext}`) ||
      (mimeType ? videoMimeTypes.some((type) => mimeType.startsWith(type)) : false)
    );
  }

  /**
   * Check if file is a PDF
   */
  public static isPDF(filename: string, mimeType?: string): boolean {
    const ext = filename.toLowerCase().split('.').pop();
    return ext === 'pdf' || mimeType === 'application/pdf';
  }

  /**
   * Check if file is a PSD (Photoshop)
   */
  public static isPSD(filename: string): boolean {
    const ext = filename.toLowerCase().split('.').pop();
    return ext === 'psd';
  }

  /**
   * Parse frame rate from FFmpeg format (e.g., "30000/1001")
   */
  private static parseFrameRate(frameRate?: string): number {
    if (!frameRate) return 0;

    if (frameRate.includes('/')) {
      const [num, den] = frameRate.split('/').map(Number);
      return num / den;
    }

    return parseFloat(frameRate);
  }

  /**
   * Generate thumbnail from image
   */
  public static async generateImageThumbnail(
    buffer: Buffer,
    width: number = 300,
    height: number = 300
  ): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch (error) {
      logger.error('Failed to generate image thumbnail', error);
      throw error;
    }
  }

  /**
   * Generate thumbnail from video (first frame)
   */
  public static async generateVideoThumbnail(
    tempFilePath: string,
    outputPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(tempFilePath)
        .screenshots({
          count: 1,
          folder: outputPath,
          filename: 'thumbnail.jpg',
          size: '300x?',
        })
        .on('end', () => resolve())
        .on('error', (err) => {
          logger.error('Failed to generate video thumbnail', err);
          reject(err);
        });
    });
  }
}
