/**
 * Campaign Service
 *
 * Handles campaign management and client portal link generation.
 * Core workflow: Kargo AM creates campaign → System generates secure portal link → Client uploads assets
 */

import crypto from 'crypto';
import { Pool } from 'pg';
import { Logger } from '../utils/logger';

const logger = new Logger('CampaignService');

// Types
export interface CampaignInput {
  name: string;
  client_name: string;
  client_email: string;
  kargo_account_manager_email: string;
  start_date?: Date;
  end_date?: Date;
  budget?: number;
  celtra_integration_enabled?: boolean;
  default_landing_url?: string;
  tracking_pixels?: Record<string, any>;
}

export interface Campaign {
  id: string;
  name: string;
  client_name: string;
  kargo_account_manager_email: string;
  start_date?: Date;
  end_date?: Date;
  budget?: number;
  status: string;
  celtra_integration_enabled: boolean;
  default_landing_url?: string;
  tracking_pixels?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export interface PortalToken {
  id: string;
  campaign_id: string;
  token: string;
  client_email: string;
  expires_at: Date;
  created_at: Date;
}

export interface CampaignWithPortal {
  campaign: Campaign;
  portalUrl: string;
  portalToken: string;
  expiresAt: Date;
}

export class CampaignService {
  private db: Pool;
  private frontendUrl: string;
  private tokenExpiryDays: number;

  constructor(db: Pool) {
    this.db = db;
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    this.tokenExpiryDays = parseInt(process.env.CLIENT_PORTAL_TOKEN_EXPIRY_DAYS || '30');
  }

