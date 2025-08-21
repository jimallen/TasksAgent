/**
 * Settings Tab UI for Meeting Tasks Plugin
 * Provides the user interface for plugin configuration
 */

import {
  App,
  PluginSettingTab,
  Setting,
  Notice,
  TextComponent,
  TextAreaComponent,
  ToggleComponent,
  DropdownComponent,
  ButtonComponent,
  ExtraButtonComponent,
  debounce,
} from 'obsidian';
import type MeetingTasksPlugin from '../main';
import { 
  MeetingTasksSettings, 
  validateSettings,
  DEFAULT_SETTINGS,
  addHistoryEntry,
} from '../settings';
import { ApiClient } from '../api/client';

/**
 * Settings tab for the Meeting Tasks plugin
 */
export class MeetingTasksSettingTab extends PluginSettingTab {
  plugin: MeetingTasksPlugin;
  private apiClient: ApiClient;
  private connectionStatus: HTMLElement | null = null;
  private apiKeyInput: TextComponent | null = null;
  private isApiKeyVisible: boolean = false;

  constructor(app: App, plugin: MeetingTasksPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.apiClient = new ApiClient({
      baseUrl: plugin.settings.serviceUrl,
      webSocketUrl: plugin.settings.webSocketUrl,
      timeout: plugin.settings.advanced.timeout,
      retryAttempts: plugin.settings.advanced.retryAttempts,
    });
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Main heading
    containerEl.createEl('h1', { text: 'Meeting Tasks Settings' });
    
    // Add description
    containerEl.createEl('p', { 
      text: 'Configure the Meeting Tasks plugin to automatically import meeting tasks from your email.',
      cls: 'setting-item-description'
    });

    // Create collapsible sections
    this.createServiceConnectionSection(containerEl);
    this.createGmailSection(containerEl);
    this.createAISection(containerEl);
    this.createObsidianSection(containerEl);
    this.createAutomationSection(containerEl);
    this.createNotificationSection(containerEl);
    this.createAdvancedSection(containerEl);
    this.createStatisticsSection(containerEl);
    
    // Add footer with links
    this.createFooter(containerEl);
  }

