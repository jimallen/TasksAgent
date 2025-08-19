import * as cron from 'node-cron';
import { logDebug, logError, logInfo, logWarn } from '../utils/logger';
import { notificationService } from '../services/notificationService';
import { stateManager } from '../database/stateManager';

export interface ScheduledJob {
  id: string;
  name: string;
  schedule: string;
  handler: () => Promise<void>;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  task?: cron.ScheduledTask;
  errorCount: number;
  maxRetries: number;
}

export interface SchedulerStats {
  totalJobs: number;
  activeJobs: number;
  executedToday: number;
  failedToday: number;
  uptime: number;
}

export class CronScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private isRunning: boolean = false;
  private startTime: Date = new Date();
  private executionHistory: Array<{
    jobId: string;
    timestamp: Date;
    success: boolean;
    duration: number;
    error?: string;
  }> = [];
  private healthCheckInterval?: NodeJS.Timeout;
  private processingFunction?: () => Promise<any>;

  constructor() {
    this.setupDefaultSchedules();
    this.setupShutdownHandlers();
  }

  /**
   * Setup default schedules from configuration
   */
  private setupDefaultSchedules(): void {
    // 3x daily schedule as per requirements (9 AM, 1 PM, 5 PM)
    const schedules = [
      { id: 'morning', name: 'Morning Check', schedule: '0 9 * * *', hour: 9 },
      { id: 'afternoon', name: 'Afternoon Check', schedule: '0 13 * * *', hour: 13 },
      { id: 'evening', name: 'Evening Check', schedule: '0 17 * * *', hour: 17 },
    ];

    // Also add optional schedules from config
    const customSchedule = process.env['CUSTOM_SCHEDULE'];
    if (customSchedule) {
      schedules.push({
        id: 'custom',
        name: 'Custom Schedule',
        schedule: customSchedule,
        hour: 0
      });
    }

    // Register each schedule
    schedules.forEach(({ id, name, schedule }) => {
      this.registerJob({
        id,
        name,
        schedule,
        handler: async () => await this.executeProcessing(id),
        enabled: true,
        errorCount: 0,
        maxRetries: 3
      });
    });

    // Add maintenance jobs
    this.registerJob({
      id: 'daily-summary',
      name: 'Daily Summary',
      schedule: '0 18 * * *', // 6 PM daily summary
      handler: async () => await this.generateDailySummary(),
      enabled: true,
      errorCount: 0,
      maxRetries: 1
    });

    this.registerJob({
      id: 'cleanup',
      name: 'Database Cleanup',
      schedule: '0 2 * * 0', // 2 AM every Sunday
      handler: async () => await this.performCleanup(),
      enabled: true,
      errorCount: 0,
      maxRetries: 1
    });

    this.registerJob({
      id: 'health-check',
      name: 'Health Check',
      schedule: '*/30 * * * *', // Every 30 minutes
      handler: async () => await this.performHealthCheck(),
      enabled: process.env['ENABLE_HEALTH_CHECK'] === 'true',
      errorCount: 0,
      maxRetries: 1
    });
  }

  /**
   * Register a scheduled job
   */
  registerJob(job: ScheduledJob): void {
    if (this.jobs.has(job.id)) {
      logWarn(`Job ${job.id} already registered, updating...`);
      this.unregisterJob(job.id);
    }

    // Validate cron expression
    if (!cron.validate(job.schedule)) {
      throw new Error(`Invalid cron expression for job ${job.id}: ${job.schedule}`);
    }

    this.jobs.set(job.id, job);
    logInfo(`Registered job: ${job.name} (${job.schedule})`);
  }

  /**
   * Unregister a job
   */
  unregisterJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      if (job.task) {
        job.task.stop();
      }
      this.jobs.delete(jobId);
      logInfo(`Unregistered job: ${job.name}`);
    }
  }

  /**
   * Set the main processing function
   */
  setProcessingFunction(fn: () => Promise<any>): void {
    this.processingFunction = fn;
    logDebug('Processing function registered');
  }

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logWarn('Scheduler is already running');
      return;
    }

    logInfo('Starting cron scheduler...');
    this.isRunning = true;
    this.startTime = new Date();

    // Start each enabled job
    for (const [id, job] of this.jobs) {
      if (job.enabled) {
        this.startJob(id);
      }
    }

    // Start health monitoring
    this.startHealthMonitoring();

    await notificationService.send({
      title: '🚀 Scheduler Started',
      message: `Meeting Transcript Agent scheduler started with ${this.jobs.size} jobs`,
      channels: ['console']
    });

    logInfo(`Scheduler started with ${this.jobs.size} jobs`);
  }

  /**
   * Start a specific job
   */
  private startJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      logError(`Job ${jobId} not found`);
      return;
    }

    if (job.task) {
      logWarn(`Job ${jobId} is already running`);
      return;
    }

    job.task = cron.schedule(job.schedule, async () => {
      await this.executeJob(jobId);
    }, {
      timezone: process.env['TZ'] || 'America/New_York'
    });

    job.task.start();
    job.nextRun = this.getNextRunTime(job.schedule);
    logDebug(`Started job: ${job.name}`);
  }

  /**
   * Execute a job
   */
  private async executeJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const startTime = Date.now();
    logInfo(`Executing job: ${job.name}`);

    try {
      await job.handler();
      
      const duration = Date.now() - startTime;
      job.lastRun = new Date();
      job.nextRun = this.getNextRunTime(job.schedule);
      job.errorCount = 0;

      this.executionHistory.push({
        jobId,
        timestamp: new Date(),
        success: true,
        duration
      });

      logInfo(`Job ${job.name} completed in ${duration}ms`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      job.errorCount++;
      
      this.executionHistory.push({
        jobId,
        timestamp: new Date(),
        success: false,
        duration,
        error: error.message
      });

      logError(`Job ${job.name} failed`, error);

      // Retry if within retry limit
      if (job.errorCount <= job.maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, job.errorCount), 30000);
        logInfo(`Retrying job ${job.name} in ${retryDelay}ms (attempt ${job.errorCount}/${job.maxRetries})`);
        
        setTimeout(() => {
          this.executeJob(jobId);
        }, retryDelay);
      } else {
        await notificationService.notifyError(
          error,
          `Job ${job.name} failed after ${job.maxRetries} retries`
        );
      }
    }

    // Keep history limited
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-100);
    }
  }

  /**
   * Execute main processing
   */
  private async executeProcessing(triggerId: string): Promise<void> {
    if (!this.processingFunction) {
      logWarn('No processing function registered');
      return;
    }

    logInfo(`Starting scheduled processing (trigger: ${triggerId})`);
    
    try {
      await this.processingFunction();
      await stateManager.updateDailyStats(1, 0, 0, 0);
    } catch (error: any) {
      logError('Processing failed', error);
      await stateManager.updateDailyStats(0, 0, 0, 1);
      throw error;
    }
  }

  /**
   * Generate daily summary
   */
  private async generateDailySummary(): Promise<void> {
    logInfo('Generating daily summary...');
    
    try {
      const stats = await stateManager.getStats();
      const todayStats = {
        emailsProcessed: stats.today?.emails_processed || 0,
        tasksExtracted: stats.today?.tasks_extracted || 0,
        meetingsFound: stats.today?.meetings_found || 0,
        errors: stats.today?.errors_count || 0
      };

      await notificationService.notifyDailySummary(todayStats);
      logInfo('Daily summary sent');
    } catch (error) {
      logError('Failed to generate daily summary', error);
      throw error;
    }
  }

  /**
   * Perform database cleanup
   */
  private async performCleanup(): Promise<void> {
    logInfo('Performing database cleanup...');
    
    try {
      const daysToKeep = parseInt(stateManager.getConfig('auto_cleanup_days') || '90');
      await stateManager.cleanup(daysToKeep);
      logInfo('Database cleanup completed');
    } catch (error) {
      logError('Database cleanup failed', error);
      throw error;
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    const health = this.getHealthStatus();
    
    if (!health.healthy) {
      logWarn('Health check failed', health);
      
      if (health.issues.includes('No successful executions in 24 hours')) {
        await notificationService.send({
          title: '⚠️ Scheduler Health Warning',
          message: 'No successful job executions in the last 24 hours',
          priority: 'high',
          channels: ['console', 'desktop']
        });
      }
    } else {
      logDebug('Health check passed');
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Check health every 5 minutes
    this.healthCheckInterval = setInterval(() => {
      const health = this.getHealthStatus();
      if (!health.healthy) {
        logWarn('Health check warning', health);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logWarn('Scheduler is not running');
      return;
    }

    logInfo('Stopping scheduler...');

    // Stop all jobs
    for (const [, job] of this.jobs) {
      if (job.task) {
        job.task.stop();
        job.task = undefined;
      }
    }

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    this.isRunning = false;
    logInfo('Scheduler stopped');
  }

  /**
   * Pause a specific job
   */
  pauseJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job && job.task) {
      job.task.stop();
      job.enabled = false;
      logInfo(`Paused job: ${job.name}`);
    }
  }

  /**
   * Resume a specific job
   */
  resumeJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job && !job.enabled) {
      job.enabled = true;
      this.startJob(jobId);
      logInfo(`Resumed job: ${job.name}`);
    }
  }

  /**
   * Trigger a job manually
   */
  async triggerJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    logInfo(`Manually triggering job: ${job.name}`);
    await this.executeJob(jobId);
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    const now = new Date();
    const today = now.toDateString();
    
    const todayExecutions = this.executionHistory.filter(
      h => h.timestamp.toDateString() === today
    );

    return {
      totalJobs: this.jobs.size,
      activeJobs: Array.from(this.jobs.values()).filter(j => j.enabled).length,
      executedToday: todayExecutions.filter(e => e.success).length,
      failedToday: todayExecutions.filter(e => !e.success).length,
      uptime: now.getTime() - this.startTime.getTime()
    };
  }

  /**
   * Get job status
   */
  getJobStatus(jobId?: string): any {
    if (jobId) {
      const job = this.jobs.get(jobId);
      if (!job) return null;
      
      return {
        id: job.id,
        name: job.name,
        schedule: job.schedule,
        enabled: job.enabled,
        lastRun: job.lastRun,
        nextRun: job.nextRun,
        errorCount: job.errorCount,
        isRunning: !!job.task
      };
    }

    // Return all jobs status
    return Array.from(this.jobs.values()).map(job => ({
      id: job.id,
      name: job.name,
      schedule: job.schedule,
      enabled: job.enabled,
      lastRun: job.lastRun,
      nextRun: job.nextRun,
      errorCount: job.errorCount,
      isRunning: !!job.task
    }));
  }

  /**
   * Get health status
   */
  getHealthStatus(): any {
    const stats = this.getStats();
    const issues: string[] = [];
    
    // Check if scheduler is running
    if (!this.isRunning) {
      issues.push('Scheduler is not running');
    }

    // Check if jobs are failing
    if (stats.failedToday > stats.executedToday * 0.5) {
      issues.push('More than 50% of jobs failed today');
    }

    // Check for stale jobs
    const now = Date.now();
    for (const job of this.jobs.values()) {
      if (job.enabled && job.lastRun) {
        const hoursSinceLastRun = (now - job.lastRun.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastRun > 24) {
          issues.push(`Job ${job.name} hasn't run in ${Math.floor(hoursSinceLastRun)} hours`);
        }
      }
    }

    // Check for jobs with high error count
    for (const job of this.jobs.values()) {
      if (job.errorCount >= job.maxRetries) {
        issues.push(`Job ${job.name} has exceeded max retries`);
      }
    }

    return {
      healthy: issues.length === 0,
      uptime: stats.uptime,
      issues,
      stats
    };
  }

  /**
   * Get next run time for a cron expression
   */
  private getNextRunTime(schedule: string): Date {
    // This is a simplified implementation
    // In production, you'd use a proper cron parser
    const now = new Date();
    const parts = schedule.split(' ');
    
    if (parts.length === 5) {
      const [minute, hour] = parts;
      
      if (minute !== '*' && hour !== '*' && minute && hour) {
        const nextRun = new Date();
        nextRun.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
        
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        
        return nextRun;
      }
    }
    
    // Default to 1 hour from now for complex expressions
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      logInfo(`Received ${signal}, shutting down gracefully...`);
      
      await this.stop();
      
      // Give time for cleanup
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit: number = 50): any[] {
    return this.executionHistory
      .slice(-limit)
      .map(h => ({
        ...h,
        jobName: this.jobs.get(h.jobId)?.name || h.jobId
      }))
      .reverse();
  }
}

// Export singleton instance
export const cronScheduler = new CronScheduler();