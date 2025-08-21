/**
 * Settings Management for Meeting Tasks Plugin
 * Handles plugin configuration and settings UI
 */

import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  Notice,
  ButtonComponent,
  TextComponent,
  ToggleComponent,
  DropdownComponent,
  TextAreaComponent,
  ExtraButtonComponent,
} from 'obsidian';
import { ApiClient } from './api/client';
import { ConnectionTestResult } from './api/types';

/**
 * Plugin Settings Interface
 * Complete configuration for the Meeting Tasks plugin
 */
export interface MeetingTasksSettings {
  // ============================================================================
  // Service Connection
  // ============================================================================
  
  /**
   * Base URL of the TasksAgent service
   * @default 'http://localhost:3000'
   */
  serviceUrl: string;
  
  /**
   * WebSocket URL for real-time updates
   * @default 'ws://localhost:3000'
   */
  webSocketUrl: string;
  
  /**
   * Enable WebSocket connection for real-time updates
   * @default true
   */
  enableWebSocket: boolean;
  
  // ============================================================================
  // Gmail Settings (via proxy)
  // ============================================================================
  
  /**
   * Email patterns to match for meeting transcripts
   * @default ['Notes:', 'Recording of', 'Transcript for', 'Meeting notes']
   */
  gmailPatterns: string[];
  
  /**
   * How many hours to look back for emails
   * @default 120 (5 days)
   */
  lookbackHours: number;
  
  /**
   * Maximum number of emails to process per check
   * @default 50
   */
  maxEmails: number;
  
  /**
   * Email domains to filter (optional)
   * @default []
   */
  emailDomains: string[];
  
  // ============================================================================
  // AI Settings (user-provided)
  // ============================================================================
  
  /**
   * Anthropic API key for Claude
   * User must provide their own key
   */
  anthropicApiKey: string;
  
  /**
   * Claude model to use for task extraction
   * @default 'claude-3-haiku-20240307'
   */
  claudeModel: string;
  
  /**
   * Maximum tokens for Claude responses
   * @default 4096
   */
  maxTokens: number;
  
  /**
   * Temperature for Claude responses (0-1)
   * @default 0.7
   */
  temperature: number;
  
  /**
   * Custom prompt prefix for task extraction
   * @default ''
   */
  customPrompt: string;
  
  // ============================================================================
  // Obsidian Integration
  // ============================================================================
  
  /**
   * Target folder for meeting notes
   * @default 'Meetings'
   */
  targetFolder: string;
  
  /**
   * Note naming pattern
   * Available variables: {{date}}, {{title}}, {{time}}
   * @default '{{date}} - {{title}}'
   */
  noteNamePattern: string;
  
  /**
   * Date format for note names
   * @default 'YYYY-MM-DD'
   */
  dateFormat: string;
  
  /**
   * Time format for note names
   * @default 'HH-mm'
   */
  timeFormat: string;
  
  /**
   * Default note template (if not using Templater)
   * @default ''
   */
  noteTemplate: string;
  
  /**
   * Use Templater plugin for templates
   * @default false
   */
  useTemplater: boolean;
  
  /**
   * Path to Templater template
   * @default ''
   */
  templaterTemplate: string;
  
  /**
   * Custom template variables
   * @default {}
   */
  templateVariables: Record<string, string>;
  
  /**
   * Tags to add to meeting notes
   * @default ['meeting', 'tasks']
   */
  defaultTags: string[];
  
  /**
   * Link to daily note if it exists
   * @default true
   */
  linkToDailyNote: boolean;
  
  /**
   * Daily note folder path
   * @default 'Daily Notes'
   */
  dailyNoteFolder: string;
  
  /**
   * Daily note date format
   * @default 'YYYY-MM-DD'
   */
  dailyNoteDateFormat: string;
  
  // ============================================================================
  // Automation
  // ============================================================================
  
  /**
   * Enable automatic checking for new tasks
   * @default false
   */
  autoCheck: boolean;
  
  /**
   * Check interval in minutes
   * @default 60
   */
  checkInterval: number;
  
