/**
 * Modal Components for Meeting Tasks Plugin
 * Provides progress, results, and error modals
 */

import { App, Modal, Setting, ProgressBar, Notice } from 'obsidian';
import { MeetingTasksPlugin } from '../main';
import { MeetingNote, ExtractedTask, ProcessingResult } from '../api/types';
import { ProcessingHistoryEntry } from '../settings';
import moment from 'moment';

/**
 * Progress modal for showing processing status
 */
export class ProgressModal extends Modal {
  private plugin: MeetingTasksPlugin;
  private statusEl: HTMLElement;
  private progressEl: HTMLElement;
  private detailsEl: HTMLElement;
  private cancelBtn: HTMLButtonElement | null = null;
  private isCancelled: boolean = false;
  private currentStep: number = 0;
  private totalSteps: number = 0;

  constructor(plugin: MeetingTasksPlugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('meeting-tasks-progress-modal');

    // Title
    contentEl.createEl('h2', { text: 'Processing Meeting Tasks' });

    // Status message
    this.statusEl = contentEl.createEl('div', {
      cls: 'progress-status',
      text: 'Initializing...',
    });

    // Progress bar container
    const progressContainer = contentEl.createEl('div', {
      cls: 'progress-container',
    });

    // Progress bar
    this.progressEl = progressContainer.createEl('div', {
      cls: 'progress-bar',
    });

    // Progress text
    const progressText = progressContainer.createEl('div', {
      cls: 'progress-text',
      text: '0%',
    });

    // Details section
    this.detailsEl = contentEl.createEl('div', {
      cls: 'progress-details',
    });

    // Cancel button
    const buttonContainer = contentEl.createEl('div', {
      cls: 'modal-button-container',
    });

    this.cancelBtn = buttonContainer.createEl('button', {
      text: 'Cancel',
      cls: 'mod-warning',
    });

    this.cancelBtn.addEventListener('click', () => {
      this.cancel();
    });
  }

  /**
   * Update progress
   */
  updateProgress(step: number, total: number, message: string, details?: string): void {
    this.currentStep = step;
    this.totalSteps = total;

    // Update status message
    this.statusEl.setText(message);

    // Calculate percentage
    const percentage = total > 0 ? Math.round((step / total) * 100) : 0;

    // Update progress bar
    this.progressEl.style.width = `${percentage}%`;

    // Update progress text
    const progressText = this.contentEl.querySelector('.progress-text');
    if (progressText) {
      progressText.setText(`${percentage}% (${step}/${total})`);
    }

    // Update details if provided
    if (details && this.detailsEl) {
      this.detailsEl.setText(details);
    }

    // Add animation class
    this.progressEl.addClass('is-animating');
    setTimeout(() => {
      this.progressEl.removeClass('is-animating');
    }, 300);
  }

  /**
   * Set indeterminate progress
   */
  setIndeterminate(message: string): void {
    this.statusEl.setText(message);
    this.progressEl.addClass('is-indeterminate');
  }

  /**
   * Cancel processing
   */
  cancel(): void {
    this.isCancelled = true;
    this.statusEl.setText('Cancelling...');
    
    if (this.cancelBtn) {
      this.cancelBtn.disabled = true;
    }

    // Notify plugin
    this.plugin.cancelProcessing();
    
    // Close after a short delay
    setTimeout(() => {
      this.close();
    }, 1000);
  }

