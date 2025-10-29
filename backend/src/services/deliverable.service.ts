/**
 * Deliverable Service
 *
 * Manages static mocks and animated creatives delivered by Kargo to clients.
 * Handles demo URL management for multi-device formats.
 */

import { Pool } from 'pg';
import { Logger } from '../utils/logger';
import FormatService from './format.service';

const logger = new Logger('DeliverableService');

export interface Deliverable {
  id: string;
  campaign_id: string;
  deliverable_type: 'static_mock' | 'animated';
  round_number: number;
  revision_number: number;
  delivery_method: 'google_slides_url' | 'dropbox_url' | 'demo_urls';
  google_slides_url: string | null;
  dropbox_url: string | null;
  status: 'in_production' | 'ready_for_review' | 'approved' | 'changes_requested';
  production_started_at: Date | null;
  delivered_at: Date | null;
  approved_at: Date | null;
  am_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DemoUrl {
  id: string;
  deliverable_id: string;
  campaign_format_id: string;
  device: string;
  demo_url: string;
  kargo_creative_id: string | null;
  preview_uuid: string | null;
  created_at: Date;
}

export interface CreateDeliverableInput {
  campaign_id: string;
  deliverable_type: 'static_mock' | 'animated';
  round_number?: number;
  delivery_method: 'google_slides_url' | 'dropbox_url' | 'demo_urls';
  google_slides_url?: string;
  dropbox_url?: string;
  am_notes?: string;
}

export interface AddDemoUrlInput {
  campaign_format_id: string;
  device: string;
  demo_url: string;
  kargo_creative_id?: string;
  preview_uuid?: string;
}

export class DeliverableService {
  private formatService: FormatService;

  constructor(private db: Pool) {
    this.formatService = new FormatService(db);
  }

  /**
   * Create deliverable (static mock or animated)
   */
  async createDeliverable(input: CreateDeliverableInput): Promise<Deliverable> {
    try {
      const result = await this.db.query(
        `INSERT INTO deliverables (
          campaign_id, deliverable_type, round_number, delivery_method,
          google_slides_url, dropbox_url, am_notes, status, production_started_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'in_production', NOW())
        RETURNING *`,
        [
          input.campaign_id,
          input.deliverable_type,
          input.round_number || 1,
          input.delivery_method,
          input.google_slides_url || null,
          input.dropbox_url || null,
          input.am_notes || null
        ]
      );

      const deliverable: Deliverable = result.rows[0];

      logger.info('Deliverable created', {
        deliverableId: deliverable.id,
        campaignId: input.campaign_id,
        type: input.deliverable_type
      });

      return deliverable;
    } catch (error) {
      logger.error('Failed to create deliverable', error);
      throw error;
    }
  }

  /**
   * Add demo URL for specific format/device
   */
  async addDemoUrl(deliverableId: string, input: AddDemoUrlInput): Promise<DemoUrl> {
    try {
      // Validate device is supported for this format
      const formatResult = await this.db.query(
        `SELECT format_id FROM campaign_formats WHERE id = $1`,
        [input.campaign_format_id]
      );

      if (formatResult.rows.length === 0) {
        throw new Error('Campaign format not found');
      }

      const formatId = formatResult.rows[0].format_id;
      await this.formatService.validateFormatDevice(formatId, input.device);

      // Insert demo URL
      const result = await this.db.query(
        `INSERT INTO deliverable_demo_urls (
          deliverable_id, campaign_format_id, device, demo_url,
          kargo_creative_id, preview_uuid
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          deliverableId,
          input.campaign_format_id,
          input.device,
          input.demo_url,
          input.kargo_creative_id || null,
          input.preview_uuid || null
        ]
      );

      const demoUrl: DemoUrl = result.rows[0];

      logger.info('Demo URL added', {
        deliverableId,
        formatId: input.campaign_format_id,
        device: input.device
      });

      return demoUrl;
    } catch (error) {
      logger.error('Failed to add demo URL', error);
      throw error;
    }
  }

  /**
   * Add multiple demo URLs (for multi-device formats)
   */
  async addDemoUrls(deliverableId: string, demoUrls: AddDemoUrlInput[]): Promise<DemoUrl[]> {
    const results: DemoUrl[] = [];

    for (const input of demoUrls) {
      const demoUrl = await this.addDemoUrl(deliverableId, input);
      results.push(demoUrl);
    }

    logger.info('Multiple demo URLs added', {
      deliverableId,
      count: results.length
    });

    return results;
  }

  /**
   * Mark deliverable as ready for client review
   */
  async markDeliverableReady(deliverableId: string): Promise<Deliverable> {
    try {
      const result = await this.db.query(
        `UPDATE deliverables
         SET status = 'ready_for_review',
             delivered_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [deliverableId]
      );

      if (result.rows.length === 0) {
        throw new Error('Deliverable not found');
      }

      const deliverable: Deliverable = result.rows[0];

      // Update campaign phase
      const phaseMap = {
        'static_mock': 'static_mock_approval',
        'animated': 'animated_approval'
      };

      await this.db.query(
        `UPDATE campaigns
         SET current_phase = $1
         WHERE id = $2`,
        [phaseMap[deliverable.deliverable_type], deliverable.campaign_id]
      );

      logger.info('Deliverable marked ready for review', {
        deliverableId,
        type: deliverable.deliverable_type
      });

      return deliverable;
    } catch (error) {
      logger.error('Failed to mark deliverable ready', { deliverableId, error });
      throw error;
    }
  }

