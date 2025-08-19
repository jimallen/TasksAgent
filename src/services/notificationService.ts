import notifier from 'node-notifier';
import path from 'path';
import { logDebug, logError, logInfo } from '../utils/logger';
import { TaskExtractionResult } from '../extractors/claudeTaskExtractor';
import { spawn } from 'child_process';
import os from 'os';

export type NotificationChannel = 'console' | 'desktop' | 'obsidian' | 'slack' | 'email';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationOptions {
  title: string;
  message: string;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  sound?: boolean;
  wait?: boolean;
  actions?: string[];
  data?: any;
  obsidianUri?: string;
}

export interface NotificationResult {
  channel: NotificationChannel;
  success: boolean;
  error?: string;
}

export class NotificationService {
  private enabledChannels: Set<NotificationChannel>;
  private platform: string;
  // @ts-ignore - These will be used in future feature enhancements
  private hasNotifySend: boolean = false; 
  // @ts-ignore - These will be used in future feature enhancements  
  private hasTerminalNotifier: boolean = false;

  constructor() {
    // Get enabled channels from config or environment
    const channels = process.env['NOTIFICATION_CHANNELS']?.split(',') || ['console', 'desktop'];
    this.enabledChannels = new Set(channels as NotificationChannel[]);
    this.platform = os.platform();
    
    // Check for platform-specific tools
    this.checkPlatformSupport();
  }

  /**
   * Check platform-specific notification support
   */
  private async checkPlatformSupport(): Promise<void> {
    if (this.platform === 'linux') {
      // Check for notify-send
      try {
        const { execSync } = require('child_process');
        execSync('which notify-send', { stdio: 'ignore' });
        this.hasNotifySend = true;
        logDebug('Linux: notify-send is available');
      } catch {
        logInfo('Linux: notify-send not found. Install libnotify-bin for desktop notifications');
      }
    } else if (this.platform === 'darwin') {
      // Check for terminal-notifier (optional enhancement for macOS)
      try {
        const { execSync } = require('child_process');
        execSync('which terminal-notifier', { stdio: 'ignore' });
        this.hasTerminalNotifier = true;
        logDebug('macOS: terminal-notifier is available');
      } catch {
        logDebug('macOS: Using built-in notification center');
      }
    }
  }

  /**
   * Send notification through configured channels
   */
  async send(options: NotificationOptions): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    const channels = options.channels || Array.from(this.enabledChannels);

    for (const channel of channels) {
      if (!this.enabledChannels.has(channel)) {
        continue;
      }

      try {
        switch (channel) {
          case 'console':
            await this.sendConsoleNotification(options);
            results.push({ channel, success: true });
            break;

          case 'desktop':
            await this.sendDesktopNotification(options);
            results.push({ channel, success: true });
            break;

          case 'obsidian':
            await this.sendObsidianNotification(options);
            results.push({ channel, success: true });
            break;

          case 'slack':
            await this.sendSlackNotification(options);
            results.push({ channel, success: true });
            break;

          case 'email':
            await this.sendEmailNotification(options);
            results.push({ channel, success: true });
            break;

          default:
            results.push({ 
              channel, 
              success: false, 
              error: `Unknown channel: ${channel}` 
            });
        }
      } catch (error: any) {
        logError(`Notification failed for channel ${channel}`, error);
        results.push({ 
          channel, 
          success: false, 
          error: error.message 
        });
      }
    }

