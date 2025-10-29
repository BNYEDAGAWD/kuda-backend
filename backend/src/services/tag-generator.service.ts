/**
 * Tag Generator Service
 *
 * Generates Celtra-integrated ad tags for approved creatives.
 * Auto-triggered on creative approval.
 */

import { Pool } from 'pg';
import axios from 'axios';
import { Logger } from '../utils/logger';

const logger = new Logger('TagGeneratorService');

// Types
export interface Creative {
  id: string;
  name: string;
  s3_file_url: string;
  landing_url?: string;
  demo_link?: string;
  dimensions?: string;
  creative_type: string;
}

export interface Campaign {
  id: string;
  name: string;
  default_landing_url?: string;
  celtra_integration_enabled: boolean;
  tracking_pixels?: Record<string, any>;
}

export interface GeneratedTag {
  id: string;
  creative_id: string;
  tag_type: string;
  tag_code: string;
  celtra_pixel_included: boolean;
  generated_by: string;
  generated_at: Date;
  version: number;
}

export class TagGeneratorService {
  private db: Pool;
  private celtraApiKey: string;
  private celtraApiUrl: string;

  constructor(db: Pool) {
    this.db = db;
    this.celtraApiKey = process.env.CELTRA_API_KEY || '';
    this.celtraApiUrl = process.env.CELTRA_API_URL || 'https://api.celtra.com';
  }

  /**
   * Generate tag for approved creative
   */
  async generateTag(
    creative: Creative,
    campaign: Campaign,
    generatedBy: string = 'system'
  ): Promise<string> {
    logger.info('Generating tag for creative', {
      creativeId: creative.id,
      creativeName: creative.name
    });

    let tagCode = '';

    if (campaign.celtra_integration_enabled && creative.demo_link) {
      // Generate tag with Celtra integration
      tagCode = await this.generateCeltraTag(creative, campaign);
    } else {
      // Generate basic tag without Celtra
      tagCode = this.generateBasicTag(creative, campaign);
    }

    // Save generated tag to database
    await this.saveTag(
      creative.id,
      campaign.celtra_integration_enabled ? 'celtra' : 'custom',
      tagCode,
      campaign.celtra_integration_enabled,
      generatedBy
    );

    // Mark creative as having generated tags
    await this.db.query(
      'UPDATE creatives SET tags_generated = true WHERE id = $1',
      [creative.id]
    );

    logger.info('Tag generated successfully', { creativeId: creative.id });

    return tagCode;
  }

  /**
   * Generate basic ad tag (no Celtra)
   */
  private generateBasicTag(creative: Creative, campaign: Campaign): string {
    const landingUrl = creative.landing_url || campaign.default_landing_url || '';
    const width = creative.dimensions?.split('x')[0] || '';
    const height = creative.dimensions?.split('x')[1] || '';

    const trackingPixel = campaign.tracking_pixels?.kargo
      ? `<img src="${campaign.tracking_pixels.kargo}?creative=${creative.id}&campaign=${campaign.id}" width="1" height="1" style="display:none" />`
      : '';

    if (creative.creative_type === 'video') {
      // Video tag
      return `
<!-- BEGIN CREATIVE TAG: ${creative.name} -->
<video width="${width}" height="${height}" controls>
  <source src="${creative.s3_file_url}" type="video/mp4">
  Your browser does not support the video tag.
</video>
${trackingPixel}
<!-- END CREATIVE TAG -->
      `.trim();
    } else {
      // Display tag (image)
      return `
<!-- BEGIN CREATIVE TAG: ${creative.name} -->
<a href="${landingUrl}" target="_blank">
  <img src="${creative.s3_file_url}" width="${width}" height="${height}" alt="${creative.name}" />
</a>
${trackingPixel}
<!-- END CREATIVE TAG -->
      `.trim();
    }
  }

