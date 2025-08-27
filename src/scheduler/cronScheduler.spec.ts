import { CronScheduler, ScheduledJob } from './cronScheduler';
import * as cron from 'node-cron';
import { notificationService } from '../services/notificationService';
import { stateManager } from '../database/stateManager';

// Mock dependencies
jest.mock('node-cron');
jest.mock('../services/notificationService');
jest.mock('../database/stateManager');
jest.mock('../utils/logger');

describe('CronScheduler', () => {
  let scheduler: CronScheduler;
  let mockTask: any;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new CronScheduler();
    
    // Mock cron task
    mockTask = {
      start: jest.fn(),
      stop: jest.fn()
    };
    
    (cron.schedule as jest.Mock).mockReturnValue(mockTask);
    (cron.validate as jest.Mock).mockReturnValue(true);
    
    // Mock notification service
    (notificationService.send as jest.Mock).mockResolvedValue([]);
    (notificationService.notifyError as jest.Mock).mockResolvedValue(undefined);
    
    // Mock state manager
    (stateManager.getStats as jest.Mock).mockResolvedValue({
      today: {
        emails_processed: 5,
        tasks_extracted: 10,
        meetings_found: 3,
        errors_count: 0
      }
    });
    (stateManager.updateDailyStats as jest.Mock).mockResolvedValue(undefined);
    (stateManager.cleanup as jest.Mock).mockResolvedValue(undefined);
    (stateManager.getConfig as jest.Mock).mockReturnValue('90');
  });

  describe('Job Registration', () => {
    it('should register a new job', () => {
      const job: ScheduledJob = {
        id: 'test-job',
        name: 'Test Job',
        schedule: '* * * * *',
        handler: jest.fn(),
        enabled: true,
        errorCount: 0,
        maxRetries: 3
      };

      scheduler.registerJob(job);
      
      const status = scheduler.getJobStatus('test-job');
      expect(status).toMatchObject({
        id: 'test-job',
        name: 'Test Job',
        schedule: '* * * * *',
        enabled: true
      });
    });

    it('should validate cron expression', () => {
      (cron.validate as jest.Mock).mockReturnValue(false);
      
      const job: ScheduledJob = {
        id: 'invalid-job',
        name: 'Invalid Job',
        schedule: 'invalid-cron',
        handler: jest.fn(),
        enabled: true,
        errorCount: 0,
        maxRetries: 3
      };

      expect(() => scheduler.registerJob(job)).toThrow('Invalid cron expression');
    });

    it('should update existing job', () => {
      const job1: ScheduledJob = {
        id: 'update-job',
        name: 'Original Job',
        schedule: '* * * * *',
        handler: jest.fn(),
        enabled: true,
        errorCount: 0,
        maxRetries: 3
      };

      const job2: ScheduledJob = {
        ...job1,
        name: 'Updated Job'
      };

      scheduler.registerJob(job1);
      scheduler.registerJob(job2);
      
      const status = scheduler.getJobStatus('update-job');
      expect(status?.name).toBe('Updated Job');
    });
  });

  describe('Scheduler Lifecycle', () => {
    it('should start scheduler and all enabled jobs', async () => {
      const processingFn = jest.fn();
      scheduler.setProcessingFunction(processingFn);
      
      await scheduler.start();
      
      expect(cron.schedule).toHaveBeenCalled();
      expect(mockTask.start).toHaveBeenCalled();
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Scheduler Started')
        })
      );
    });

    it('should not start if already running', async () => {
      await scheduler.start();
      
      jest.clearAllMocks();
      await scheduler.start();
      
      expect(cron.schedule).not.toHaveBeenCalled();
    });

    it('should stop scheduler and all jobs', async () => {
      await scheduler.start();
      await scheduler.stop();
      
      expect(mockTask.stop).toHaveBeenCalled();
    });
  });

  describe('Job Execution', () => {
    it('should execute job successfully', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      const job: ScheduledJob = {
        id: 'exec-job',
        name: 'Execution Test',
        schedule: '* * * * *',
        handler,
        enabled: true,
        errorCount: 0,
        maxRetries: 3
      };

      scheduler.registerJob(job);
      await scheduler.triggerJob('exec-job');
      
      expect(handler).toHaveBeenCalled();
    });

    it('should handle job execution errors', async () => {
      const error = new Error('Job failed');
      const handler = jest.fn().mockRejectedValue(error);
      const job: ScheduledJob = {
        id: 'error-job',
        name: 'Error Test',
        schedule: '* * * * *',
        handler,
        enabled: true,
        errorCount: 0,
        maxRetries: 3
      };

      scheduler.registerJob(job);
      
      // Mock setTimeout to execute immediately
      jest.useFakeTimers();
      
      await scheduler.triggerJob('error-job');
      
      // Job should be retried
      expect(handler).toHaveBeenCalledTimes(1);
      
      // Fast-forward timers
      jest.runOnlyPendingTimers();
      
      // Check error count increased
      const status = scheduler.getJobStatus('error-job');
      expect(status?.errorCount).toBeGreaterThan(0);
      
      jest.useRealTimers();
    });

    it('should notify after max retries exceeded', async () => {
      const error = new Error('Persistent failure');
      const handler = jest.fn().mockRejectedValue(error);
      const job: ScheduledJob = {
        id: 'retry-job',
        name: 'Retry Test',
        schedule: '* * * * *',
        handler,
        enabled: true,
        errorCount: 3, // Already at max
        maxRetries: 3
      };

      scheduler.registerJob(job);
      await scheduler.triggerJob('retry-job');
      
      expect(notificationService.notifyError).toHaveBeenCalledWith(
        error,
        expect.stringContaining('failed after 3 retries')
      );
    });
  });

  describe('Job Control', () => {
    beforeEach(async () => {
      const job: ScheduledJob = {
        id: 'control-job',
        name: 'Control Test',
        schedule: '* * * * *',
        handler: jest.fn(),
        enabled: true,
        errorCount: 0,
        maxRetries: 3
      };
      
      scheduler.registerJob(job);
      await scheduler.start();
    });

    it('should pause a job', () => {
      scheduler.pauseJob('control-job');
      
      const status = scheduler.getJobStatus('control-job');
      expect(status?.enabled).toBe(false);
      expect(mockTask.stop).toHaveBeenCalled();
    });

    it('should resume a paused job', () => {
      scheduler.pauseJob('control-job');
      jest.clearAllMocks();
      
      scheduler.resumeJob('control-job');
      
      const status = scheduler.getJobStatus('control-job');
      expect(status?.enabled).toBe(true);
      expect(mockTask.start).toHaveBeenCalled();
    });

    it('should unregister a job', () => {
      scheduler.unregisterJob('control-job');
      
      const status = scheduler.getJobStatus('control-job');
      expect(status).toBeNull();
      expect(mockTask.stop).toHaveBeenCalled();
    });
  });

  describe('Daily Summary', () => {
    it('should generate daily summary', async () => {
      const job: ScheduledJob = {
        id: 'daily-summary',
        name: 'Daily Summary',
        schedule: '0 18 * * *',
        handler: jest.fn(),
        enabled: true,
        errorCount: 0,
        maxRetries: 1
      };

      scheduler.registerJob(job);
      await scheduler.triggerJob('daily-summary');
      
      // The daily summary job should be executed
      expect(stateManager.getStats).toHaveBeenCalled();
    });
  });

  describe('Database Cleanup', () => {
    it('should perform database cleanup', async () => {
      const job: ScheduledJob = {
        id: 'cleanup',
        name: 'Database Cleanup',
        schedule: '0 2 * * 0',
        handler: jest.fn(),
        enabled: true,
        errorCount: 0,
        maxRetries: 1
      };

      scheduler.registerJob(job);
      await scheduler.triggerJob('cleanup');
      
      expect(stateManager.cleanup).toHaveBeenCalledWith(90);
    });
  });

  describe('Statistics', () => {
    it('should return scheduler statistics', async () => {
      await scheduler.start();
      
      const stats = scheduler.getStats();
      
      expect(stats).toHaveProperty('totalJobs');
      expect(stats).toHaveProperty('activeJobs');
      expect(stats).toHaveProperty('executedToday');
      expect(stats).toHaveProperty('failedToday');
      expect(stats).toHaveProperty('uptime');
      expect(stats.totalJobs).toBeGreaterThan(0);
    });

    it('should return all jobs status', () => {
      const status = scheduler.getJobStatus();
      
      expect(Array.isArray(status)).toBe(true);
      expect(status.length).toBeGreaterThan(0);
      expect(status[0]).toHaveProperty('id');
      expect(status[0]).toHaveProperty('name');
      expect(status[0]).toHaveProperty('schedule');
    });
  });

  describe('Health Check', () => {
    it('should report healthy status', async () => {
      await scheduler.start();
      
      const health = scheduler.getHealthStatus();
      
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('issues');
      expect(health).toHaveProperty('stats');
    });

    it('should detect unhealthy conditions', () => {
      const health = scheduler.getHealthStatus();
      
      expect(health.healthy).toBe(false);
      expect(health.issues).toContain('Scheduler is not running');
    });

    it('should detect stale jobs', async () => {
      const job: ScheduledJob = {
        id: 'stale-job',
        name: 'Stale Job',
        schedule: '* * * * *',
        handler: jest.fn(),
        enabled: true,
        lastRun: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        errorCount: 0,
        maxRetries: 3
      };

      scheduler.registerJob(job);
      
      const health = scheduler.getHealthStatus();
      
      expect(health.healthy).toBe(false);
      expect(health.issues.some(i => i.includes('hasn\'t run in'))).toBe(true);
    });
  });

  describe('Execution History', () => {
    it('should track execution history', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      const job: ScheduledJob = {
        id: 'history-job',
        name: 'History Test',
        schedule: '* * * * *',
        handler,
        enabled: true,
        errorCount: 0,
        maxRetries: 3
      };

      scheduler.registerJob(job);
      await scheduler.triggerJob('history-job');
      
      const history = scheduler.getExecutionHistory();
      
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('jobId');
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('success');
      expect(history[0]).toHaveProperty('duration');
      expect(history[0].success).toBe(true);
    });

    it('should limit execution history size', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      const job: ScheduledJob = {
        id: 'limit-job',
        name: 'Limit Test',
        schedule: '* * * * *',
        handler,
        enabled: true,
        errorCount: 0,
        maxRetries: 3
      };

      scheduler.registerJob(job);
      
      // Execute many times
      for (let i = 0; i < 150; i++) {
        await scheduler.triggerJob('limit-job');
      }
      
      const history = scheduler.getExecutionHistory(200);
      
      // History should be limited to last 100 entries internally
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Manual Trigger', () => {
    it('should throw error for non-existent job', async () => {
      await expect(scheduler.triggerJob('non-existent')).rejects.toThrow('Job non-existent not found');
    });
  });

  describe('Processing Function', () => {
    it('should execute processing function', async () => {
      const processingFn = jest.fn().mockResolvedValue(undefined);
      scheduler.setProcessingFunction(processingFn);
      
      // Trigger morning check job
      await scheduler.start();
      
      // Find and trigger the morning job
      const jobs = scheduler.getJobStatus();
      const morningJob = (jobs as unknown as Array<{ id: string }>).find(j => j.id === 'morning');
      
      if (morningJob) {
        await scheduler.triggerJob('morning');
        expect(processingFn).toHaveBeenCalled();
        expect(stateManager.updateDailyStats).toHaveBeenCalledWith(1, 0, 0, 0);
      }
    });

    it('should handle processing function errors', async () => {
      const error = new Error('Processing failed');
      const processingFn = jest.fn().mockRejectedValue(error);
      scheduler.setProcessingFunction(processingFn);
      
      await scheduler.start();
      
      const jobs = scheduler.getJobStatus();
      const morningJob = (jobs as unknown as Array<{ id: string }>).find(j => j.id === 'morning');
      
      if (morningJob) {
        await scheduler.triggerJob('morning');
        expect(stateManager.updateDailyStats).toHaveBeenCalledWith(0, 0, 0, 1);
      }
    });
  });
});