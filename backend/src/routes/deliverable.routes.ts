/**
 * Deliverable Routes - Static mocks & animated creatives management
 */
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import DeliverableService from '../services/deliverable.service';
import { Logger } from '../utils/logger';

const router = Router();
const logger = new Logger('DeliverableRoutes');

export const createDeliverableRouter = (db: Pool) => {
  const deliverableService = new DeliverableService(db);

  // Create new deliverable (static mock or animated)
  router.post('/', async (req: Request, res: Response) => {
    try {
      const deliverable = await deliverableService.createDeliverable(req.body);
      logger.info('Deliverable created', { 
        deliverableId: deliverable.id, 
        type: deliverable.deliverable_type 
      });
      res.status(201).json(deliverable);
    } catch (error) {
      logger.error('Error creating deliverable', error);
      res.status(500).json({ error: 'Failed to create deliverable' });
    }
  });

  // Get deliverable by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const deliverable = await deliverableService.getDeliverableById(req.params.id);
      if (!deliverable) {
        return res.status(404).json({ error: 'Deliverable not found' });
      }
      res.json(deliverable);
    } catch (error) {
      logger.error('Error fetching deliverable', error);
      res.status(500).json({ error: 'Failed to fetch deliverable' });
    }
  });

  // Get deliverables by campaign
  router.get('/campaign/:campaignId', async (req: Request, res: Response) => {
    try {
      const { deliverable_type, status } = req.query;
      const deliverables = await deliverableService.getDeliverablesByCampaign(
        req.params.campaignId,
        deliverable_type as string,
        status as string
      );
      res.json(deliverables);
    } catch (error) {
      logger.error('Error fetching deliverables', error);
      res.status(500).json({ error: 'Failed to fetch deliverables' });
    }
  });

  // Add demo URL to deliverable
  router.post('/:id/demo-urls', async (req: Request, res: Response) => {
    try {
      const demoUrl = await deliverableService.addDemoUrl(req.params.id, req.body);
      logger.info('Demo URL added', { 
        deliverableId: req.params.id, 
        device: req.body.device 
      });
      res.status(201).json(demoUrl);
    } catch (error) {
      logger.error('Error adding demo URL', error);
      res.status(500).json({ error: error.message || 'Failed to add demo URL' });
    }
  });

  // Get demo URLs for deliverable
  router.get('/:id/demo-urls', async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT ddu.*, cf.format_id, fl.format_name
         FROM deliverable_demo_urls ddu
         JOIN campaign_formats cf ON ddu.campaign_format_id = cf.id
         JOIN format_library fl ON cf.format_id = fl.id
         WHERE ddu.deliverable_id = $1
         ORDER BY fl.format_name, ddu.device`,
        [req.params.id]
      );
      res.json(result.rows);
    } catch (error) {
      logger.error('Error fetching demo URLs', error);
      res.status(500).json({ error: 'Failed to fetch demo URLs' });
    }
  });

  // Mark deliverable as ready for review
  router.post('/:id/mark-ready', async (req: Request, res: Response) => {
    try {
      const deliverable = await deliverableService.markDeliverableReady(req.params.id);
      logger.info('Deliverable marked ready', { deliverableId: req.params.id });
      res.json(deliverable);
    } catch (error) {
      logger.error('Error marking deliverable ready', error);
      res.status(500).json({ error: 'Failed to mark deliverable ready' });
    }
  });

  // Create revision
  router.post('/:id/revisions', async (req: Request, res: Response) => {
    try {
      const { changes_summary } = req.body;
      const revision = await deliverableService.createRevision(
        req.params.id,
        changes_summary
      );
      logger.info('Revision created', { 
        originalId: req.params.id, 
        revisionId: revision.id 
      });
      res.status(201).json(revision);
    } catch (error) {
      logger.error('Error creating revision', error);
      res.status(500).json({ error: 'Failed to create revision' });
    }
  });

  // Get revision history for deliverable
  router.get('/:id/revisions', async (req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT dr.*, d.deliverable_url, d.status
         FROM deliverable_revisions dr
         JOIN deliverables d ON dr.revision_deliverable_id = d.id
         WHERE dr.original_deliverable_id = $1
         ORDER BY dr.created_at DESC`,
        [req.params.id]
      );
      res.json(result.rows);
    } catch (error) {
      logger.error('Error fetching revision history', error);
      res.status(500).json({ error: 'Failed to fetch revision history' });
    }
  });

  // Update deliverable URL (Google Slides or Dropbox)
  router.patch('/:id/url', async (req: Request, res: Response) => {
    try {
      const { deliverable_url } = req.body;
      const result = await db.query(
        `UPDATE deliverables SET deliverable_url = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [deliverable_url, req.params.id]
      );
      logger.info('Deliverable URL updated', { deliverableId: req.params.id });
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Error updating deliverable URL', error);
      res.status(500).json({ error: 'Failed to update deliverable URL' });
    }
  });

  return router;
};

export default createDeliverableRouter;
