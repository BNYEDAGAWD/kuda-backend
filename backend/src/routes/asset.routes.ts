/**
 * Asset API Routes
 *
 * Endpoints for searching and managing individual assets.
 */

import { Router, Request, Response } from 'express';
import { db } from '../config/database.config';
import { Logger } from '../utils/logger';

const router = Router();
const logger = new Logger('AssetRoutes');

/**
 * GET /api/assets
 * List assets with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      campaignId,
      packageId,
      category,
      subcategory,
      isFinalCreative,
      approvalStatus,
      limit = '50',
      offset = '0',
    } = req.query;

    let query = `SELECT * FROM assets WHERE 1=1`;
    const params: any[] = [];

    if (campaignId) {
      query += ` AND campaign_id = $${params.length + 1}`;
      params.push(campaignId);
    }

    if (packageId) {
      query += ` AND package_id = $${params.length + 1}`;
      params.push(packageId);
    }

    if (category) {
      query += ` AND file_category = $${params.length + 1}`;
      params.push(category);
    }

    if (subcategory) {
      query += ` AND file_subcategory = $${params.length + 1}`;
      params.push(subcategory);
    }

    if (isFinalCreative !== undefined) {
      query += ` AND is_final_creative = $${params.length + 1}`;
      params.push(isFinalCreative === 'true');
    }

    if (approvalStatus) {
      query += ` AND approval_status = $${params.length + 1}`;
      params.push(approvalStatus);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM assets WHERE 1=1`;
    const countParams: any[] = [];

    if (campaignId) {
      countQuery += ` AND campaign_id = $${countParams.length + 1}`;
      countParams.push(campaignId);
    }

    if (packageId) {
      countQuery += ` AND package_id = $${countParams.length + 1}`;
      countParams.push(packageId);
    }

    if (category) {
      countQuery += ` AND file_category = $${countParams.length + 1}`;
      countParams.push(category);
    }

    if (isFinalCreative !== undefined) {
      countQuery += ` AND is_final_creative = $${countParams.length + 1}`;
      countParams.push(isFinalCreative === 'true');
    }

    if (approvalStatus) {
      countQuery += ` AND approval_status = $${countParams.length + 1}`;
      countParams.push(approvalStatus);
    }

    const countResult = await db.query(countQuery, countParams);

    res.json({
      assets: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    logger.error('Failed to list assets', error);
    res.status(500).json({
      error: 'Failed to retrieve assets',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/assets/search
 * Full-text search for assets
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const {
      q, // Search query
      campaignId,
      category,
      dimensions,
      isFinalCreative,
      limit = '50',
      offset = '0',
    } = req.query;

    if (!q) {
      return res.status(400).json({
        error: 'Missing required parameter: q (search query)',
      });
    }

    let query = `
      SELECT * FROM assets
      WHERE (
        original_filename ILIKE $1
        OR organized_filename ILIKE $1
        OR $2 = ANY(tags)
      )
    `;
    const params: any[] = [`%${q}%`, q];

    if (campaignId) {
      query += ` AND campaign_id = $${params.length + 1}`;
      params.push(campaignId);
    }

    if (category) {
      query += ` AND file_category = $${params.length + 1}`;
      params.push(category);
    }

    if (dimensions) {
      query += ` AND dimensions = $${params.length + 1}`;
      params.push(dimensions);
    }

    if (isFinalCreative !== undefined) {
      query += ` AND is_final_creative = $${params.length + 1}`;
      params.push(isFinalCreative === 'true');
    }

    query += ` ORDER BY
      CASE
        WHEN original_filename ILIKE $1 THEN 1
        WHEN organized_filename ILIKE $1 THEN 2
        ELSE 3
      END,
      created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await db.query(query, params);

    res.json({
      query: q,
      assets: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Asset search failed', error);
    res.status(500).json({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/assets/:id
 * Get asset details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.query(`SELECT * FROM assets WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Asset not found',
      });
    }

    res.json({
      asset: result.rows[0],
    });
  } catch (error) {
    logger.error('Failed to get asset details', error);
    res.status(500).json({
      error: 'Failed to retrieve asset',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/assets/final-creatives/campaign/:campaignId
 * Get all final creatives for a campaign (ready for approval)
 */
router.get('/final-creatives/campaign/:campaignId', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { approvalStatus = 'pending' } = req.query;

    const result = await db.query(
      `SELECT * FROM pending_final_creatives
       WHERE campaign_id = $1 AND approval_status = $2
       ORDER BY created_at DESC`,
      [campaignId, approvalStatus]
    );

    res.json({
      campaignId,
      finalCreatives: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Failed to get final creatives', error);
    res.status(500).json({
      error: 'Failed to retrieve final creatives',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/assets/categories/campaign/:campaignId
 * Get asset category breakdown for a campaign
 */
router.get('/categories/campaign/:campaignId', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;

    const result = await db.query(
      `SELECT * FROM asset_category_breakdown WHERE campaign_id = $1`,
      [campaignId]
    );

    res.json({
      campaignId,
      categories: result.rows,
    });
  } catch (error) {
    logger.error('Failed to get category breakdown', error);
    res.status(500).json({
      error: 'Failed to retrieve category breakdown',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
