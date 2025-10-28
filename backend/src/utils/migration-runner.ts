/**
 * Migration Runner Utility
 *
 * Executes SQL migration files in order.
 * Tracks executed migrations in a `migrations` table.
 */

import fs from 'fs/promises';
import path from 'path';
import { db } from '../config/database.config';
import { Logger } from './logger';

const logger = new Logger('MigrationRunner');

interface Migration {
  id: number;
  name: string;
  executed_at: Date;
}

export class MigrationRunner {
  private migrationsDir: string;

  constructor(migrationsDir?: string) {
    this.migrationsDir =
      migrationsDir || path.join(__dirname, '../../migrations');
  }

  /**
   * Ensure migrations table exists
   */
  private async ensureMigrationsTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await db.query(createTableSQL);
    logger.debug('Migrations table ensured');
  }

  /**
   * Get list of executed migrations
   */
  private async getExecutedMigrations(): Promise<string[]> {
    const result = await db.query<Migration>(
      'SELECT name FROM migrations ORDER BY id ASC'
    );
    return result.rows.map((row) => row.name);
  }

  /**
   * Get list of migration files
   */
  private async getMigrationFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.migrationsDir);
      return files
        .filter((file) => file.endsWith('.sql'))
        .sort(); // Sort alphabetically
    } catch (error) {
      logger.error('Failed to read migrations directory', error);
      throw error;
    }
  }

  /**
   * Execute a single migration file
   */
  private async executeMigration(filename: string): Promise<void> {
    const filePath = path.join(this.migrationsDir, filename);

    try {
      // Read migration file
      const sql = await fs.readFile(filePath, 'utf-8');

      // Execute in transaction
      await db.transaction(async (client) => {
        // Execute migration SQL
        await client.query(sql);

        // Record migration
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [filename]
        );
      });

      logger.info(`Migration executed: ${filename}`);
    } catch (error) {
      logger.error(`Migration failed: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  public async runMigrations(): Promise<void> {
    try {
      // Ensure database is connected
      if (!db.connected) {
        await db.connect();
      }

      // Ensure migrations table exists
      await this.ensureMigrationsTable();

      // Get executed and available migrations
      const executed = await this.getExecutedMigrations();
      const available = await this.getMigrationFiles();

      // Find pending migrations
      const pending = available.filter((file) => !executed.includes(file));

      if (pending.length === 0) {
        logger.info('No pending migrations');
        return;
      }

      logger.info(`Found ${pending.length} pending migrations`);

      // Execute pending migrations in order
      for (const file of pending) {
        await this.executeMigration(file);
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration process failed', error);
      throw error;
    }
  }

  /**
   * Rollback last migration
   */
  public async rollbackLast(): Promise<void> {
    try {
      if (!db.connected) {
        await db.connect();
      }

      await this.ensureMigrationsTable();

      // Get last executed migration
      const result = await db.query<Migration>(
        'SELECT name FROM migrations ORDER BY id DESC LIMIT 1'
      );

      if (result.rows.length === 0) {
        logger.warn('No migrations to rollback');
        return;
      }

      const lastMigration = result.rows[0].name;
      logger.warn(`Rollback not implemented for: ${lastMigration}`);
      logger.warn('Manual rollback required');

      // Note: Implementing automatic rollback requires down migrations
      // which we haven't created yet. Manual rollback is safer.
    } catch (error) {
      logger.error('Rollback failed', error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  public async getStatus(): Promise<{
    executed: string[];
    pending: string[];
  }> {
    try {
      if (!db.connected) {
        await db.connect();
      }

      await this.ensureMigrationsTable();

      const executed = await this.getExecutedMigrations();
      const available = await this.getMigrationFiles();
      const pending = available.filter((file) => !executed.includes(file));

      return { executed, pending };
    } catch (error) {
      logger.error('Failed to get migration status', error);
      throw error;
    }
  }
}

// CLI interface for running migrations
if (require.main === module) {
  const runner = new MigrationRunner();

  const command = process.argv[2] || 'run';

  (async () => {
    try {
      switch (command) {
        case 'run':
          await runner.runMigrations();
          break;
        case 'status':
          const status = await runner.getStatus();
          console.log('\n📊 Migration Status:');
          console.log(`✅ Executed: ${status.executed.length}`);
          status.executed.forEach((name) => console.log(`   - ${name}`));
          console.log(`⏳ Pending: ${status.pending.length}`);
          status.pending.forEach((name) => console.log(`   - ${name}`));
          break;
        case 'rollback':
          await runner.rollbackLast();
          break;
        default:
          console.log('Unknown command. Use: run, status, or rollback');
      }

      await db.disconnect();
      process.exit(0);
    } catch (error) {
      console.error('Migration command failed:', error);
      process.exit(1);
    }
  })();
}

export default MigrationRunner;
