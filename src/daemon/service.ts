import * as cron from 'node-cron';
import { EventEmitter } from 'events';
import { EmailProcessor } from '../processors/emailProcessor';
import logger from '../utils/logger';
import Database from 'better-sqlite3';
import * as path from 'path';

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
}

export class DaemonService extends EventEmitter {
  private processor: EmailProcessor;
  private cronJobs: cron.ScheduledTask[] = [];
  private stats: ServiceStats;
  private db: Database.Database;
  private isProcessing = false;
  private stopRequested = false;

  constructor() {
    super();
    this.processor = new EmailProcessor();
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

    logger.info('Starting daemon service...');
    this.stats.status = 'running';
    this.stopRequested = false;
    this.emit('statusChanged', this.stats.status);

    const schedule = process.env['SCHEDULE'] || '0 9,13,17 * * *';
    
    const job = cron.schedule(schedule, async () => {
      await this.processEmails();
    });
    
    this.cronJobs.push(job);
    
    const nextRuns = this.getNextScheduledRuns();
    this.stats.nextScheduledRun = nextRuns[0] || null;
    
    logger.info(`Daemon service started with schedule: ${schedule}`);
    this.emit('started');
  }

  async stop(): Promise<void> {
    logger.info('Stopping daemon service...');
    this.stopRequested = true;
    
    for (const job of this.cronJobs) {
      job.stop();
    }
    this.cronJobs = [];
    
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

  async processEmails(isManual = false): Promise<void> {
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
      logger.info(`Starting ${isManual ? 'manual' : 'scheduled'} email processing...`);
      
      const result = await this.processor.processEmails();
      
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
    } catch (error) {
      this.stats.failedRuns++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Processing failed:', error);
      this.logError(errorMessage);
      this.stats.status = 'error';
      this.emit('processingFailed', error);
    } finally {
      this.isProcessing = false;
      if (!this.stopRequested) {
        this.stats.status = 'running';
        const nextRuns = this.getNextScheduledRuns();
        this.stats.nextScheduledRun = nextRuns[0] || null;
      }
      this.saveStats();
      this.emit('statusChanged', this.stats.status);
    }
  }

  getStats(): ServiceStats {
    return { ...this.stats };
  }

  getNextScheduledRuns(): Date[] {
    const runs: Date[] = [];
    const now = new Date();
    const schedule = process.env['SCHEDULE'] || '0 9,13,17 * * *';
    
    const parts = schedule.split(' ');
    const minute = parts[0];
    const hours = parts[1] || '9,13,17';
    const hoursList = hours.split(',').map(h => parseInt(h));
    
    for (let i = 0; i < 3; i++) {
      const nextRun = new Date(now);
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);
      
      let found = false;
      for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
        const testDate = new Date(nextRun);
        testDate.setDate(testDate.getDate() + dayOffset);
        
        for (const hour of hoursList) {
          testDate.setHours(hour);
          testDate.setMinutes(parseInt(minute || '0'));
          
          if (testDate > now && !runs.some(r => r.getTime() === testDate.getTime())) {
            runs.push(new Date(testDate));
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
    
    return runs.sort((a, b) => a.getTime() - b.getTime());
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

  cleanup(): void {
    this.db.close();
  }
}