/**
 * SLA Timer Service - 48h/24h countdown tracking
 */
import { Pool } from 'pg';
import { Logger } from '../utils/logger';

const logger = new Logger('SLATimerService');

export class SLATimerService {
  constructor(private db: Pool) {}

  async startTimer(type: string, referenceId: string, durationHours: number) {
    const result = await this.db.query(
      `INSERT INTO sla_timers (reference_type, reference_id, duration_hours, started_at, status)
       VALUES ($1, $2, $3, NOW(), 'active') RETURNING *`,
      [type, referenceId, durationHours]
    );
    logger.info('SLA timer started', { type, referenceId, durationHours });
    return result.rows[0];
  }

  async getActiveTimers() {
    const result = await this.db.query(
      `SELECT *, EXTRACT(EPOCH FROM (deadline - NOW())) / 3600 as hours_remaining
       FROM sla_timers WHERE status = 'active' ORDER BY deadline ASC`
    );
    return result.rows;
  }

  async adjustTimer(timerId: string, newDurationHours: number, reason: string, adjustedBy: string) {
    const result = await this.db.query(
      `UPDATE sla_timers
       SET duration_hours = $1, adjustment_reason = $2, adjusted_by = $3,
           original_duration_hours = COALESCE(original_duration_hours, duration_hours)
       WHERE id = $4 RETURNING *`,
      [newDurationHours, reason, adjustedBy, timerId]
    );
    return result.rows[0];
  }

  async completeTimer(timerId: string) {
    await this.db.query(
      `UPDATE sla_timers SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [timerId]
    );
  }
}

export default SLATimerService;
