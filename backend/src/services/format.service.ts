/**
 * Format Service
 *
 * Manages the library of 21 Kargo high-impact ad formats.
 * Provides format metadata including device support for portal UX.
 */

import { Pool } from 'pg';
import { Logger } from '../utils/logger';

const logger = new Logger('FormatService');

export interface Format {
  id: string;
  format_name: string;
  format_type: 'video' | 'display' | 'ctv';
  device_support: 'cross-platform' | 'mobile-only' | 'ctv-only';
  devices: string[];  // ["desktop", "mobile", "tablet"] or ["mobile"] or ["ctv"]
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class FormatService {
  constructor(private db: Pool) {}

  /**
   * Get all active formats from library
   */
  async getAllFormats(): Promise<Format[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM format_library
         WHERE is_active = true
         ORDER BY format_name ASC`
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get all formats', error);
      throw new Error('Failed to retrieve format library');
    }
  }

  /**
   * Get formats filtered by type
   */
  async getFormatsByType(type: 'video' | 'display' | 'ctv'): Promise<Format[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM format_library
         WHERE is_active = true AND format_type = $1
         ORDER BY format_name ASC`,
        [type]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get formats by type', { type, error });
      throw new Error(`Failed to retrieve ${type} formats`);
    }
  }

  /**
   * Get formats filtered by device support
   */
  async getFormatsByDeviceSupport(
    deviceSupport: 'cross-platform' | 'mobile-only' | 'ctv-only'
  ): Promise<Format[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM format_library
         WHERE is_active = true AND device_support = $1
         ORDER BY format_name ASC`,
        [deviceSupport]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get formats by device support', { deviceSupport, error });
      throw new Error(`Failed to retrieve ${deviceSupport} formats`);
    }
  }

  /**
   * Get single format by ID
   */
  async getFormatById(formatId: string): Promise<Format | null> {
    try {
      const result = await this.db.query(
        `SELECT * FROM format_library WHERE id = $1`,
        [formatId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get format by ID', { formatId, error });
      throw new Error('Failed to retrieve format');
    }
  }

  /**
   * Get single format by name
   */
  async getFormatByName(formatName: string): Promise<Format | null> {
    try {
      const result = await this.db.query(
        `SELECT * FROM format_library WHERE format_name = $1`,
        [formatName]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get format by name', { formatName, error });
      throw new Error('Failed to retrieve format');
    }
  }

  /**
   * Get supported devices for a format
   * Returns array of device strings
   */
  async getDevicesForFormat(formatId: string): Promise<string[]> {
    try {
      const format = await this.getFormatById(formatId);

      if (!format) {
        throw new Error('Format not found');
      }

      return format.devices;
    } catch (error) {
      logger.error('Failed to get devices for format', { formatId, error });
      throw error;
    }
  }

  /**
   * Check if format supports a specific device
   */
  async formatSupportsDevice(formatId: string, device: string): Promise<boolean> {
    try {
      const devices = await this.getDevicesForFormat(formatId);
      return devices.includes(device);
    } catch (error) {
      logger.error('Failed to check device support', { formatId, device, error });
      throw error;
    }
  }

  /**
   * Get formats grouped by type
   * Useful for frontend format selector
   */
  async getFormatsGroupedByType(): Promise<{
    video: Format[];
    display: Format[];
    ctv: Format[];
  }> {
    try {
      const allFormats = await this.getAllFormats();

      return {
        video: allFormats.filter(f => f.format_type === 'video'),
        display: allFormats.filter(f => f.format_type === 'display'),
        ctv: allFormats.filter(f => f.format_type === 'ctv')
      };
    } catch (error) {
      logger.error('Failed to get formats grouped by type', error);
      throw new Error('Failed to retrieve grouped formats');
    }
  }

  /**
   * Get format library statistics
   * Useful for admin dashboard
   */
  async getFormatLibraryStats(): Promise<{
    total: number;
    byType: { video: number; display: number; ctv: number };
    byDeviceSupport: { crossPlatform: number; mobileOnly: number; ctvOnly: number };
  }> {
    try {
      const result = await this.db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE format_type = 'video') as video_count,
          COUNT(*) FILTER (WHERE format_type = 'display') as display_count,
          COUNT(*) FILTER (WHERE format_type = 'ctv') as ctv_count,
          COUNT(*) FILTER (WHERE device_support = 'cross-platform') as cross_platform_count,
          COUNT(*) FILTER (WHERE device_support = 'mobile-only') as mobile_only_count,
          COUNT(*) FILTER (WHERE device_support = 'ctv-only') as ctv_only_count
        FROM format_library
        WHERE is_active = true
      `);

      const stats = result.rows[0];

      return {
        total: parseInt(stats.total) || 0,
        byType: {
          video: parseInt(stats.video_count) || 0,
          display: parseInt(stats.display_count) || 0,
          ctv: parseInt(stats.ctv_count) || 0
        },
        byDeviceSupport: {
          crossPlatform: parseInt(stats.cross_platform_count) || 0,
          mobileOnly: parseInt(stats.mobile_only_count) || 0,
          ctvOnly: parseInt(stats.ctv_only_count) || 0
        }
      };
    } catch (error) {
      logger.error('Failed to get format library stats', error);
      throw new Error('Failed to retrieve format statistics');
    }
  }

  /**
   * Search formats by name (case-insensitive)
   * Useful for frontend autocomplete/search
   */
  async searchFormats(query: string): Promise<Format[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM format_library
         WHERE is_active = true
           AND LOWER(format_name) LIKE LOWER($1)
         ORDER BY format_name ASC`,
        [`%${query}%`]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to search formats', { query, error });
      throw new Error('Failed to search formats');
    }
  }

  /**
   * Get recommended demo URL parameter for device
   * Helps AM construct demo.kargo.com URLs
   */
  getDeviceViewParameter(device: string): string {
    const deviceMap: { [key: string]: string } = {
      'desktop': 'desktop',
      'mobile': 'mobile',
      'tablet': 'tablet',
      'ctv': 'ctv'
    };

    return deviceMap[device.toLowerCase()] || 'desktop';
  }

  /**
   * Validate format and device combination
   * Throws error if device not supported for format
   */
  async validateFormatDevice(formatId: string, device: string): Promise<void> {
    const isSupported = await this.formatSupportsDevice(formatId, device);

    if (!isSupported) {
      const format = await this.getFormatById(formatId);
      throw new Error(
        `Device "${device}" is not supported for format "${format?.format_name}". ` +
        `Supported devices: ${format?.devices.join(', ')}`
      );
    }
  }
}

export default FormatService;
