/**
 * Approval Service - Hybrid approval with mandatory rejection feedback
 */
import { Pool } from 'pg';
import { Logger } from '../utils/logger';

const logger = new Logger('ApprovalService');

export class ApprovalService {
  constructor(private db: Pool) {}

  async approveFormat(deliverableId: string, formatId: string, reviewedBy: string) {
    const result = await this.db.query(
      `INSERT INTO format_approvals (deliverable_id, campaign_format_id, approval_level, status, reviewed_by, reviewed_at)
       VALUES ($1, $2, 'format', 'approved', $3, NOW()) RETURNING *`,
      [deliverableId, formatId, reviewedBy]
    );
    return result.rows[0];
  }

  async rejectFormat(deliverableId: string, formatId: string, reviewedBy: string, feedback: string) {
    if (!feedback?.trim()) throw new Error('Rejection feedback is MANDATORY');
    const result = await this.db.query(
      `INSERT INTO format_approvals (deliverable_id, campaign_format_id, approval_level, status, reviewed_by, reviewed_at, rejection_feedback)
       VALUES ($1, $2, 'format', 'rejected', $3, NOW(), $4) RETURNING *`,
      [deliverableId, formatId, reviewedBy, feedback.trim()]
    );
    return result.rows[0];
  }

  async approveDevice(deliverableId: string, formatId: string, device: string, reviewedBy: string) {
    const result = await this.db.query(
      `INSERT INTO format_approvals (deliverable_id, campaign_format_id, approval_level, device, status, reviewed_by, reviewed_at)
       VALUES ($1, $2, 'device', $3, 'approved', $4, NOW()) RETURNING *`,
      [deliverableId, formatId, device, reviewedBy]
    );
    return result.rows[0];
  }

  async rejectDevice(deliverableId: string, formatId: string, device: string, reviewedBy: string, feedback: string) {
    if (!feedback?.trim()) throw new Error('Rejection feedback is MANDATORY');
    const result = await this.db.query(
      `INSERT INTO format_approvals (deliverable_id, campaign_format_id, approval_level, device, status, reviewed_by, reviewed_at, rejection_feedback)
       VALUES ($1, $2, 'device', $3, 'rejected', $4, NOW(), $5) RETURNING *`,
      [deliverableId, formatId, device, reviewedBy, feedback.trim()]
    );
    return result.rows[0];
  }
}

export default ApprovalService;
