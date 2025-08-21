/**
 * Scheduler Service for Meeting Tasks Plugin
 * Handles automatic checking at configured intervals
 */

import { MeetingTasksPlugin } from '../main';
import { MeetingTasksSettings } from '../settings';
import moment from 'moment-timezone';

/**
 * Scheduler state
 */
interface SchedulerState {
  isRunning: boolean;
  lastCheckTime: Date | null;
  nextCheckTime: Date | null;
  checkCount: number;
  errorCount: number;
}

/**
 * Service for scheduling automatic task checks
 */
export class SchedulerService {
  private plugin: MeetingTasksPlugin;
  private intervalTimer: NodeJS.Timer | null = null;
  private state: SchedulerState;
  private isChecking: boolean = false;
  private quietHoursTimer: NodeJS.Timer | null = null;

  constructor(plugin: MeetingTasksPlugin) {
    this.plugin = plugin;
    this.state = {
      isRunning: false,
      lastCheckTime: null,
      nextCheckTime: null,
      checkCount: 0,
      errorCount: 0,
    };
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.state.isRunning) {
      console.log('[Scheduler] Already running');
      return;
    }

    const settings = this.plugin.settings;
    
    if (!settings.autoCheck) {
      console.log('[Scheduler] Auto-check is disabled');
      return;
    }

    console.log('[Scheduler] Starting with interval:', settings.checkInterval, 'minutes');
    
    this.state.isRunning = true;
    this.state.checkCount = 0;
    this.state.errorCount = 0;

    // Load last check time from settings
    if (settings.lastCheckTime) {
      this.state.lastCheckTime = new Date(settings.lastCheckTime);
    }

    // Check immediately if processOnStartup is enabled
    if (settings.processOnStartup) {
      this.runCheck();
    }

