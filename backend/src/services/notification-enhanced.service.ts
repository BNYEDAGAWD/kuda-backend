/**
 * Enhanced Notification Service - Integration Layer for Phase 2
 *
 * Combines:
 * - Smart Timing Service (Tue-Thu 10AM-4PM algorithm)
 * - Email Threading Service (Gmail API)
 * - Email Templates (7 workflow templates)
 * - Notification Scheduling (database persistence)
 *
 * This service orchestrates the complete notification workflow from
 * scheduling through delivery with proper timing and threading.
 */

import { Pool } from 'pg';
import { Logger } from '../utils/logger';
import { SmartTimingService } from './smart-timing.service';
import { EmailThreadingService, ThreadType } from './email-threading.service';
import * as EmailTemplates from '../templates/emails/email-templates';

const logger = new Logger('NotificationEnhancedService');

export interface ScheduleNotificationInput {
  notification_type: string;
  reference_type: 'campaign' | 'asset_pack' | 'deliverable' | 'revision';
  reference_id: string;
  campaign_id: string;
  sender_tier: 'kuda_ocean' | 'system';
  recipients: {
    to: string[];
    cc?: string[];
    bcc?: string[];
  };
  template_name: keyof typeof EmailTemplates;
  template_data: any;
  requested_send_time?: Date;
}

export interface ScheduledNotification {
  id: string;
  notification_type: string;
  reference_type: string;
  reference_id: string;
  sender_tier: string;
  recipients: {
    to: string[];
    cc: string[];
    bcc: string[];
  };
  template_name: string;
  template_data: any;
  requested_send_time: Date;
  calculated_send_time: Date;
  actual_send_time: Date | null;
  timing_rule_applied: string | null;
  was_delayed: boolean;
  delay_reason: string | null;
  status: 'pending' | 'sent' | 'failed';
  failure_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationResult {
  notification: ScheduledNotification;
  gmail_message_id?: string;
  error?: string;
}

export class NotificationEnhancedService {
  private smartTiming: SmartTimingService;
  private emailThreading: EmailThreadingService;

  constructor(private db: Pool) {
    this.smartTiming = new SmartTimingService(db);
    this.emailThreading = new EmailThreadingService(db);
  }