  /**
   * Check if cancelled
   */
  isCancelledCheck(): boolean {
    return this.isCancelled;
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Results modal for showing processed meetings
 */
export class ResultsModal extends Modal {
  private plugin: MeetingTasksPlugin;
  private results: ProcessingResult;

  constructor(plugin: MeetingTasksPlugin, results: ProcessingResult) {
    super(plugin.app);
    this.plugin = plugin;
    this.results = results;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('meeting-tasks-results-modal');

    // Title
    contentEl.createEl('h2', { text: 'Processing Results' });

    // Summary section
    this.createSummarySection(contentEl);

    // Meetings section
    if (this.results.meetings && this.results.meetings.length > 0) {
      this.createMeetingsSection(contentEl);
    }

    // Tasks section
    if (this.results.tasks && this.results.tasks.length > 0) {
      this.createTasksSection(contentEl);
    }

    // Errors section
    if (this.results.errors && this.results.errors.length > 0) {
      this.createErrorsSection(contentEl);
    }

    // Statistics section
    if (this.results.statistics) {
      this.createStatisticsSection(contentEl);
    }

    // Close button
    const buttonContainer = contentEl.createEl('div', {
      cls: 'modal-button-container',
    });

    const closeBtn = buttonContainer.createEl('button', {
      text: 'Close',
      cls: 'mod-cta',
    });

    closeBtn.addEventListener('click', () => {
      this.close();
    });
  }

  /**
   * Create summary section
   */
  private createSummarySection(contentEl: HTMLElement): void {
    const summaryEl = contentEl.createEl('div', {
      cls: 'results-summary',
    });

    const meetingCount = this.results.meetings?.length || 0;
    const taskCount = this.results.tasks?.length || 0;
    const errorCount = this.results.errors?.length || 0;

    // Meeting count
    if (meetingCount > 0) {
      summaryEl.createEl('div', {
        cls: 'summary-item success',
        text: `✅ ${meetingCount} meeting${meetingCount !== 1 ? 's' : ''} processed`,
      });
    }

    // Task count
    if (taskCount > 0) {
      summaryEl.createEl('div', {
        cls: 'summary-item info',
        text: `📋 ${taskCount} task${taskCount !== 1 ? 's' : ''} extracted`,
      });
    }

    // Error count
    if (errorCount > 0) {
      summaryEl.createEl('div', {
        cls: 'summary-item error',
        text: `⚠️ ${errorCount} error${errorCount !== 1 ? 's' : ''} occurred`,
      });
    }

    // No results
    if (meetingCount === 0 && taskCount === 0 && errorCount === 0) {
      summaryEl.createEl('div', {
        cls: 'summary-item',
        text: 'No new meetings or tasks found',
      });
    }
  }

  /**
   * Create meetings section
   */
  private createMeetingsSection(contentEl: HTMLElement): void {
    const section = contentEl.createEl('div', {
      cls: 'results-section',
    });

    section.createEl('h3', { text: 'Processed Meetings' });

    const listEl = section.createEl('ul', {
      cls: 'meeting-list',
    });

    this.results.meetings?.forEach((meeting) => {
      const itemEl = listEl.createEl('li', {
        cls: 'meeting-item',
      });

      // Meeting title
      const titleEl = itemEl.createEl('div', {
        cls: 'meeting-title',
        text: meeting.title,
      });

      // Make clickable to open note
      titleEl.addEventListener('click', async () => {
        await this.plugin.openMeetingNote(meeting);
        this.close();
      });

      // Meeting details
      const detailsEl = itemEl.createEl('div', {
        cls: 'meeting-details',
      });

      detailsEl.createEl('span', {
        text: moment(meeting.date).format('YYYY-MM-DD HH:mm'),
      });

      if (meeting.participants?.length > 0) {
        detailsEl.createEl('span', {
          text: ` • ${meeting.participants.length} participants`,
        });
      }

      if (meeting.tasks?.length > 0) {
        detailsEl.createEl('span', {
          text: ` • ${meeting.tasks.length} tasks`,
        });
      }
    });
  }

  /**
   * Create tasks section
   */
  private createTasksSection(contentEl: HTMLElement): void {
    const section = contentEl.createEl('div', {
      cls: 'results-section',
    });

    section.createEl('h3', { text: 'Extracted Tasks' });

    const listEl = section.createEl('ul', {
      cls: 'task-list',
    });

    // Group tasks by priority
    const highPriority = this.results.tasks?.filter(t => t.priority === 'high') || [];
    const mediumPriority = this.results.tasks?.filter(t => t.priority === 'medium') || [];
    const lowPriority = this.results.tasks?.filter(t => t.priority === 'low') || [];

    // High priority tasks
    if (highPriority.length > 0) {
      const highGroup = listEl.createEl('li', {
        cls: 'task-group',
      });
      highGroup.createEl('div', {
        cls: 'task-group-title',
        text: '🔴 High Priority',
      });
      this.createTaskItems(highGroup, highPriority);
    }

    // Medium priority tasks
    if (mediumPriority.length > 0) {
      const medGroup = listEl.createEl('li', {
        cls: 'task-group',
      });
      medGroup.createEl('div', {
        cls: 'task-group-title',
        text: '🟡 Medium Priority',
      });
      this.createTaskItems(medGroup, mediumPriority);
    }

    // Low priority tasks
    if (lowPriority.length > 0) {
      const lowGroup = listEl.createEl('li', {
        cls: 'task-group',
      });
      lowGroup.createEl('div', {
        cls: 'task-group-title',
        text: '🟢 Low Priority',
      });
      this.createTaskItems(lowGroup, lowPriority);
    }
  }

  /**
   * Create task items
   */
  private createTaskItems(container: HTMLElement, tasks: ExtractedTask[]): void {
    const subList = container.createEl('ul', {
      cls: 'task-sublist',
    });

    tasks.forEach((task) => {
      const itemEl = subList.createEl('li', {
        cls: 'task-item',
      });

      // Task description
      itemEl.createEl('div', {
        cls: 'task-description',
        text: task.description,
      });

      // Task metadata
      const metaEl = itemEl.createEl('div', {
        cls: 'task-meta',
      });

      if (task.assignee) {
        metaEl.createEl('span', {
          text: `Assigned to: ${task.assignee}`,
        });
      }

      if (task.dueDate) {
        metaEl.createEl('span', {
          text: ` • Due: ${task.dueDate}`,
        });
      }

      if (task.confidence) {
        metaEl.createEl('span', {
          text: ` • Confidence: ${Math.round(task.confidence * 100)}%`,
        });
      }
    });
  }

  /**
   * Create errors section
   */
  private createErrorsSection(contentEl: HTMLElement): void {
    const section = contentEl.createEl('div', {
      cls: 'results-section errors',
    });

    section.createEl('h3', { text: 'Errors' });

    const listEl = section.createEl('ul', {
      cls: 'error-list',
    });

    this.results.errors?.forEach((error) => {
      const itemEl = listEl.createEl('li', {
        cls: 'error-item',
      });

      itemEl.createEl('div', {
        cls: 'error-message',
        text: error.message || 'Unknown error',
      });

      if (error.details) {
        itemEl.createEl('div', {
          cls: 'error-details',
          text: error.details,
        });
      }
    });
  }

  /**
   * Create statistics section
   */
  private createStatisticsSection(contentEl: HTMLElement): void {
    const section = contentEl.createEl('div', {
      cls: 'results-section statistics',
    });

    section.createEl('h3', { text: 'Statistics' });

    const stats = this.results.statistics;
    if (!stats) return;

    const statsEl = section.createEl('div', {
      cls: 'stats-container',
    });

    // Display various statistics
    if (stats.totalMeetings !== undefined) {
      statsEl.createEl('div', {
        cls: 'stat-item',
        text: `Total Meetings: ${stats.totalMeetings}`,
      });
    }

    if (stats.totalTasks !== undefined) {
      statsEl.createEl('div', {
        cls: 'stat-item',
        text: `Total Tasks: ${stats.totalTasks}`,
      });
    }

    if (stats.lastCheck) {
      statsEl.createEl('div', {
        cls: 'stat-item',
        text: `Last Check: ${moment(stats.lastCheck).format('YYYY-MM-DD HH:mm')}`,
      });
    }

    // Processing history
    if (stats.processingHistory && stats.processingHistory.length > 0) {
      const historyEl = section.createEl('div', {
        cls: 'history-container',
      });

      historyEl.createEl('h4', { text: 'Recent History' });

      const historyList = historyEl.createEl('ul', {
        cls: 'history-list',
      });

      stats.processingHistory.forEach((entry: ProcessingHistoryEntry) => {
        const itemEl = historyList.createEl('li', {
          cls: `history-item ${entry.success ? 'success' : 'error'}`,
        });

        itemEl.createEl('span', {
          cls: 'history-time',
          text: moment(entry.timestamp).format('MM-DD HH:mm'),
        });

        itemEl.createEl('span', {
          cls: 'history-action',
          text: entry.action,
        });

        itemEl.createEl('span', {
          cls: 'history-details',
          text: entry.details,
        });
      });
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Error modal for showing troubleshooting information
 */
export class ErrorModal extends Modal {
  private plugin: MeetingTasksPlugin;
  private error: Error;
  private context: string;

  constructor(plugin: MeetingTasksPlugin, error: Error, context: string) {
    super(plugin.app);
    this.plugin = plugin;
    this.error = error;
    this.context = context;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('meeting-tasks-error-modal');

    // Title
    contentEl.createEl('h2', { text: '⚠️ Error Occurred' });

    // Context
    contentEl.createEl('div', {
      cls: 'error-context',
      text: `Context: ${this.context}`,
    });

    // Error message
    const errorEl = contentEl.createEl('div', {
      cls: 'error-message-container',
    });

    errorEl.createEl('h3', { text: 'Error Message' });
    errorEl.createEl('pre', {
      cls: 'error-message',
      text: this.error.message,
    });

    // Stack trace (if available and in debug mode)
    if (this.plugin.settings.advanced.debugMode && this.error.stack) {
      const stackEl = contentEl.createEl('details', {
        cls: 'error-stack-container',
      });

      stackEl.createEl('summary', { text: 'Stack Trace' });
      stackEl.createEl('pre', {
        cls: 'error-stack',
        text: this.error.stack,
      });
    }

    // Troubleshooting steps
    this.createTroubleshootingSection(contentEl);

    // Action buttons
    const buttonContainer = contentEl.createEl('div', {
      cls: 'modal-button-container',
    });

    // Copy error button
    const copyBtn = buttonContainer.createEl('button', {
      text: 'Copy Error',
      cls: 'mod-warning',
    });

    copyBtn.addEventListener('click', () => {
      this.copyError();
    });

    // Open logs button
    const logsBtn = buttonContainer.createEl('button', {
      text: 'View Logs',
    });

    logsBtn.addEventListener('click', () => {
      this.openLogs();
    });

    // Close button
    const closeBtn = buttonContainer.createEl('button', {
      text: 'Close',
      cls: 'mod-cta',
    });

    closeBtn.addEventListener('click', () => {
      this.close();
    });
  }

  /**
   * Create troubleshooting section
   */
  private createTroubleshootingSection(contentEl: HTMLElement): void {
    const section = contentEl.createEl('div', {
      cls: 'troubleshooting-section',
    });

    section.createEl('h3', { text: 'Troubleshooting Steps' });

    const steps = this.getTroubleshootingSteps();
    const listEl = section.createEl('ol', {
      cls: 'troubleshooting-list',
    });

    steps.forEach((step) => {
      listEl.createEl('li', { text: step });
    });
  }

  /**
   * Get troubleshooting steps based on error
   */
  private getTroubleshootingSteps(): string[] {
    const steps: string[] = [];

    // Check error type and provide specific steps
    const errorMessage = this.error.message.toLowerCase();

    if (errorMessage.includes('connection') || errorMessage.includes('network')) {
      steps.push('Check your internet connection');
      steps.push('Verify the service URL in settings');
      steps.push('Ensure the TasksAgent service is running');
      steps.push('Try testing the connection in settings');
    } else if (errorMessage.includes('api key') || errorMessage.includes('authentication')) {
      steps.push('Verify your Anthropic API key in settings');
      steps.push('Check that the API key has sufficient credits');
      steps.push('Ensure the API key has the correct permissions');
    } else if (errorMessage.includes('websocket')) {
      steps.push('Check WebSocket URL in settings');
      steps.push('Try disabling and re-enabling WebSocket');
      steps.push('Check firewall settings for WebSocket connections');
    } else if (errorMessage.includes('template')) {
      steps.push('Verify Templater plugin is installed and enabled');
      steps.push('Check that the template file exists');
      steps.push('Try disabling Templater in settings');
    } else {
      // Generic troubleshooting steps
      steps.push('Check the plugin settings');
      steps.push('Try restarting Obsidian');
      steps.push('Check the console for more details (Ctrl+Shift+I)');
      steps.push('Report the issue on GitHub if it persists');
    }

    return steps;
  }

  /**
   * Copy error to clipboard
   */
  private copyError(): void {
    const errorText = [
      `Error: ${this.error.message}`,
      `Context: ${this.context}`,
      `Time: ${new Date().toISOString()}`,
      '',
      'Stack Trace:',
      this.error.stack || 'Not available',
    ].join('\n');

    navigator.clipboard.writeText(errorText).then(() => {
      new Notice('Error copied to clipboard');
    });
  }

  /**
   * Open logs folder
   */
  private openLogs(): void {
    // Open developer console
    // @ts-ignore
    this.app.workspace.trigger('toggle-developer-tools');
    this.close();
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}