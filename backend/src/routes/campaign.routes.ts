/**
 * Campaign Routes - Campaign creation, format selection, portal link generation
 */
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import CampaignService from '../services/campaign.service';
import { Logger } from '../utils/logger';

const router = Router();
const logger = new Logger('CampaignRoutes');

export const createCampaignRouter = (db: Pool) => {
  const campaignService = new CampaignService(db);

  // Create new campaign
  router.post('/', async (req: Request, res: Response) => {
    try {
      const campaign = await campaignService.createCampaign(req.body);
      logger.info('Campaign created', { campaignId: campaign.id });
      res.status(201).json(campaign);
    } catch (error) {
      logger.error('Error creating campaign', error);
      res.status(500).json({ error: 'Failed to create campaign' });
    }
  });

  // Get campaign by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const campaign = await campaignService.getCampaignById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      res.json(campaign);
    } catch (error) {
      logger.error('Error fetching campaign', error);
      res.status(500).json({ error: 'Failed to fetch campaign' });
    }
  });

  // Get all campaigns with optional filters
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { status, client_id } = req.query;
      const campaigns = await campaignService.getAllCampaigns(
        status as string,
        client_id as string
      );
      res.json(campaigns);
    } catch (error) {
      logger.error('Error fetching campaigns', error);
      res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
  });

  // Add format to campaign
  router.post('/:id/formats', async (req: Request, res: Response) => {
    try {
      const { format_id, variations } = req.body;
      const campaignFormat = await campaignService.addFormatToCampaign(
        req.params.id,
        format_id,
        variations
      );
      logger.info('Format added to campaign', { campaignId: req.params.id, formatId: format_id });
      res.status(201).json(campaignFormat);
    } catch (error) {
      logger.error('Error adding format to campaign', error);
      res.status(500).json({ error: 'Failed to add format to campaign' });
    }
  });

  // Get campaign formats
  router.get('/:id/formats', async (req: Request, res: Response) => {
    try {
      const formats = await campaignService.getCampaignFormats(req.params.id);
      res.json(formats);
    } catch (error) {
      logger.error('Error fetching campaign formats', error);
      res.status(500).json({ error: 'Failed to fetch campaign formats' });
    }
  });

  // Generate portal link
  router.post('/:id/portal-link', async (req: Request, res: Response) => {
    try {
      const portalLink = await campaignService.generatePortalLink(req.params.id);
      logger.info('Portal link generated', { campaignId: req.params.id, portalLink });
      res.json({ portal_link: portalLink });
    } catch (error) {
      logger.error('Error generating portal link', error);
      res.status(500).json({ error: 'Failed to generate portal link' });
    }
  });

  // Update campaign status
  router.patch('/:id/status', async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const campaign = await campaignService.updateCampaignStatus(req.params.id, status);
      logger.info('Campaign status updated', { campaignId: req.params.id, status });
      res.json(campaign);
    } catch (error) {
      logger.error('Error updating campaign status', error);
      res.status(500).json({ error: 'Failed to update campaign status' });
    }
  });

  // Update expected launch date
  router.patch('/:id/launch-date', async (req: Request, res: Response) => {
    try {
      const { launch_date } = req.body;
      const campaign = await campaignService.updateLaunchDate(req.params.id, launch_date);
      logger.info('Launch date updated', { campaignId: req.params.id, launch_date });
      res.json(campaign);
    } catch (error) {
      logger.error('Error updating launch date', error);
      res.status(500).json({ error: 'Failed to update launch date' });
    }
  });

  return router;
};

export default createCampaignRouter;
