/**
 * Notification Routes - KUDA Phase 2
 *
 * Endpoints for managing notifications (schedule, send, track)
 */

import { Router } from 'express';
import { Pool } from 'pg';
import { Logger } from '../utils/logger';
import { NotificationEnhancedService } from '../services/notification-enhanced.service';
import { createAccessControlMiddleware } from '../middleware/access-control.middleware';

const logger = new Logger('NotificationRoutes');

export function createNotificationRoutes(db: Pool): Router {
  const router = Router();
  const notificationService = new NotificationEnhancedService(db);
  const middleware = createAccessControlMiddleware(db);

  /**
   * POST /api/campaigns/:campaign_id/notifications/schedule
   * Schedule a notification with smart timing
   */
  router.post(
    '/:campaign_id/notifications/schedule',
    middleware.requirePermission('can_send_manual_email'),
    async (req, res) => {
      try {
        const { campaign_id } = req.params;
        const {
          notification_type,
          reference_type,
          reference_id,
          recipients,
          template_name,
          template_data,
          requested_send_time
        } = req.body;

        if (!notification_type || !reference_type || !reference_id || !recipients || !template_name) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'notification_type, reference_type, reference_id, recipients, and template_name are required'
          });
        }

        const notification = await notificationService.scheduleNotification({
          notification_type,
          reference_type,
          reference_id,
          campaign_id,
          sender_tier: req.access!.tier === 'kuda_ocean' ? 'kuda_ocean' : 'system',
          recipients,
          template_name,
          template_data,
          requested_send_time: requested_send_time ? new Date(requested_send_time) : undefined
        });

        logger.info('Notification scheduled via API', {
          campaignId: campaign_id,
          notificationId: notification.id,
          notificationType: notification_type
        });

        res.status(201).json({
          success: true,
          notification
        });
      } catch (error) {
        logger.error('Failed to schedule notification', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to schedule notification'
        });
      }
    }
  );

  /**
   * POST /api/notifications/process
   * Manually trigger notification processing (Kuda Ocean only)
   */
  router.post(
    '/process',
    async (req, res) => {
      try {
        // This endpoint is typically called by cron job, but can be manually triggered by admins
        const results = await notificationService.processScheduledNotifications();

        logger.info('Manual notification processing triggered', {
          processedCount: results.length,
          sentCount: results.filter(r => !r.error).length,
          failedCount: results.filter(r => r.error).length
        });

        res.json({
          success: true,
          results,
          stats: {
            total: results.length,
            sent: results.filter(r => !r.error).length,
            failed: results.filter(r => r.error).length
          }
        });
      } catch (error) {
        logger.error('Failed to process notifications', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to process notifications'
        });
      }
    }
  );

  /**
   * GET /api/campaigns/:campaign_id/notifications
   * Get all notifications for a campaign
   */
  router.get(
    '/:campaign_id/notifications',
    middleware.requireCampaignAccess,
    async (req, res) => {
      try {
        const { campaign_id } = req.params;

        const notifications = await notificationService.getCampaignNotifications(campaign_id);

        res.json({
          success: true,
          notifications,
          count: notifications.length
        });
      } catch (error) {
        logger.error('Failed to get campaign notifications', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to get campaign notifications'
        });
      }
    }
  );

  /**
   * GET /api/notifications/:notification_id
   * Get notification by ID
   */
  router.get(
    '/:notification_id',
    async (req, res) => {
      try {
        const { notification_id } = req.params;

        const notification = await notificationService.getNotification(notification_id);

        if (!notification) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Notification not found'
          });
        }

        res.json({
          success: true,
          notification
        });
      } catch (error) {
        logger.error('Failed to get notification', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to get notification'
        });
      }
    }
  );

  /**
   * DELETE /api/notifications/:notification_id
   * Cancel a pending notification (Kuda Ocean only)
   */
  router.delete(
    '/:notification_id',
    async (req, res) => {
      try {
        const { notification_id } = req.params;

        await notificationService.cancelNotification(notification_id);

        logger.info('Notification cancelled', {
          notificationId: notification_id,
          cancelledBy: req.user?.email
        });

        res.json({
          success: true,
          message: 'Notification cancelled successfully'
        });
      } catch (error) {
        logger.error('Failed to cancel notification', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Failed to cancel notification'
        });
      }
    }
  );

  /**
   * POST /api/notifications/:notification_id/reschedule
   * Reschedule a failed notification
   */
  router.post(
    '/:notification_id/reschedule',
    async (req, res) => {
      try {
        const { notification_id } = req.params;
        const { new_send_time } = req.body;

        const notification = await notificationService.rescheduleNotification(
          notification_id,
          new_send_time ? new Date(new_send_time) : undefined
        );

        logger.info('Notification rescheduled', {
          notificationId: notification_id,
          newSendTime: notification.calculated_send_time,
          rescheduledBy: req.user?.email
        });

        res.json({
          success: true,
          notification
        });
      } catch (error) {
        logger.error('Failed to reschedule notification', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Failed to reschedule notification'
        });
      }
    }
  );

  /**
   * GET /api/notifications/stats
   * Get notification statistics
   */
  router.get(
    '/stats',
    async (req, res) => {
      try {
        const days = parseInt(req.query.days as string) || 30;

        const stats = await notificationService.getNotificationStats(days);

        res.json({
          success: true,
          stats,
          period_days: days
        });
      } catch (error) {
        logger.error('Failed to get notification stats', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to get notification stats'
        });
      }
    }
  );

  return router;
}

export default createNotificationRoutes;
