/**
 * Portal Auth Service
 *
 * Handles client portal token validation and access tracking.
 * Enables secure, token-based client uploads without login.
 */

import { Pool } from 'pg';
import { Logger } from '../utils/logger';

const logger = new Logger('PortalAuthService');

// Types
export interface PortalToken {
  id: string;
  campaign_id: string;
  token: string;
  client_email: string;
  expires_at: Date;
  used_at?: Date;
  last_accessed_at?: Date;
  access_count: number;
  created_at: Date;
}

export interface Campaign {
  id: string;
  name: string;
  client_name: string;
  kargo_account_manager_email: string;
  status: string;
  celtra_integration_enabled: boolean;
  default_landing_url?: string;
}

export interface PortalSession {
  campaign: Campaign;
  token: PortalToken;
  isValid: boolean;
  isExpired: boolean;
}

export class PortalAuthService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Validate portal token and return campaign details
   */
  async validateToken(token: string): Promise<PortalSession> {
    logger.info('Validating portal token', { token: token.substring(0, 8) + '...' });

    // Get token details
    const tokenResult = await this.db.query(
      'SELECT * FROM client_portal_tokens WHERE token = $1',
      [token]
    );

    if (tokenResult.rows.length === 0) {
      logger.warn('Invalid token', { token: token.substring(0, 8) + '...' });
      throw new Error('Invalid or expired portal link');
    }

    const portalToken: PortalToken = tokenResult.rows[0];

    // Check if token is expired
    const now = new Date();
    const isExpired = new Date(portalToken.expires_at) < now;

    if (isExpired) {
      logger.warn('Expired token', {
        token: token.substring(0, 8) + '...',
        expiresAt: portalToken.expires_at
      });
      throw new Error('This portal link has expired. Please contact your Kargo account manager for a new link.');
    }

    // Get campaign details
    const campaignResult = await this.db.query(
      'SELECT * FROM campaigns WHERE id = $1',
      [portalToken.campaign_id]
    );

    if (campaignResult.rows.length === 0) {
      logger.error('Campaign not found for valid token', {
        campaignId: portalToken.campaign_id
      });
      throw new Error('Campaign not found');
    }

    const campaign: Campaign = campaignResult.rows[0];

    // Update token access tracking
    await this.updateTokenAccess(token);

    logger.info('Token validated successfully', {
      token: token.substring(0, 8) + '...',
      campaignId: campaign.id,
      campaignName: campaign.name
    });

    return {
      campaign,
      token: portalToken,
      isValid: true,
      isExpired: false
    };
  }

  /**
   * Update token access tracking
   */
  async updateTokenAccess(token: string): Promise<void> {
    await this.db.query(
      `UPDATE client_portal_tokens
       SET last_accessed_at = NOW(),
           access_count = access_count + 1,
           used_at = COALESCE(used_at, NOW())
       WHERE token = $1`,
      [token]
    );
  }

  /**
   * Check if token is expired
   */
  async isTokenExpired(token: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT expires_at FROM client_portal_tokens WHERE token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return true; // Invalid token is considered expired
    }

    const expiresAt = new Date(result.rows[0].expires_at);
    const now = new Date();

    return expiresAt < now;
  }

  /**
   * Get token details
   */
  async getTokenDetails(token: string): Promise<PortalToken | null> {
    const result = await this.db.query(
      'SELECT * FROM client_portal_tokens WHERE token = $1',
      [token]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all tokens for a campaign
   */
  async getCampaignTokens(campaignId: string): Promise<PortalToken[]> {
    const result = await this.db.query(
      'SELECT * FROM client_portal_tokens WHERE campaign_id = $1 ORDER BY created_at DESC',
      [campaignId]
    );

    return result.rows;
  }

  /**
   * Revoke token (mark as used)
   */
  async revokeToken(token: string): Promise<void> {
    await this.db.query(
      'UPDATE client_portal_tokens SET used_at = NOW() WHERE token = $1',
      [token]
    );

    logger.info('Token revoked', { token: token.substring(0, 8) + '...' });
  }

  /**
   * Check if user can upload to campaign
   */
  async canUpload(token: string): Promise<boolean> {
    try {
      const session = await this.validateToken(token);

      // Check if campaign is in a state that accepts uploads
      if (session.campaign.status === 'archived' || session.campaign.status === 'completed') {
        logger.warn('Cannot upload to archived/completed campaign', {
          campaignId: session.campaign.id,
          status: session.campaign.status
        });
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get campaign by token
   */
  async getCampaignByToken(token: string): Promise<Campaign | null> {
    const tokenResult = await this.db.query(
      'SELECT campaign_id FROM client_portal_tokens WHERE token = $1',
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return null;
    }

    const campaignResult = await this.db.query(
      'SELECT * FROM campaigns WHERE id = $1',
      [tokenResult.rows[0].campaign_id]
    );

    return campaignResult.rows[0] || null;
  }
}

export default PortalAuthService;
