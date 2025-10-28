/**
 * Database Configuration Service
 *
 * Manages PostgreSQL connection pool, health checks, and connection lifecycle.
 * Uses pg library with connection pooling for optimal performance.
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { Logger } from '../utils/logger';

const logger = new Logger('DatabaseConfig');

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

class Database {
  private static instance: Database;
  private pool: Pool | null = null;
  private isConnected: boolean = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * Initialize database connection pool
   */
  public async connect(): Promise<void> {
    if (this.isConnected && this.pool) {
      logger.info('Database already connected');
      return;
    }

    try {
      // Validate environment variables
      this.validateConfig();

      // Parse DATABASE_URL or use individual variables
      const config = this.getConfig();

      // Create connection pool
      this.pool = new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        max: config.max,
        idleTimeoutMillis: config.idleTimeoutMillis,
        connectionTimeoutMillis: config.connectionTimeoutMillis,
      });

      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info('Database connected successfully', {
        database: config.database,
        host: config.host,
        port: config.port,
        serverTime: result.rows[0].now,
      });

      // Handle pool errors
      this.pool.on('error', (err) => {
        logger.error('Unexpected database pool error', err);
      });
    } catch (error) {
      logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  public async disconnect(): Promise<void> {
    if (!this.pool) {
      logger.warn('No database connection to close');
      return;
    }

    try {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from database', error);
      throw error;
    }
  }

  /**
   * Execute a query
   */
  public async query<T = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      logger.debug('Query executed', {
        duration: `${duration}ms`,
        rows: result.rowCount,
        query: text.substring(0, 100),
      });

      return result;
    } catch (error) {
      logger.error('Query execution failed', {
        query: text.substring(0, 100),
        params,
        error,
      });
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  public async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    try {
      const client = await this.pool.connect();
      return client;
    } catch (error) {
      logger.error('Failed to get database client', error);
      throw error;
    }
  }

  /**
   * Execute a transaction
   */
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction failed, rolled back', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check database health
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency: number;
    error?: string;
  }> {
    const start = Date.now();

    try {
      if (!this.pool) {
        return {
          status: 'unhealthy',
          latency: 0,
          error: 'Database not connected',
        };
      }

      await this.pool.query('SELECT 1');
      const latency = Date.now() - start;

      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get connection pool stats
   */
  public getPoolStats() {
    if (!this.pool) {
      return null;
    }

    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * Validate required environment variables
   */
  private validateConfig(): void {
    const requiredVars = ['DATABASE_URL'];
    const missing = requiredVars.filter((v) => !process.env[v]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`
      );
    }
  }

  /**
   * Parse database configuration from environment
   */
  private getConfig(): DatabaseConfig {
    // Parse DATABASE_URL (postgresql://user:password@host:port/database)
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable not set');
    }

    try {
      const url = new URL(databaseUrl);

      return {
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        database: url.pathname.substring(1),
        user: url.username,
        password: url.password,
        max: parseInt(process.env.DB_POOL_MAX || '20'),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
        connectionTimeoutMillis: parseInt(
          process.env.DB_CONNECTION_TIMEOUT || '5000'
        ),
      };
    } catch (error) {
      throw new Error(`Invalid DATABASE_URL format: ${error}`);
    }
  }

  /**
   * Check if database is connected
   */
  public get connected(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const db = Database.getInstance();

// Export types
export { Database, DatabaseConfig, PoolClient, QueryResult };
