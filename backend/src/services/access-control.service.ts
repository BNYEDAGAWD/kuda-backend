/**
 * Access Control Service - Three-Tier KUDA Access Model
 *
 * Implements the three-tier access control system:
 * - Kuda Ocean: Full platform control (AMs, designers, engineers)
 * - Kuda River: Client approval interface (client stakeholders)
 * - Kuda Minnow: View-only access (observers, stakeholders)
 */

import { Pool, PoolClient } from 'pg';
import { Logger } from '../utils/logger';

const logger = new Logger('AccessControlService');

export type AccessTier = 'kuda_ocean' | 'kuda_river' | 'kuda_minnow';

export interface CampaignAccess {
  id: string;
  campaign_id: string;
  user_email: string;
  access_tier: AccessTier;
  granted_by: string;
  granted_at: Date;
  revoked_at: Date | null;
  is_active: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface GrantAccessInput {
  campaign_id: string;
  user_email: string;
  access_tier: AccessTier;
  granted_by: string;
  notes?: string;
}

export interface AccessPermissions {
  can_view_campaign: boolean;
  can_upload_assets: boolean;
  can_approve_assets: boolean;
  can_reject_assets: boolean;
  can_upload_deliverables: boolean;
  can_approve_deliverables: boolean;
  can_reject_deliverables: boolean;
  can_grant_access: boolean;
  can_revoke_access: boolean;
  can_override_smart_timing: boolean;
  can_send_manual_email: boolean;
  can_view_email_threads: boolean;
  can_reply_to_threads: boolean;
  can_edit_changelogs: boolean;
}

export class AccessControlService {
  constructor(private db: Pool) {}

