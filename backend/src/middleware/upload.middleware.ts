/**
 * File Upload Middleware
 *
 * Handles multipart/form-data file uploads using Multer.
 * Supports individual files and ZIP archives.
 */

import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import path from 'path';
import { Logger } from '../utils/logger';

const logger = new Logger('UploadMiddleware');

// Allowed file types for upload
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/tiff',
  // Videos
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
  // Documents
  'application/pdf',
  'application/postscript', // .ai, .eps
  // Design files (by extension)
  'application/octet-stream', // .psd, .aep, .prproj, .sketch
  // Fonts
  'font/ttf',
  'font/otf',
  'font/woff',
  'font/woff2',
  'application/font-woff',
  'application/font-woff2',
  'application/x-font-ttf',
  'application/x-font-otf',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  // Text
  'text/plain',
];

// Allowed file extensions (for design files with generic MIME types)
const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.tiff',
  '.mp4',
  '.webm',
  '.mov',
  '.avi',
  '.pdf',
  '.psd',
  '.ai',
  '.eps',
  '.aep',
  '.prproj',
  '.sketch',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.zip',
  '.rar',
  '.txt',
];

// Maximum file size: 500MB
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// Maximum files per upload: 100
const MAX_FILES = 100;

/**
 * Multer storage configuration (memory storage for processing)
 */
const storage = multer.memoryStorage();

/**
 * File filter to validate file types
 */
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();

  // Check MIME type
  if (ALLOWED_MIME_TYPES.includes(mimeType)) {
    cb(null, true);
    return;
  }

  // Check extension (for design files with generic MIME types)
  if (ALLOWED_EXTENSIONS.includes(extension)) {
    logger.debug('File allowed by extension', {
      filename: file.originalname,
      extension,
      mimeType,
    });
    cb(null, true);
    return;
  }

  // Reject file
  const error = new Error(
    `File type not allowed: ${file.originalname} (${mimeType}, ${extension})`
  );
  logger.warn('File rejected', {
    filename: file.originalname,
    mimeType,
    extension,
  });
  cb(error as any);
};

/**
 * Multer upload configuration
 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
});

/**
 * Single file upload middleware
 */
export const uploadSingle = upload.single('file');

/**
 * Multiple files upload middleware
 */
export const uploadMultiple = upload.array('files', MAX_FILES);

/**
 * Handle multer errors
 */
export const handleUploadErrors = (
  error: any,
  req: Request,
  res: any,
  next: any
): void => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({
          error: 'File too large',
          message: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(413).json({
          error: 'Too many files',
          message: `Maximum ${MAX_FILES} files allowed`,
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          error: 'Unexpected file field',
          message: error.message,
        });
      default:
        return res.status(400).json({
          error: 'Upload error',
          message: error.message,
        });
    }
  }

  if (error) {
    logger.error('Upload error', error);
    return res.status(400).json({
      error: 'Upload failed',
      message: error.message,
    });
  }

  next();
};
