/**
 * Analytics Routes
 *
 * Dashboard metrics and approval analytics.
 * Provides visibility into approval velocity, bottlenecks, and campaign health.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { Logger } from '../utils/logger';

const logger = new Logger('AnalyticsRoutes');

export function createAnalyticsRoutes(db: Pool): Router {
  const router = Router();

  /**
   * GET /api/analytics/dashboard
   * Overall dashboard metrics
   */
  router.get('/dashboard', async (req: Request, res: Response) => {
    try {
      // Use database view if it exists, otherwise calculate
      const metricsResult = await db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
          COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
          COUNT(*) FILTER (WHERE status = 'needs_changes') as needs_changes_count,
          COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count,
          COUNT(*) FILTER (WHERE priority = 'high') as high_priority_count,
          AVG(
            CASE
              WHEN approved_at IS NOT NULL AND submitted_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 3600
              ELSE NULL
            END
          ) as avg_approval_time_hours,
          COUNT(*) FILTER (
            WHERE submitted_at >= NOW() - INTERVAL '24 hours'
          ) as submitted_last_24h,
          COUNT(*) FILTER (
            WHERE approved_at >= NOW() - INTERVAL '24 hours'
          ) as approved_last_24h
        FROM creatives
      `);

      const metrics = metricsResult.rows[0];

      // Active campaigns count
      const campaignsResult = await db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'active') as active_campaigns,
          COUNT(*) FILTER (WHERE status = 'draft') as draft_campaigns,
          COUNT(*) as total_campaigns
        FROM campaigns
      `);

      const campaignMetrics = campaignsResult.rows[0];

      res.json({
        success: true,
        data: {
          creatives: {
            pending: parseInt(metrics.pending_count) || 0,
            approved: parseInt(metrics.approved_count) || 0,
            rejected: parseInt(metrics.rejected_count) || 0,
            needsChanges: parseInt(metrics.needs_changes_count) || 0,
            urgent: parseInt(metrics.urgent_count) || 0,
            highPriority: parseInt(metrics.high_priority_count) || 0
          },
          campaigns: {
            active: parseInt(campaignMetrics.active_campaigns) || 0,
            draft: parseInt(campaignMetrics.draft_campaigns) || 0,
            total: parseInt(campaignMetrics.total_campaigns) || 0
          },
          performance: {
            avgApprovalTimeHours: parseFloat(metrics.avg_approval_time_hours) || 0,
            submittedLast24h: parseInt(metrics.submitted_last_24h) || 0,
            approvedLast24h: parseInt(metrics.approved_last_24h) || 0
          }
        }
      });
    } catch (error: any) {
      logger.error('Failed to get dashboard metrics', error);
      res.status(500).json({
        error: 'Failed to get dashboard metrics',
        message: error.message
      });
    }
  });

  /**
   * GET /api/analytics/campaign/:id
   * Campaign-specific analytics
   */
  router.get('/campaign/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Campaign creative status breakdown
      const statusResult = await db.query(`
        SELECT
          status,
          COUNT(*) as count,
          AVG(file_size_bytes) as avg_file_size,
          STRING_AGG(DISTINCT creative_type, ', ') as creative_types
        FROM creatives
        WHERE campaign_id = $1
        GROUP BY status
      `, [id]);

      // Approval timeline
      const timelineResult = await db.query(`
        SELECT
          DATE(submitted_at) as date,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'approved') as approved,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
          COUNT(*) FILTER (WHERE status = 'needs_changes') as needs_changes
        FROM creatives
        WHERE campaign_id = $1
        GROUP BY DATE(submitted_at)
        ORDER BY date DESC
        LIMIT 30
      `, [id]);

      // Approval velocity (approvals per day)
      const velocityResult = await db.query(`
        SELECT
          DATE(approved_at) as date,
          COUNT(*) as approvals,
          AVG(EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 3600) as avg_turnaround_hours
        FROM creatives
        WHERE campaign_id = $1 AND approved_at IS NOT NULL
        GROUP BY DATE(approved_at)
        ORDER BY date DESC
        LIMIT 14
      `, [id]);

      // Bottleneck detection (creatives pending > 48 hours)
      const bottleneckResult = await db.query(`
        SELECT
          id,
          name,
          creative_type,
          priority,
          submitted_at,
          EXTRACT(EPOCH FROM (NOW() - submitted_at)) / 3600 as hours_pending
        FROM creatives
        WHERE campaign_id = $1
          AND status = 'pending'
          AND submitted_at < NOW() - INTERVAL '48 hours'
        ORDER BY submitted_at ASC
      `, [id]);

      res.json({
        success: true,
        data: {
          statusBreakdown: statusResult.rows,
          timeline: timelineResult.rows,
          velocity: velocityResult.rows,
          bottlenecks: bottleneckResult.rows.map(row => ({
            ...row,
            hoursPending: parseFloat(row.hours_pending)
          }))
        }
      });
    } catch (error: any) {
      logger.error('Failed to get campaign analytics', error);
      res.status(500).json({
        error: 'Failed to get campaign analytics',
        message: error.message
      });
    }
  });

  /**
   * GET /api/analytics/approval-velocity
   * System-wide approval velocity trends
   */
  router.get('/approval-velocity', async (req: Request, res: Response) => {
    try {
      const { days = '30' } = req.query;
      const daysInt = parseInt(days as string);

      const result = await db.query(`
        SELECT
          DATE(approved_at) as date,
          COUNT(*) as approvals,
          AVG(EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 3600) as avg_turnaround_hours,
          MIN(EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 3600) as min_turnaround_hours,
          MAX(EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 3600) as max_turnaround_hours,
          COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_approvals,
          COUNT(*) FILTER (WHERE priority = 'high') as high_priority_approvals
        FROM creatives
        WHERE approved_at IS NOT NULL
          AND approved_at >= NOW() - INTERVAL '1 day' * $1
        GROUP BY DATE(approved_at)
        ORDER BY date DESC
      `, [daysInt]);

      res.json({
        success: true,
        data: result.rows.map(row => ({
          date: row.date,
          approvals: parseInt(row.approvals),
          avgTurnaroundHours: parseFloat(row.avg_turnaround_hours) || 0,
          minTurnaroundHours: parseFloat(row.min_turnaround_hours) || 0,
          maxTurnaroundHours: parseFloat(row.max_turnaround_hours) || 0,
          urgentApprovals: parseInt(row.urgent_approvals) || 0,
          highPriorityApprovals: parseInt(row.high_priority_approvals) || 0
        }))
      });
    } catch (error: any) {
      logger.error('Failed to get approval velocity', error);
      res.status(500).json({
        error: 'Failed to get approval velocity',
        message: error.message
      });
    }
  });

  /**
   * GET /api/analytics/account-manager-performance
   * Performance metrics by account manager
   */
  router.get('/account-manager-performance', async (req: Request, res: Response) => {
    try {
      const result = await db.query(`
        SELECT
          c.kargo_account_manager_email as account_manager,
          COUNT(DISTINCT c.id) as total_campaigns,
          COUNT(cr.id) as total_creatives,
          COUNT(cr.id) FILTER (WHERE cr.status = 'approved') as approved_creatives,
          COUNT(cr.id) FILTER (WHERE cr.status = 'pending') as pending_creatives,
          AVG(
            CASE
              WHEN cr.approved_at IS NOT NULL AND cr.submitted_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (cr.approved_at - cr.submitted_at)) / 3600
              ELSE NULL
            END
          ) as avg_approval_time_hours,
          COUNT(cr.id) FILTER (
            WHERE cr.status = 'pending'
              AND cr.submitted_at < NOW() - INTERVAL '48 hours'
          ) as bottleneck_creatives
        FROM campaigns c
        LEFT JOIN creatives cr ON cr.campaign_id = c.id
        GROUP BY c.kargo_account_manager_email
        ORDER BY total_campaigns DESC
      `);

      res.json({
        success: true,
        data: result.rows.map(row => ({
          accountManager: row.account_manager,
          totalCampaigns: parseInt(row.total_campaigns) || 0,
          totalCreatives: parseInt(row.total_creatives) || 0,
          approvedCreatives: parseInt(row.approved_creatives) || 0,
          pendingCreatives: parseInt(row.pending_creatives) || 0,
          avgApprovalTimeHours: parseFloat(row.avg_approval_time_hours) || 0,
          bottleneckCreatives: parseInt(row.bottleneck_creatives) || 0
        }))
      });
    } catch (error: any) {
      logger.error('Failed to get account manager performance', error);
      res.status(500).json({
        error: 'Failed to get account manager performance',
        message: error.message
      });
    }
  });

  /**
   * GET /api/analytics/creative-type-breakdown
   * Creative type distribution and approval rates
   */
  router.get('/creative-type-breakdown', async (req: Request, res: Response) => {
    try {
      const result = await db.query(`
        SELECT
          creative_type,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'approved') as approved,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          AVG(file_size_bytes) as avg_file_size,
          AVG(
            CASE
              WHEN approved_at IS NOT NULL AND submitted_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 3600
              ELSE NULL
            END
          ) as avg_approval_time_hours
        FROM creatives
        GROUP BY creative_type
        ORDER BY total DESC
      `);

      res.json({
        success: true,
        data: result.rows.map(row => ({
          creativeType: row.creative_type,
          total: parseInt(row.total),
          approved: parseInt(row.approved) || 0,
          rejected: parseInt(row.rejected) || 0,
          pending: parseInt(row.pending) || 0,
          approvalRate: row.total > 0
            ? ((parseInt(row.approved) || 0) / parseInt(row.total) * 100).toFixed(2)
            : '0.00',
          avgFileSizeBytes: parseInt(row.avg_file_size) || 0,
          avgApprovalTimeHours: parseFloat(row.avg_approval_time_hours) || 0
        }))
      });
    } catch (error: any) {
      logger.error('Failed to get creative type breakdown', error);
      res.status(500).json({
        error: 'Failed to get creative type breakdown',
        message: error.message
      });
    }
  });

  /**
   * GET /api/analytics/timeline-risks
   * Identify campaigns at risk of missing deadlines
   */
  router.get('/timeline-risks', async (req: Request, res: Response) => {
    try {
      const result = await db.query(`
        SELECT
          c.id as campaign_id,
          c.name as campaign_name,
          c.client_name,
          c.kargo_account_manager_email,
          c.start_date,
          c.end_date,
          COUNT(cr.id) as total_creatives,
          COUNT(cr.id) FILTER (WHERE cr.status = 'pending') as pending_creatives,
          COUNT(cr.id) FILTER (WHERE cr.status = 'needs_changes') as needs_changes_creatives,
          MAX(cr.submitted_at) as latest_submission,
          EXTRACT(EPOCH FROM (c.start_date - NOW())) / 86400 as days_until_launch
        FROM campaigns c
        LEFT JOIN creatives cr ON cr.campaign_id = c.id
        WHERE c.status = 'active'
          AND c.start_date > NOW()
          AND (
            cr.status IN ('pending', 'needs_changes')
            OR c.start_date < NOW() + INTERVAL '7 days'
          )
        GROUP BY c.id
        HAVING COUNT(cr.id) FILTER (WHERE cr.status IN ('pending', 'needs_changes')) > 0
        ORDER BY c.start_date ASC
      `);

      res.json({
        success: true,
        data: result.rows.map(row => ({
          campaignId: row.campaign_id,
          campaignName: row.campaign_name,
          clientName: row.client_name,
          accountManager: row.kargo_account_manager_email,
          startDate: row.start_date,
          endDate: row.end_date,
          totalCreatives: parseInt(row.total_creatives) || 0,
          pendingCreatives: parseInt(row.pending_creatives) || 0,
          needsChangesCreatives: parseInt(row.needs_changes_creatives) || 0,
          latestSubmission: row.latest_submission,
          daysUntilLaunch: parseFloat(row.days_until_launch) || 0,
          riskLevel: parseFloat(row.days_until_launch) < 3 ? 'high' : 'medium'
        }))
      });
    } catch (error: any) {
      logger.error('Failed to get timeline risks', error);
      res.status(500).json({
        error: 'Failed to get timeline risks',
        message: error.message
      });
    }
  });

  /**
   * GET /api/analytics/approval-history-timeline/:creativeId
   * Detailed approval history timeline for a specific creative
   */
  router.get('/approval-history-timeline/:creativeId', async (req: Request, res: Response) => {
    try {
      const { creativeId } = req.params;

      const result = await db.query(`
        SELECT
          id,
          action,
          actor_email,
          actor_role,
          feedback,
          previous_status,
          new_status,
          created_at,
          EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at))) / 3600 as hours_since_last_action
        FROM approval_history
        WHERE creative_id = $1
        ORDER BY created_at ASC
      `, [creativeId]);

      res.json({
        success: true,
        data: result.rows.map(row => ({
          ...row,
          hoursSinceLastAction: parseFloat(row.hours_since_last_action) || null
        }))
      });
    } catch (error: any) {
      logger.error('Failed to get approval history timeline', error);
      res.status(500).json({
        error: 'Failed to get approval history timeline',
        message: error.message
      });
    }
  });

  return router;
}

export default createAnalyticsRoutes;
