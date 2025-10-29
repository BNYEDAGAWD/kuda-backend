/**
 * Express Application
 *
 * Main application setup with middleware, routes, and error handling.
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { db } from './config/database.config';
import { Logger } from './utils/logger';

// Routes - KCAP Workflow
import createCampaignRouter from './routes/campaign.routes';
import createAssetPackRouter from './routes/asset-pack.routes';
import createDeliverableRouter from './routes/deliverable.routes';
import createApprovalRouter from './routes/approval.routes';
import createSLARouter from './routes/sla.routes';

const logger = new Logger('App');

export class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  /**
   * Initialize middleware
   */
  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet());

    // CORS
    this.app.use(
      cors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
      })
    );

    // Request logging
    if (process.env.NODE_ENV !== 'production') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // Body parsers
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    logger.info('Middleware initialized');
  }

  /**
   * Initialize routes
   */
  private initializeRoutes(): void {
    // Health check
    this.app.get('/health', async (req: Request, res: Response) => {
      const dbHealth = await db.healthCheck();

      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: dbHealth,
        uptime: process.uptime(),
      });
    });

    // API routes - KCAP Workflow
    this.app.use('/api/campaigns', createCampaignRouter(db.pool));
    this.app.use('/api/asset-packs', createAssetPackRouter(db.pool));
    this.app.use('/api/deliverables', createDeliverableRouter(db.pool));
    this.app.use('/api/approvals', createApprovalRouter(db.pool));
    this.app.use('/api/sla-timers', createSLARouter(db.pool));

    // Root route
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'Kargo Creative Approval Platform (KCAP) API',
        version: '2.0.0',
        status: 'running',
        workflow: 'Client uploads assets → Kargo builds creatives → Client approves',
        endpoints: {
          campaigns: '/api/campaigns',
          assetPacks: '/api/asset-packs',
          deliverables: '/api/deliverables',
          approvals: '/api/approvals',
          slaTimers: '/api/sla-timers',
          health: '/health'
        }
      });
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
      });
    });

    logger.info('Routes initialized');
  }

  /**
   * Initialize error handling
   */
  private initializeErrorHandling(): void {
    this.app.use(
      (error: Error, req: Request, res: Response, next: NextFunction) => {
        logger.error('Unhandled error', {
          error: error.message,
          stack: error.stack,
          path: req.path,
          method: req.method,
        });

        res.status(500).json({
          error: 'Internal Server Error',
          message:
            process.env.NODE_ENV === 'production'
              ? 'An unexpected error occurred'
              : error.message,
        });
      }
    );

    logger.info('Error handling initialized');
  }

  /**
   * Start the server
   */
  public async start(port: number = 4000): Promise<void> {
    try {
      // Connect to database
      await db.connect();

      // Start server
      this.app.listen(port, () => {
        logger.info(`Server started on port ${port}`, {
          environment: process.env.NODE_ENV || 'development',
          port,
        });
      });
    } catch (error) {
      logger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down server...');

    try {
      await db.disconnect();
      logger.info('Server shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  const app = new App();
  await app.shutdown();
});

process.on('SIGINT', async () => {
  const app = new App();
  await app.shutdown();
});

export default App;
