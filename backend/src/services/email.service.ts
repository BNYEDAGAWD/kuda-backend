/**
 * Email Service
 *
 * Handles email notifications via Gmail API.
 * Sends:
 * - Client portal invites
 * - Creative approval notifications
 * - Creative rejection notifications
 * - Change request notifications
 */

import { google } from 'googleapis';
import { Logger } from '../utils/logger';
import { Pool } from 'pg';

const logger = new Logger('EmailService');

// Types
export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export interface Campaign {
  id: string;
  name: string;
  client_name: string;
  kargo_account_manager_email: string;
}

export interface Creative {
  id: string;
  name: string;
  status: string;
  submitted_by: string;
  dimensions?: string;
  s3_file_url: string;
}

export class EmailService {
  private gmail: any;
  private db: Pool;
  private fromEmail: string;

  constructor(db: Pool) {
    this.db = db;
    this.fromEmail = process.env.GMAIL_FROM_EMAIL || 'noreply@kargo.com';
    this.initializeGmail();
  }

  /**
   * Initialize Gmail API client
   */
  private initializeGmail(): void {
    try {
      const auth = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'
      );

      auth.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN
      });

      this.gmail = google.gmail({ version: 'v1', auth });
      logger.info('Gmail API initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Gmail API', error);
    }
  }

  /**
   * Send email via Gmail API
   */
  private async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
      const cc = options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : '';
      const bcc = options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : '';

      const message = [
        `From: Kargo Creative Approval <${this.fromEmail}>`,
        `To: ${recipients}`,
        cc ? `Cc: ${cc}` : '',
        bcc ? `Bcc: ${bcc}` : '',
        `Subject: ${options.subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        options.html
      ].filter(line => line.length > 0).join('\n');

      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      // Log email
      await this.logEmail(recipients, options.subject, 'sent');

      logger.info('Email sent successfully', {
        to: recipients,
        subject: options.subject
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to send email', {
        error: error.message,
        to: options.to,
        subject: options.subject
      });

      // Log failed email
      await this.logEmail(
        Array.isArray(options.to) ? options.to.join(', ') : options.to,
        options.subject,
        'failed',
        error.message
      );

      return false;
    }
  }

  /**
   * Log email to database
   */
  private async logEmail(
    recipient: string,
    subject: string,
    status: 'sent' | 'failed' | 'queued',
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO email_logs (recipient, subject, status, error_message)
         VALUES ($1, $2, $3, $4)`,
        [recipient, subject, status, errorMessage || null]
      );
    } catch (error) {
      logger.error('Failed to log email', error);
    }
  }

  /**
   * Send client portal invite email
   */
  async sendClientPortalInvite(
    campaign: Campaign,
    portalUrl: string,
    clientEmail: string,
    expiresAt: Date
  ): Promise<boolean> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Upload Creative Assets</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      You're receiving this email because <strong>${campaign.kargo_account_manager_email}</strong> has created a campaign and needs your creative assets.
    </p>

    <div style="background: #f9fafb; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;"><strong>Campaign Name:</strong></p>
      <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: 600; color: #111827;">${campaign.name}</p>
    </div>

    <p style="font-size: 16px; margin: 20px 0;">
      Please upload your creative files using the secure link below. No login required!
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        Upload Creative Assets →
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin: 20px 0;">
      Or copy and paste this link into your browser:<br>
      <a href="${portalUrl}" style="color: #667eea; word-break: break-all;">${portalUrl}</a>
    </p>

    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        <strong>⏰ Important:</strong> This link expires on <strong>${expiresAt.toLocaleDateString()}</strong>
      </p>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      Questions? Contact your Kargo account manager at <a href="mailto:${campaign.kargo_account_manager_email}" style="color: #667eea;">${campaign.kargo_account_manager_email}</a>
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; padding: 20px; font-size: 12px; color: #9ca3af;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Kargo Global Inc. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: clientEmail,
      subject: `Upload Creative Assets for ${campaign.name}`,
      html
    });
  }

  /**
   * Send creative approved email
   */
  async sendCreativeApprovedEmail(
    creative: Creative,
    campaign: Campaign,
    feedback: string = ''
  ): Promise<boolean> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">✅ Creative Approved!</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Great news!</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      Your creative has been approved by the Kargo team and is ready for campaign launch.
    </p>

    <div style="background: #f9fafb; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;"><strong>Campaign:</strong> ${campaign.name}</p>
      <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: 600; color: #111827;">${creative.name}</p>
      ${creative.dimensions ? `<p style="margin: 5px 0 0 0; font-size: 14px; color: #6b7280;">Dimensions: ${creative.dimensions}</p>` : ''}
    </div>

    ${feedback ? `
    <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #065f46;"><strong>Feedback from Kargo team:</strong></p>
      <p style="margin: 10px 0 0 0; font-size: 14px; color: #065f46;">${feedback}</p>
    </div>
    ` : ''}

    <div style="text-align: center; margin: 30px 0;">
      <img src="${creative.s3_file_url}" alt="${creative.name}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      Questions? Contact your Kargo account manager at <a href="mailto:${campaign.kargo_account_manager_email}" style="color: #10b981;">${campaign.kargo_account_manager_email}</a>
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; padding: 20px; font-size: 12px; color: #9ca3af;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Kargo Global Inc. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: creative.submitted_by,
      subject: `✅ Creative Approved: ${creative.name}`,
      html
    });
  }

  /**
   * Send creative rejected email
   */
  async sendCreativeRejectedEmail(
    creative: Creative,
    campaign: Campaign,
    reason: string
  ): Promise<boolean> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">❌ Creative Rejected</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      Unfortunately, your creative does not meet the requirements for this campaign and has been rejected.
    </p>

    <div style="background: #f9fafb; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;"><strong>Campaign:</strong> ${campaign.name}</p>
      <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: 600; color: #111827;">${creative.name}</p>
      ${creative.dimensions ? `<p style="margin: 5px 0 0 0; font-size: 14px; color: #6b7280;">Dimensions: ${creative.dimensions}</p>` : ''}
    </div>

    <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #991b1b;"><strong>Reason for rejection:</strong></p>
      <p style="margin: 10px 0 0 0; font-size: 14px; color: #991b1b;">${reason}</p>
    </div>

    <p style="font-size: 16px; margin: 20px 0;">
      Please create a new creative that addresses the feedback above and upload it via the client portal.
    </p>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      Questions? Contact your Kargo account manager at <a href="mailto:${campaign.kargo_account_manager_email}" style="color: #ef4444;">${campaign.kargo_account_manager_email}</a>
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; padding: 20px; font-size: 12px; color: #9ca3af;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Kargo Global Inc. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: creative.submitted_by,
      subject: `❌ Creative Rejected: ${creative.name}`,
      html
    });
  }

  /**
   * Send changes requested email
   */
  async sendChangesRequestedEmail(
    creative: Creative,
    campaign: Campaign,
    changes: string
  ): Promise<boolean> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🔄 Changes Requested</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      The Kargo team has reviewed your creative and is requesting some changes before approval.
    </p>

    <div style="background: #f9fafb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;"><strong>Campaign:</strong> ${campaign.name}</p>
      <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: 600; color: #111827;">${creative.name}</p>
      ${creative.dimensions ? `<p style="margin: 5px 0 0 0; font-size: 14px; color: #6b7280;">Dimensions: ${creative.dimensions}</p>` : ''}
    </div>

    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #92400e;"><strong>Requested changes:</strong></p>
      <p style="margin: 10px 0 0 0; font-size: 14px; color: #92400e;">${changes}</p>
    </div>

    <p style="font-size: 16px; margin: 20px 0;">
      Please update the creative based on the feedback above and upload a revised version via the client portal.
    </p>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      Questions? Contact your Kargo account manager at <a href="mailto:${campaign.kargo_account_manager_email}" style="color: #f59e0b;">${campaign.kargo_account_manager_email}</a>
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; padding: 20px; font-size: 12px; color: #9ca3af;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Kargo Global Inc. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({
      to: creative.submitted_by,
      subject: `🔄 Changes Requested: ${creative.name}`,
      html
    });
  }
}

export default EmailService;