  /**
   * Schedule a notification with smart timing
   */
  async scheduleNotification(
    input: ScheduleNotificationInput
  ): Promise<ScheduledNotification> {
    try {
      // Calculate optimal send time using smart timing algorithm
      const timing_result = this.smartTiming.calculateOptimalSendTime(
        input.notification_type,
        input.sender_tier,
        input.requested_send_time
      );

      // Insert notification schedule record
      const result = await this.db.query<ScheduledNotification>(
        `INSERT INTO notification_schedule (
          notification_type, reference_type, reference_id,
          sender_tier, recipients, template_name, template_data,
          requested_send_time, calculated_send_time,
          timing_rule_applied, was_delayed, delay_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          input.notification_type,
          input.reference_type,
          input.reference_id,
          input.sender_tier,
          JSON.stringify({
            to: input.recipients.to,
            cc: input.recipients.cc || [],
            bcc: input.recipients.bcc || []
          }),
          input.template_name,
          JSON.stringify(input.template_data),
          timing_result.original_time,
          timing_result.calculated_send_time,
          timing_result.timing_rule_applied,
          timing_result.was_delayed,
          timing_result.delay_reason
        ]
      );

      const notification = result.rows[0];

      logger.info('Notification scheduled', {
        notificationId: notification.id,
        notificationType: input.notification_type,
        calculatedSendTime: timing_result.calculated_send_time,
        wasDelayed: timing_result.was_delayed,
        timingRule: timing_result.timing_rule_applied
      });

      return notification;
    } catch (error) {
      logger.error('Failed to schedule notification', { input, error });
      throw error;
    }
  }

  /**
   * Process all pending notifications that are ready to send
   * (Called by cron job every 5 minutes)
   */
  async processScheduledNotifications(): Promise<NotificationResult[]> {
    try {
      // Get pending notifications ready to send
      const pending = await this.db.query<ScheduledNotification>(
        `SELECT * FROM notification_schedule
         WHERE status = 'pending'
           AND calculated_send_time <= CURRENT_TIMESTAMP
         ORDER BY calculated_send_time ASC
         LIMIT 50`
      );

      if (pending.rows.length === 0) {
        logger.debug('No pending notifications to process');
        return [];
      }

      logger.info('Processing pending notifications', {
        count: pending.rows.length
      });

      // Process each notification
      const results: NotificationResult[] = [];
      for (const notification of pending.rows) {
        const result = await this.sendNotification(notification);
        results.push(result);
      }

      logger.info('Processed notifications', {
        total: results.length,
        sent: results.filter(r => !r.error).length,
        failed: results.filter(r => r.error).length
      });

      return results;
    } catch (error) {
      logger.error('Failed to process scheduled notifications', error);
      throw error;
    }
  }

  /**
   * Send a single notification (render template + send email + update thread)
   */
  private async sendNotification(
    notification: ScheduledNotification
  ): Promise<NotificationResult> {
    try {
      // Render email template
      const template_function = EmailTemplates[notification.template_name];
      if (!template_function) {
        throw new Error(`Template not found: ${notification.template_name}`);
      }

      const email_content = template_function(notification.template_data);

      // Determine thread type based on notification type
      const thread_type = this.mapNotificationTypeToThreadType(
        notification.notification_type
      );

      // Send email via email threading service
      const send_result = await this.emailThreading.sendEmail({
        campaign_id: notification.template_data.campaign_id || notification.reference_id,
        thread_type,
        to: notification.recipients.to,
        cc: notification.recipients.cc,
        bcc: notification.recipients.bcc,
        subject: email_content.subject,
        body_text: email_content.body_text,
        body_html: email_content.body_html
      });

      // Update notification record
      await this.db.query(
        `UPDATE notification_schedule
         SET status = 'sent',
             actual_send_time = CURRENT_TIMESTAMP,
             gmail_message_id = $1,
             gmail_thread_id = $2
         WHERE id = $3`,
        [send_result.gmail_message_id, send_result.thread.thread_id, notification.id]
      );

      logger.info('Notification sent successfully', {
        notificationId: notification.id,
        gmailMessageId: send_result.gmail_message_id,
        threadType: thread_type
      });

      return {
        notification: {
          ...notification,
          status: 'sent',
          actual_send_time: send_result.sent_at
        },
        gmail_message_id: send_result.gmail_message_id
      };
    } catch (error) {
      logger.error('Failed to send notification', {
        notificationId: notification.id,
        error
      });

      // Update notification record with failure
      await this.db.query(
        `UPDATE notification_schedule
         SET status = 'failed',
             failure_reason = $1
         WHERE id = $2`,
        [error instanceof Error ? error.message : 'Unknown error', notification.id]
      );

      return {
        notification: {
          ...notification,
          status: 'failed',
          failure_reason: error instanceof Error ? error.message : 'Unknown error'
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Map notification type to email thread type
   */
  private mapNotificationTypeToThreadType(
    notification_type: string
  ): ThreadType {
    const mapping: { [key: string]: ThreadType } = {
      'campaign_created': 'campaign_kickoff',
      'asset_requirements': 'campaign_kickoff',
      'asset_pack_submitted': 'asset_pack_submission',
      'asset_pack_validation_failed': 'asset_pack_feedback',
      'asset_pack_approved': 'asset_pack_feedback',
      'static_mocks_ready': 'deliverable_submission',
      'deliverable_submitted': 'deliverable_submission',
      'deliverable_approved': 'deliverable_feedback',
      'deliverable_rejected': 'deliverable_feedback',
      'revision_submitted': 'revision_submission',
      'revision_changelog': 'revision_submission',
      'animated_creatives_ready': 'deliverable_submission',
      'all_creatives_approved': 'final_approval'
    };

    return mapping[notification_type] || 'campaign_kickoff';
  }

  /**
   * Get notification by ID
   */
  async getNotification(notification_id: string): Promise<ScheduledNotification | null> {
    try {
      const result = await this.db.query<ScheduledNotification>(
        `SELECT * FROM notification_schedule WHERE id = $1`,
        [notification_id]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get notification', { notification_id, error });
      throw error;
    }
  }

  /**
   * Get notifications for a campaign
   */
  async getCampaignNotifications(
    campaign_id: string
  ): Promise<ScheduledNotification[]> {
    try {
      const result = await this.db.query<ScheduledNotification>(
        `SELECT * FROM notification_schedule
         WHERE template_data->>'campaign_id' = $1
         ORDER BY created_at DESC`,
        [campaign_id]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get campaign notifications', { campaign_id, error });
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(days: number = 30): Promise<{
    total_scheduled: number;
    total_sent: number;
    total_failed: number;
    total_pending: number;
    avg_delay_minutes: number;
    delayed_percentage: number;
    immediate_sends: number;
    optimal_window_sends: number;
  }> {
    try {
      const result = await this.db.query(
        `SELECT
          COUNT(*) as total_scheduled,
          COUNT(*) FILTER (WHERE status = 'sent') as total_sent,
          COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
          COUNT(*) FILTER (WHERE status = 'pending') as total_pending,
          AVG(EXTRACT(EPOCH FROM (calculated_send_time - requested_send_time)) / 60) as avg_delay_minutes,
          (COUNT(*) FILTER (WHERE was_delayed = TRUE)::float / NULLIF(COUNT(*), 0) * 100) as delayed_percentage,
          COUNT(*) FILTER (WHERE timing_rule_applied = 'immediate') as immediate_sends,
          COUNT(*) FILTER (WHERE timing_rule_applied = 'optimal_window') as optimal_window_sends
         FROM notification_schedule
         WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'`
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get notification stats', { days, error });
      throw error;
    }
  }

  /**
   * Cancel a pending notification
   */
  async cancelNotification(notification_id: string): Promise<void> {
    try {
      const result = await this.db.query(
        `UPDATE notification_schedule
         SET status = 'cancelled'
         WHERE id = $1 AND status = 'pending'
         RETURNING id`,
        [notification_id]
      );

      if (result.rows.length === 0) {
        throw new Error('Notification not found or already processed');
      }

      logger.info('Notification cancelled', { notification_id });
    } catch (error) {
      logger.error('Failed to cancel notification', { notification_id, error });
      throw error;
    }
  }

  /**
   * Reschedule a failed notification
   */
  async rescheduleNotification(
    notification_id: string,
    new_send_time?: Date
  ): Promise<ScheduledNotification> {
    try {
      const notification = await this.getNotification(notification_id);
      if (!notification) {
        throw new Error('Notification not found');
      }

      if (notification.status !== 'failed') {
        throw new Error('Can only reschedule failed notifications');
      }

      // Recalculate timing if new send time provided
      const requested_time = new_send_time || new Date();
      const timing_result = this.smartTiming.calculateOptimalSendTime(
        notification.notification_type,
        notification.sender_tier as 'kuda_ocean' | 'system',
        requested_time
      );

      // Update notification
      const result = await this.db.query<ScheduledNotification>(
        `UPDATE notification_schedule
         SET status = 'pending',
             requested_send_time = $1,
             calculated_send_time = $2,
             timing_rule_applied = $3,
             was_delayed = $4,
             delay_reason = $5,
             failure_reason = NULL,
             actual_send_time = NULL
         WHERE id = $6
         RETURNING *`,
        [
          timing_result.original_time,
          timing_result.calculated_send_time,
          timing_result.timing_rule_applied,
          timing_result.was_delayed,
          timing_result.delay_reason,
          notification_id
        ]
      );

      logger.info('Notification rescheduled', {
        notificationId: notification_id,
        newSendTime: timing_result.calculated_send_time
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to reschedule notification', { notification_id, error });
      throw error;
    }
  }
}

export default NotificationEnhancedService;
