/**
 * ZIP Extractor Utility
 *
 * Extracts files from ZIP archives.
 * Returns array of extracted files with their original folder structure.
 */

import AdmZip from 'adm-zip';
import { Logger } from './logger';

const logger = new Logger('ZipExtractor');

export interface ExtractedFile {
  filename: string;
  originalPath: string; // Path within ZIP (e.g., "folder/file.jpg")
  buffer: Buffer;
  size: number;
}

export class ZipExtractor {
  /**
   * Extract all files from a ZIP buffer
   */
  public static async extractFiles(
    zipBuffer: Buffer,
    zipFilename: string
  ): Promise<ExtractedFile[]> {
    try {
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();

      const files: ExtractedFile[] = [];

      for (const entry of entries) {
        // Skip directories
        if (entry.isDirectory) {
          continue;
        }

        // Skip hidden files and __MACOSX folder
        if (
          entry.entryName.startsWith('__MACOSX') ||
          entry.entryName.includes('/.') ||
          entry.entryName.startsWith('.')
        ) {
          logger.debug('Skipping hidden file', { path: entry.entryName });
          continue;
        }

        // Extract file data
        const buffer = entry.getData();

        // Get just the filename (last part of path)
        const filename = entry.entryName.split('/').pop() || entry.entryName;

        files.push({
          filename,
          originalPath: entry.entryName,
          buffer,
          size: buffer.length,
        });

        logger.debug('Extracted file from ZIP', {
          filename,
          originalPath: entry.entryName,
          size: buffer.length,
        });
      }

      logger.info('ZIP extraction complete', {
        zipFilename,
        totalFiles: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
      });

      return files;
    } catch (error) {
      logger.error('ZIP extraction failed', { zipFilename, error });
      throw new Error(`Failed to extract ZIP file: ${error}`);
    }
  }

  /**
   * Check if a file is a ZIP archive
   */
  public static isZipFile(filename: string, mimeType?: string): boolean {
    const extension = filename.toLowerCase().split('.').pop();
    const zipMimeTypes = [
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream',
    ];

    return (
      extension === 'zip' ||
      (mimeType ? zipMimeTypes.includes(mimeType) : false)
    );
  }

  /**
   * Get ZIP file info without extracting
   */
  public static getZipInfo(zipBuffer: Buffer): {
    fileCount: number;
    totalSize: number;
    files: string[];
  } {
    try {
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries().filter((e) => !e.isDirectory);

      return {
        fileCount: entries.length,
        totalSize: entries.reduce((sum, e) => sum + e.header.size, 0),
        files: entries.map((e) => e.entryName),
      };
    } catch (error) {
      logger.error('Failed to get ZIP info', error);
      throw error;
    }
  }
}