  /**
   * Quiet hours configuration
   * During these hours, automatic checks are disabled
   */
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string;   // HH:mm format
    timezone: string;
  };
  
  /**
   * Days of week to run automatic checks
   * 0 = Sunday, 6 = Saturday
   * @default [1, 2, 3, 4, 5] (weekdays)
   */
  activeDays: number[];
  
  /**
   * Process on plugin startup
   * @default false
   */
  processOnStartup: boolean;
  
  // ============================================================================
  // Notifications
  // ============================================================================
  
  notifications: {
    /**
     * Enable notifications
     * @default true
     */
    enabled: boolean;
    
    /**
     * Notify on new tasks found
     * @default true
     */
    onNewTasks: boolean;
    
    /**
     * Notify on errors
     * @default true
     */
    onErrors: boolean;
    
    /**
     * Notify when no new tasks found
     * @default false
     */
    onNoTasks: boolean;
    
    /**
     * Show processing progress
     * @default true
     */
    showProgress: boolean;
    
    /**
     * Notification duration in seconds
     * @default 5
     */
    duration: number;
    
    /**
     * Play sound on new tasks
     * @default false
     */
    playSound: boolean;
  };
  
  // ============================================================================
  // Advanced Settings
  // ============================================================================
  
  advanced: {
    /**
     * Number of retry attempts for failed requests
     * @default 3
     */
    retryAttempts: number;
    
    /**
     * Request timeout in milliseconds
     * @default 60000 (60 seconds)
     */
    timeout: number;
    
    /**
     * Cache expiry time in milliseconds
     * @default 3600000 (1 hour)
     */
    cacheExpiry: number;
    
    /**
     * Enable transcript caching for offline viewing
     * @default true
     */
    enableTranscriptCache: boolean;
    
    /**
     * WebSocket reconnect delay in milliseconds
     * @default 5000 (5 seconds)
     */
    webSocketReconnectDelay: number;
    
    /**
     * Maximum WebSocket reconnect attempts
     * @default 10
     */
    maxReconnectAttempts: number;
    
    /**
     * Enable debug logging
     * @default false
     */
    debugMode: boolean;
    
    /**
     * Log level
     * @default 'info'
     */
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    
    /**
     * Maximum log file size in MB
     * @default 10
     */
    maxLogSize: number;
    
    /**
     * Keep processed email IDs for deduplication
     * @default true
     */
    trackProcessedEmails: boolean;
    
    /**
     * Number of days to keep processed email history
     * @default 30
     */
    historyRetentionDays: number;
    
    /**
     * Batch processing size
     * @default 5
     */
    batchSize: number;
    
    /**
     * Delay between batch items in milliseconds
     * @default 1000
     */
    batchDelay: number;
  };
  
  // ============================================================================
  // Statistics & History
  // ============================================================================
  
  /**
   * Track processing statistics
   * @default true
   */
  trackStatistics: boolean;
  
  /**
   * Last successful check timestamp
   */
  lastCheckTime?: string;
  
  /**
   * Total meetings processed
   * @default 0
   */
  totalMeetingsProcessed: number;
  
  /**
   * Total tasks extracted
   * @default 0
   */
  totalTasksExtracted: number;
  
  /**
   * Processing history
   * @default []
   */
  processingHistory: ProcessingHistoryEntry[];
  
  /**
   * Maximum history entries to keep
   * @default 100
   */
  maxHistoryEntries: number;
}

/**
 * Processing history entry
 */
export interface ProcessingHistoryEntry {
  timestamp: string;
  action: 'check' | 'process' | 'error';
  details: string;
  meetingsFound: number;
  tasksExtracted: number;
  success: boolean;
  error?: string;
}

/**
 * Default settings for the plugin
 */
export const DEFAULT_SETTINGS: MeetingTasksSettings = {
  // Service Connection
  serviceUrl: 'http://localhost:3000',
  webSocketUrl: 'ws://localhost:3000',
  enableWebSocket: true,
  
  // Gmail Settings
  gmailPatterns: [
    'Notes:',
    'Recording of',
    'Transcript for',
    'Meeting notes',
    'Meeting summary',
    'Action items from'
  ],
  lookbackHours: 120,
  maxEmails: 50,
  emailDomains: [],
  
  // AI Settings
  anthropicApiKey: '',
  claudeModel: 'claude-3-haiku-20240307',
  maxTokens: 4096,
  temperature: 0.7,
  customPrompt: '',
  
  // Obsidian Integration
  targetFolder: 'Meetings',
  noteNamePattern: '{{date}} - {{title}}',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: 'HH-mm',
  noteTemplate: '',
  useTemplater: false,
  templaterTemplate: '',
  templateVariables: {},
  defaultTags: ['meeting', 'tasks'],
  linkToDailyNote: true,
  dailyNoteFolder: 'Daily Notes',
  dailyNoteDateFormat: 'YYYY-MM-DD',
  
  // Automation
  autoCheck: false,
  checkInterval: 60,
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  activeDays: [1, 2, 3, 4, 5], // Weekdays
  processOnStartup: false,
  
  // Notifications
  notifications: {
    enabled: true,
    onNewTasks: true,
    onErrors: true,
    onNoTasks: false,
    showProgress: true,
    duration: 5,
    playSound: false,
  },
  
  // Advanced Settings
  advanced: {
    retryAttempts: 3,
    timeout: 60000,
    cacheExpiry: 3600000,
    enableTranscriptCache: true,
    webSocketReconnectDelay: 5000,
    maxReconnectAttempts: 10,
    debugMode: false,
    logLevel: 'info',
    maxLogSize: 10,
    trackProcessedEmails: true,
    historyRetentionDays: 30,
    batchSize: 5,
    batchDelay: 1000,
  },
  
  // Statistics & History
  trackStatistics: true,
  lastCheckTime: undefined,
  totalMeetingsProcessed: 0,
  totalTasksExtracted: 0,
  processingHistory: [],
  maxHistoryEntries: 100,
};

/**
 * Validate settings
 * @param settings Settings to validate
 * @returns Validation result with any errors
 */
