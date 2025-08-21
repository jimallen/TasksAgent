/**
 * Notification System for Meeting Tasks Plugin
 * Handles all plugin notifications and alerts
 */

import { Notice, App, Platform } from 'obsidian';
import { MeetingTasksPlugin } from '../main';
import { MeetingNote, ExtractedTask } from '../api/types';

/**
 * Notification types
 */
export type NotificationType = 'success' | 'error' | 'info' | 'warning';

/**
 * Notification options
 */
export interface NotificationOptions {
  duration?: number;
  showProgress?: boolean;
  playSound?: boolean;
  persistent?: boolean;
  actionButton?: {
    text: string;
    callback: () => void;
  };
}

/**
 * Manages notifications for the plugin
 */
export class NotificationManager {
  private plugin: MeetingTasksPlugin;
  private app: App;
  private activeNotices: Notice[] = [];
  private soundEnabled: boolean = false;
  private audioContext: AudioContext | null = null;

  constructor(plugin: MeetingTasksPlugin) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.soundEnabled = plugin.settings.notifications.playSound;
    
    // Initialize audio context for sound notifications
    if (this.soundEnabled && typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new AudioContext();
    }
  }

  /**
   * Show a notification
   */
  show(
    message: string,
    type: NotificationType = 'info',
    options: NotificationOptions = {}
  ): Notice {
    // Check if notifications are enabled
    if (!this.plugin.settings.notifications.enabled) {
      console.log(`[Meeting Tasks] ${type}: ${message}`);
      return new Notice(''); // Return empty notice
    }

    // Apply notification settings
    const duration = options.duration ?? this.plugin.settings.notifications.duration * 1000;
    const showProgress = options.showProgress ?? this.plugin.settings.notifications.showProgress;
    const playSound = options.playSound ?? this.plugin.settings.notifications.playSound;

    // Create notice with appropriate styling
    const notice = new Notice(message, duration);
    
    // Add custom class for styling
    notice.noticeEl.addClass('meeting-tasks-notice');
    notice.noticeEl.addClass(type);
    
    // Add icon based on type
    const icon = this.getIconForType(type);
    if (icon) {
      notice.noticeEl.createEl('span', {
        cls: 'notice-icon',
        text: icon,
      });
    }

    // Add action button if provided
    if (options.actionButton) {
      const btn = notice.noticeEl.createEl('button', {
        cls: 'notice-action-button',
        text: options.actionButton.text,
      });
      btn.addEventListener('click', () => {
        options.actionButton!.callback();
        notice.hide();
      });
    }

    // Play sound if enabled
    if (playSound && this.soundEnabled) {
      this.playNotificationSound(type);
    }

    // Track active notices
    this.activeNotices.push(notice);
    
    // Clean up when notice is hidden
    setTimeout(() => {
      const index = this.activeNotices.indexOf(notice);
      if (index > -1) {
        this.activeNotices.splice(index, 1);
      }
    }, duration);

    return notice;
  }

  /**
   * Show notification for new tasks
   */
  showNewTasks(tasks: ExtractedTask[], meeting: MeetingNote): void {
    if (!this.plugin.settings.notifications.onNewTasks) {
      return;
    }

    const taskCount = tasks.length;
    const highPriorityCount = tasks.filter(t => t.priority === 'high').length;
    
    let message = `📋 ${taskCount} new task${taskCount !== 1 ? 's' : ''} from "${meeting.title}"`;
    
    if (highPriorityCount > 0) {
      message += ` (${highPriorityCount} high priority)`;
    }

    this.show(message, 'success', {
      duration: 10000,
      playSound: true,
      actionButton: {
        text: 'View Note',
        callback: async () => {
          await this.plugin.openMeetingNote(meeting);
        },
      },
    });

    // Update ribbon icon badge
    this.plugin.ribbonIcon?.showNewTasksBadge(taskCount);
  }

  /**
   * Show notification for processing progress
   */
  showProgress(current: number, total: number, message: string): Notice {
    if (!this.plugin.settings.notifications.showProgress) {
      return new Notice('');
    }

    const percentage = Math.round((current / total) * 100);
    const progressBar = '█'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10));
    
    return this.show(
      `${message}\n${progressBar} ${percentage}%`,
      'info',
      { duration: 0 } // Persistent until replaced
    );
  }

  /**
   * Show error notification
   */
  showError(error: Error | string, context?: string): void {
    if (!this.plugin.settings.notifications.onErrors) {
      console.error('[Meeting Tasks]', context || 'Error:', error);
      return;
    }

    const message = typeof error === 'string' ? error : error.message;
    const fullMessage = context ? `${context}: ${message}` : message;

    this.show(fullMessage, 'error', {
      duration: 10000,
      playSound: true,
      actionButton: {
        text: 'Details',
        callback: () => {
          if (error instanceof Error) {
            this.plugin.showErrorModal(error, context || 'Unknown');
          }
        },
      },
    });
  }

  /**
   * Show notification when no tasks are found
   */
  showNoTasks(): void {
    if (!this.plugin.settings.notifications.onNoTasks) {
      return;
    }

    this.show('No new meeting tasks found', 'info', {
      duration: 5000,
    });
  }

  /**
   * Show connection status notification
   */
  showConnectionStatus(connected: boolean): void {
    if (connected) {
      this.show('🟢 Connected to TasksAgent service', 'success', {
        duration: 3000,
      });
    } else {
      this.show('🔴 Disconnected from TasksAgent service', 'warning', {
        duration: 5000,
        actionButton: {
          text: 'Reconnect',
          callback: () => {
            this.plugin.connectWebSocket();
          },
        },
      });
    }
  }

  /**
   * Show batch processing summary
   */
  showBatchSummary(
    meetingsProcessed: number,
    tasksExtracted: number,
    errors: number
  ): void {
    const parts = [];
    
    if (meetingsProcessed > 0) {
      parts.push(`${meetingsProcessed} meeting${meetingsProcessed !== 1 ? 's' : ''}`);
    }
    
    if (tasksExtracted > 0) {
      parts.push(`${tasksExtracted} task${tasksExtracted !== 1 ? 's' : ''}`);
    }
    
    if (errors > 0) {
      parts.push(`${errors} error${errors !== 1 ? 's' : ''}`);
    }

    if (parts.length === 0) {
      this.showNoTasks();
      return;
    }

    const message = `✅ Processing complete: ${parts.join(', ')}`;
    const type: NotificationType = errors > 0 ? 'warning' : 'success';

    this.show(message, type, {
      duration: 8000,
      playSound: tasksExtracted > 0,
      actionButton: tasksExtracted > 0 ? {
        text: 'View Results',
        callback: () => {
          this.plugin.showLastResults();
        },
      } : undefined,
    });
  }

  /**
   * Get icon for notification type
   */
  private getIconForType(type: NotificationType): string {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(type: NotificationType): void {
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Different frequencies for different notification types
      const frequencies: Record<NotificationType, number[]> = {
        success: [523, 659, 784], // C, E, G - Major chord
        error: [440, 415, 392],   // A, G#, G - Descending
        warning: [554, 554],      // C# twice
        info: [440, 554],         // A, C#
      };

      const notes = frequencies[type] || frequencies.info;
      const duration = 0.1;

      // Play notes in sequence
      notes.forEach((freq, index) => {
        setTimeout(() => {
          oscillator.frequency.setValueAtTime(freq, this.audioContext!.currentTime);
          gainNode.gain.setValueAtTime(0.1, this.audioContext!.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + duration);
        }, index * duration * 1000);
      });

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + (notes.length * duration));
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }

  /**
   * Show desktop notification (if supported)
   */
  async showDesktopNotification(
    title: string,
    body: string,
    options?: NotificationOptions
  ): Promise<void> {
    // Check if desktop notifications are supported and permitted
    if (!('Notification' in window)) {
      return;
    }

    // Request permission if needed
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return;
      }
    }

    if (Notification.permission !== 'granted') {
      return;
    }

    // Create desktop notification
    const notification = new Notification(title, {
      body,
      icon: 'app://obsidian.md/icon.png',
      badge: 'app://obsidian.md/icon.png',
      tag: 'meeting-tasks',
      requireInteraction: options?.persistent,
    });

    // Handle click
    notification.onclick = () => {
      window.focus();
      notification.close();
      
      if (options?.actionButton) {
        options.actionButton.callback();
      }
    };

    // Auto-close
    if (!options?.persistent) {
      setTimeout(() => {
        notification.close();
      }, options?.duration || 5000);
    }
  }

  /**
   * Clear all active notifications
   */
  clearAll(): void {
    this.activeNotices.forEach(notice => {
      notice.hide();
    });
    this.activeNotices = [];
  }

  /**
   * Update notification settings
   */
  updateSettings(): void {
    this.soundEnabled = this.plugin.settings.notifications.playSound;
    
    // Reinitialize audio context if needed
    if (this.soundEnabled && !this.audioContext && typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new AudioContext();
    } else if (!this.soundEnabled && this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  /**
   * Clean up notification manager
   */
  cleanup(): void {
    this.clearAll();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}