  /**
   * Create service connection settings section
   */
  private createServiceConnectionSection(containerEl: HTMLElement): void {
    const section = this.createCollapsibleSection(containerEl, 'Service Connection', true);
    
    new Setting(section)
      .setName('Service URL')
      .setDesc('URL of the TasksAgent service (e.g., http://localhost:3000)')
      .addText(text => text
        .setPlaceholder('http://localhost:3000')
        .setValue(this.plugin.settings.serviceUrl)
        .onChange(debounce(async (value) => {
          this.plugin.settings.serviceUrl = value;
          await this.plugin.saveSettings();
          this.updateApiClient();
        }, 500))
      );

    new Setting(section)
      .setName('WebSocket URL')
      .setDesc('WebSocket URL for real-time updates (e.g., ws://localhost:3000)')
      .addText(text => text
        .setPlaceholder('ws://localhost:3000')
        .setValue(this.plugin.settings.webSocketUrl)
        .onChange(debounce(async (value) => {
          this.plugin.settings.webSocketUrl = value;
          await this.plugin.saveSettings();
          this.updateApiClient();
        }, 500))
      );

    new Setting(section)
      .setName('Enable WebSocket')
      .setDesc('Enable real-time updates via WebSocket connection')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableWebSocket)
        .onChange(async (value) => {
          this.plugin.settings.enableWebSocket = value;
          await this.plugin.saveSettings();
        })
      );

    // Connection status display
    const statusSetting = new Setting(section)
      .setName('Connection Status')
      .setDesc('Current connection status to the TasksAgent service');
    
    this.connectionStatus = statusSetting.descEl.createEl('span', {
      text: '⚪ Not tested',
      cls: 'connection-status'
    });

    new Setting(section)
      .setName('Test Connection')
      .setDesc('Test the connection to the TasksAgent service')
      .addButton(button => button
        .setButtonText('Test Connection')
        .setCta()
        .onClick(async () => {
          await this.testConnection(button);
        })
      );
  }

  /**
   * Create Gmail settings section
   */
  private createGmailSection(containerEl: HTMLElement): void {
    const section = this.createCollapsibleSection(containerEl, 'Gmail Settings', false);
    
    new Setting(section)
      .setName('Email Patterns')
      .setDesc('Patterns to match in email subjects/content (one per line)')
      .addTextArea(text => text
        .setPlaceholder('Notes:\nRecording of\nTranscript for\nMeeting notes')
        .setValue(this.plugin.settings.gmailPatterns.join('\n'))
        .onChange(debounce(async (value) => {
          this.plugin.settings.gmailPatterns = value
            .split('\n')
            .map(p => p.trim())
            .filter(p => p.length > 0);
          await this.plugin.saveSettings();
        }, 500))
      );

    new Setting(section)
      .setName('Lookback Hours')
      .setDesc('How many hours to look back for emails (1-720)')
      .addText(text => text
        .setPlaceholder('120')
        .setValue(String(this.plugin.settings.lookbackHours))
        .onChange(debounce(async (value) => {
          const hours = parseInt(value);
          if (!isNaN(hours) && hours >= 1 && hours <= 720) {
            this.plugin.settings.lookbackHours = hours;
            await this.plugin.saveSettings();
          }
        }, 500))
      );

    new Setting(section)
      .setName('Max Emails')
      .setDesc('Maximum number of emails to process per check (1-100)')
      .addText(text => text
        .setPlaceholder('50')
        .setValue(String(this.plugin.settings.maxEmails))
        .onChange(debounce(async (value) => {
          const max = parseInt(value);
          if (!isNaN(max) && max >= 1 && max <= 100) {
            this.plugin.settings.maxEmails = max;
            await this.plugin.saveSettings();
          }
        }, 500))
      );

    new Setting(section)
      .setName('Email Domains')
      .setDesc('Filter emails by sender domain (optional, one per line)')
      .addTextArea(text => text
        .setPlaceholder('example.com\ncompany.org')
        .setValue(this.plugin.settings.emailDomains.join('\n'))
        .onChange(debounce(async (value) => {
          this.plugin.settings.emailDomains = value
            .split('\n')
            .map(d => d.trim())
            .filter(d => d.length > 0);
          await this.plugin.saveSettings();
        }, 500))
      );
  }

  /**
   * Create AI settings section
   */
  private createAISection(containerEl: HTMLElement): void {
    const section = this.createCollapsibleSection(containerEl, 'AI Settings', false);
    
    const apiKeySetting = new Setting(section)
      .setName('Anthropic API Key')
      .setDesc('Your personal Anthropic API key for Claude')
      .addText(text => {
        this.apiKeyInput = text;
        text
          .setPlaceholder('sk-ant-...')
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(debounce(async (value) => {
            this.plugin.settings.anthropicApiKey = value;
            await this.plugin.saveSettings();
          }, 500));
        
        // Set initial visibility
        text.inputEl.type = this.isApiKeyVisible ? 'text' : 'password';
        return text;
      })
      .addExtraButton(button => button
        .setIcon('eye')
        .setTooltip('Toggle visibility')
        .onClick(() => {
          this.isApiKeyVisible = !this.isApiKeyVisible;
          if (this.apiKeyInput) {
            this.apiKeyInput.inputEl.type = this.isApiKeyVisible ? 'text' : 'password';
          }
        })
      );

    new Setting(section)
      .setName('Claude Model')
      .setDesc('Select the Claude model to use for task extraction')
      .addDropdown(dropdown => dropdown
        .addOption('claude-3-haiku-20240307', 'Claude 3 Haiku (Fast & Economical)')
        .addOption('claude-3-sonnet-20240229', 'Claude 3 Sonnet (Balanced)')
        .addOption('claude-3-opus-20240229', 'Claude 3 Opus (Most Capable)')
        .setValue(this.plugin.settings.claudeModel)
        .onChange(async (value) => {
          this.plugin.settings.claudeModel = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(section)
      .setName('Max Tokens')
      .setDesc('Maximum tokens for Claude responses (1000-8192)')
      .addText(text => text
        .setPlaceholder('4096')
        .setValue(String(this.plugin.settings.maxTokens))
        .onChange(debounce(async (value) => {
          const tokens = parseInt(value);
          if (!isNaN(tokens) && tokens >= 1000 && tokens <= 8192) {
            this.plugin.settings.maxTokens = tokens;
            await this.plugin.saveSettings();
          }
        }, 500))
      );

    new Setting(section)
      .setName('Temperature')
      .setDesc('Response creativity (0-1, lower = more focused)')
      .addText(text => text
        .setPlaceholder('0.7')
        .setValue(String(this.plugin.settings.temperature))
        .onChange(debounce(async (value) => {
          const temp = parseFloat(value);
          if (!isNaN(temp) && temp >= 0 && temp <= 1) {
            this.plugin.settings.temperature = temp;
            await this.plugin.saveSettings();
          }
        }, 500))
      );

    new Setting(section)
      .setName('Custom Prompt')
      .setDesc('Custom prompt prefix for task extraction (optional)')
      .addTextArea(text => text
        .setPlaceholder('Extract tasks with special attention to...')
        .setValue(this.plugin.settings.customPrompt)
        .onChange(debounce(async (value) => {
          this.plugin.settings.customPrompt = value;
          await this.plugin.saveSettings();
        }, 500))
      );
  }

  /**
   * Create Obsidian integration settings section
   */
  private createObsidianSection(containerEl: HTMLElement): void {
    const section = this.createCollapsibleSection(containerEl, 'Obsidian Integration', false);
    
    new Setting(section)
      .setName('Target Folder')
      .setDesc('Folder where meeting notes will be created')
      .addText(text => text
        .setPlaceholder('Meetings')
        .setValue(this.plugin.settings.targetFolder)
        .onChange(debounce(async (value) => {
          this.plugin.settings.targetFolder = value;
          await this.plugin.saveSettings();
        }, 500))
      );

    new Setting(section)
      .setName('Note Name Pattern')
      .setDesc('Pattern for note names ({{date}}, {{title}}, {{time}})')
      .addText(text => text
        .setPlaceholder('{{date}} - {{title}}')
        .setValue(this.plugin.settings.noteNamePattern)
        .onChange(debounce(async (value) => {
          this.plugin.settings.noteNamePattern = value;
          await this.plugin.saveSettings();
        }, 500))
      );

    new Setting(section)
      .setName('Date Format')
      .setDesc('Date format for note names (moment.js format)')
      .addText(text => text
        .setPlaceholder('YYYY-MM-DD')
        .setValue(this.plugin.settings.dateFormat)
        .onChange(debounce(async (value) => {
          this.plugin.settings.dateFormat = value;
          await this.plugin.saveSettings();
        }, 500))
      );

    new Setting(section)
      .setName('Use Templater')
      .setDesc('Use Templater plugin for advanced templates')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useTemplater)
        .onChange(async (value) => {
          this.plugin.settings.useTemplater = value;
          await this.plugin.saveSettings();
          // Re-render to show/hide Templater settings
          this.display();
        })
      );

    if (this.plugin.settings.useTemplater) {
      new Setting(section)
        .setName('Templater Template')
        .setDesc('Path to Templater template file')
        .addText(text => text
          .setPlaceholder('Templates/Meeting Template.md')
          .setValue(this.plugin.settings.templaterTemplate)
          .onChange(debounce(async (value) => {
            this.plugin.settings.templaterTemplate = value;
            await this.plugin.saveSettings();
          }, 500))
        );
    }

    new Setting(section)
      .setName('Default Tags')
      .setDesc('Tags to add to meeting notes (comma-separated)')
      .addText(text => text
        .setPlaceholder('meeting, tasks')
        .setValue(this.plugin.settings.defaultTags.join(', '))
        .onChange(debounce(async (value) => {
          this.plugin.settings.defaultTags = value
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);
          await this.plugin.saveSettings();
        }, 500))
      );

    new Setting(section)
      .setName('Link to Daily Note')
      .setDesc('Automatically link meeting notes to daily notes')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.linkToDailyNote)
        .onChange(async (value) => {
          this.plugin.settings.linkToDailyNote = value;
          await this.plugin.saveSettings();
        })
      );
  }

  /**
   * Create automation settings section
   */
  private createAutomationSection(containerEl: HTMLElement): void {
    const section = this.createCollapsibleSection(containerEl, 'Automation', false);
    
    new Setting(section)
      .setName('Auto Check')
      .setDesc('Automatically check for new meeting tasks')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoCheck)
        .onChange(async (value) => {
          this.plugin.settings.autoCheck = value;
          await this.plugin.saveSettings();
          // Re-render to show/hide automation settings
          this.display();
        })
      );

    if (this.plugin.settings.autoCheck) {
      new Setting(section)
        .setName('Check Interval')
        .setDesc('How often to check in minutes (5-1440)')
        .addText(text => text
          .setPlaceholder('60')
          .setValue(String(this.plugin.settings.checkInterval))
          .onChange(debounce(async (value) => {
            const interval = parseInt(value);
            if (!isNaN(interval) && interval >= 5 && interval <= 1440) {
              this.plugin.settings.checkInterval = interval;
              await this.plugin.saveSettings();
            }
          }, 500))
        );

      new Setting(section)
        .setName('Process on Startup')
        .setDesc('Check for new tasks when Obsidian starts')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.processOnStartup)
          .onChange(async (value) => {
            this.plugin.settings.processOnStartup = value;
            await this.plugin.saveSettings();
          })
        );

      new Setting(section)
        .setName('Quiet Hours')
        .setDesc('Disable automatic checks during specified hours')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.quietHours.enabled)
          .onChange(async (value) => {
            this.plugin.settings.quietHours.enabled = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );

      if (this.plugin.settings.quietHours.enabled) {
        new Setting(section)
          .setName('Quiet Hours Range')
          .setDesc('Start and end time (24-hour format)')
          .addText(text => text
            .setPlaceholder('22:00')
            .setValue(this.plugin.settings.quietHours.start)
            .onChange(debounce(async (value) => {
              if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
                this.plugin.settings.quietHours.start = value;
                await this.plugin.saveSettings();
              }
            }, 500))
          )
          .addText(text => text
            .setPlaceholder('08:00')
            .setValue(this.plugin.settings.quietHours.end)
            .onChange(debounce(async (value) => {
              if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
                this.plugin.settings.quietHours.end = value;
                await this.plugin.saveSettings();
              }
            }, 500))
          );
      }
    }
  }

  /**
   * Create notification settings section
   */
  private createNotificationSection(containerEl: HTMLElement): void {
    const section = this.createCollapsibleSection(containerEl, 'Notifications', false);
    
    new Setting(section)
      .setName('Enable Notifications')
      .setDesc('Show notifications for plugin events')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.notifications.enabled)
        .onChange(async (value) => {
          this.plugin.settings.notifications.enabled = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.notifications.enabled) {
      new Setting(section)
        .setName('Notify on New Tasks')
        .setDesc('Show notification when new tasks are found')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.notifications.onNewTasks)
          .onChange(async (value) => {
            this.plugin.settings.notifications.onNewTasks = value;
            await this.plugin.saveSettings();
          })
        );

      new Setting(section)
        .setName('Notify on Errors')
        .setDesc('Show notification when errors occur')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.notifications.onErrors)
          .onChange(async (value) => {
            this.plugin.settings.notifications.onErrors = value;
            await this.plugin.saveSettings();
          })
        );

      new Setting(section)
        .setName('Show Progress')
        .setDesc('Display progress notifications during processing')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.notifications.showProgress)
          .onChange(async (value) => {
            this.plugin.settings.notifications.showProgress = value;
            await this.plugin.saveSettings();
          })
        );

      new Setting(section)
        .setName('Notification Duration')
        .setDesc('How long to show notifications in seconds')
        .addText(text => text
          .setPlaceholder('5')
          .setValue(String(this.plugin.settings.notifications.duration))
          .onChange(debounce(async (value) => {
            const duration = parseInt(value);
            if (!isNaN(duration) && duration >= 1 && duration <= 30) {
              this.plugin.settings.notifications.duration = duration;
              await this.plugin.saveSettings();
            }
          }, 500))
        );
    }
  }

  /**
   * Create advanced settings section
   */
  private createAdvancedSection(containerEl: HTMLElement): void {
    const section = this.createCollapsibleSection(containerEl, 'Advanced Settings', false);
    
    new Setting(section)
      .setName('Debug Mode')
      .setDesc('Enable debug logging for troubleshooting')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.advanced.debugMode)
        .onChange(async (value) => {
          this.plugin.settings.advanced.debugMode = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(section)
      .setName('Request Timeout')
      .setDesc('Timeout for API requests in seconds (10-300)')
      .addText(text => text
        .setPlaceholder('60')
        .setValue(String(this.plugin.settings.advanced.timeout / 1000))
        .onChange(debounce(async (value) => {
          const timeout = parseInt(value);
          if (!isNaN(timeout) && timeout >= 10 && timeout <= 300) {
            this.plugin.settings.advanced.timeout = timeout * 1000;
            await this.plugin.saveSettings();
            this.updateApiClient();
          }
        }, 500))
      );

    new Setting(section)
      .setName('Retry Attempts')
      .setDesc('Number of retry attempts for failed requests (0-10)')
      .addText(text => text
        .setPlaceholder('3')
        .setValue(String(this.plugin.settings.advanced.retryAttempts))
        .onChange(debounce(async (value) => {
          const attempts = parseInt(value);
          if (!isNaN(attempts) && attempts >= 0 && attempts <= 10) {
            this.plugin.settings.advanced.retryAttempts = attempts;
            await this.plugin.saveSettings();
            this.updateApiClient();
          }
        }, 500))
      );

    new Setting(section)
      .setName('Enable Transcript Cache')
      .setDesc('Cache transcripts for offline viewing')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.advanced.enableTranscriptCache)
        .onChange(async (value) => {
          this.plugin.settings.advanced.enableTranscriptCache = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(section)
      .setName('Batch Size')
      .setDesc('Number of emails to process in each batch (1-20)')
      .addText(text => text
        .setPlaceholder('5')
        .setValue(String(this.plugin.settings.advanced.batchSize))
        .onChange(debounce(async (value) => {
          const size = parseInt(value);
          if (!isNaN(size) && size >= 1 && size <= 20) {
            this.plugin.settings.advanced.batchSize = size;
            await this.plugin.saveSettings();
          }
        }, 500))
      );
  }

  /**
   * Create statistics section
   */
  private createStatisticsSection(containerEl: HTMLElement): void {
    const section = this.createCollapsibleSection(containerEl, 'Statistics & History', false);
    
    // Statistics display
    const stats = containerEl.createEl('div', { cls: 'meeting-tasks-stats' });
    
    stats.createEl('p', { 
      text: `Total Meetings Processed: ${this.plugin.settings.totalMeetingsProcessed}`
    });
    
    stats.createEl('p', { 
      text: `Total Tasks Extracted: ${this.plugin.settings.totalTasksExtracted}`
    });
    
    if (this.plugin.settings.lastCheckTime) {
      const lastCheck = new Date(this.plugin.settings.lastCheckTime);
      stats.createEl('p', { 
        text: `Last Check: ${lastCheck.toLocaleString()}`
      });
    }
    
    // Clear statistics button
    new Setting(section)
      .setName('Clear Statistics')
      .setDesc('Reset all statistics and history')
      .addButton(button => button
        .setButtonText('Clear')
        .setWarning()
        .onClick(async () => {
          if (confirm('Are you sure you want to clear all statistics and history?')) {
            this.plugin.settings.totalMeetingsProcessed = 0;
            this.plugin.settings.totalTasksExtracted = 0;
            this.plugin.settings.processingHistory = [];
            this.plugin.settings.lastCheckTime = undefined;
            await this.plugin.saveSettings();
            new Notice('Statistics cleared');
            this.display();
          }
        })
      );
  }

  /**
   * Create footer with links
   */
  private createFooter(containerEl: HTMLElement): void {
    const footer = containerEl.createEl('div', { cls: 'meeting-tasks-footer' });
    
    footer.createEl('hr');
    
    const links = footer.createEl('p', { cls: 'meeting-tasks-links' });
    
    links.createEl('a', {
      text: '📖 Documentation',
      href: 'https://github.com/yourusername/obsidian-meeting-tasks/wiki'
    });
    
    links.createEl('span', { text: ' | ' });
    
    links.createEl('a', {
      text: '🐛 Report Issue',
      href: 'https://github.com/yourusername/obsidian-meeting-tasks/issues'
    });
    
    links.createEl('span', { text: ' | ' });
    
    links.createEl('a', {
      text: '💬 Discussions',
      href: 'https://github.com/yourusername/obsidian-meeting-tasks/discussions'
    });
  }

  /**
   * Create a collapsible section
   */
  private createCollapsibleSection(
    containerEl: HTMLElement, 
    title: string, 
    expanded: boolean = false
  ): HTMLElement {
    const section = containerEl.createEl('details', { cls: 'meeting-tasks-section' });
    if (expanded) {
      section.setAttribute('open', '');
    }
    
    section.createEl('summary', { 
      text: title,
      cls: 'meeting-tasks-section-header'
    });
    
    return section.createEl('div', { cls: 'meeting-tasks-section-content' });
  }

  /**
   * Test connection to the service
   */
  private async testConnection(button: ButtonComponent): Promise<void> {
    button.setDisabled(true);
    button.setButtonText('Testing...');
    
    if (this.connectionStatus) {
      this.connectionStatus.setText('🔄 Testing connection...');
      this.connectionStatus.className = 'connection-status testing';
    }
    
    try {
      const result = await this.apiClient.testConnection();
      
      if (result.success) {
        if (this.connectionStatus) {
          this.connectionStatus.setText(`✅ Connected (${result.latency}ms)`);
          this.connectionStatus.className = 'connection-status success';
        }
        
        // Build status message
        const services = [];
        if (result.services.api) services.push('API');
        if (result.services.webSocket) services.push('WebSocket');
        if (result.services.gmail) services.push('Gmail');
        if (result.services.claude) services.push('Claude');
        
        new Notice(`Connection successful! Services: ${services.join(', ')}`);
        
        // Add to history
        addHistoryEntry(this.plugin.settings, {
          action: 'check',
          details: 'Connection test successful',
          meetingsFound: 0,
          tasksExtracted: 0,
          success: true
        });
        await this.plugin.saveSettings();
        
      } else {
        if (this.connectionStatus) {
          this.connectionStatus.setText('❌ Connection failed');
          this.connectionStatus.className = 'connection-status error';
        }
        
        new Notice(`Connection failed: ${result.error || 'Unknown error'}`);
        
        // Add to history
        addHistoryEntry(this.plugin.settings, {
          action: 'error',
          details: 'Connection test failed',
          meetingsFound: 0,
          tasksExtracted: 0,
          success: false,
          error: result.error
        });
        await this.plugin.saveSettings();
      }
      
    } catch (error) {
      if (this.connectionStatus) {
        this.connectionStatus.setText('❌ Error');
        this.connectionStatus.className = 'connection-status error';
      }
      
      new Notice(`Error testing connection: ${error.message}`);
      console.error('Connection test error:', error);
      
    } finally {
      button.setDisabled(false);
      button.setButtonText('Test Connection');
    }
  }

  /**
   * Update API client with current settings
   */
  private updateApiClient(): void {
    this.apiClient.updateConfig({
      baseUrl: this.plugin.settings.serviceUrl,
      webSocketUrl: this.plugin.settings.webSocketUrl,
      timeout: this.plugin.settings.advanced.timeout,
      retryAttempts: this.plugin.settings.advanced.retryAttempts,
    });
  }
}