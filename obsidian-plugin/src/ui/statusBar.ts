/**
 * Status Bar Component for Meeting Tasks Plugin
 * Shows plugin status and last check time in Obsidian's status bar
 */

import { App, moment } from 'obsidian';
import { MeetingTasksPlugin } from '../main';

/**
 * Status types for the status bar
 */
export type StatusType = 'idle' | 'checking' | 'processing' | 'connected' | 'disconnected' | 'error';

/**
 * Manages the status bar item for the plugin
 */
export class StatusBarItem {
  private plugin: MeetingTasksPlugin;
  private app: App;
  private statusBarEl: HTMLElement | null = null;
  private lastCheckTime: Date | null = null;
  private currentStatus: StatusType = 'idle';
  private updateInterval: NodeJS.Timer | null = null;
  private taskCount: number = 0;

  constructor(plugin: MeetingTasksPlugin) {
    this.plugin = plugin;
    this.app = plugin.app;
  }

  /**
   * Initialize the status bar item
   */
  init(): void {
    // Create status bar item
    this.statusBarEl = this.plugin.addStatusBarItem();
    
    if (this.statusBarEl) {
      // Add CSS class
      this.statusBarEl.addClass('meeting-tasks-status');
      
      // Set initial text
      this.updateDisplay();
      
      // Add click handler
      this.statusBarEl.onClickEvent((evt: MouseEvent) => {
        this.handleClick(evt);
      });
      
      // Start update interval for relative time
      this.startUpdateInterval();
      
      // Load last check time from settings
      if (this.plugin.settings.lastCheckTime) {
        this.lastCheckTime = new Date(this.plugin.settings.lastCheckTime);
      }
    }
  }

  /**
   * Handle status bar click
   */
  private handleClick(evt: MouseEvent): void {
    if (evt.shiftKey) {
      // Shift+Click: Copy status to clipboard
      this.copyStatusToClipboard();
    } else if (evt.ctrlKey || evt.metaKey) {
      // Ctrl/Cmd+Click: Show detailed status
      this.showDetailedStatus();
    } else {
      // Normal click: Show quick stats
      this.showQuickStats();
    }
  }

  /**
   * Update the last check time
   */
  updateLastCheckTime(time: Date): void {
    this.lastCheckTime = time;
    this.updateDisplay();
    
    // Save to settings
    this.plugin.settings.lastCheckTime = time.toISOString();
    this.plugin.saveSettings();
  }

  /**
   * Update the current status
   */
  updateStatus(status: StatusType, taskCount?: number): void {
    this.currentStatus = status;
    if (taskCount !== undefined) {
      this.taskCount = taskCount;
    }
    this.updateDisplay();
  }

  /**
   * Update the display text
   */
  private updateDisplay(): void {
    if (!this.statusBarEl) return;

    let text = '';
    let tooltip = '';
    
    // Build status text based on current state
    switch (this.currentStatus) {
      case 'checking':
        text = '📧 Checking...';
        tooltip = 'Checking for new meeting tasks';
        break;
        
      case 'processing':
        text = '⚙️ Processing...';
        tooltip = 'Processing meeting transcripts';
        break;
        
      case 'connected':
        text = '🟢 Connected';
        tooltip = 'WebSocket connected';
        break;
        
      case 'disconnected':
        text = '🔴 Disconnected';
        tooltip = 'WebSocket disconnected';
        break;
        
      case 'error':
        text = '⚠️ Error';
        tooltip = 'An error occurred';
        break;
        
      case 'idle':
      default:
        if (this.lastCheckTime) {
          const timeAgo = this.getRelativeTime(this.lastCheckTime);
          text = `📋 ${timeAgo}`;
          tooltip = `Last checked: ${moment(this.lastCheckTime).format('YYYY-MM-DD HH:mm:ss')}`;
        } else {
          text = '📋 Never checked';
          tooltip = 'Click to check for meeting tasks';
        }
        break;
    }
    
    // Add task count if available
    if (this.taskCount > 0 && this.currentStatus === 'idle') {
      text += ` (${this.taskCount} new)`;
    }
    
    // Update element
    this.statusBarEl.setText(text);
    this.statusBarEl.setAttribute('aria-label', tooltip);
    this.statusBarEl.setAttribute('title', tooltip);
    
    // Update CSS classes
    this.statusBarEl.removeClass('is-checking', 'is-processing', 'is-error', 'is-connected', 'is-disconnected');
    if (this.currentStatus !== 'idle') {
      this.statusBarEl.addClass(`is-${this.currentStatus}`);
    }
  }

