/**
 * Notification Service - Portal notifications and email integration
 */
import { Pool } from 'pg';
import { Logger } from '../utils/logger';
import EmailService from './email.service';

const logger = new Logger('NotificationService');

export class NotificationService {
  private emailService: EmailService;

  constructor(private db: Pool) {
    this.emailService = new EmailService();
  }

  async notifyAssetPackRejected(assetPackId: string, recipientEmail: string, rejectionNote: string) {
    await this.createNotification(
      assetPackId,
      recipientEmail,
      'asset_pack_rejected',
      'Asset Pack Rejected - Additional Materials Needed',
      rejectionNote
    );
    logger.info('Asset pack rejection notification created', { assetPackId });
  }

  async notifyDeliverableReady(deliverableId: string, recipientEmail: string, deliverableType: string) {
    const title = deliverableType === 'static_mock' ? 'Static Mocks Ready for Review' : 'Animated Creatives Ready for Review';
    await this.createNotification(
      deliverableId,
      recipientEmail,
      `${deliverableType}_ready`,
      title,
      'Your deliverable is ready for review in the portal'
    );
  }

  private async createNotification(referenceId: string, recipientEmail: string, type: string, title: string, message: string) {
    const campaignResult = await this.db.query(`SELECT campaign_id FROM asset_packs WHERE id = $1 LIMIT 1`, [referenceId]);
    const campaignId = campaignResult.rows[0]?.campaign_id;

    await this.db.query(
      `INSERT INTO portal_notifications (campaign_id, recipient_email, notification_type, title, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [campaignId, recipientEmail, type, title, message]
    );
  }
}

export default NotificationService;