  /**
   * Generate Celtra-integrated ad tag
   */
  private async generateCeltraTag(creative: Creative, campaign: Campaign): Promise<string> {
    try {
      // Fetch Celtra measurement pixel
      const celtraPixel = await this.getCeltraPixel(creative.demo_link!);

      const landingUrl = creative.landing_url || campaign.default_landing_url || '';
      const width = creative.dimensions?.split('x')[0] || '';
      const height = creative.dimensions?.split('x')[1] || '';

      return `
<!-- BEGIN CREATIVE TAG: ${creative.name} (Celtra-enabled) -->
<a href="${landingUrl}" target="_blank">
  <img src="${creative.s3_file_url}" width="${width}" height="${height}" alt="${creative.name}" />
</a>

<!-- Celtra Measurement Pixel -->
${celtraPixel}

<!-- Kargo Tracking -->
<img src="https://tracking.kargo.com/impression?creative=${creative.id}&campaign=${campaign.id}" width="1" height="1" style="display:none" />
<!-- END CREATIVE TAG -->
      `.trim();
    } catch (error) {
      logger.error('Failed to fetch Celtra pixel, falling back to basic tag', {
        error,
        creativeId: creative.id
      });
      return this.generateBasicTag(creative, campaign);
    }
  }

  /**
   * Fetch Celtra measurement pixel from API
   */
  private async getCeltraPixel(demoLink: string): Promise<string> {
    if (!this.celtraApiKey) {
      logger.warn('Celtra API key not configured, skipping pixel fetch');
      return '';
    }

    try {
      const response = await axios.get(`${this.celtraApiUrl}/pixel`, {
        params: {
          demo_link: demoLink
        },
        headers: {
          'Authorization': `Bearer ${this.celtraApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      return response.data.pixel || '';
    } catch (error: any) {
      logger.error('Failed to fetch Celtra pixel from API', {
        error: error.message,
        demoLink
      });
      return '';
    }
  }

  /**
   * Save generated tag to database
   */
  private async saveTag(
    creativeId: string,
    tagType: string,
    tagCode: string,
    celtraPixelIncluded: boolean,
    generatedBy: string
  ): Promise<void> {
    // Get current version
    const versionResult = await this.db.query(
      'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM generated_tags WHERE creative_id = $1',
      [creativeId]
    );

    const nextVersion = versionResult.rows[0].next_version;

    await this.db.query(
      `INSERT INTO generated_tags (
        creative_id, tag_type, tag_code, celtra_pixel_included,
        generated_by, version
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [creativeId, tagType, tagCode, celtraPixelIncluded, generatedBy, nextVersion]
    );
  }

  /**
   * Get latest tag for creative
   */
  async getLatestTag(creativeId: string): Promise<GeneratedTag | null> {
    const result = await this.db.query(
      `SELECT * FROM generated_tags
       WHERE creative_id = $1
       ORDER BY version DESC
       LIMIT 1`,
      [creativeId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all tag versions for creative
   */
  async getTagVersions(creativeId: string): Promise<GeneratedTag[]> {
    const result = await this.db.query(
      `SELECT * FROM generated_tags
       WHERE creative_id = $1
       ORDER BY version DESC`,
      [creativeId]
    );

    return result.rows;
  }

  /**
   * Regenerate tag for creative
   */
  async regenerateTag(
    creativeId: string,
    generatedBy: string
  ): Promise<string> {
    // Get creative and campaign details
    const creativeResult = await this.db.query(
      `SELECT c.*, cmp.*
       FROM creatives c
       JOIN campaigns cmp ON c.campaign_id = cmp.id
       WHERE c.id = $1`,
      [creativeId]
    );

    if (creativeResult.rows.length === 0) {
      throw new Error('Creative not found');
    }

    const row = creativeResult.rows[0];
    const creative: Creative = {
      id: row.id,
      name: row.name,
      s3_file_url: row.s3_file_url,
      landing_url: row.landing_url,
      demo_link: row.demo_link,
      dimensions: row.dimensions,
      creative_type: row.creative_type
    };

    const campaign: Campaign = {
      id: row.campaign_id,
      name: row.name,
      default_landing_url: row.default_landing_url,
      celtra_integration_enabled: row.celtra_integration_enabled,
      tracking_pixels: row.tracking_pixels
    };

    return this.generateTag(creative, campaign, generatedBy);
  }
}

export default TagGeneratorService;
