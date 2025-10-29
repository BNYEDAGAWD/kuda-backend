/**
 * Email Threading Service - Gmail API Integration
 *
 * Maintains single thread continuity from campaign creation through final approval.
 * Integrates with Gmail API for sending emails with proper threading.
 */

import { Pool } from 'pg';
import { Logger } from '../utils/logger';
import { google } from 'googleapis';
import { Gmail } from 'googleapis/build/src/apis/gmail/v1';

const logger = new Logger('EmailThreadingService');

export type ThreadType =
  | 'campaign_kickoff'
  | 'asset_pack_submission'
  | 'asset_pack_feedback'
  | 'deliverable_submission'
  | 'deliverable_feedback'
  | 'revision_submission'
  | 'final_approval';

export interface EmailThread {
  id: string;
  campaign_id: string;
  thread_id: string; // Gmail thread ID
  subject: string;
  thread_type: ThreadType;
  gmail_message_ids: string[];
  participants: {
    to: string[];
    cc: string[];
    bcc: string[];
  };
  total_messages: number;
  last_message_at: Date | null;
  thread_status: 'active' | 'resolved' | 'archived';
  created_at: Date;
  updated_at: Date;
}

export interface SendEmailInput {
  campaign_id: string;
  thread_type: ThreadType;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body_text: string;
  body_html?: string;
  reply_to?: string;
}

export interface SendEmailResult {
  thread: EmailThread;
  gmail_message_id: string;
  sent_at: Date;
}

export class EmailThreadingService {
  private gmail: Gmail | null = null;
  private readonly from_email: string;

  constructor(private db: Pool) {
    this.from_email = process.env.GMAIL_FROM_EMAIL || 'noreply@kargo.com';
    this.initializeGmail();
  }

