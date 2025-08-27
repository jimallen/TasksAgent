import { EventEmitter } from 'events';
import { EmailProcessor } from '../processors/emailProcessor';
import logger from '../utils/logger';
import Database from 'better-sqlite3';
import * as path from 'path';
import { DaemonHttpServer } from './httpServer';

export interface ServiceStats {
  startTime: Date;
  lastRun: Date | null;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  emailsProcessed: number;
  tasksExtracted: number;
  notesCreated: number;
  errors: string[];
  status: 'running' | 'stopped' | 'processing' | 'error';
  nextScheduledRun: Date | null;
  httpServerRunning?: boolean;
  httpServerPort?: number;
}

export class DaemonService extends EventEmitter {
  private processor: EmailProcessor;
  private stats: ServiceStats;
  private db: Database.Database;
  private isProcessing = false;
  private stopRequested = false;
  private httpServer?: DaemonHttpServer;

  constructor(httpServer?: DaemonHttpServer) {
    super();
    this.processor = new EmailProcessor();
    this.httpServer = httpServer;
    this.stats = {
      startTime: new Date(),
      lastRun: null,
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      emailsProcessed: 0,
      tasksExtracted: 0,
      notesCreated: 0,
      errors: [],
      status: 'stopped',
      nextScheduledRun: null,
    };
    
    const dbPath = path.join(process.cwd(), 'daemon-stats.db');
    this.db = new Database(dbPath);
    this.initDatabase();
    this.loadStats();
  }

