/**
 * Ribbon Icon Handler for Meeting Tasks Plugin
 * Manages the ribbon icon in Obsidian's left sidebar
 */

import { App, setIcon } from 'obsidian';
import { MeetingTasksPlugin } from '../main';

/**
 * Manages the ribbon icon for quick access to plugin features
 */
export class RibbonIconHandler {
  private plugin: MeetingTasksPlugin;
  private app: App;
  private ribbonIconEl: HTMLElement | null = null;
  private isProcessing: boolean = false;

  constructor(plugin: MeetingTasksPlugin) {
    this.plugin = plugin;
    this.app = plugin.app;
  }

  /**
   * Initialize the ribbon icon
   */
  init(): void {
    // Add ribbon icon
    this.ribbonIconEl = this.plugin.addRibbonIcon(
      'mail-check', // Icon name
      'Check for meeting tasks', // Tooltip
      async (evt: MouseEvent) => {
        await this.handleClick(evt);
      }
    );

    // Add CSS class for styling
    if (this.ribbonIconEl) {
      this.ribbonIconEl.addClass('meeting-tasks-ribbon-icon');
    }
  }

  /**
   * Handle ribbon icon click
   */
  private async handleClick(evt: MouseEvent): Promise<void> {
    // Prevent multiple clicks while processing
    if (this.isProcessing) {
      return;
    }

    try {
      // Check for modifier keys
      if (evt.shiftKey) {
        // Shift+Click: Open settings
        await this.openSettings();
      } else if (evt.ctrlKey || evt.metaKey) {
        // Ctrl/Cmd+Click: Force check (ignore cache)
        await this.forceCheck();
      } else {
        // Normal click: Check for new tasks
        await this.checkForTasks();
      }
    } catch (error) {
      console.error('Ribbon icon action failed:', error);
      this.plugin.showNotice('Action failed. Check console for details.', 'error');
    }
  }

  /**
   * Check for new meeting tasks
   */
  private async checkForTasks(): Promise<void> {
    this.setProcessingState(true);

    try {
      // Trigger the main plugin's check method
      await this.plugin.checkForMeetingTasks();
      
      // Update last check time in status bar
      this.plugin.statusBar?.updateLastCheckTime(new Date());
    } finally {
      this.setProcessingState(false);
    }
  }

  /**
   * Force check for tasks (ignore cache)
   */
  private async forceCheck(): Promise<void> {
    this.setProcessingState(true);

    try {
      // Trigger force check
      await this.plugin.checkForMeetingTasks(true);
      
      // Show notification
      this.plugin.showNotice('Force check initiated', 'info');
      
      // Update status bar
      this.plugin.statusBar?.updateLastCheckTime(new Date());
    } finally {
      this.setProcessingState(false);
    }
  }

  /**
   * Open plugin settings
   */
  private async openSettings(): Promise<void> {
    // Open settings tab
    // @ts-ignore - Accessing Obsidian's internal API
    this.app.setting.open();
    // @ts-ignore
    this.app.setting.openTabById(this.plugin.manifest.id);
  }

  /**
   * Set processing state and update UI
   */
  private setProcessingState(processing: boolean): void {
    this.isProcessing = processing;

    if (this.ribbonIconEl) {
      if (processing) {
        this.ribbonIconEl.addClass('is-processing');
        // Change icon to loading indicator
        setIcon(this.ribbonIconEl, 'loader-2');
        
        // Add spinning animation
        this.ribbonIconEl.setCssStyles({
          animation: 'spin 1s linear infinite'
        });
      } else {
        this.ribbonIconEl.removeClass('is-processing');
        // Restore original icon
        setIcon(this.ribbonIconEl, 'mail-check');
        
        // Remove animation
        this.ribbonIconEl.setCssStyles({
          animation: ''
        });
      }
    }
  }

  /**
   * Update ribbon icon state based on connection status
   */
  updateConnectionStatus(connected: boolean): void {
    if (this.ribbonIconEl) {
      if (connected) {
        this.ribbonIconEl.removeClass('is-disconnected');
        this.ribbonIconEl.setAttribute('aria-label', 'Check for meeting tasks');
      } else {
        this.ribbonIconEl.addClass('is-disconnected');
        this.ribbonIconEl.setAttribute('aria-label', 'Check for meeting tasks (disconnected)');
      }
    }
  }

  /**
   * Show badge on ribbon icon for new tasks
   */
  showNewTasksBadge(count: number): void {
    if (!this.ribbonIconEl) return;

    // Remove existing badge
    this.clearBadge();

    if (count > 0) {
      // Create badge element
      const badge = document.createElement('span');
      badge.addClass('meeting-tasks-badge');
      badge.setText(count > 99 ? '99+' : count.toString());
      
      // Add badge to ribbon icon
      this.ribbonIconEl.appendChild(badge);
      
      // Auto-clear badge after 10 seconds
      setTimeout(() => this.clearBadge(), 10000);
    }
  }

  /**
   * Clear badge from ribbon icon
   */
  clearBadge(): void {
    if (this.ribbonIconEl) {
      const badge = this.ribbonIconEl.querySelector('.meeting-tasks-badge');
      if (badge) {
        badge.remove();
      }
    }
  }

  /**
   * Clean up ribbon icon
   */
  cleanup(): void {
    // Clear any badges
    this.clearBadge();
    
    // Remove CSS classes
    if (this.ribbonIconEl) {
      this.ribbonIconEl.removeClass('meeting-tasks-ribbon-icon');
      this.ribbonIconEl.removeClass('is-processing');
      this.ribbonIconEl.removeClass('is-disconnected');
    }
    
    // Note: The ribbon icon itself is removed by Obsidian when the plugin unloads
    this.ribbonIconEl = null;
  }
}