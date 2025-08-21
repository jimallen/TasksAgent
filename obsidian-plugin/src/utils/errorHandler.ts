/**
 * Global Error Handler for Meeting Tasks Plugin
 * Handles uncaught exceptions and unhandled promise rejections
 */

import { Notice } from 'obsidian';
import { MeetingTasksPlugin } from '../main';
import { 
  MeetingTasksError, 
  normalizeError, 
  getUserFriendlyErrorMessage,
  isRetryableError 
} from './errors';
import { Logger } from './logger';

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  showNotifications: boolean;
  logToConsole: boolean;
  logToFile: boolean;
  maxErrorsPerSession: number;
  errorReportingUrl?: string;
  includeStackTrace: boolean;
}

/**
 * Error statistics
 */
interface ErrorStats {
  totalErrors: number;
  errorsByType: Map<string, number>;
  recentErrors: ErrorRecord[];
  sessionStartTime: Date;
}

/**
 * Error record for tracking
 */
interface ErrorRecord {
  error: MeetingTasksError;
  timestamp: Date;
  context?: string;
  handled: boolean;
  retryable: boolean;
}

/**
 * Global error handler for the plugin
 */
export class GlobalErrorHandler {
  private plugin: MeetingTasksPlugin;
  private logger: Logger;
  private config: ErrorHandlerConfig;
  private stats: ErrorStats;
  private originalHandlers: {
    error?: OnErrorEventHandler;
    unhandledRejection?: (event: PromiseRejectionEvent) => void;
  } = {};
  private errorQueue: ErrorRecord[] = [];
  private isProcessingQueue: boolean = false;

  constructor(plugin: MeetingTasksPlugin, logger: Logger) {
    this.plugin = plugin;
    this.logger = logger;
    
    this.config = {
      showNotifications: true,
      logToConsole: true,
      logToFile: true,
      maxErrorsPerSession: 100,
      includeStackTrace: plugin.settings.advanced.debugMode,
    };
    
    this.stats = {
      totalErrors: 0,
      errorsByType: new Map(),
      recentErrors: [],
      sessionStartTime: new Date(),
    };
  }

  /**
   * Initialize global error handlers
   */
  init(): void {
    // Store original handlers
    if (typeof window !== 'undefined') {
      this.originalHandlers.error = window.onerror;
      this.originalHandlers.unhandledRejection = (window as any).onunhandledrejection;
      
      // Set up global error handler
      window.onerror = this.handleWindowError.bind(this);
      
      // Set up unhandled promise rejection handler
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    }
    
    // Set up Node.js handlers if available
    if (typeof process !== 'undefined') {
      process.on('uncaughtException', this.handleUncaughtException.bind(this));
      process.on('unhandledRejection', this.handleNodeUnhandledRejection.bind(this));
    }
    
    this.logger.info('Global error handler initialized');
  }

  /**
   * Handle window error events
   */
  private handleWindowError(
    message: string | Event,
    source?: string,
    lineno?: number,
    colno?: number,
    error?: Error
  ): boolean {
    const errorObj = error || new Error(typeof message === 'string' ? message : 'Unknown error');
    
    this.handleError(errorObj, 'window.onerror', {
      source,
      lineno,
      colno,
    });
    
    // Call original handler if exists
    if (this.originalHandlers.error) {
      return this.originalHandlers.error(message, source, lineno, colno, error);
    }
    
    // Prevent default browser error handling
    return true;
  }

