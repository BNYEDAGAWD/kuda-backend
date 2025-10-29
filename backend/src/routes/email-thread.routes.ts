/**
 * Email Thread Routes - KUDA Phase 2
 *
 * Endpoints for managing email threads (view, archive, resolve)
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { Logger } from '../utils/logger';
import { EmailThreadingService } from '../services/email-threading.service';
import { createAccessControlMiddleware } from '../middleware/access-control.middleware';

const logger = new Logger('EmailThreadRoutes');

export function createEmailThreadRoutes(db: Pool): Router {
  const router = Router();
  const emailThreading = new EmailThreadingService(db);
  const middleware = createAccessControlMiddleware(db);

  /**
   * GET /api/campaigns/:campaign_id/threads
   * Get all email threads for a campaign
   */
  router.get(
    '/:campaign_id/threads',
    middleware.requirePermission('can_view_email_threads'),
    async (req, res) => {
      try {
        const { campaign_id } = req.params;

        const threads = await emailThreading.getCampaignThreads(campaign_id);

        res.json({
          success: true,
          threads,
          count: threads.length
        });
      } catch (error) {
        logger.error('Failed to get campaign threads', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to get campaign threads'
        });
      }
    }
  );

  /**
   * GET /api/threads/:thread_id
   * Get email thread by ID
   */
  router.get(
    '/:thread_id',
    async (req, res) => {
      try {
        const { thread_id } = req.params;

        const thread = await emailThreading.getThread(thread_id);

        if (!thread) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Thread not found'
          });
        }

        res.json({
          success: true,
          thread
        });
      } catch (error) {
        logger.error('Failed to get thread', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to get thread'
        });
      }
    }
  );

  /**
   * POST /api/threads/:thread_id/archive
   * Archive a thread (Kuda Ocean only)
   */
  router.post(
    '/:thread_id/archive',
    async (req, res) => {
      try {
        const { thread_id } = req.params;

        await emailThreading.archiveThread(thread_id);

        logger.info('Thread archived', {
          threadId: thread_id,
          archivedBy: req.user?.email
        });

        res.json({
          success: true,
          message: 'Thread archived successfully'
        });
      } catch (error) {
        logger.error('Failed to archive thread', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to archive thread'
        });
      }
    }
  );

  /**
   * POST /api/threads/:thread_id/resolve
   * Resolve a thread (mark as complete)
   */
  router.post(
    '/:thread_id/resolve',
    async (req, res) => {
      try {
        const { thread_id } = req.params;

        await emailThreading.resolveThread(thread_id);

        logger.info('Thread resolved', {
          threadId: thread_id,
          resolvedBy: req.user?.email
        });

        res.json({
          success: true,
          message: 'Thread resolved successfully'
        });
      } catch (error) {
        logger.error('Failed to resolve thread', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to resolve thread'
        });
      }
    }
  );

  /**
   * GET /api/campaigns/:campaign_id/threads/stats
   * Get thread statistics for a campaign
   */
  router.get(
    '/:campaign_id/threads/stats',
    middleware.requireCampaignAccess,
    async (req, res) => {
      try {
        const { campaign_id } = req.params;

        const stats = await emailThreading.getThreadStats(campaign_id);

        res.json({
          success: true,
          stats
        });
      } catch (error) {
        logger.error('Failed to get thread stats', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to get thread stats'
        });
      }
    }
  );

  return router;
}

export default createEmailThreadRoutes;
