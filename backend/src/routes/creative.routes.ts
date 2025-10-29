/**
 * Creative Routes
 *
 * Endpoints for creative approval workflow.
 * Kargo team uses these to approve/reject/request changes on client-uploaded creatives.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import ApprovalService from '../services/approval.service';
import TagGeneratorService from '../services/tag-generator.service';
import EmailService from '../services/email.service';
import CampaignService from '../services/campaign.service';
import { Logger } from '../utils/logger';

const logger = new Logger('CreativeRoutes');

export function createCreativeRoutes(db: Pool): Router {
  const router = Router();
  const approvalService = new ApprovalService(db);
  const tagGenerator = new TagGeneratorService(db);
  const emailService = new EmailService();
  const campaignService = new CampaignService(db);

  /**
   * GET /api/creatives
   * List creatives with filters
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const {
        campaign_id,
        status,
        submitted_by,
        priority,
        limit,
        offset
      } = req.query;

      const result = await approvalService.listCreatives({
        campaign_id: campaign_id as string,
        status: status as string,
        submitted_by: submitted_by as string,
        priority: priority as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined
      });

      res.json({
        success: true,
        data: result.creatives,
        total: result.total,
        count: result.creatives.length
      });
    } catch (error: any) {
      logger.error('Failed to list creatives', error);
      res.status(500).json({
        error: 'Failed to list creatives',
        message: error.message
      });
    }
  });

  /**
   * GET /api/creatives/pending
   * Get pending creatives for dashboard
   */
  router.get('/pending', async (req: Request, res: Response) => {
    try {
      const { campaign_id, priority } = req.query;

      const creatives = await approvalService.getPendingCreatives({
        campaign_id: campaign_id as string,
        priority: priority as string
      });

      res.json({
        success: true,
        data: creatives,
        count: creatives.length
      });
    } catch (error: any) {
      logger.error('Failed to get pending creatives', error);
      res.status(500).json({
        error: 'Failed to get pending creatives',
        message: error.message
      });
    }
  });

  /**
   * GET /api/creatives/:id
   * Get creative by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const creative = await approvalService.getCreativeById(id);

      if (!creative) {
        return res.status(404).json({
          error: 'Creative not found'
        });
      }

      // Get approval history
      const history = await approvalService.getApprovalHistory(id);

      // Get generated tags if approved
      let latestTag = null;
      if (creative.status === 'approved') {
        latestTag = await tagGenerator.getLatestTag(id);
      }

      res.json({
        success: true,
        data: {
          creative,
          approvalHistory: history,
          latestTag
        }
      });
    } catch (error: any) {
      logger.error('Failed to get creative', error);
      res.status(500).json({
        error: 'Failed to get creative',
        message: error.message
      });
    }
  });

  /**
   * POST /api/creatives/:id/approve
   * Approve a creative
   */
  router.post('/:id/approve', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { feedback, actor_email } = req.body;

      if (!actor_email) {
        return res.status(400).json({
          error: 'actor_email is required'
        });
      }

      // Approve creative
      const creative = await approvalService.approveCreative(
        id,
        feedback || '',
        actor_email
      );

      // Get campaign details
      const campaign = await campaignService.getCampaignById(creative.campaign_id);

      if (!campaign) {
        logger.error('Campaign not found for creative', {
          creativeId: id,
          campaignId: creative.campaign_id
        });
      } else {
        // Generate tag
        try {
          await tagGenerator.generateTag(creative, campaign, actor_email);
          logger.info('Tag generated after approval', { creativeId: id });
        } catch (tagError) {
          logger.error('Failed to generate tag', tagError);
          // Don't fail the approval
        }

        // Send approval email to client
        try {
          await emailService.sendCreativeApprovedEmail(
            creative,
            campaign,
            feedback || ''
          );
          logger.info('Approval email sent', { creativeId: id });
        } catch (emailError) {
          logger.error('Failed to send approval email', emailError);
        }
      }

      res.json({
        success: true,
        data: creative,
        message: 'Creative approved successfully'
      });
    } catch (error: any) {
      logger.error('Failed to approve creative', error);

      if (error.message === 'Creative not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to approve creative',
        message: error.message
      });
    }
  });

  /**
   * POST /api/creatives/:id/reject
   * Reject a creative
   */
  router.post('/:id/reject', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason, actor_email } = req.body;

      if (!actor_email) {
        return res.status(400).json({
          error: 'actor_email is required'
        });
      }

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({
          error: 'Rejection reason is required'
        });
      }

      // Reject creative
      const creative = await approvalService.rejectCreative(
        id,
        reason,
        actor_email
      );

      // Get campaign details
      const campaign = await campaignService.getCampaignById(creative.campaign_id);

      if (campaign) {
        // Send rejection email to client
        try {
          await emailService.sendCreativeRejectedEmail(
            creative,
            campaign,
            reason
          );
          logger.info('Rejection email sent', { creativeId: id });
        } catch (emailError) {
          logger.error('Failed to send rejection email', emailError);
        }
      }

      res.json({
        success: true,
        data: creative,
        message: 'Creative rejected'
      });
    } catch (error: any) {
      logger.error('Failed to reject creative', error);

      if (error.message === 'Creative not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to reject creative',
        message: error.message
      });
    }
  });

  /**
   * POST /api/creatives/:id/request-changes
   * Request changes to a creative
   */
  router.post('/:id/request-changes', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { changes, actor_email } = req.body;

      if (!actor_email) {
        return res.status(400).json({
          error: 'actor_email is required'
        });
      }

      if (!changes || changes.trim().length === 0) {
        return res.status(400).json({
          error: 'Change request details are required'
        });
      }

      // Request changes
      const creative = await approvalService.requestChanges(
        id,
        changes,
        actor_email
      );

      // Get campaign details
      const campaign = await campaignService.getCampaignById(creative.campaign_id);

      if (campaign) {
        // Send changes requested email to client
        try {
          await emailService.sendChangesRequestedEmail(
            creative,
            campaign,
            changes
          );
          logger.info('Changes requested email sent', { creativeId: id });
        } catch (emailError) {
          logger.error('Failed to send changes requested email', emailError);
        }
      }

      res.json({
        success: true,
        data: creative,
        message: 'Changes requested'
      });
    } catch (error: any) {
      logger.error('Failed to request changes', error);

      if (error.message === 'Creative not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to request changes',
        message: error.message
      });
    }
  });

  /**
   * POST /api/creatives/bulk-approve
   * Bulk approve multiple creatives
   */
  router.post('/bulk-approve', async (req: Request, res: Response) => {
    try {
      const { creative_ids, feedback, actor_email } = req.body;

      if (!actor_email) {
        return res.status(400).json({
          error: 'actor_email is required'
        });
      }

      if (!creative_ids || !Array.isArray(creative_ids) || creative_ids.length === 0) {
        return res.status(400).json({
          error: 'creative_ids must be a non-empty array'
        });
      }

      // Bulk approve
      const results = await approvalService.bulkApprove(
        creative_ids,
        feedback || '',
        actor_email
      );

      // Generate tags and send emails for successful approvals
      for (const result of results) {
        if (result.success) {
          try {
            const creative = await approvalService.getCreativeById(result.creativeId);
            if (creative) {
              const campaign = await campaignService.getCampaignById(creative.campaign_id);
              if (campaign) {
                // Generate tag
                await tagGenerator.generateTag(creative, campaign, actor_email);

                // Send email
                await emailService.sendCreativeApprovedEmail(
                  creative,
                  campaign,
                  feedback || ''
                );
              }
            }
          } catch (error) {
            logger.error('Failed to generate tag or send email for bulk approved creative', {
              creativeId: result.creativeId,
              error
            });
          }
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failedCount = results.length - successCount;

      res.json({
        success: true,
        data: results,
        summary: {
          total: results.length,
          success: successCount,
          failed: failedCount
        }
      });
    } catch (error: any) {
      logger.error('Failed to bulk approve creatives', error);
      res.status(500).json({
        error: 'Failed to bulk approve creatives',
        message: error.message
      });
    }
  });

  /**
   * PATCH /api/creatives/:id/priority
   * Update creative priority
   */
  router.patch('/:id/priority', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { priority } = req.body;

      const validPriorities = ['normal', 'high', 'urgent'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({
          error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}`
        });
      }

      const creative = await approvalService.updatePriority(id, priority);

      res.json({
        success: true,
        data: creative
      });
    } catch (error: any) {
      logger.error('Failed to update priority', error);

      if (error.message === 'Creative not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to update priority',
        message: error.message
      });
    }
  });

  /**
   * PATCH /api/creatives/:id/notes
   * Update internal notes
   */
  router.patch('/:id/notes', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      const creative = await approvalService.updateInternalNotes(id, notes || '');

      res.json({
        success: true,
        data: creative
      });
    } catch (error: any) {
      logger.error('Failed to update notes', error);

      if (error.message === 'Creative not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to update notes',
        message: error.message
      });
    }
  });

  /**
   * GET /api/creatives/:id/history
   * Get approval history for creative
   */
  router.get('/:id/history', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const history = await approvalService.getApprovalHistory(id);

      res.json({
        success: true,
        data: history,
        count: history.length
      });
    } catch (error: any) {
      logger.error('Failed to get approval history', error);
      res.status(500).json({
        error: 'Failed to get approval history',
        message: error.message
      });
    }
  });

  /**
   * GET /api/creatives/:id/tags
   * Get all tag versions for creative
   */
  router.get('/:id/tags', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const tags = await tagGenerator.getTagVersions(id);

      res.json({
        success: true,
        data: tags,
        count: tags.length
      });
    } catch (error: any) {
      logger.error('Failed to get tag versions', error);
      res.status(500).json({
        error: 'Failed to get tag versions',
        message: error.message
      });
    }
  });

  /**
   * POST /api/creatives/:id/regenerate-tag
   * Regenerate tag for creative
   */
  router.post('/:id/regenerate-tag', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { actor_email } = req.body;

      if (!actor_email) {
        return res.status(400).json({
          error: 'actor_email is required'
        });
      }

      const tagCode = await tagGenerator.regenerateTag(id, actor_email);

      res.json({
        success: true,
        data: {
          tagCode
        },
        message: 'Tag regenerated successfully'
      });
    } catch (error: any) {
      logger.error('Failed to regenerate tag', error);

      if (error.message === 'Creative not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Failed to regenerate tag',
        message: error.message
      });
    }
  });

  return router;
}

export default createCreativeRoutes;
