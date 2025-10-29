/**
 * Approval Routes - Hybrid approval (format-level OR device-level)
 */
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import ApprovalService from '../services/approval.service';
import { Logger } from '../utils/logger';

const router = Router();
const logger = new Logger('ApprovalRoutes');

export const createApprovalRouter = (db: Pool) => {
  const approvalService = new ApprovalService(db);

  // Approve entire format (all devices)
  router.post('/format/approve', async (req: Request, res: Response) => {
    try {
      const { deliverable_id, format_id, reviewed_by } = req.body;
      const approval = await approvalService.approveFormat(
        deliverable_id,
        format_id,
        reviewed_by
      );
      logger.info('Format approved', { deliverableId: deliverable_id, formatId: format_id });
      res.status(201).json(approval);
    } catch (error) {
      logger.error('Error approving format', error);
      res.status(500).json({ error: 'Failed to approve format' });
    }
  });

  // Reject entire format (MANDATORY feedback)
  router.post('/format/reject', async (req: Request, res: Response) => {
    try {
      const { deliverable_id, format_id, reviewed_by, feedback } = req.body;

      if (!feedback || feedback.trim().length === 0) {
        return res.status(400).json({ 
          error: 'Rejection feedback is MANDATORY when rejecting a format' 
        });
      }

      const approval = await approvalService.rejectFormat(
        deliverable_id,
        format_id,
        reviewed_by,
        feedback
      );
      logger.info('Format rejected', { deliverableId: deliverable_id, formatId: format_id });
      res.status(201).json(approval);
    } catch (error) {
      logger.error('Error rejecting format', error);
      res.status(500).json({ error: error.message || 'Failed to reject format' });
    }
  });

  // Approve specific device view
  router.post('/device/approve', async (req: Request, res: Response) => {
    try {
      const { deliverable_id, format_id, device, reviewed_by } = req.body;
      const approval = await approvalService.approveDevice(
        deliverable_id,
        format_id,
        device,
        reviewed_by
      );
      logger.info('Device approved', { 
        deliverableId: deliverable_id, 
        formatId: format_id, 
        device 
      });
      res.status(201).json(approval);
    } catch (error) {
      logger.error('Error approving device', error);
      res.status(500).json({ error: 'Failed to approve device' });
    }
  });

  // Reject specific device view (MANDATORY feedback)
  router.post('/device/reject', async (req: Request, res: Response) => {
    try {
      const { deliverable_id, format_id, device, reviewed_by, feedback } = req.body;

      if (!feedback || feedback.trim().length === 0) {
        return res.status(400).json({ 
          error: 'Rejection feedback is MANDATORY when rejecting a device view' 
        });
      }

      const approval = await approvalService.rejectDevice(
        deliverable_id,
        format_id,
        device,
        reviewed_by,
        feedback
      );
      logger.info('Device rejected', { 
        deliverableId: deliverable_id, 
        formatId: format_id, 
        device 
      });
      res.status(201).json(approval);
    } catch (error) {
      logger.error('Error rejecting device', error);
      res.status(500).json({ error: error.message || 'Failed to reject device' });
    }
  });

  // Get all approvals for deliverable
  router.get('/deliverable/:deliverableId', async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT fa.*, cf.format_id, fl.format_name
         FROM format_approvals fa
         JOIN campaign_formats cf ON fa.campaign_format_id = cf.id
         JOIN format_library fl ON cf.format_id = fl.id
         WHERE fa.deliverable_id = $1
         ORDER BY fa.reviewed_at DESC`,
        [req.params.deliverableId]
      );
      res.json(result.rows);
    } catch (error) {
      logger.error('Error fetching approvals', error);
      res.status(500).json({ error: 'Failed to fetch approvals' });
    }
  });

  // Get approval status summary for deliverable
  router.get('/deliverable/:deliverableId/summary', async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
           COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
           COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
           JSONB_AGG(
             JSONB_BUILD_OBJECT(
               'format_name', fl.format_name,
               'approval_level', fa.approval_level,
               'device', fa.device,
               'status', fa.status,
               'rejection_feedback', fa.rejection_feedback
             )
           ) as approvals
         FROM format_approvals fa
         JOIN campaign_formats cf ON fa.campaign_format_id = cf.id
         JOIN format_library fl ON cf.format_id = fl.id
         WHERE fa.deliverable_id = $1`,
        [req.params.deliverableId]
      );
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching approval summary', error);
      res.status(500).json({ error: 'Failed to fetch approval summary' });
    }
  });

  return router;
};

export default createApprovalRouter;
