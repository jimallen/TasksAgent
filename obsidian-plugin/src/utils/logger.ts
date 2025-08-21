/**
 * Logging Service for Meeting Tasks Plugin
 * Provides configurable logging with multiple outputs
 */

import { App, TFile, normalizePath } from 'obsidian';
import { MeetingTasksSettings } from '../settings';
import moment from 'moment';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
  NONE = 5,
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  data?: any;
  context?: string;
  error?: Error;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  logToConsole: boolean;
  logToFile: boolean;
  logToStatusBar: boolean;
  maxFileSize: number; // in MB
  maxLogFiles: number;
  logFilePath: string;
  includeTimestamp: boolean;
  includeContext: boolean;
  formatJson: boolean;
}

/**
 * Logging service for the plugin
 */
export class Logger {
  private app: App;
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private isWriting: boolean = false;
  private logFile: TFile | null = null;
  private currentLogSize: number = 0;
  private logFileIndex: number = 0;
  private performanceMetrics: Map<string, number[]> = new Map();

  constructor(app: App, settings: MeetingTasksSettings) {
    this.app = app;
    
    // Initialize config from settings
    this.config = {
      level: this.parseLogLevel(settings.advanced.logLevel),
      logToConsole: settings.advanced.debugMode,
      logToFile: true,
      logToStatusBar: false,
      maxFileSize: settings.advanced.maxLogSize || 10,
      maxLogFiles: 5,
      logFilePath: '.obsidian/plugins/meeting-tasks/logs',
      includeTimestamp: true,
      includeContext: true,
      formatJson: false,
    };
    
    // Initialize log file
    this.initializeLogFile();
  }