    // Schedule next check
    this.scheduleNextCheck();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.state.isRunning) {
      return;
    }

    console.log('[Scheduler] Stopping');
    
    this.state.isRunning = false;
    this.state.nextCheckTime = null;

    // Clear timers
    if (this.intervalTimer) {
      clearTimeout(this.intervalTimer);
      this.intervalTimer = null;
    }

    if (this.quietHoursTimer) {
      clearTimeout(this.quietHoursTimer);
      this.quietHoursTimer = null;
    }
  }

  /**
   * Restart the scheduler (e.g., after settings change)
   */
  restart(): void {
    console.log('[Scheduler] Restarting');
    this.stop();
    this.start();
  }

  /**
   * Schedule the next check
   */
  private scheduleNextCheck(): void {
    if (!this.state.isRunning) {
      return;
    }

    // Clear existing timer
    if (this.intervalTimer) {
      clearTimeout(this.intervalTimer);
    }

    const settings = this.plugin.settings;
    const now = new Date();

    // Calculate next check time
    let nextCheckTime = this.calculateNextCheckTime(now);
    
    // Check if we're in quiet hours
    if (this.isInQuietHours(nextCheckTime)) {
      nextCheckTime = this.getNextValidCheckTime(nextCheckTime);
    }

    // Check if it's an active day
    if (!this.isActiveDay(nextCheckTime)) {
      nextCheckTime = this.getNextActiveDay(nextCheckTime);
    }

    this.state.nextCheckTime = nextCheckTime;
    
    const delay = nextCheckTime.getTime() - now.getTime();
    console.log('[Scheduler] Next check at:', nextCheckTime.toLocaleString(), `(in ${Math.round(delay / 60000)} minutes)`);

    // Schedule the check
    this.intervalTimer = setTimeout(() => {
      this.runCheck();
      this.scheduleNextCheck(); // Schedule next check after this one
    }, delay);

    // Update status bar
    this.plugin.statusBar?.updateStatus('idle');
  }

  /**
   * Calculate next check time based on interval
   */
  private calculateNextCheckTime(from: Date): Date {
    const settings = this.plugin.settings;
    const intervalMs = settings.checkInterval * 60 * 1000;
    
    if (this.state.lastCheckTime) {
      // Base on last check time
      const nextTime = new Date(this.state.lastCheckTime.getTime() + intervalMs);
      
      // If next time is in the past, calculate from now
      if (nextTime <= from) {
        return new Date(from.getTime() + intervalMs);
      }
      
      return nextTime;
    } else {
      // First check - schedule from now
      return new Date(from.getTime() + intervalMs);
    }
  }

  /**
   * Check if time is within quiet hours
   */
  private isInQuietHours(time: Date): boolean {
    const settings = this.plugin.settings;
    
    if (!settings.quietHours.enabled) {
      return false;
    }

    // Convert to timezone
    const m = moment.tz(time, settings.quietHours.timezone);
    const currentTime = m.format('HH:mm');
    
    const { start, end } = settings.quietHours;
    
    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (start > end) {
      return currentTime >= start || currentTime < end;
    } else {
      return currentTime >= start && currentTime < end;
    }
  }

  /**
   * Get next valid check time outside quiet hours
   */
  private getNextValidCheckTime(time: Date): Date {
    const settings = this.plugin.settings;
    
    if (!settings.quietHours.enabled) {
      return time;
    }

    const m = moment.tz(time, settings.quietHours.timezone);
    const { start, end } = settings.quietHours;
    
    // If we're in quiet hours, schedule for end of quiet hours
    if (this.isInQuietHours(time)) {
      const endTime = m.clone().format('YYYY-MM-DD') + ' ' + end;
      const nextValid = moment.tz(endTime, 'YYYY-MM-DD HH:mm', settings.quietHours.timezone);
      
      // If end time is before start (overnight), add a day
      if (end < start && nextValid.isBefore(m)) {
        nextValid.add(1, 'day');
      }
      
      return nextValid.toDate();
    }
    
    return time;
  }

  /**
   * Check if day is active
   */
  private isActiveDay(time: Date): boolean {
    const settings = this.plugin.settings;
    const dayOfWeek = time.getDay(); // 0 = Sunday, 6 = Saturday
    return settings.activeDays.includes(dayOfWeek);
  }

  /**
   * Get next active day
   */
  private getNextActiveDay(time: Date): Date {
    const settings = this.plugin.settings;
    const m = moment(time);
    
    // Find next active day
    for (let i = 1; i <= 7; i++) {
      const nextDay = m.clone().add(i, 'days');
      nextDay.set({ hour: 9, minute: 0, second: 0 }); // Default to 9 AM
      
      if (this.isActiveDay(nextDay.toDate()) && !this.isInQuietHours(nextDay.toDate())) {
        return nextDay.toDate();
      }
    }
    
    // Fallback (shouldn't happen if at least one day is active)
    return m.add(1, 'day').toDate();
  }

  /**
   * Run a scheduled check
   */
  private async runCheck(): Promise<void> {
    if (this.isChecking) {
      console.log('[Scheduler] Check already in progress, skipping');
      return;
    }

    if (!this.state.isRunning) {
      console.log('[Scheduler] Scheduler not running, skipping check');
      return;
    }

    this.isChecking = true;
    this.state.checkCount++;
    
    console.log('[Scheduler] Running scheduled check #' + this.state.checkCount);

    try {
      // Update status
      this.plugin.statusBar?.updateStatus('checking');
      
      // Run the check
      await this.plugin.checkForMeetingTasks(false);
      
      // Update last check time
      this.state.lastCheckTime = new Date();
      this.plugin.settings.lastCheckTime = this.state.lastCheckTime.toISOString();
      await this.plugin.saveSettings();
      
      console.log('[Scheduler] Check completed successfully');
      
    } catch (error) {
      console.error('[Scheduler] Check failed:', error);
      this.state.errorCount++;
      
      // Show error notification if enabled
      if (this.plugin.settings.notifications.onErrors) {
        this.plugin.notificationManager?.showError(
          error instanceof Error ? error : new Error(String(error)),
          'Scheduled check failed'
        );
      }
      
      // If too many errors, pause scheduler
      if (this.state.errorCount >= 5) {
        console.error('[Scheduler] Too many errors, pausing scheduler');
        this.stop();
        
        this.plugin.notificationManager?.show(
          'Auto-check paused due to repeated errors',
          'error',
          { duration: 10000 }
        );
      }
    } finally {
      this.isChecking = false;
      this.plugin.statusBar?.updateStatus('idle');
    }
  }

  /**
   * Get scheduler state
   */
  getState(): SchedulerState {
    return { ...this.state };
  }

  /**
   * Force run a check immediately
   */
  async runNow(): Promise<void> {
    if (this.isChecking) {
      throw new Error('Check already in progress');
    }

    await this.runCheck();
    
    // Reschedule next check
    if (this.state.isRunning) {
      this.scheduleNextCheck();
    }
  }

  /**
   * Get human-readable status
   */
  getStatus(): string {
    if (!this.state.isRunning) {
      return 'Scheduler not running';
    }

    if (this.isChecking) {
      return 'Check in progress...';
    }

    if (this.state.nextCheckTime) {
      const now = new Date();
      const msUntilNext = this.state.nextCheckTime.getTime() - now.getTime();
      
      if (msUntilNext < 0) {
        return 'Check pending...';
      }
      
      const minutesUntilNext = Math.round(msUntilNext / 60000);
      
      if (minutesUntilNext < 60) {
        return `Next check in ${minutesUntilNext} minute${minutesUntilNext !== 1 ? 's' : ''}`;
      } else {
        const hoursUntilNext = Math.round(minutesUntilNext / 60);
        return `Next check in ${hoursUntilNext} hour${hoursUntilNext !== 1 ? 's' : ''}`;
      }
    }

    return 'Scheduler active';
  }

  /**
   * Clean up scheduler
   */
  cleanup(): void {
    this.stop();
  }
}