  /**
   * Initialize Gmail API client
   */
  private async initializeGmail(): Promise<void> {
    try {
      // OAuth2 configuration
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI
      );

      // Set credentials (refresh token should be stored securely)
      oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN
      });

      this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      logger.info('Gmail API initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Gmail API', error);
      // Don't throw - allow service to function in degraded mode
    }
  }

  /**
   * Send email and maintain thread continuity
   */
  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    if (!this.gmail) {
      throw new Error('Gmail API not initialized');
    }

    try {
      // Get or create email thread
      const thread = await this.getOrCreateThread(
        input.campaign_id,
        input.thread_type,
        input.subject
      );

      // Build email message with proper threading
      const raw_message = this.buildRawMessage({
        from: this.from_email,
        to: input.to,
        cc: input.cc || [],
        bcc: input.bcc || [],
        subject: input.subject,
        body_text: input.body_text,
        body_html: input.body_html,
        thread_id: thread.thread_id,
        message_ids: thread.gmail_message_ids,
        reply_to: input.reply_to
      });

      // Send via Gmail API
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: raw_message,
          threadId: thread.thread_id || undefined
        }
      });

      const gmail_message_id = response.data.id!;
      const gmail_thread_id = response.data.threadId!;
      const sent_at = new Date();

      // Update thread record
      const updated_thread = await this.updateThread(thread.id, {
        thread_id: gmail_thread_id,
        gmail_message_ids: [...thread.gmail_message_ids, gmail_message_id],
        participants: {
          to: [...new Set([...thread.participants.to, ...input.to])],
          cc: [...new Set([...thread.participants.cc, ...(input.cc || [])])],
          bcc: [...new Set([...thread.participants.bcc, ...(input.bcc || [])])]
        },
        total_messages: thread.total_messages + 1,
        last_message_at: sent_at
      });

      logger.info('Email sent and thread updated', {
        campaignId: input.campaign_id,
        threadType: input.thread_type,
        gmailMessageId: gmail_message_id,
        gmailThreadId: gmail_thread_id
      });

      return {
        thread: updated_thread,
        gmail_message_id,
        sent_at
      };
    } catch (error) {
      logger.error('Failed to send email', { input, error });
      throw error;
    }
  }

  /**
   * Get or create email thread for campaign
   */
  private async getOrCreateThread(
    campaign_id: string,
    thread_type: ThreadType,
    subject: string
  ): Promise<EmailThread> {
    try {
      // Try to find existing thread
      const existing = await this.db.query<EmailThread>(
        `SELECT * FROM email_threads
         WHERE campaign_id = $1 AND thread_type = $2 AND thread_status = 'active'
         LIMIT 1`,
        [campaign_id, thread_type]
      );

      if (existing.rows.length > 0) {
        return existing.rows[0];
      }

      // Create new thread
      const result = await this.db.query<EmailThread>(
        `INSERT INTO email_threads (
          campaign_id, thread_id, subject, thread_type, participants
        ) VALUES ($1, '', $2, $3, '{"to":[],"cc":[],"bcc":[]}'::jsonb)
        RETURNING *`,
        [campaign_id, subject, thread_type]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get or create thread', {
        campaign_id,
        thread_type,
        error
      });
      throw error;
    }
  }

  /**
   * Update email thread
   */
  private async updateThread(
    thread_id: string,
    updates: Partial<{
      thread_id: string;
      gmail_message_ids: string[];
      participants: { to: string[]; cc: string[]; bcc: string[] };
      total_messages: number;
      last_message_at: Date;
      thread_status: 'active' | 'resolved' | 'archived';
    }>
  ): Promise<EmailThread> {
    try {
      const set_clauses: string[] = [];
      const values: any[] = [];
      let param_index = 1;

      if (updates.thread_id !== undefined) {
        set_clauses.push(`thread_id = $${param_index++}`);
        values.push(updates.thread_id);
      }

      if (updates.gmail_message_ids) {
        set_clauses.push(`gmail_message_ids = $${param_index++}`);
        values.push(JSON.stringify(updates.gmail_message_ids));
      }

      if (updates.participants) {
        set_clauses.push(`participants = $${param_index++}`);
        values.push(JSON.stringify(updates.participants));
      }

      if (updates.total_messages !== undefined) {
        set_clauses.push(`total_messages = $${param_index++}`);
        values.push(updates.total_messages);
      }

      if (updates.last_message_at) {
        set_clauses.push(`last_message_at = $${param_index++}`);
        values.push(updates.last_message_at);
      }

      if (updates.thread_status) {
        set_clauses.push(`thread_status = $${param_index++}`);
        values.push(updates.thread_status);
      }

      values.push(thread_id);

      const result = await this.db.query<EmailThread>(
        `UPDATE email_threads
         SET ${set_clauses.join(', ')}
         WHERE id = $${param_index}
         RETURNING *`,
        values
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update thread', { thread_id, updates, error });
      throw error;
    }
  }

  /**
   * Build raw email message for Gmail API
   */
  private buildRawMessage(params: {
    from: string;
    to: string[];
    cc: string[];
    bcc: string[];
    subject: string;
    body_text: string;
    body_html?: string;
    thread_id?: string;
    message_ids?: string[];
    reply_to?: string;
  }): string {
    const boundary = 'boundary_kuda_email';
    const lines: string[] = [];

    // Headers
    lines.push(`From: ${params.from}`);
    lines.push(`To: ${params.to.join(', ')}`);

    if (params.cc.length > 0) {
      lines.push(`Cc: ${params.cc.join(', ')}`);
    }

    if (params.bcc.length > 0) {
      lines.push(`Bcc: ${params.bcc.join(', ')}`);
    }

    if (params.reply_to) {
      lines.push(`Reply-To: ${params.reply_to}`);
    }

    lines.push(`Subject: ${params.subject}`);
    lines.push(`MIME-Version: 1.0`);

    // Threading headers
    if (params.message_ids && params.message_ids.length > 0) {
      const last_message_id = params.message_ids[params.message_ids.length - 1];
      lines.push(`In-Reply-To: ${last_message_id}`);
      lines.push(`References: ${params.message_ids.join(' ')}`);
    }

    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push('');

    // Plain text part
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset=UTF-8');
    lines.push('');
    lines.push(params.body_text);
    lines.push('');

    // HTML part (if provided)
    if (params.body_html) {
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/html; charset=UTF-8');
      lines.push('');
      lines.push(params.body_html);
      lines.push('');
    }

    lines.push(`--${boundary}--`);

    // Base64 encode
    const email_content = lines.join('\r\n');
    return Buffer.from(email_content)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Get email thread by ID
   */
  async getThread(thread_id: string): Promise<EmailThread | null> {
    try {
      const result = await this.db.query<EmailThread>(
        `SELECT * FROM email_threads WHERE id = $1`,
        [thread_id]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get thread', { thread_id, error });
      throw error;
    }
  }

  /**
   * Get all threads for a campaign
   */
  async getCampaignThreads(campaign_id: string): Promise<EmailThread[]> {
    try {
      const result = await this.db.query<EmailThread>(
        `SELECT * FROM email_threads
         WHERE campaign_id = $1
         ORDER BY created_at ASC`,
        [campaign_id]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get campaign threads', { campaign_id, error });
      throw error;
    }
  }

  /**
   * Archive a thread
   */
  async archiveThread(thread_id: string): Promise<void> {
    try {
      await this.updateThread(thread_id, {
        thread_status: 'archived'
      });

      logger.info('Thread archived', { thread_id });
    } catch (error) {
      logger.error('Failed to archive thread', { thread_id, error });
      throw error;
    }
  }

  /**
   * Resolve a thread (mark as complete)
   */
  async resolveThread(thread_id: string): Promise<void> {
    try {
      await this.updateThread(thread_id, {
        thread_status: 'resolved'
      });

      logger.info('Thread resolved', { thread_id });
    } catch (error) {
      logger.error('Failed to resolve thread', { thread_id, error });
      throw error;
    }
  }

  /**
   * Get thread statistics
   */
  async getThreadStats(campaign_id: string): Promise<{
    total_threads: number;
    active_threads: number;
    resolved_threads: number;
    archived_threads: number;
    total_messages: number;
    avg_messages_per_thread: number;
  }> {
    try {
      const result = await this.db.query(
        `SELECT
          COUNT(*) as total_threads,
          COUNT(*) FILTER (WHERE thread_status = 'active') as active_threads,
          COUNT(*) FILTER (WHERE thread_status = 'resolved') as resolved_threads,
          COUNT(*) FILTER (WHERE thread_status = 'archived') as archived_threads,
          COALESCE(SUM(total_messages), 0) as total_messages,
          COALESCE(AVG(total_messages), 0) as avg_messages_per_thread
         FROM email_threads
         WHERE campaign_id = $1`,
        [campaign_id]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get thread stats', { campaign_id, error });
      throw error;
    }
  }
}

export default EmailThreadingService;