export function validateSettings(settings: MeetingTasksSettings): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Validate URLs
  try {
    new URL(settings.serviceUrl);
  } catch {
    errors.push('Invalid service URL');
  }
  
  try {
    new URL(settings.webSocketUrl);
  } catch {
    errors.push('Invalid WebSocket URL');
  }
  
  // Validate required fields
  if (!settings.anthropicApiKey && settings.autoCheck) {
    errors.push('Anthropic API key is required for automatic checking');
  }
  
  if (!settings.targetFolder) {
    errors.push('Target folder is required');
  }
  
  // Validate numeric ranges
  if (settings.lookbackHours < 1 || settings.lookbackHours > 720) {
    errors.push('Lookback hours must be between 1 and 720 (30 days)');
  }
  
  if (settings.maxEmails < 1 || settings.maxEmails > 100) {
    errors.push('Max emails must be between 1 and 100');
  }
  
  if (settings.checkInterval < 5 || settings.checkInterval > 1440) {
    errors.push('Check interval must be between 5 and 1440 minutes (24 hours)');
  }
  
  if (settings.temperature < 0 || settings.temperature > 1) {
    errors.push('Temperature must be between 0 and 1');
  }
  
  // Validate time format
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (settings.quietHours.enabled) {
    if (!timeRegex.test(settings.quietHours.start)) {
      errors.push('Invalid quiet hours start time format (use HH:mm)');
    }
    if (!timeRegex.test(settings.quietHours.end)) {
      errors.push('Invalid quiet hours end time format (use HH:mm)');
    }
  }
  
  // Validate Templater settings
  if (settings.useTemplater && !settings.templaterTemplate) {
    errors.push('Templater template path is required when using Templater');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Migrate settings from old versions
 * @param oldSettings Potentially outdated settings
 * @returns Migrated settings
 */
export function migrateSettings(oldSettings: any): MeetingTasksSettings {
  const settings = { ...DEFAULT_SETTINGS };
  
  // Safely copy over existing settings
  if (oldSettings) {
    // Simple fields
    const simpleFields = [
      'serviceUrl', 'webSocketUrl', 'enableWebSocket',
      'lookbackHours', 'maxEmails', 'anthropicApiKey',
      'claudeModel', 'maxTokens', 'temperature', 'customPrompt',
      'targetFolder', 'noteNamePattern', 'dateFormat', 'timeFormat',
      'noteTemplate', 'useTemplater', 'templaterTemplate',
      'linkToDailyNote', 'dailyNoteFolder', 'dailyNoteDateFormat',
      'autoCheck', 'checkInterval', 'processOnStartup',
      'trackStatistics', 'lastCheckTime', 'totalMeetingsProcessed',
      'totalTasksExtracted', 'maxHistoryEntries'
    ];
    
    simpleFields.forEach(field => {
      if (oldSettings[field] !== undefined) {
        (settings as any)[field] = oldSettings[field];
      }
    });
    
    // Array fields
    if (Array.isArray(oldSettings.gmailPatterns)) {
      settings.gmailPatterns = oldSettings.gmailPatterns;
    }
    if (Array.isArray(oldSettings.emailDomains)) {
      settings.emailDomains = oldSettings.emailDomains;
    }
    if (Array.isArray(oldSettings.defaultTags)) {
      settings.defaultTags = oldSettings.defaultTags;
    }
    if (Array.isArray(oldSettings.activeDays)) {
      settings.activeDays = oldSettings.activeDays;
    }
    if (Array.isArray(oldSettings.processingHistory)) {
      settings.processingHistory = oldSettings.processingHistory.slice(-settings.maxHistoryEntries);
    }
    
    // Object fields
    if (oldSettings.templateVariables && typeof oldSettings.templateVariables === 'object') {
      settings.templateVariables = oldSettings.templateVariables;
    }
    
    if (oldSettings.quietHours && typeof oldSettings.quietHours === 'object') {
      settings.quietHours = { ...settings.quietHours, ...oldSettings.quietHours };
    }
    
    if (oldSettings.notifications && typeof oldSettings.notifications === 'object') {
      settings.notifications = { ...settings.notifications, ...oldSettings.notifications };
    }
    
    if (oldSettings.advanced && typeof oldSettings.advanced === 'object') {
      settings.advanced = { ...settings.advanced, ...oldSettings.advanced };
    }
  }
  
  return settings;
}

/**
 * Add entry to processing history
 * @param settings Current settings
 * @param entry New history entry
 */
export function addHistoryEntry(
  settings: MeetingTasksSettings,
  entry: Omit<ProcessingHistoryEntry, 'timestamp'>
): void {
  const historyEntry: ProcessingHistoryEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  
  settings.processingHistory.push(historyEntry);
  
  // Trim history to max entries
  if (settings.processingHistory.length > settings.maxHistoryEntries) {
    settings.processingHistory = settings.processingHistory.slice(-settings.maxHistoryEntries);
  }
  
  // Update statistics
  if (entry.success && entry.action === 'process') {
    settings.totalMeetingsProcessed += entry.meetingsFound;
    settings.totalTasksExtracted += entry.tasksExtracted;
  }
  
  // Update last check time
  if (entry.action === 'check') {
    settings.lastCheckTime = historyEntry.timestamp;
  }
}