  /**
   * Parse log level from string
   */
  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      case 'fatal': return LogLevel.FATAL;
      case 'none': return LogLevel.NONE;
      default: return LogLevel.INFO;
    }
  }

  /**
   * Initialize log file
   */
  private async initializeLogFile(): Promise<void> {
    try {
      // Ensure log directory exists
      const logDir = this.config.logFilePath;
      const folder = this.app.vault.getAbstractFileByPath(logDir);
      
      if (!folder) {
        await this.app.vault.createFolder(logDir);
      }
      
      // Get current log file
      const logFileName = this.getLogFileName();
      const logFilePath = normalizePath(`${logDir}/${logFileName}`);
      
      this.logFile = this.app.vault.getAbstractFileByPath(logFilePath) as TFile;
      
      if (!this.logFile) {
        // Create new log file
        this.logFile = await this.app.vault.create(logFilePath, this.getLogHeader());
        this.currentLogSize = this.getLogHeader().length;
      } else {
        // Get current file size
        const content = await this.app.vault.read(this.logFile);
        this.currentLogSize = content.length;
        
        // Check if rotation needed
        if (this.currentLogSize > this.config.maxFileSize * 1024 * 1024) {
          await this.rotateLogFile();
        }
      }
    } catch (error) {
      console.error('Failed to initialize log file:', error);
      this.config.logToFile = false;
    }
  }

  /**
   * Get log file name
   */
  private getLogFileName(): string {
    const date = moment().format('YYYY-MM-DD');
    if (this.logFileIndex > 0) {
      return `meeting-tasks-${date}-${this.logFileIndex}.log`;
    }
    return `meeting-tasks-${date}.log`;
  }

  /**
   * Get log header
   */
  private getLogHeader(): string {
    return [
      '# Meeting Tasks Plugin Log',
      `# Created: ${new Date().toISOString()}`,
      `# Plugin Version: ${(this.app as any).plugins?.manifests?.['meeting-tasks']?.version || 'unknown'}`,
      '# ================================',
      '',
    ].join('\n');
  }

  /**
   * Rotate log file
   */
  private async rotateLogFile(): Promise<void> {
    try {
      // Increment index
      this.logFileIndex++;
      
      // Create new log file
      const logFileName = this.getLogFileName();
      const logFilePath = normalizePath(`${this.config.logFilePath}/${logFileName}`);
      
      this.logFile = await this.app.vault.create(logFilePath, this.getLogHeader());
      this.currentLogSize = this.getLogHeader().length;
      
      // Clean up old log files
      await this.cleanupOldLogs();
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * Clean up old log files
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const logDir = this.app.vault.getAbstractFileByPath(this.config.logFilePath);
      if (!logDir || !('children' in logDir)) return;
      
      // Get all log files
      const logFiles = (logDir as any).children
        .filter((f: any) => f instanceof TFile && f.name.startsWith('meeting-tasks-'))
        .sort((a: TFile, b: TFile) => b.stat.ctime - a.stat.ctime);
      
      // Delete old files
      if (logFiles.length > this.config.maxLogFiles) {
        for (let i = this.config.maxLogFiles; i < logFiles.length; i++) {
          await this.app.vault.delete(logFiles[i]);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, data?: any, context?: string): void {
    // Check log level
    if (level < this.config.level) {
      return;
    }
    
    // Create log entry
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data,
      context,
    };
    
    // Add to buffer
    this.buffer.push(entry);
    
    // Log to console
    if (this.config.logToConsole) {
      this.logToConsole(entry);
    }
    
    // Log to file (async)
    if (this.config.logToFile) {
      this.logToFile(entry);
    }
    
    // Log to status bar for important messages
    if (this.config.logToStatusBar && level >= LogLevel.WARN) {
      this.logToStatusBar(entry);
    }
  }

  /**
   * Log to console
   */
  private logToConsole(entry: LogEntry): void {
    const prefix = `[Meeting Tasks] [${LogLevel[entry.level]}]`;
    const timestamp = this.config.includeTimestamp 
      ? `[${moment(entry.timestamp).format('HH:mm:ss')}]` 
      : '';
    const context = this.config.includeContext && entry.context 
      ? `[${entry.context}]` 
      : '';
    
    const fullPrefix = [prefix, timestamp, context].filter(Boolean).join(' ');
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(fullPrefix, entry.message, entry.data || '');
        break;
      case LogLevel.INFO:
        console.info(fullPrefix, entry.message, entry.data || '');
        break;
      case LogLevel.WARN:
        console.warn(fullPrefix, entry.message, entry.data || '');
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(fullPrefix, entry.message, entry.data || '');
        if (entry.error) {
          console.error(entry.error);
        }
        break;
    }
  }

  /**
   * Log to file
   */
  private async logToFile(entry: LogEntry): Promise<void> {
    if (!this.logFile || this.isWriting) {
      return;
    }
    
    this.isWriting = true;
    
    try {
      // Format log line
      const logLine = this.formatLogEntry(entry);
      
      // Read current content
      const content = await this.app.vault.read(this.logFile);
      
      // Append new line
      const newContent = content + logLine + '\n';
      
      // Write back
      await this.app.vault.modify(this.logFile, newContent);
      
      // Update size
      this.currentLogSize = newContent.length;
      
      // Check for rotation
      if (this.currentLogSize > this.config.maxFileSize * 1024 * 1024) {
        await this.rotateLogFile();
      }
    } catch (error) {
      console.error('Failed to write to log file:', error);
    } finally {
      this.isWriting = false;
    }
  }

  /**
   * Format log entry
   */
  private formatLogEntry(entry: LogEntry): string {
    if (this.config.formatJson) {
      return JSON.stringify({
        timestamp: entry.timestamp.toISOString(),
        level: LogLevel[entry.level],
        message: entry.message,
        context: entry.context,
        data: entry.data,
        error: entry.error ? {
          message: entry.error.message,
          stack: entry.error.stack,
        } : undefined,
      });
    }
    
    const parts = [];
    
    if (this.config.includeTimestamp) {
      parts.push(moment(entry.timestamp).format('YYYY-MM-DD HH:mm:ss.SSS'));
    }
    
    parts.push(`[${LogLevel[entry.level]}]`);
    
    if (this.config.includeContext && entry.context) {
      parts.push(`[${entry.context}]`);
    }
    
    parts.push(entry.message);
    
    if (entry.data) {
      parts.push(JSON.stringify(entry.data, null, 2));
    }
    
    if (entry.error) {
      parts.push(`\nError: ${entry.error.message}`);
      if (entry.error.stack) {
        parts.push(`\nStack: ${entry.error.stack}`);
      }
    }
    
    return parts.join(' ');
  }

  /**
   * Log to status bar
   */
  private logToStatusBar(entry: LogEntry): void {
    // This would integrate with the plugin's status bar
    // For now, just use a Notice
    const levelIcon = {
      [LogLevel.WARN]: '⚠️',
      [LogLevel.ERROR]: '❌',
      [LogLevel.FATAL]: '💀',
    }[entry.level] || 'ℹ️';
    
    const message = `${levelIcon} ${entry.message}`;
    
    // Use plugin's notification system if available
    if ((this as any).plugin?.notificationManager) {
      (this as any).plugin.notificationManager.show(message, 'warning', { duration: 5000 });
    }
  }

  /**
   * Public logging methods
   */
  
  debug(message: string, data?: any, context?: string): void {
    this.log(LogLevel.DEBUG, message, data, context);
  }
  
  info(message: string, data?: any, context?: string): void {
    this.log(LogLevel.INFO, message, data, context);
  }
  
  warn(message: string, data?: any, context?: string): void {
    this.log(LogLevel.WARN, message, data, context);
  }
  
  error(message: string, error?: Error | any, context?: string): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.ERROR,
      message,
      context,
      error: error instanceof Error ? error : undefined,
      data: error instanceof Error ? undefined : error,
    };
    
    this.buffer.push(entry);
    
    if (this.config.logToConsole) {
      this.logToConsole(entry);
    }
    
    if (this.config.logToFile) {
      this.logToFile(entry);
    }
  }
  
  fatal(message: string, error?: Error | any, context?: string): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.FATAL,
      message,
      context,
      error: error instanceof Error ? error : undefined,
      data: error instanceof Error ? undefined : error,
    };
    
    this.buffer.push(entry);
    
    if (this.config.logToConsole) {
      this.logToConsole(entry);
    }
    
    if (this.config.logToFile) {
      this.logToFile(entry);
    }
  }

  /**
   * Performance logging
   */
  
  startTimer(operation: string): void {
    const timers = this.performanceMetrics.get(operation) || [];
    timers.push(Date.now());
    this.performanceMetrics.set(operation, timers);
  }
  
  endTimer(operation: string, logResult: boolean = true): number {
    const timers = this.performanceMetrics.get(operation);
    if (!timers || timers.length === 0) {
      this.warn(`No timer found for operation: ${operation}`);
      return -1;
    }
    
    const startTime = timers.pop()!;
    const duration = Date.now() - startTime;
    
    if (logResult) {
      this.debug(`${operation} completed in ${duration}ms`, { duration }, 'Performance');
    }
    
    return duration;
  }
  
  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): Map<string, number[]> {
    return new Map(this.performanceMetrics);
  }

  /**
   * Configuration methods
   */
  
  setLogLevel(level: LogLevel | string): void {
    this.config.level = typeof level === 'string' ? this.parseLogLevel(level) : level;
  }
  
  enableConsoleLogging(enable: boolean): void {
    this.config.logToConsole = enable;
  }
  
  enableFileLogging(enable: boolean): void {
    this.config.logToFile = enable;
  }
  
  /**
   * Buffer management
   */
  
  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }
  
  clearBuffer(): void {
    this.buffer = [];
  }
  
  /**
   * Export logs
   */
  async exportLogs(): Promise<string> {
    if (!this.logFile) {
      return this.buffer.map(entry => this.formatLogEntry(entry)).join('\n');
    }
    
    try {
      return await this.app.vault.read(this.logFile);
    } catch (error) {
      this.error('Failed to export logs', error);
      return '';
    }
  }
  
  /**
   * Clean up
   */
  async cleanup(): Promise<void> {
    // Flush any remaining buffer to file
    if (this.config.logToFile && this.buffer.length > 0) {
      for (const entry of this.buffer) {
        await this.logToFile(entry);
      }
    }
    
    // Clear buffer
    this.buffer = [];
    
    // Clear performance metrics
    this.performanceMetrics.clear();
    
    this.info('Logger service cleaned up');
  }
}