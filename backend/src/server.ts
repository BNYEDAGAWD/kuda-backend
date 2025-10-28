/**
 * Server Entry Point
 *
 * Starts the Express server.
 */

import dotenv from 'dotenv';
import App from './app';
import { Logger } from './utils/logger';

// Load environment variables
dotenv.config();

const logger = new Logger('Server');

const PORT = parseInt(process.env.PORT || '4000');

// Create and start app
const app = new App();

app
  .start(PORT)
  .then(() => {
    logger.info('Application started successfully');
  })
  .catch((error) => {
    logger.error('Failed to start application', error);
    process.exit(1);
  });