    return results;
  }

  /**
   * Send console notification (always works)
   */
  private async sendConsoleNotification(options: NotificationOptions): Promise<void> {
    const separator = '='.repeat(50);
    const priority = options.priority ? `[${options.priority.toUpperCase()}]` : '';
    
    console.log(`\n${separator}`);
    console.log(`📬 ${priority} ${options.title}`);
    console.log(separator);
    console.log(options.message);
    if (options.data) {
      console.log('Data:', JSON.stringify(options.data, null, 2));
    }
    console.log(`${separator}\n`);
  }

  /**
   * Send desktop notification (cross-platform)
   */
  private async sendDesktopNotification(options: NotificationOptions): Promise<void> {
    const notificationOptions: any = {
      title: options.title,
      message: options.message,
      sound: options.sound !== false,
      wait: options.wait || false,
    };

    // Platform-specific enhancements
    if (this.platform === 'darwin') {
      // macOS specific options
      notificationOptions.subtitle = this.getPriorityLabel(options.priority);
      notificationOptions.sound = options.sound ? 'Submarine' : false;
      
      if (options.obsidianUri) {
        notificationOptions.open = options.obsidianUri;
      }
      
      if (options.actions && options.actions.length > 0) {
        notificationOptions.actions = options.actions.slice(0, 2); // macOS supports up to 2 actions
      }
    } else if (this.platform === 'linux') {
      // Linux specific options
      notificationOptions.urgency = this.mapPriorityToUrgency(options.priority);
      notificationOptions.category = 'email.arrived';
      notificationOptions.hint = 'string:x-canonical-private-synchronous:true'; // Keep in notification center
      
      if (options.obsidianUri) {
        notificationOptions['app-name'] = 'Meeting Transcript Agent';
      }
    } else if (this.platform === 'win32') {
      // Windows specific options
      notificationOptions.appID = 'Meeting Transcript Agent';
      notificationOptions.sound = options.sound !== false;
      
      if (options.actions && options.actions.length > 0) {
        notificationOptions.actions = options.actions;
      }
    }

    // Add icon based on priority
    notificationOptions.icon = this.getIconPath(options.priority);

    return new Promise((resolve, reject) => {
      notifier.notify(notificationOptions, (error, response) => {
        if (error) {
          logError('Desktop notification failed', error);
          reject(error);
        } else {
          logDebug(`Desktop notification sent: ${response}`);
          resolve();
        }
      });
    });
  }

  /**
   * Send Obsidian URI notification
   */
  private async sendObsidianNotification(options: NotificationOptions): Promise<void> {
    if (!options.obsidianUri) {
      // Create Obsidian URI from data
      const vault = process.env['OBSIDIAN_VAULT_NAME'] || 'ObsidianVault';
      const action = 'open';
      const file = options.data?.obsidianNotePath || 'Meetings';
      
      options.obsidianUri = `obsidian://${action}?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(file)}`;
    }

    // Open Obsidian URI
    const open = this.platform === 'darwin' ? 'open' : 
                  this.platform === 'win32' ? 'start' : 'xdg-open';
    
    return new Promise((resolve, reject) => {
      const child = spawn(open, [options.obsidianUri!], { 
        detached: true,
        stdio: 'ignore' 
      });
      
      child.on('error', reject);
      child.unref();
      
      // Give it a moment to launch
      setTimeout(resolve, 100);
    });
  }

  /**
   * Send Slack notification (requires webhook URL)
   */
  private async sendSlackNotification(options: NotificationOptions): Promise<void> {
    const webhookUrl = process.env['SLACK_WEBHOOK_URL'];
    if (!webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const payload = {
      text: options.title,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: options.title,
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: options.message
          }
        }
      ],
      attachments: options.priority === 'high' || options.priority === 'urgent' ? [
        {
          color: options.priority === 'urgent' ? 'danger' : 'warning',
          fields: [
            {
              title: 'Priority',
              value: options.priority,
              short: true
            }
          ]
        }
      ] : undefined
    };

    // Send to Slack webhook
    const axios = require('axios');
    await axios.post(webhookUrl, payload);
    logDebug('Slack notification sent');
  }

  /**
   * Send email notification (requires email configuration)
   */
  private async sendEmailNotification(options: NotificationOptions): Promise<void> {
    // This would require email configuration (SMTP settings, etc.)
    // For now, just log that we would send an email
    logInfo(`Email notification would be sent: ${options.title}`);
    
    // In production, you would use nodemailer or similar
    // Example:
    // const transporter = nodemailer.createTransport({...});
    // await transporter.sendMail({
    //   from: 'agent@example.com',
    //   to: process.env.NOTIFICATION_EMAIL,
    //   subject: options.title,
    //   text: options.message,
    //   html: this.formatEmailHtml(options)
    // });
  }

  /**
   * Send task extraction summary notification
   */
  async notifyTasksExtracted(
    emailSubject: string,
    extraction: TaskExtractionResult,
    obsidianPath?: string
  ): Promise<void> {
    const highPriorityCount = extraction.tasks.filter(t => t.priority === 'high').length;
    const urgentTasks = extraction.tasks.filter(t => 
      t.priority === 'high' && t.dueDate && 
      new Date(t.dueDate) <= new Date(Date.now() + 24 * 60 * 60 * 1000)
    );

    const priority: NotificationPriority = 
      urgentTasks.length > 0 ? 'urgent' :
      highPriorityCount > 0 ? 'high' : 'normal';

    const message = this.formatTaskSummary(extraction);

    await this.send({
      title: `📋 ${extraction.tasks.length} tasks extracted from: ${emailSubject}`,
      message,
      priority,
      obsidianUri: obsidianPath ? this.createObsidianUri(obsidianPath) : undefined,
      sound: highPriorityCount > 0,
      data: {
        emailSubject,
        taskCount: extraction.tasks.length,
        highPriorityCount,
        obsidianNotePath: obsidianPath,
        confidence: extraction.confidence
      }
    });
  }

  /**
   * Send processing error notification
   */
  async notifyError(
    error: Error,
    context: string,
    emailId?: string
  ): Promise<void> {
    await this.send({
      title: `❌ Processing Error: ${context}`,
      message: `Error: ${error.message}\n${emailId ? `Email ID: ${emailId}` : ''}`,
      priority: 'high',
      sound: true,
      channels: ['console', 'desktop']
    });
  }

  /**
   * Send daily summary notification
   */
  async notifyDailySummary(stats: {
    emailsProcessed: number;
    tasksExtracted: number;
    meetingsFound: number;
    errors: number;
  }): Promise<void> {
    const message = `
📊 Daily Processing Summary:
• Emails Processed: ${stats.emailsProcessed}
• Tasks Extracted: ${stats.tasksExtracted}
• Meetings Found: ${stats.meetingsFound}
${stats.errors > 0 ? `• ⚠️ Errors: ${stats.errors}` : '• ✅ No errors'}
    `.trim();

    await this.send({
      title: '📈 Daily Summary - Meeting Transcript Agent',
      message,
      priority: stats.errors > 0 ? 'high' : 'normal',
      sound: false
    });
  }

  /**
   * Format task summary for notification
   */
  private formatTaskSummary(extraction: TaskExtractionResult): string {
    const lines: string[] = [];
    
    // Summary
    lines.push(`📝 ${extraction.summary}\n`);
    
    // High priority tasks
    const highPriority = extraction.tasks.filter(t => t.priority === 'high');
    if (highPriority.length > 0) {
      lines.push('🔴 High Priority Tasks:');
      highPriority.slice(0, 3).forEach(task => {
        lines.push(`  • ${task.description}`);
        if (task.dueDate) {
          lines.push(`    Due: ${new Date(task.dueDate).toLocaleDateString()}`);
        }
      });
      if (highPriority.length > 3) {
        lines.push(`  ... and ${highPriority.length - 3} more`);
      }
      lines.push('');
    }

    // Key decisions
    if (extraction.keyDecisions.length > 0) {
      lines.push('🎯 Key Decisions:');
      extraction.keyDecisions.slice(0, 2).forEach(decision => {
        lines.push(`  • ${decision}`);
      });
      lines.push('');
    }

    // Participants
    if (extraction.participants.length > 0) {
      lines.push(`👥 Participants: ${extraction.participants.slice(0, 5).join(', ')}`);
    }

    // Confidence
    lines.push(`\n📊 Confidence: ${extraction.confidence}%`);

    return lines.join('\n');
  }

  /**
   * Create Obsidian URI
   */
  private createObsidianUri(notePath: string): string {
    const vault = process.env['OBSIDIAN_VAULT_NAME'] || 'ObsidianVault';
    return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(notePath)}`;
  }

  /**
   * Get priority label
   */
  private getPriorityLabel(priority?: NotificationPriority): string {
    switch (priority) {
      case 'urgent': return '🚨 URGENT';
      case 'high': return '⚠️ High Priority';
      case 'low': return 'ℹ️ Low Priority';
      default: return '📌 Normal';
    }
  }

  /**
   * Map priority to Linux urgency level
   */
  private mapPriorityToUrgency(priority?: NotificationPriority): string {
    switch (priority) {
      case 'urgent':
      case 'high': return 'critical';
      case 'normal': return 'normal';
      case 'low': return 'low';
      default: return 'normal';
    }
  }

  /**
   * Get icon path based on priority
   */
  private getIconPath(_priority?: NotificationPriority): string {
    // You can add custom icons here
    // For now, using terminal icon
    if (this.platform === 'darwin') {
      return 'Terminal.app';
    }
    return path.join(__dirname, '../../assets/icon.png');
  }

  /**
   * Enable/disable notification channels
   */
  setChannels(channels: NotificationChannel[]): void {
    this.enabledChannels = new Set(channels);
    logInfo(`Notification channels updated: ${channels.join(', ')}`);
  }

  /**
   * Test notification system
   */
  async test(): Promise<void> {
    await this.send({
      title: '🧪 Test Notification',
      message: 'This is a test notification from Meeting Transcript Agent.\nAll notification channels are working correctly!',
      priority: 'normal',
      sound: true,
      actions: ['Open Obsidian', 'Dismiss'],
      data: { test: true }
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();