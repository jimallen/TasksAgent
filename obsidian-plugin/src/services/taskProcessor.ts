/**
 * Task Processor Service for Meeting Tasks Plugin
 * Handles processing and transformation of task data
 */

import { App } from 'obsidian';
import { MeetingTasksPlugin } from '../main';
import { ApiClient } from '../api/client';
import { WebSocketManager } from '../api/websocket';
import { NoteCreatorService } from './noteCreator';
import { 
  MeetingNote, 
  ExtractedTask, 
  ProcessEmailsRequest,
  ProcessEmailsResponse,
  ProcessingResult,
  EmailPattern,
} from '../api/types';
import { MeetingTasksSettings, addHistoryEntry } from '../settings';

/**
 * Processing options
 */
export interface ProcessingOptions {
  forceRefresh?: boolean;
  emailIds?: string[];
  showProgress?: boolean;
  batchSize?: number;
}

/**
 * Service for processing meeting tasks
 */
export class TaskProcessorService {
  private plugin: MeetingTasksPlugin;
  private app: App;
  private apiClient: ApiClient;
  private noteCreator: NoteCreatorService;
  private isProcessing: boolean = false;
  private cancelRequested: boolean = false;
  private lastResults: ProcessingResult | null = null;

  constructor(
    plugin: MeetingTasksPlugin,
    apiClient: ApiClient,
    noteCreator: NoteCreatorService
  ) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.apiClient = apiClient;
    this.noteCreator = noteCreator;
  }

  /**
   * Manually trigger processing of emails
   */
  async processEmails(options: ProcessingOptions = {}): Promise<ProcessingResult> {
    if (this.isProcessing) {
      throw new Error('Processing already in progress');
    }

    this.isProcessing = true;
    this.cancelRequested = false;

    const result: ProcessingResult = {
      meetings: [],
      tasks: [],
      errors: [],
      statistics: {},
    };

    try {
      // Show progress modal if requested
      if (options.showProgress) {
        this.plugin.showProgressModal();
      }

      // Update status
      this.plugin.updateStatus('checking');
      this.plugin.updateProgress(0, 100, 'Connecting to service...');

      // Prepare request
      const request: ProcessEmailsRequest = {
        patterns: this.getEmailPatterns(),
        lookbackHours: this.plugin.settings.lookbackHours,
        maxEmails: this.plugin.settings.maxEmails,
        forceRefresh: options.forceRefresh,
        emailIds: options.emailIds,
        anthropicKey: this.plugin.settings.anthropicApiKey,
        claudeModel: this.plugin.settings.claudeModel,
      };

      // Check for cancellation
      if (this.cancelRequested) {
        throw new Error('Processing cancelled');
      }

      // Call API to process emails
      this.plugin.updateProgress(10, 100, 'Searching for meeting emails...');
      const response = await this.apiClient.processEmails(request);

      // Check for cancellation
      if (this.cancelRequested) {
        throw new Error('Processing cancelled');
      }

      // Process results
      if (response.meetings && response.meetings.length > 0) {
        result.meetings = response.meetings;
        result.tasks = response.meetings.flatMap(m => m.tasks || []);

        // Create notes for each meeting
        const total = response.meetings.length;
        for (let i = 0; i < total; i++) {
          if (this.cancelRequested) {
            throw new Error('Processing cancelled');
          }

          const meeting = response.meetings[i];
          const progress = 20 + (70 * (i + 1) / total);
          
          this.plugin.updateProgress(
            progress, 
            100, 
            `Creating note for: ${meeting.title}`,
            `Processing ${i + 1} of ${total} meetings`
          );

          try {
            // Create note
            const file = await this.noteCreator.createMeetingNote(meeting);
            
            // Track success
            meeting.noteCreated = true;
            meeting.notePath = file.path;
            
            // Show notification for new tasks
            if (meeting.tasks && meeting.tasks.length > 0) {
              this.plugin.notificationManager?.showNewTasks(meeting.tasks, meeting);
            }
          } catch (error) {
            console.error('Failed to create note:', error);
            result.errors?.push({
              message: `Failed to create note for ${meeting.title}`,
              details: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // Update statistics
      this.plugin.updateProgress(90, 100, 'Updating statistics...');
      this.updateStatistics(result);

      // Add history entry
      addHistoryEntry(this.plugin.settings, {
        action: 'process',
        details: options.forceRefresh ? 'Force check' : 'Regular check',
        meetingsFound: result.meetings?.length || 0,
        tasksExtracted: result.tasks?.length || 0,
        success: true,
      });

      // Save settings
      await this.plugin.saveSettings();

      // Update last check time
      this.plugin.statusBar?.updateLastCheckTime(new Date());

      // Show results
      this.plugin.updateProgress(100, 100, 'Processing complete!');
      
      if (options.showProgress) {
        setTimeout(() => {
          this.plugin.hideProgressModal();
          this.showResults(result);
        }, 1000);
      } else {
        this.showResultNotification(result);
      }

      this.lastResults = result;
      return result;

    } catch (error) {
      console.error('Processing failed:', error);
      
      // Add error to results
      result.errors?.push({
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined,
      });

      // Add history entry
      addHistoryEntry(this.plugin.settings, {
        action: 'error',
        details: 'Processing failed',
        meetingsFound: 0,
        tasksExtracted: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      // Save settings
      await this.plugin.saveSettings();

      // Show error
      if (options.showProgress) {
        this.plugin.hideProgressModal();
      }
      
      this.plugin.notificationManager?.showError(
        error instanceof Error ? error : new Error(String(error)),
        'Email processing failed'
      );

      throw error;

    } finally {
      this.isProcessing = false;
      this.cancelRequested = false;
      this.plugin.updateStatus('idle');
    }
  }

  /**
   * Process a single email by ID
   */
  async processSingleEmail(emailId: string): Promise<ProcessingResult> {
    return this.processEmails({
      emailIds: [emailId],
      showProgress: true,
    });
  }

  /**
   * Cancel current processing
   */
  cancelProcessing(): void {
    this.cancelRequested = true;
  }

  /**
   * Get email patterns from settings
   */
  private getEmailPatterns(): EmailPattern[] {
    return this.plugin.settings.gmailPatterns.map(pattern => ({
      pattern,
      isRegex: pattern.startsWith('/') && pattern.endsWith('/'),
    }));
  }

  /**
   * Update statistics
   */
  private updateStatistics(result: ProcessingResult): void {
    const settings = this.plugin.settings;
    
    if (result.meetings) {
      settings.totalMeetingsProcessed += result.meetings.length;
    }
    
    if (result.tasks) {
      settings.totalTasksExtracted += result.tasks.length;
    }

    // Add to result statistics
    result.statistics = {
      totalMeetings: settings.totalMeetingsProcessed,
      totalTasks: settings.totalTasksExtracted,
      lastCheck: new Date().toISOString(),
    };
  }

  /**
   * Show processing results
   */
  private showResults(result: ProcessingResult): void {
    this.plugin.showResultsModal(result);
  }

  /**
   * Show result notification
   */
  private showResultNotification(result: ProcessingResult): void {
    const meetingCount = result.meetings?.length || 0;
    const taskCount = result.tasks?.length || 0;
    const errorCount = result.errors?.length || 0;

    this.plugin.notificationManager?.showBatchSummary(
      meetingCount,
      taskCount,
      errorCount
    );
  }

  /**
   * Get last processing results
   */
  getLastResults(): ProcessingResult | null {
    return this.lastResults;
  }

  /**
   * Clear cached results
   */
  clearResults(): void {
    this.lastResults = null;
  }
}