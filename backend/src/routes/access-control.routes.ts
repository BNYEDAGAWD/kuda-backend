/**
 * Access Control Routes - KUDA Phase 2
 *
 * Endpoints for managing campaign access (grant, revoke, update tiers)
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { Logger } from '../utils/logger';
import { AccessControlService, AccessTier } from '../services/access-control.service';
import { createAccessControlMiddleware } from '../middleware/access-control.middleware';

const logger = new Logger('AccessControlRoutes');

export function createAccessControlRoutes(db: Pool): Router {
  const router = Router();
  const accessControl = new AccessControlService(db);
  const middleware = createAccessControlMiddleware(db);

  /**
   * POST /api/campaigns/:campaign_id/access/grant
   * Grant access to a user (Kuda Ocean only)
   */
  router.post(
    '/:campaign_id/access/grant',
    middleware.requirePermission('can_grant_access'),
    async (req, res) => {
      try {
        const { campaign_id } = req.params;
        const { user_email, access_tier, notes } = req.body;

        if (!user_email || !access_tier) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'user_email and access_tier are required'
          });
        }

        const access = await accessControl.grantAccess({
          campaign_id,
          user_email,
          access_tier: access_tier as AccessTier,
          granted_by: req.user!.email,
          notes
        });

        logger.info('Access granted', {
          campaignId: campaign_id,
          userEmail: user_email,
          accessTier: access_tier,
          grantedBy: req.user!.email
        });

        res.status(201).json({
          success: true,
          access
        });
      } catch (error) {
        logger.error('Failed to grant access', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to grant access'
        });
      }
    }
  );

  /**
   * POST /api/campaigns/:campaign_id/access/batch-grant
   * Grant access to multiple users (Kuda Ocean only)
   */
  router.post(
    '/:campaign_id/access/batch-grant',
    middleware.requirePermission('can_grant_access'),
    async (req, res) => {
      try {
        const { campaign_id } = req.params;
        const { users } = req.body;

        if (!Array.isArray(users) || users.length === 0) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'users array is required'
          });
        }

        const access_list = await accessControl.batchGrantAccess({
          campaign_id,
          users: users.map(u => ({
            user_email: u.user_email,
            access_tier: u.access_tier as AccessTier,
            notes: u.notes
          })),
          granted_by: req.user!.email
        });

        logger.info('Batch access granted', {
          campaignId: campaign_id,
          userCount: users.length,
          grantedBy: req.user!.email
        });

        res.status(201).json({
          success: true,
          access_list,
          count: access_list.length
        });
      } catch (error) {
        logger.error('Failed to batch grant access', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to batch grant access'
        });
      }
    }
  );

  /**
   * DELETE /api/campaigns/:campaign_id/access/:user_email
   * Revoke access from a user (Kuda Ocean only)
   */
  router.delete(
    '/:campaign_id/access/:user_email',
    middleware.requirePermission('can_revoke_access'),
    async (req, res) => {
      try {
        const { campaign_id, user_email } = req.params;

        await accessControl.revokeAccess(campaign_id, user_email);

        logger.info('Access revoked', {
          campaignId: campaign_id,
          userEmail: user_email,
          revokedBy: req.user!.email
        });

        res.json({
          success: true,
          message: 'Access revoked successfully'
        });
      } catch (error) {
        logger.error('Failed to revoke access', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to revoke access'
        });
      }
    }
  );

  /**
   * PATCH /api/campaigns/:campaign_id/access/:access_id
   * Update access tier (Kuda Ocean only)
   */
  router.patch(
    '/:campaign_id/access/:access_id',
    middleware.requirePermission('can_grant_access'),
    async (req, res) => {
      try {
        const { access_id } = req.params;
        const { new_tier } = req.body;

        if (!new_tier) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'new_tier is required'
          });
        }

        const updated_access = await accessControl.updateAccessTier(
          access_id,
          new_tier as AccessTier,
          req.user!.email
        );

        logger.info('Access tier updated', {
          accessId: access_id,
          newTier: new_tier,
          updatedBy: req.user!.email
        });

        res.json({
          success: true,
          access: updated_access
        });
      } catch (error) {
        logger.error('Failed to update access tier', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to update access tier'
        });
      }
    }
  );

  /**
   * GET /api/campaigns/:campaign_id/access
   * Get all access records for a campaign
   */
  router.get(
    '/:campaign_id/access',
    middleware.requireCampaignAccess,
    async (req, res) => {
      try {
        const { campaign_id } = req.params;

        const access_list = await accessControl.getCampaignAccess(campaign_id);

        res.json({
          success: true,
          access_list,
          count: access_list.length
        });
      } catch (error) {
        logger.error('Failed to get campaign access', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to get campaign access'
        });
      }
    }
  );

  /**
   * GET /api/campaigns/:campaign_id/access/me
   * Get current user's access and permissions
   */
  router.get(
    '/:campaign_id/access/me',
    middleware.requireCampaignAccess,
    async (req, res) => {
      try {
        const { campaign_id } = req.params;
        const user_email = req.user!.email;

        const access = await accessControl.getUserAccess(campaign_id, user_email);
        const permissions = await accessControl.getUserPermissions(campaign_id, user_email);

        res.json({
          success: true,
          access,
          permissions
        });
      } catch (error) {
        logger.error('Failed to get user access', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to get user access'
        });
      }
    }
  );

  /**
   * GET /api/campaigns/:campaign_id/access/stats
   * Get access statistics for a campaign
   */
  router.get(
    '/:campaign_id/access/stats',
    middleware.requireCampaignAccess,
    async (req, res) => {
      try {
        const { campaign_id } = req.params;

        const stats = await accessControl.getCampaignAccessStats(campaign_id);

        res.json({
          success: true,
          stats
        });
      } catch (error) {
        logger.error('Failed to get access stats', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to get access stats'
        });
      }
    }
  );

  return router;
}

export default createAccessControlRoutes;
