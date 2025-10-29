/**
 * Changelog Routes - KUDA Phase 2
 *
 * Endpoints for managing revision changelogs (view, mark reviewed)
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { Logger } from '../utils/logger';
import { RevisionChangelogService } from '../services/revision-changelog.service';
import { createAccessControlMiddleware } from '../middleware/access-control.middleware';

const logger = new Logger('ChangelogRoutes');

export function createChangelogRoutes(db: Pool): Router {
  const router = Router();
  const changelogService = new RevisionChangelogService(db);
  const middleware = createAccessControlMiddleware(db);

  /**
   * POST /api/deliverables/:deliverable_id/changelogs/generate
   * Generate changelog for a deliverable revision (Kuda Ocean only)
   */
  router.post(
    '/:deliverable_id/changelogs/generate',
    middleware.requirePermission('can_edit_changelogs'),
    async (req, res) => {
      try {
        const { deliverable_id } = req.params;
        const {
          revision_number,
          previous_version_id,
          metadata_current,
          metadata_previous
        } = req.body;

        if (!revision_number || !metadata_current) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'revision_number and metadata_current are required'
          });
        }

        const changelog = await changelogService.generateChangelog({
          deliverable_id,
          revision_number,
          previous_version_id,
          metadata_current,
          metadata_previous
        });

        logger.info('Changelog generated via API', {
          deliverableId: deliverable_id,
          revisionNumber: revision_number,
          changelogId: changelog.id,
          totalChanges: changelog.total_changes
        });

        res.status(201).json({
          success: true,
          changelog
        });
      } catch (error) {
        logger.error('Failed to generate changelog', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to generate changelog'
        });
      }
    }
  );

  /**
   * GET /api/deliverables/:deliverable_id/changelogs
   * Get all changelogs for a deliverable
   */
  router.get(
    '/:deliverable_id/changelogs',
    middleware.requireCampaignAccess,
    async (req, res) => {
      try {
        const { deliverable_id } = req.params;

        const changelogs = await changelogService.getDeliverablelogs(deliverable_id);

        res.json({
          success: true,
          changelogs,
          count: changelogs.length
        });
      } catch (error) {
        logger.error('Failed to get deliverable changelogs', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to get deliverable changelogs'
        });
      }
    }
  );

  /**
   * GET /api/changelogs/:changelog_id
   * Get changelog by ID
   */
  router.get(
    '/:changelog_id',
    async (req, res) => {
      try {
        const { changelog_id } = req.params;

        const changelog = await changelogService.getChangelog(changelog_id);

        if (!changelog) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Changelog not found'
          });
        }

        res.json({
          success: true,
          changelog
        });
      } catch (error) {
        logger.error('Failed to get changelog', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to get changelog'
        });
      }
    }
  );

  /**
   * POST /api/changelogs/:changelog_id/review
   * Mark changelog as reviewed
   */
  router.post(
    '/:changelog_id/review',
    async (req, res) => {
      try {
        const { changelog_id } = req.params;

        const changelog = await changelogService.markReviewed(
          changelog_id,
          req.user!.email
        );

        logger.info('Changelog marked as reviewed', {
          changelogId: changelog_id,
          reviewedBy: req.user!.email
        });

        res.json({
          success: true,
          changelog
        });
      } catch (error) {
        logger.error('Failed to mark changelog as reviewed', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Failed to mark changelog as reviewed'
        });
      }
    }
  );

  return router;
}

export default createChangelogRoutes;