  /**
   * Handle unhandled promise rejections
   */
  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));
    
    this.handleError(error, 'unhandledRejection', {
      promise: event.promise,
    });
    
    // Prevent default handling
    event.preventDefault();
  }

  /**
   * Handle uncaught exceptions (Node.js)
   */
  private handleUncaughtException(error: Error, origin: string): void {
    this.handleError(error, origin || 'uncaughtException');
    
    // For critical errors, notify and possibly restart
    if (this.isCriticalError(error)) {
      this.handleCriticalError(error);
    }
  }

  /**
   * Handle Node.js unhandled rejections
   */
  private handleNodeUnhandledRejection(reason: any, promise: Promise<any>): void {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    
    this.handleError(error, 'unhandledRejection', { promise });
  }

  /**
   * Main error handling method
   */
  handleError(error: Error | MeetingTasksError, context?: string, metadata?: any): void {
    // Normalize error
    const normalizedError = normalizeError(error);
    
    // Create error record
    const errorRecord: ErrorRecord = {
      error: normalizedError,
      timestamp: new Date(),
      context,
      handled: false,
      retryable: isRetryableError(normalizedError),
    };
    
    // Add to queue
    this.errorQueue.push(errorRecord);
    
    // Process queue
    this.processErrorQueue();
    
    // Update statistics
    this.updateStats(normalizedError);
    
    // Log error
    this.logError(normalizedError, context, metadata);
    
    // Show notification if appropriate
    if (this.shouldShowNotification(normalizedError)) {
      this.showErrorNotification(normalizedError, errorRecord.retryable);
    }
    
    // Check for error flood
    if (this.stats.totalErrors > this.config.maxErrorsPerSession) {
      this.handleErrorFlood();
    }
  }

  /**
   * Process error queue
   */
  private async processErrorQueue(): Promise<void> {
    if (this.isProcessingQueue || this.errorQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      while (this.errorQueue.length > 0) {
        const errorRecord = this.errorQueue.shift();
        if (!errorRecord) continue;
        
        // Process error
        await this.processError(errorRecord);
        
        // Mark as handled
        errorRecord.handled = true;
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Process individual error
   */
  private async processError(errorRecord: ErrorRecord): Promise<void> {
    const { error, retryable } = errorRecord;
    
    // Send error report if configured
    if (this.config.errorReportingUrl) {
      await this.sendErrorReport(errorRecord);
    }
    
    // Store in recent errors
    this.stats.recentErrors.push(errorRecord);
    
    // Limit recent errors
    if (this.stats.recentErrors.length > 50) {
      this.stats.recentErrors.shift();
    }
    
    // Handle specific error types
    this.handleSpecificError(error);
  }

  /**
   * Handle specific error types
   */
  private handleSpecificError(error: MeetingTasksError): void {
    switch (error.code) {
      case 'CONNECTION_ERROR':
        // Attempt to reconnect
        if (this.plugin.settings.enableWebSocket) {
          setTimeout(() => {
            this.plugin.connectWebSocket();
          }, 5000);
        }
        break;
        
      case 'AUTHENTICATION_ERROR':
        // Notify user to check API key
        this.plugin.notificationManager?.show(
          'Authentication failed. Please check your API key in settings.',
          'error',
          {
            duration: 10000,
            actionButton: {
              text: 'Open Settings',
              callback: () => {
                this.plugin.openSettings();
              },
            },
          }
        );
        break;
        
      case 'RATE_LIMIT_ERROR':
        // Pause scheduler if running
        if (this.plugin.scheduler?.getState().isRunning) {
          this.plugin.scheduler.stop();
          
          // Resume after retry period
          const retryAfter = (error as any).retryAfter || 60;
          setTimeout(() => {
            this.plugin.scheduler?.start();
          }, retryAfter * 1000);
        }
        break;
    }
  }

  /**
   * Log error
   */
  private logError(error: MeetingTasksError, context?: string, metadata?: any): void {
    const logData = {
      error: error.toJSON(),
      context,
      metadata,
      timestamp: new Date().toISOString(),
    };
    
    // Log to console
    if (this.config.logToConsole) {
      console.error('[Meeting Tasks Error]', logData);
    }
    
    // Log to file
    if (this.config.logToFile) {
      this.logger.error(`Error in ${context || 'unknown context'}`, logData);
    }
  }

  /**
   * Should show notification for error
   */
  private shouldShowNotification(error: MeetingTasksError): boolean {
    if (!this.config.showNotifications) {
      return false;
    }
    
    // Don't show for certain error types
    const silentErrors = ['CANCELLATION_ERROR'];
    if (silentErrors.includes(error.code)) {
      return false;
    }
    
    // Throttle notifications
    const recentSimilarErrors = this.stats.recentErrors.filter(
      record => record.error.code === error.code &&
                Date.now() - record.timestamp.getTime() < 60000 // Within last minute
    );
    
    return recentSimilarErrors.length < 3; // Max 3 similar errors per minute
  }

  /**
   * Show error notification
   */
  private showErrorNotification(error: MeetingTasksError, retryable: boolean): void {
    const message = getUserFriendlyErrorMessage(error);
    
    const options: any = {
      duration: 8000,
    };
    
    if (this.config.includeStackTrace && error.stack) {
      options.actionButton = {
        text: 'Show Details',
        callback: () => {
          this.plugin.showErrorModal(error, error.code);
        },
      };
    }
    
    if (retryable) {
      options.actionButton = {
        text: 'Retry',
        callback: () => {
          this.retryLastOperation();
        },
      };
    }
    
    this.plugin.notificationManager?.show(message, 'error', options);
  }

  /**
   * Update error statistics
   */
  private updateStats(error: MeetingTasksError): void {
    this.stats.totalErrors++;
    
    const count = this.stats.errorsByType.get(error.code) || 0;
    this.stats.errorsByType.set(error.code, count + 1);
  }

  /**
   * Check if error is critical
   */
  private isCriticalError(error: Error): boolean {
    // Define critical error patterns
    const criticalPatterns = [
      /out of memory/i,
      /maximum call stack/i,
      /cannot read property.*of undefined/i,
      /cannot access.*before initialization/i,
    ];
    
    return criticalPatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Handle critical error
   */
  private handleCriticalError(error: Error): void {
    this.logger.fatal('Critical error occurred', error);
    
    // Show critical error notification
    new Notice(
      `⚠️ Critical Error: ${error.message}\nThe plugin may need to be reloaded.`,
      0 // Persistent
    );
    
    // Attempt graceful shutdown
    this.plugin.emergencyShutdown();
  }

  /**
   * Handle error flood (too many errors)
   */
  private handleErrorFlood(): void {
    this.logger.warn('Error flood detected, disabling error notifications');
    
    // Disable notifications
    this.config.showNotifications = false;
    
    // Show single notification
    new Notice(
      '⚠️ Too many errors detected. Error notifications have been disabled.',
      10000
    );
    
    // Consider stopping plugin
    if (this.stats.totalErrors > this.config.maxErrorsPerSession * 2) {
      this.plugin.emergencyShutdown();
    }
  }

  /**
   * Retry last operation
   */
  private retryLastOperation(): void {
    // This would be implemented based on tracking last operations
    this.plugin.checkForMeetingTasks();
  }

  /**
   * Send error report
   */
  private async sendErrorReport(errorRecord: ErrorRecord): Promise<void> {
    if (!this.config.errorReportingUrl) return;
    
    try {
      const report = {
        error: errorRecord.error.toJSON(),
        context: errorRecord.context,
        timestamp: errorRecord.timestamp.toISOString(),
        plugin: {
          version: this.plugin.manifest.version,
          settings: this.sanitizeSettings(this.plugin.settings),
        },
        environment: {
          obsidianVersion: (this.plugin.app as any).vault.config?.obsidianVersion,
          platform: navigator.platform,
          userAgent: navigator.userAgent,
        },
      };
      
      // Send report (implementation would depend on reporting service)
      // await fetch(this.config.errorReportingUrl, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(report),
      // });
    } catch (error) {
      // Silently fail - don't want error reporting to cause more errors
      console.error('Failed to send error report:', error);
    }
  }

  /**
   * Sanitize settings for error reporting
   */
  private sanitizeSettings(settings: any): any {
    const sanitized = { ...settings };
    
    // Remove sensitive fields
    delete sanitized.anthropicApiKey;
    delete sanitized.apiKey;
    delete sanitized.webhookUrl;
    
    return sanitized;
  }

  /**
   * Get error statistics
   */
  getStats(): ErrorStats {
    return { ...this.stats };
  }

  /**
   * Clear error statistics
   */
  clearStats(): void {
    this.stats.totalErrors = 0;
    this.stats.errorsByType.clear();
    this.stats.recentErrors = [];
  }

  /**
   * Clean up error handler
   */
  cleanup(): void {
    // Restore original handlers
    if (typeof window !== 'undefined') {
      if (this.originalHandlers.error) {
        window.onerror = this.originalHandlers.error;
      }
      
      window.removeEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    }
    
    // Remove Node.js handlers
    if (typeof process !== 'undefined') {
      process.removeListener('uncaughtException', this.handleUncaughtException.bind(this));
      process.removeListener('unhandledRejection', this.handleNodeUnhandledRejection.bind(this));
    }
    
    // Clear queue
    this.errorQueue = [];
    
    this.logger.info('Global error handler cleaned up');
  }
}