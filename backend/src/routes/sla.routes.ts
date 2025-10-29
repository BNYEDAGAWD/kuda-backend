/**
 * SLA Timer Routes - 48h/24h countdown tracking and management
 */
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import SLATimerService from '../services/sla-timer.service';
import { Logger } from '../utils/logger';

const router = Router();
const logger = new Logger('SLARoutes');

export const createSLARouter = (db: Pool) => {
  const slaService = new SLATimerService(db);

  // Start new SLA timer
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { reference_type, reference_id, duration_hours } = req.body;
      const timer = await slaService.startTimer(reference_type, reference_id, duration_hours);
      logger.info('SLA timer started', { 
        timerId: timer.id, 
        type: reference_type, 
        duration: duration_hours 
      });
      res.status(201).json(timer);
    } catch (error) {
      logger.error('Error starting SLA timer', error);
      res.status(500).json({ error: 'Failed to start SLA timer' });
    }
  });

  // Get all active timers
  router.get('/active', async (req: Request, res: Response) => {
    try {
      const timers = await slaService.getActiveTimers();
      res.json(timers);
    } catch (error) {
      logger.error('Error fetching active timers', error);
      res.status(500).json({ error: 'Failed to fetch active timers' });
    }
  });

  // Get timers at risk (< 6 hours remaining)
  router.get('/at-risk', async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT *, EXTRACT(EPOCH FROM (deadline - NOW())) / 3600 as hours_remaining
         FROM sla_timers
         WHERE status = 'active'
         AND deadline - NOW() < INTERVAL '6 hours'
         ORDER BY deadline ASC`
      );
      res.json(result.rows);
    } catch (error) {
      logger.error('Error fetching at-risk timers', error);
      res.status(500).json({ error: 'Failed to fetch at-risk timers' });
    }
  });

  // Adjust SLA timer (AM override)
  router.patch('/:id/adjust', async (req: Request, res: Response) => {
    try {
      const { new_duration_hours, reason, adjusted_by } = req.body;

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({ 
          error: 'Reason is required when adjusting SLA timer' 
        });
      }

      const timer = await slaService.adjustTimer(
        req.params.id,
        new_duration_hours,
        reason,
        adjusted_by
      );
      logger.info('SLA timer adjusted', { 
        timerId: req.params.id, 
        newDuration: new_duration_hours,
        adjustedBy: adjusted_by 
      });
      res.json(timer);
    } catch (error) {
      logger.error('Error adjusting SLA timer', error);
      res.status(500).json({ error: 'Failed to adjust SLA timer' });
    }
  });

  // Complete SLA timer
  router.post('/:id/complete', async (req: Request, res: Response) => {
    try {
      await slaService.completeTimer(req.params.id);
      logger.info('SLA timer completed', { timerId: req.params.id });
      res.status(204).send();
    } catch (error) {
      logger.error('Error completing SLA timer', error);
      res.status(500).json({ error: 'Failed to complete SLA timer' });
    }
  });

  // Get timer by reference
  router.get('/reference/:type/:id', async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT *, EXTRACT(EPOCH FROM (deadline - NOW())) / 3600 as hours_remaining
         FROM sla_timers
         WHERE reference_type = $1 AND reference_id = $2
         ORDER BY started_at DESC
         LIMIT 1`,
        [req.params.type, req.params.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Timer not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching timer by reference', error);
      res.status(500).json({ error: 'Failed to fetch timer' });
    }
  });

  // Get timer history for reference
  router.get('/reference/:type/:id/history', async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT *
         FROM sla_timers
         WHERE reference_type = $1 AND reference_id = $2
         ORDER BY started_at DESC`,
        [req.params.type, req.params.id]
      );
      res.json(result.rows);
    } catch (error) {
      logger.error('Error fetching timer history', error);
      res.status(500).json({ error: 'Failed to fetch timer history' });
    }
  });

  return router;
};

export default createSLARouter;
