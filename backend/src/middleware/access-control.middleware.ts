/**
 * Access Control Middleware - Route Protection for KUDA Phase 2
 *
 * Provides middleware functions to protect routes based on:
 * - Campaign access (user has access to campaign)
 * - Access tier (kuda_ocean, kuda_river, kuda_minnow)
 * - Specific permissions (upload, approve, grant access, etc.)
 */

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { Logger } from '../utils/logger';
import { AccessControlService, AccessTier } from '../services/access-control.service';

const logger = new Logger('AccessControlMiddleware');

/**
 * Extend Express Request to include user and campaign context
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        email: string;
        name?: string;
        role?: string;
      };
      campaign?: {
        id: string;
        name: string;
      };
      access?: {
        tier: AccessTier;
        permissions: any;
      };
    }
  }
}

/**
 * Create access control middleware with database pool
 */
export function createAccessControlMiddleware(db: Pool) {
  const accessControl = new AccessControlService(db);

  /**
   * Require user to have access to campaign (any tier)
   */
  const requireCampaignAccess = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const campaign_id = req.params.campaign_id || req.body.campaign_id;
      const user_email = req.user?.email;

      if (!user_email) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated'
        });
      }

      if (!campaign_id) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Campaign ID required'
        });
      }

      // Check if user has access
      const has_access = await accessControl.hasAccessTier(
        campaign_id,
        user_email,
        ['kuda_ocean', 'kuda_river', 'kuda_minnow']
      );

      if (!has_access) {
        logger.warn('Access denied - no campaign access', {
          campaignId: campaign_id,
          userEmail: user_email
        });

        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this campaign'
        });
      }

      // Get user's permissions
      const permissions = await accessControl.getUserPermissions(
        campaign_id,
        user_email
      );

      // Attach access context to request
      req.access = {
        tier: (await accessControl.getUserAccess(campaign_id, user_email))?.access_tier as AccessTier,
        permissions
      };

      next();
    } catch (error) {
      logger.error('Access control middleware error', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to verify access'
      });
    }
  };

  /**
   * Require user to have specific access tier
   */
  const requireAccessTier = (allowed_tiers: AccessTier[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const campaign_id = req.params.campaign_id || req.body.campaign_id;
        const user_email = req.user?.email;

        if (!user_email) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'User not authenticated'
          });
        }

        if (!campaign_id) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Campaign ID required'
          });
        }

        const has_tier = await accessControl.hasAccessTier(
          campaign_id,
          user_email,
          allowed_tiers
        );

        if (!has_tier) {
          logger.warn('Access denied - insufficient tier', {
            campaignId: campaign_id,
            userEmail: user_email,
            requiredTiers: allowed_tiers
          });

          return res.status(403).json({
            error: 'Forbidden',
            message: `This action requires one of the following access tiers: ${allowed_tiers.join(', ')}`
          });
        }

        // Get user's permissions
        const permissions = await accessControl.getUserPermissions(
          campaign_id,
          user_email
        );

        // Attach access context to request
        req.access = {
          tier: (await accessControl.getUserAccess(campaign_id, user_email))?.access_tier as AccessTier,
          permissions
        };

        next();
      } catch (error) {
        logger.error('Access tier middleware error', error);
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to verify access tier'
        });
      }
    };
  };

  /**
   * Require user to have specific permission
   */
  const requirePermission = (permission_key: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const campaign_id = req.params.campaign_id || req.body.campaign_id;
        const user_email = req.user?.email;

        if (!user_email) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'User not authenticated'
          });
        }

        if (!campaign_id) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Campaign ID required'
          });
        }

        const permissions = await accessControl.getUserPermissions(
          campaign_id,
          user_email
        );

        if (!permissions[permission_key]) {
          logger.warn('Access denied - missing permission', {
            campaignId: campaign_id,
            userEmail: user_email,
            requiredPermission: permission_key
          });

          return res.status(403).json({
            error: 'Forbidden',
            message: `You do not have permission to perform this action (${permission_key})`
          });
        }

        // Attach access context to request
        req.access = {
          tier: (await accessControl.getUserAccess(campaign_id, user_email))?.access_tier as AccessTier,
          permissions
        };

        next();
      } catch (error) {
        logger.error('Permission middleware error', error);
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to verify permission'
        });
      }
    };
  };

  /**
   * Kuda Ocean only - full control tier
   */
  const requireKudaOcean = requireAccessTier(['kuda_ocean']);

  /**
   * Kuda Ocean or River - internal team + client stakeholders
   */
  const requireKudaOceanOrRiver = requireAccessTier(['kuda_ocean', 'kuda_river']);

  return {
    requireCampaignAccess,
    requireAccessTier,
    requirePermission,
    requireKudaOcean,
    requireKudaOceanOrRiver
  };
}

export default createAccessControlMiddleware;