  /**
   * Create a new campaign and generate client portal link
   */
  async createCampaignWithPortal(data: CampaignInput, createdBy?: string): Promise<CampaignWithPortal> {
    logger.info('Creating campaign with portal link', { campaignName: data.name });

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // 1. Create campaign
      const campaignResult = await client.query(
        `INSERT INTO campaigns (
          name, client_name, kargo_account_manager_email,
          start_date, end_date, budget, status,
          celtra_integration_enabled, default_landing_url,
          tracking_pixels, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          data.name,
          data.client_name,
          data.kargo_account_manager_email,
          data.start_date || null,
          data.end_date || null,
          data.budget || null,
          'draft', // Start as draft
          data.celtra_integration_enabled !== false, // Default true
          data.default_landing_url || null,
          JSON.stringify(data.tracking_pixels || {}),
          createdBy || null
        ]
      );

      const campaign = campaignResult.rows[0];

      // 2. Generate secure portal token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.tokenExpiryDays);

      const tokenResult = await client.query(
        `INSERT INTO client_portal_tokens (
          campaign_id, token, client_email, expires_at
        ) VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [campaign.id, token, data.client_email, expiresAt]
      );

      await client.query('COMMIT');

      const portalUrl = `${this.frontendUrl}/portal/${token}`;

      logger.info('Campaign created with portal link', {
        campaignId: campaign.id,
        portalUrl,
        expiresAt
      });

      return {
        campaign,
        portalUrl,
        portalToken: token,
        expiresAt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create campaign with portal', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get campaign by ID
   */
  async getCampaignById(id: string): Promise<Campaign | null> {
    const result = await this.db.query(
      'SELECT * FROM campaigns WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * List all campaigns with optional filters
   */
  async listCampaigns(filters?: {
    status?: string;
    kargo_account_manager_email?: string;
    client_name?: string;
  }): Promise<Campaign[]> {
    let query = 'SELECT * FROM campaigns WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (filters?.status) {
      query += ` AND status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    if (filters?.kargo_account_manager_email) {
      query += ` AND kargo_account_manager_email = $${paramCount}`;
      params.push(filters.kargo_account_manager_email);
      paramCount++;
    }

    if (filters?.client_name) {
      query += ` AND client_name ILIKE $${paramCount}`;
      params.push(`%${filters.client_name}%`);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Update campaign
   */
  async updateCampaign(id: string, updates: Partial<CampaignInput>): Promise<Campaign> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramCount}`);
      params.push(updates.name);
      paramCount++;
    }

    if (updates.client_name !== undefined) {
      setClauses.push(`client_name = $${paramCount}`);
      params.push(updates.client_name);
      paramCount++;
    }

    if (updates.kargo_account_manager_email !== undefined) {
      setClauses.push(`kargo_account_manager_email = $${paramCount}`);
      params.push(updates.kargo_account_manager_email);
      paramCount++;
    }

    if (updates.start_date !== undefined) {
      setClauses.push(`start_date = $${paramCount}`);
      params.push(updates.start_date);
      paramCount++;
    }

    if (updates.end_date !== undefined) {
      setClauses.push(`end_date = $${paramCount}`);
      params.push(updates.end_date);
      paramCount++;
    }

    if (updates.budget !== undefined) {
      setClauses.push(`budget = $${paramCount}`);
      params.push(updates.budget);
      paramCount++;
    }

    if (updates.celtra_integration_enabled !== undefined) {
      setClauses.push(`celtra_integration_enabled = $${paramCount}`);
      params.push(updates.celtra_integration_enabled);
      paramCount++;
    }

    if (updates.default_landing_url !== undefined) {
      setClauses.push(`default_landing_url = $${paramCount}`);
      params.push(updates.default_landing_url);
      paramCount++;
    }

    if (updates.tracking_pixels !== undefined) {
      setClauses.push(`tracking_pixels = $${paramCount}`);
      params.push(JSON.stringify(updates.tracking_pixels));
      paramCount++;
    }

    if (setClauses.length === 0) {
      throw new Error('No fields to update');
    }

    params.push(id);

    const result = await this.db.query(
      `UPDATE campaigns SET ${setClauses.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error('Campaign not found');
    }

    logger.info('Campaign updated', { campaignId: id });

    return result.rows[0];
  }

  /**
   * Update campaign status
   */
  async updateCampaignStatus(id: string, status: 'draft' | 'active' | 'completed' | 'archived'): Promise<Campaign> {
    const result = await this.db.query(
      'UPDATE campaigns SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      throw new Error('Campaign not found');
    }

    logger.info('Campaign status updated', { campaignId: id, status });

    return result.rows[0];
  }

  /**
   * Generate new portal link for existing campaign
   */
  async regeneratePortalLink(campaignId: string, clientEmail: string): Promise<CampaignWithPortal> {
    const campaign = await this.getCampaignById(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Invalidate old tokens (mark as used)
      await client.query(
        `UPDATE client_portal_tokens
         SET used_at = NOW()
         WHERE campaign_id = $1 AND client_email = $2 AND used_at IS NULL`,
        [campaignId, clientEmail]
      );

      // Generate new token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.tokenExpiryDays);

      await client.query(
        `INSERT INTO client_portal_tokens (
          campaign_id, token, client_email, expires_at
        ) VALUES ($1, $2, $3, $4)`,
        [campaignId, token, clientEmail, expiresAt]
      );

      await client.query('COMMIT');

      const portalUrl = `${this.frontendUrl}/portal/${token}`;

      logger.info('Portal link regenerated', { campaignId, portalUrl });

      return {
        campaign,
        portalUrl,
        portalToken: token,
        expiresAt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to regenerate portal link', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get active portal token for campaign
   */
  async getActivePortalToken(campaignId: string): Promise<PortalToken | null> {
    const result = await this.db.query(
      `SELECT * FROM client_portal_tokens
       WHERE campaign_id = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [campaignId]
    );

    return result.rows[0] || null;
  }

  /**
   * Delete campaign (soft delete by archiving)
   */
  async deleteCampaign(id: string): Promise<void> {
    await this.updateCampaignStatus(id, 'archived');
    logger.info('Campaign archived', { campaignId: id });
  }
}

export default CampaignService;