  private initDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS service_stats (
        id INTEGER PRIMARY KEY,
        start_time TEXT,
        last_run TEXT,
        total_runs INTEGER,
        successful_runs INTEGER,
        failed_runs INTEGER,
        emails_processed INTEGER,
        tasks_extracted INTEGER,
        notes_created INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS service_errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        error TEXT
      );
    `);
  }

  private loadStats(): void {
    const row = this.db.prepare('SELECT * FROM service_stats WHERE id = 1').get() as any;
    if (row) {
      this.stats = {
        ...this.stats,
        startTime: new Date(row.start_time),
        lastRun: row.last_run ? new Date(row.last_run) : null,
        totalRuns: row.total_runs,
        successfulRuns: row.successful_runs,
        failedRuns: row.failed_runs,
        emailsProcessed: row.emails_processed,
        tasksExtracted: row.tasks_extracted,
        notesCreated: row.notes_created,
      };
      
      const errors = this.db.prepare('SELECT * FROM service_errors ORDER BY timestamp DESC LIMIT 10').all() as any[];
      this.stats.errors = errors.map(e => `${e.timestamp}: ${e.error}`);
    }
  }

  private saveStats(): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO service_stats (
        id, start_time, last_run, total_runs, successful_runs,
        failed_runs, emails_processed, tasks_extracted, notes_created
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      this.stats.startTime.toISOString(),
      this.stats.lastRun?.toISOString() || null,
      this.stats.totalRuns,
      this.stats.successfulRuns,
      this.stats.failedRuns,
      this.stats.emailsProcessed,
      this.stats.tasksExtracted,
      this.stats.notesCreated
    );
  }

  private logError(error: string): void {
    this.db.prepare('INSERT INTO service_errors (timestamp, error) VALUES (?, ?)').run(
      new Date().toISOString(),
      error
    );
    
    if (this.stats.errors.length >= 10) {
      this.stats.errors.pop();
    }
    this.stats.errors.unshift(`${new Date().toISOString()}: ${error}`);
  }

  async start(): Promise<void> {
    if (this.stats.status === 'running') {
      return;
    }

    logger.info('Starting daemon service (manual trigger only - no scheduled processing)...');
    this.stats.status = 'running';
    this.stopRequested = false;
    this.emit('statusChanged', this.stats.status);

    // No scheduled processing - only manual triggers via HTTP
    logger.info('Daemon service started - waiting for manual triggers via HTTP');
    this.emit('started');
  }

  async stop(): Promise<void> {
    logger.info('Stopping daemon service...');
    this.stopRequested = true;
    
    // No cron jobs to stop since we're manual-only
    
    if (this.isProcessing) {
      logger.info('Waiting for current processing to complete...');
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!this.isProcessing) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 100);
      });
    }
    
    this.stats.status = 'stopped';
    this.stats.nextScheduledRun = null;
    this.saveStats();
    this.emit('statusChanged', this.stats.status);
    this.emit('stopped');
    logger.info('Daemon service stopped');
  }

  async processEmails(isManual = false, quiet = false, lookbackHours?: number): Promise<{ emailsProcessed: number; tasksExtracted: number; notesCreated: number } | void> {
    if (this.isProcessing) {
      logger.warn('Already processing emails, skipping this run');
      return;
    }

    this.isProcessing = true;
    this.stats.status = 'processing';
    this.stats.totalRuns++;
    this.emit('statusChanged', this.stats.status);
    this.emit('processingStarted');

    try {
      logger.info(`Starting ${isManual ? 'manual' : 'scheduled'} email processing...${quiet ? ' (quiet mode)' : ''}${lookbackHours ? ` (${lookbackHours} hours lookback)` : ''}`);
      
      // Pass quiet mode and optional lookback hours to processor
      const result = await this.processor.processEmails(quiet, lookbackHours);
      
      if (this.stopRequested) {
        logger.info('Stop requested, aborting processing');
        return;
      }
      
      this.stats.successfulRuns++;
      this.stats.lastRun = new Date();
      this.stats.emailsProcessed += result.emailsProcessed;
      this.stats.tasksExtracted += result.tasksExtracted;
      this.stats.notesCreated += result.notesCreated;
      
      logger.info(`Processing completed: ${result.emailsProcessed} emails, ${result.tasksExtracted} tasks, ${result.notesCreated} notes`);
      
      this.emit('processingCompleted', result);
      
      // Return the result for API responses
      return result;
    } catch (error) {
      this.stats.failedRuns++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Processing failed:', error);
      this.logError(errorMessage);
      
      // Emit processing failed event
      this.emit('processingFailed', error);
      
      // Update stats after error
      this.isProcessing = false;
      if (!this.stopRequested) {
        this.stats.status = 'error'; // Keep error status
        this.stats.nextScheduledRun = null;
      }
      this.saveStats();
      this.emit('statusChanged', this.stats.status);
      
      throw error; // Re-throw for HTTP endpoint to handle
    } finally {
      this.isProcessing = false;
      if (!this.stopRequested) {
        // Don't override error status if processing failed
        if (this.stats.status !== 'error') {
          this.stats.status = 'running';
        }
        // No scheduled runs in manual-only mode
        this.stats.nextScheduledRun = null;
      }
      this.saveStats();
      this.emit('statusChanged', this.stats.status);
    }
  }

  getStats(): ServiceStats {
    const stats = { ...this.stats };
    
    // Include HTTP server status if available
    if (this.httpServer) {
      stats.httpServerRunning = this.httpServer.isRunning();
      stats.httpServerPort = this.httpServer.getPort();
    }
    
    return stats;
  }

  getNextScheduledRuns(): Date[] {
    // No scheduled runs in manual-only mode
    return [];
  }

  clearStats(): void {
    this.stats = {
      ...this.stats,
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      emailsProcessed: 0,
      tasksExtracted: 0,
      notesCreated: 0,
      errors: [],
      lastRun: null,
    };
    this.saveStats();
    this.db.prepare('DELETE FROM service_errors').run();
    this.emit('statsCleared');
  }

  async resetProcessedData(type: string = 'all'): Promise<{ message: string; emailsDeleted?: number; statsCleared?: boolean }> {
    const result: { message: string; emailsDeleted?: number; statsCleared?: boolean } = {
      message: ''
    };

    try {
      // Reset processed emails from state database
      if (type === 'all' || type === 'emails') {
        // We need to access the state database to clear processed emails
        const stateDbPath = path.join(process.cwd(), 'data', 'state.db');
        const stateDb = new Database(stateDbPath);
        
        // Delete all processed emails
        const deleteResult = stateDb.prepare('DELETE FROM processed_emails').run();
        result.emailsDeleted = deleteResult.changes;
        
        // Also delete related data
        stateDb.prepare('DELETE FROM extracted_tasks').run();
        stateDb.prepare('DELETE FROM meetings').run();
        stateDb.prepare('DELETE FROM attachments').run();
        
        stateDb.close();
        
        logger.info(`Reset processed emails: ${result.emailsDeleted} records deleted`);
      }

      // Reset stats
      if (type === 'all' || type === 'stats') {
        this.clearStats();
        result.statsCleared = true;
        logger.info('Reset daemon statistics');
      }

      result.message = type === 'all' 
        ? `Reset complete: ${result.emailsDeleted || 0} emails deleted, stats cleared`
        : type === 'emails'
        ? `Reset complete: ${result.emailsDeleted || 0} emails deleted`
        : 'Stats cleared';

      this.emit('dataReset', result);
      return result;
    } catch (error) {
      logger.error('Error resetting data:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (this.httpServer) {
      try {
        await this.httpServer.stop();
      } catch (error) {
        logger.error('Error stopping HTTP server during cleanup:', error);
      }
    }
    this.db.close();
  }
}