  /**
   * Get relative time string
   */
  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffMins / 1440);
      return `${days}d ago`;
    }
  }

  /**
   * Start update interval for relative time
   */
  private startUpdateInterval(): void {
    // Update every minute
    this.updateInterval = setInterval(() => {
      if (this.currentStatus === 'idle') {
        this.updateDisplay();
      }
    }, 60000);
  }

  /**
   * Stop update interval
   */
  private stopUpdateInterval(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Show quick statistics
   */
  private showQuickStats(): void {
    const stats = [];
    
    // Last check time
    if (this.lastCheckTime) {
      stats.push(`Last check: ${moment(this.lastCheckTime).format('YYYY-MM-DD HH:mm')}`);
    }
    
    // Total statistics
    const totalMeetings = this.plugin.settings.totalMeetingsProcessed;
    const totalTasks = this.plugin.settings.totalTasksExtracted;
    
    if (totalMeetings > 0) {
      stats.push(`Total meetings: ${totalMeetings}`);
    }
    if (totalTasks > 0) {
      stats.push(`Total tasks: ${totalTasks}`);
    }
    
    // Connection status
    if (this.plugin.settings.enableWebSocket) {
      stats.push(`WebSocket: ${this.currentStatus === 'connected' ? 'Connected' : 'Disconnected'}`);
    }
    
    // Auto-check status
    if (this.plugin.settings.autoCheck) {
      stats.push(`Auto-check: Every ${this.plugin.settings.checkInterval} minutes`);
    }
    
    // Show as notice
    const message = stats.length > 0 ? stats.join('\n') : 'No statistics available';
    this.plugin.showNotice(message, 'info');
  }

  /**
   * Show detailed status information
   */
  private showDetailedStatus(): void {
    // Open modal with detailed statistics
    this.plugin.showResultsModal({
      meetings: [],
      tasks: [],
      errors: [],
      statistics: {
        totalMeetings: this.plugin.settings.totalMeetingsProcessed,
        totalTasks: this.plugin.settings.totalTasksExtracted,
        lastCheck: this.lastCheckTime?.toISOString() || 'Never',
        processingHistory: this.plugin.settings.processingHistory.slice(-10),
      }
    });
  }

  /**
   * Copy status to clipboard
   */
  private copyStatusToClipboard(): void {
    const status = [];
    
    status.push('Meeting Tasks Plugin Status');
    status.push('=' .repeat(30));
    
    if (this.lastCheckTime) {
      status.push(`Last Check: ${moment(this.lastCheckTime).format('YYYY-MM-DD HH:mm:ss')}`);
    }
    
    status.push(`Current Status: ${this.currentStatus}`);
    status.push(`Total Meetings Processed: ${this.plugin.settings.totalMeetingsProcessed}`);
    status.push(`Total Tasks Extracted: ${this.plugin.settings.totalTasksExtracted}`);
    
    if (this.plugin.settings.enableWebSocket) {
      status.push(`WebSocket: ${this.currentStatus === 'connected' ? 'Connected' : 'Disconnected'}`);
    }
    
    status.push(`Auto-check: ${this.plugin.settings.autoCheck ? `Every ${this.plugin.settings.checkInterval} minutes` : 'Disabled'}`);
    
    // Copy to clipboard
    navigator.clipboard.writeText(status.join('\n')).then(() => {
      this.plugin.showNotice('Status copied to clipboard', 'info');
    });
  }

  /**
   * Clean up status bar item
   */
  cleanup(): void {
    // Stop update interval
    this.stopUpdateInterval();
    
    // Remove CSS classes
    if (this.statusBarEl) {
      this.statusBarEl.removeClass('meeting-tasks-status');
      this.statusBarEl.removeClass('is-checking', 'is-processing', 'is-error', 'is-connected', 'is-disconnected');
    }
    
    // Note: The status bar item itself is removed by Obsidian when the plugin unloads
    this.statusBarEl = null;
  }
}