  /**
   * Get deliverable by ID
   */
  async getDeliverableById(deliverableId: string): Promise<Deliverable | null> {
    try {
      const result = await this.db.query(
        `SELECT * FROM deliverables WHERE id = $1`,
        [deliverableId]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get deliverable', { deliverableId, error });
      throw error;
    }
  }

  /**
   * Get all deliverables for campaign
   */
  async getDeliverablesForCampaign(campaignId: string): Promise<Deliverable[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM deliverables
         WHERE campaign_id = $1
         ORDER BY deliverable_type, round_number, revision_number`,
        [campaignId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get deliverables for campaign', { campaignId, error });
      throw error;
    }
  }

  /**
   * Get demo URLs for deliverable
   */
  async getDemoUrlsForDeliverable(deliverableId: string): Promise<DemoUrl[]> {
    try {
      const result = await this.db.query(
        `SELECT ddu.*, cf.variation_name, fl.format_name, fl.format_type
         FROM deliverable_demo_urls ddu
         JOIN campaign_formats cf ON cf.id = ddu.campaign_format_id
         JOIN format_library fl ON fl.id = cf.format_id
         WHERE ddu.deliverable_id = $1
         ORDER BY fl.format_name, ddu.device`,
        [deliverableId]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get demo URLs', { deliverableId, error });
      throw error;
    }
  }

  /**
   * Get demo URLs grouped by format
   */
  async getDemoUrlsGroupedByFormat(deliverableId: string): Promise<any> {
    try {
      const demoUrls = await this.getDemoUrlsForDeliverable(deliverableId);

      const grouped: { [formatId: string]: any } = {};

      demoUrls.forEach(url => {
        const key = url.campaign_format_id;

        if (!grouped[key]) {
          grouped[key] = {
            campaign_format_id: url.campaign_format_id,
            format_name: url.format_name,
            format_type: url.format_type,
            variation_name: url.variation_name,
            demo_urls: []
          };
        }

        grouped[key].demo_urls.push({
          device: url.device,
          demo_url: url.demo_url,
          kargo_creative_id: url.kargo_creative_id
        });
      });

      return Object.values(grouped);
    } catch (error) {
      logger.error('Failed to get grouped demo URLs', { deliverableId, error });
      throw error;
    }
  }

  /**
   * Update deliverable status
   */
  async updateDeliverableStatus(
    deliverableId: string,
    status: 'in_production' | 'ready_for_review' | 'approved' | 'changes_requested'
  ): Promise<Deliverable> {
    try {
      const result = await this.db.query(
        `UPDATE deliverables SET status = $1 WHERE id = $2 RETURNING *`,
        [status, deliverableId]
      );

      if (result.rows.length === 0) {
        throw new Error('Deliverable not found');
      }

      logger.info('Deliverable status updated', { deliverableId, status });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update deliverable status', { deliverableId, error });
      throw error;
    }
  }

  /**
   * Create revision of deliverable
   */
  async createRevision(
    originalDeliverableId: string,
    changesSummary: string
  ): Promise<{ deliverable: Deliverable; revision: any }> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get original deliverable
      const originalResult = await client.query(
        `SELECT * FROM deliverables WHERE id = $1`,
        [originalDeliverableId]
      );

      if (originalResult.rows.length === 0) {
        throw new Error('Original deliverable not found');
      }

      const original: Deliverable = originalResult.rows[0];

      // Create new deliverable with incremented revision number
      const newDeliverableResult = await client.query(
        `INSERT INTO deliverables (
          campaign_id, deliverable_type, round_number, revision_number,
          delivery_method, status, production_started_at
        ) VALUES ($1, $2, $3, $4, $5, 'in_production', NOW())
        RETURNING *`,
        [
          original.campaign_id,
          original.deliverable_type,
          original.round_number,
          original.revision_number + 1,
          original.delivery_method
        ]
      );

      const newDeliverable: Deliverable = newDeliverableResult.rows[0];

      // Create revision record
      const revisionResult = await client.query(
        `INSERT INTO deliverable_revisions (
          deliverable_id, revision_label, changes_summary
        ) VALUES ($1, $2, $3)
        RETURNING *`,
        [
          newDeliverable.id,
          `R${newDeliverable.round_number}.${newDeliverable.revision_number}`,
          changesSummary
        ]
      );

      // Create 24-hour revision SLA timer
      await client.query(
        `INSERT INTO sla_timers (
          reference_type, reference_id, duration_hours, started_at, status
        ) VALUES ('revision', $1, 24, NOW(), 'active')`,
        [newDeliverable.id]
      );

      await client.query('COMMIT');

      logger.info('Deliverable revision created', {
        originalId: originalDeliverableId,
        newId: newDeliverable.id,
        revisionLabel: `R${newDeliverable.round_number}.${newDeliverable.revision_number}`
      });

      return {
        deliverable: newDeliverable,
        revision: revisionResult.rows[0]
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create revision', { originalDeliverableId, error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update AM notes
   */
  async updateAMNotes(deliverableId: string, notes: string): Promise<void> {
    try {
      await this.db.query(
        `UPDATE deliverables SET am_notes = $1 WHERE id = $2`,
        [notes, deliverableId]
      );

      logger.info('AM notes updated', { deliverableId });
    } catch (error) {
      logger.error('Failed to update AM notes', { deliverableId, error });
      throw error;
    }
  }

  /**
   * Get deliverable approval progress
   */
  async getApprovalProgress(deliverableId: string): Promise<{
    totalFormats: number;
    approvedFormats: number;
    rejectedFormats: number;
    pendingFormats: number;
    percentComplete: number;
    isFullyApproved: boolean;
  }> {
    try {
      const result = await this.db.query(
        `SELECT
          COUNT(DISTINCT campaign_format_id) as total_formats,
          COUNT(DISTINCT campaign_format_id) FILTER (WHERE status = 'approved') as approved_formats,
          COUNT(DISTINCT campaign_format_id) FILTER (WHERE status = 'rejected') as rejected_formats,
          COUNT(DISTINCT campaign_format_id) FILTER (WHERE status = 'pending') as pending_formats
         FROM format_approvals
         WHERE deliverable_id = $1`,
        [deliverableId]
      );

      const stats = result.rows[0];
      const total = parseInt(stats.total_formats) || 0;
      const approved = parseInt(stats.approved_formats) || 0;
      const rejected = parseInt(stats.rejected_formats) || 0;
      const pending = parseInt(stats.pending_formats) || 0;

      const percentComplete = total > 0 ? Math.round((approved / total) * 100) : 0;
      const isFullyApproved = total > 0 && approved === total;

      return {
        totalFormats: total,
        approvedFormats: approved,
        rejectedFormats: rejected,
        pendingFormats: pending,
        percentComplete,
        isFullyApproved
      };
    } catch (error) {
      logger.error('Failed to get approval progress', { deliverableId, error });
      throw error;
    }
  }
}

export default DeliverableService;