  /**
   * Grant access to a campaign for a user
   */
  async grantAccess(input: GrantAccessInput): Promise<CampaignAccess> {
    try {
      // Check if access already exists
      const existing = await this.getUserAccess(input.campaign_id, input.user_email);

      if (existing && existing.is_active) {
        // Update existing access tier if different
        if (existing.access_tier !== input.access_tier) {
          return await this.updateAccessTier(
            existing.id,
            input.access_tier,
            input.granted_by
          );
        }
        return existing;
      }

      // Grant new access
      const result = await this.db.query<CampaignAccess>(
        `INSERT INTO campaign_access (
          campaign_id, user_email, access_tier, granted_by, notes
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [
          input.campaign_id,
          input.user_email.toLowerCase(),
          input.access_tier,
          input.granted_by,
          input.notes || null
        ]
      );

      const access = result.rows[0];
      logger.info('Access granted', {
        campaignId: input.campaign_id,
        userEmail: input.user_email,
        tier: input.access_tier,
        grantedBy: input.granted_by
      });

      return access;
    } catch (error) {
      logger.error('Failed to grant access', { input, error });
      throw error;
    }
  }

  /**
   * Batch grant access to multiple users
   */
  async batchGrantAccess(
    campaign_id: string,
    grants: Array<{
      user_email: string;
      access_tier: AccessTier;
      notes?: string;
    }>,
    granted_by: string
  ): Promise<CampaignAccess[]> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      const results: CampaignAccess[] = [];

      for (const grant of grants) {
        const access = await this.grantAccess({
          campaign_id,
          user_email: grant.user_email,
          access_tier: grant.access_tier,
          granted_by,
          notes: grant.notes
        });
        results.push(access);
      }

      await client.query('COMMIT');

      logger.info('Batch access granted', {
        campaignId: campaign_id,
        count: grants.length,
        grantedBy: granted_by
      });

      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Batch grant access failed', { campaign_id, error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Revoke access for a user
   */
  async revokeAccess(
    campaign_id: string,
    user_email: string,
    revoked_by: string
  ): Promise<void> {
    try {
      await this.db.query(
        `UPDATE campaign_access
         SET is_active = FALSE,
             revoked_at = CURRENT_TIMESTAMP,
             notes = COALESCE(notes || ' | ', '') || 'Revoked by: ' || $3
         WHERE campaign_id = $1 AND user_email = $2 AND is_active = TRUE`,
        [campaign_id, user_email.toLowerCase(), revoked_by]
      );

      logger.info('Access revoked', {
        campaignId: campaign_id,
        userEmail: user_email,
        revokedBy: revoked_by
      });
    } catch (error) {
      logger.error('Failed to revoke access', {
        campaign_id,
        user_email,
        error
      });
      throw error;
    }
  }

  /**
   * Update access tier for existing access
   */
  async updateAccessTier(
    access_id: string,
    new_tier: AccessTier,
    updated_by: string
  ): Promise<CampaignAccess> {
    try {
      const result = await this.db.query<CampaignAccess>(
        `UPDATE campaign_access
         SET access_tier = $1,
             notes = COALESCE(notes || ' | ', '') || 'Tier updated by: ' || $2
         WHERE id = $3
         RETURNING *`,
        [new_tier, updated_by, access_id]
      );

      if (result.rows.length === 0) {
        throw new Error('Access record not found');
      }

      const access = result.rows[0];
      logger.info('Access tier updated', {
        accessId: access_id,
        newTier: new_tier,
        updatedBy: updated_by
      });

      return access;
    } catch (error) {
      logger.error('Failed to update access tier', { access_id, new_tier, error });
      throw error;
    }
  }

  /**
   * Get user's access for a campaign
   */
  async getUserAccess(
    campaign_id: string,
    user_email: string
  ): Promise<CampaignAccess | null> {
    try {
      const result = await this.db.query<CampaignAccess>(
        `SELECT * FROM campaign_access
         WHERE campaign_id = $1 AND user_email = $2 AND is_active = TRUE
         LIMIT 1`,
        [campaign_id, user_email.toLowerCase()]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get user access', { campaign_id, user_email, error });
      throw error;
    }
  }

  /**
   * Get all users with access to a campaign
   */
  async getCampaignAccess(
    campaign_id: string,
    tier_filter?: AccessTier
  ): Promise<CampaignAccess[]> {
    try {
      const query = tier_filter
        ? `SELECT * FROM campaign_access
           WHERE campaign_id = $1 AND access_tier = $2 AND is_active = TRUE
           ORDER BY granted_at DESC`
        : `SELECT * FROM campaign_access
           WHERE campaign_id = $1 AND is_active = TRUE
           ORDER BY access_tier, granted_at DESC`;

      const params = tier_filter ? [campaign_id, tier_filter] : [campaign_id];

      const result = await this.db.query<CampaignAccess>(query, params);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get campaign access', { campaign_id, error });
      throw error;
    }
  }

  /**
   * Check if user has required access tier
   */
  async hasAccessTier(
    campaign_id: string,
    user_email: string,
    required_tier: AccessTier | AccessTier[]
  ): Promise<boolean> {
    try {
      const access = await this.getUserAccess(campaign_id, user_email);

      if (!access) {
        return false;
      }

      const required_tiers = Array.isArray(required_tier) ? required_tier : [required_tier];
      return required_tiers.includes(access.access_tier);
    } catch (error) {
      logger.error('Failed to check access tier', {
        campaign_id,
        user_email,
        required_tier,
        error
      });
      return false;
    }
  }

  /**
   * Get full permissions for user on campaign
   */
  async getUserPermissions(
    campaign_id: string,
    user_email: string
  ): Promise<AccessPermissions> {
    try {
      const access = await this.getUserAccess(campaign_id, user_email);

      if (!access) {
        return this.getNoAccessPermissions();
      }

      switch (access.access_tier) {
        case 'kuda_ocean':
          return this.getKudaOceanPermissions();
        case 'kuda_river':
          return this.getKudaRiverPermissions();
        case 'kuda_minnow':
          return this.getKudaMinnowPermissions();
        default:
          return this.getNoAccessPermissions();
      }
    } catch (error) {
      logger.error('Failed to get user permissions', {
        campaign_id,
        user_email,
        error
      });
      return this.getNoAccessPermissions();
    }
  }

  /**
   * Kuda Ocean permissions (full control)
   */
  private getKudaOceanPermissions(): AccessPermissions {
    return {
      can_view_campaign: true,
      can_upload_assets: true,
      can_approve_assets: true,
      can_reject_assets: true,
      can_upload_deliverables: true,
      can_approve_deliverables: true,
      can_reject_deliverables: true,
      can_grant_access: true,
      can_revoke_access: true,
      can_override_smart_timing: true,
      can_send_manual_email: true,
      can_view_email_threads: true,
      can_reply_to_threads: true,
      can_edit_changelogs: true
    };
  }

  /**
   * Kuda River permissions (client approval)
   */
  private getKudaRiverPermissions(): AccessPermissions {
    return {
      can_view_campaign: true,
      can_upload_assets: false,
      can_approve_assets: false,
      can_reject_assets: false,
      can_upload_deliverables: false,
      can_approve_deliverables: true, // Client can approve final deliverables
      can_reject_deliverables: true, // Client can reject and request changes
      can_grant_access: false,
      can_revoke_access: false,
      can_override_smart_timing: false,
      can_send_manual_email: false,
      can_view_email_threads: true,
      can_reply_to_threads: true, // Client can reply to email threads
      can_edit_changelogs: false
    };
  }

  /**
   * Kuda Minnow permissions (view-only)
   */
  private getKudaMinnowPermissions(): AccessPermissions {
    return {
      can_view_campaign: true,
      can_upload_assets: false,
      can_approve_assets: false,
      can_reject_assets: false,
      can_upload_deliverables: false,
      can_approve_deliverables: false,
      can_reject_deliverables: false,
      can_grant_access: false,
      can_revoke_access: false,
      can_override_smart_timing: false,
      can_send_manual_email: false,
      can_view_email_threads: true,
      can_reply_to_threads: true, // Can reply but no platform updates
      can_edit_changelogs: false
    };
  }

  /**
   * No access permissions
   */
  private getNoAccessPermissions(): AccessPermissions {
    return {
      can_view_campaign: false,
      can_upload_assets: false,
      can_approve_assets: false,
      can_reject_assets: false,
      can_upload_deliverables: false,
      can_approve_deliverables: false,
      can_reject_deliverables: false,
      can_grant_access: false,
      can_revoke_access: false,
      can_override_smart_timing: false,
      can_send_manual_email: false,
      can_view_email_threads: false,
      can_reply_to_threads: false,
      can_edit_changelogs: false
    };
  }

  /**
   * Get access statistics for a campaign
   */
  async getCampaignAccessStats(campaign_id: string): Promise<{
    total_users: number;
    ocean_users: number;
    river_users: number;
    minnow_users: number;
    recently_granted: number;
    recently_revoked: number;
  }> {
    try {
      const result = await this.db.query(
        `SELECT
          COUNT(*) FILTER (WHERE is_active = TRUE) as total_users,
          COUNT(*) FILTER (WHERE is_active = TRUE AND access_tier = 'kuda_ocean') as ocean_users,
          COUNT(*) FILTER (WHERE is_active = TRUE AND access_tier = 'kuda_river') as river_users,
          COUNT(*) FILTER (WHERE is_active = TRUE AND access_tier = 'kuda_minnow') as minnow_users,
          COUNT(*) FILTER (WHERE granted_at >= CURRENT_DATE - INTERVAL '7 days' AND is_active = TRUE) as recently_granted,
          COUNT(*) FILTER (WHERE revoked_at >= CURRENT_DATE - INTERVAL '7 days' AND is_active = FALSE) as recently_revoked
         FROM campaign_access
         WHERE campaign_id = $1`,
        [campaign_id]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get access stats', { campaign_id, error });
      throw error;
    }
  }
}

export default AccessControlService;
