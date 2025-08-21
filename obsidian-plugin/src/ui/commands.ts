/**
 * Command Palette Commands for Meeting Tasks Plugin
 * Registers and manages all plugin commands
 */

import { App, Command, Hotkey, MarkdownView } from 'obsidian';
import { MeetingTasksPlugin } from '../main';

/**
 * Command definition interface
 */
interface PluginCommand {
  id: string;
  name: string;
  icon?: string;
  hotkeys?: Hotkey[];
  callback: () => Promise<void> | void;
  checkCallback?: (checking: boolean) => boolean | void;
}

/**
 * Manages command palette commands for the plugin
 */
export class CommandManager {
  private plugin: MeetingTasksPlugin;
  private app: App;
  private commands: Command[] = [];

  constructor(plugin: MeetingTasksPlugin) {
    this.plugin = plugin;
    this.app = plugin.app;
  }

  /**
   * Register all plugin commands
   */
  registerCommands(): void {
    const commands: PluginCommand[] = [
      {
        id: 'check-meeting-tasks',
        name: 'Check for new meeting tasks',
        icon: 'mail-check',
        hotkeys: [
          {
            modifiers: ['Mod'],
            key: 'M',
          },
        ],
        callback: async () => {
          await this.checkForTasks();
        },
      },
      {
        id: 'force-check-meeting-tasks',
        name: 'Force check for meeting tasks (ignore cache)',
        icon: 'refresh-cw',
        hotkeys: [
          {
            modifiers: ['Mod', 'Shift'],
            key: 'M',
          },
        ],
        callback: async () => {
          await this.forceCheckForTasks();
        },
      },
      {
        id: 'process-selected-email',
        name: 'Process selected email ID',
        icon: 'file-text',
        callback: async () => {
          await this.processSelectedEmail();
        },
        checkCallback: (checking: boolean) => {
          // Only available when text is selected
          const selection = this.getSelectedText();
          if (checking) {
            return selection.length > 0;
          }
          if (selection.length > 0) {
            this.processEmailById(selection);
          }
        },
      },
      {
        id: 'toggle-auto-check',
        name: 'Toggle automatic checking',
        icon: 'clock',
        callback: () => {
          this.toggleAutoCheck();
        },
      },
      {
        id: 'toggle-websocket',
        name: 'Toggle WebSocket connection',
        icon: 'wifi',
        callback: () => {
          this.toggleWebSocket();
        },
      },
      {
        id: 'show-statistics',
        name: 'Show processing statistics',
        icon: 'bar-chart-2',
        hotkeys: [
          {
            modifiers: ['Mod', 'Alt'],
            key: 'M',
          },
        ],
        callback: () => {
          this.showStatistics();
        },
      },
      {
        id: 'show-history',
        name: 'Show processing history',
        icon: 'history',
        callback: () => {
          this.showHistory();
        },
      },
      {
        id: 'clear-cache',
        name: 'Clear transcript cache',
        icon: 'trash-2',
        callback: async () => {
          await this.clearCache();
        },
      },
      {
        id: 'test-connection',
        name: 'Test service connection',
        icon: 'zap',
        callback: async () => {
          await this.testConnection();
        },
      },
      {
        id: 'open-last-meeting',
        name: 'Open last processed meeting note',
        icon: 'file',
        callback: async () => {
          await this.openLastMeeting();
        },
      },
      {
        id: 'search-meetings',
        name: 'Search meeting notes',
        icon: 'search',
        callback: () => {
          this.searchMeetings();
        },
      },
      {
        id: 'create-test-note',
        name: 'Create test meeting note',
        icon: 'file-plus',
        callback: async () => {
          await this.createTestNote();
        },
        checkCallback: (checking: boolean) => {
          // Only available in debug mode
          if (checking) {
            return this.plugin.settings.advanced.debugMode;
          }
          if (this.plugin.settings.advanced.debugMode) {
            this.createTestNote();
          }
        },
      },
    ];

    // Register each command
    commands.forEach((cmd) => {
      const command = this.plugin.addCommand({
        id: cmd.id,
        name: cmd.name,
        icon: cmd.icon,
        hotkeys: cmd.hotkeys,
        callback: cmd.callback,
        checkCallback: cmd.checkCallback,
      });
      
      this.commands.push(command);
    });
  }

  /**
   * Check for new meeting tasks
   */
  private async checkForTasks(): Promise<void> {
    try {
      this.plugin.showNotice('Checking for new meeting tasks...', 'info');
      await this.plugin.checkForMeetingTasks();
    } catch (error) {
      console.error('Failed to check for tasks:', error);
      this.plugin.showNotice('Failed to check for tasks', 'error');
    }
  }

  /**
   * Force check for meeting tasks (ignore cache)
   */
  private async forceCheckForTasks(): Promise<void> {
    try {
      this.plugin.showNotice('Force checking for meeting tasks...', 'info');
      await this.plugin.checkForMeetingTasks(true);
    } catch (error) {
      console.error('Failed to force check:', error);
      this.plugin.showNotice('Failed to force check', 'error');
    }
  }

  /**
   * Process selected email ID
   */
  private async processSelectedEmail(): Promise<void> {
    const selection = this.getSelectedText();
    if (selection) {
      await this.processEmailById(selection);
    } else {
      this.plugin.showNotice('Please select an email ID first', 'error');
    }
  }

  /**
   * Process email by ID
   */
  private async processEmailById(emailId: string): Promise<void> {
    try {
      this.plugin.showNotice(`Processing email: ${emailId}`, 'info');
      await this.plugin.processSingleEmail(emailId);
    } catch (error) {
      console.error('Failed to process email:', error);
      this.plugin.showNotice('Failed to process email', 'error');
    }
  }

  /**
   * Toggle automatic checking
   */
  private toggleAutoCheck(): void {
    this.plugin.settings.autoCheck = !this.plugin.settings.autoCheck;
    this.plugin.saveSettings();
    
    if (this.plugin.settings.autoCheck) {
      this.plugin.startScheduler();
      this.plugin.showNotice('Automatic checking enabled', 'info');
    } else {
      this.plugin.stopScheduler();
      this.plugin.showNotice('Automatic checking disabled', 'info');
    }
  }

  /**
   * Toggle WebSocket connection
   */
  private toggleWebSocket(): void {
    this.plugin.settings.enableWebSocket = !this.plugin.settings.enableWebSocket;
    this.plugin.saveSettings();
    
    if (this.plugin.settings.enableWebSocket) {
      this.plugin.connectWebSocket();
      this.plugin.showNotice('WebSocket connection enabled', 'info');
    } else {
      this.plugin.disconnectWebSocket();
      this.plugin.showNotice('WebSocket connection disabled', 'info');
    }
  }

  /**
   * Show processing statistics
   */
  private showStatistics(): void {
    const stats = [
      `Total Meetings Processed: ${this.plugin.settings.totalMeetingsProcessed}`,
      `Total Tasks Extracted: ${this.plugin.settings.totalTasksExtracted}`,
      `Last Check: ${this.plugin.settings.lastCheckTime || 'Never'}`,
      '',
      `Auto-check: ${this.plugin.settings.autoCheck ? 'Enabled' : 'Disabled'}`,
      `WebSocket: ${this.plugin.settings.enableWebSocket ? 'Enabled' : 'Disabled'}`,
      `Cache Enabled: ${this.plugin.settings.advanced.enableTranscriptCache}`,
    ];
    
    this.plugin.showNotice(stats.join('\n'), 'info');
  }

  /**
   * Show processing history
   */
  private showHistory(): void {
    const history = this.plugin.settings.processingHistory.slice(-10);
    
    if (history.length === 0) {
      this.plugin.showNotice('No processing history available', 'info');
      return;
    }
    
    // Show in results modal
    this.plugin.showResultsModal({
      meetings: [],
      tasks: [],
      errors: [],
      statistics: {
        processingHistory: history,
      },
    });
  }

  /**
   * Clear transcript cache
   */
  private async clearCache(): Promise<void> {
    try {
      await this.plugin.clearCache();
      this.plugin.showNotice('Cache cleared successfully', 'info');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      this.plugin.showNotice('Failed to clear cache', 'error');
    }
  }

  /**
   * Test service connection
   */
  private async testConnection(): Promise<void> {
    try {
      this.plugin.showNotice('Testing connection...', 'info');
      const result = await this.plugin.testConnection();
      
      if (result.success) {
        this.plugin.showNotice('Connection successful!', 'success');
      } else {
        this.plugin.showNotice(`Connection failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      this.plugin.showNotice('Connection test failed', 'error');
    }
  }

  /**
   * Open last processed meeting note
   */
  private async openLastMeeting(): Promise<void> {
    try {
      const lastMeeting = await this.plugin.getLastProcessedMeeting();
      if (lastMeeting) {
        await this.plugin.openNote(lastMeeting);
      } else {
        this.plugin.showNotice('No meetings processed yet', 'info');
      }
    } catch (error) {
      console.error('Failed to open last meeting:', error);
      this.plugin.showNotice('Failed to open last meeting', 'error');
    }
  }

  /**
   * Search meeting notes
   */
  private searchMeetings(): void {
    // Open search with meeting folder filter
    const searchQuery = `path:"${this.plugin.settings.targetFolder}"`;
    
    // @ts-ignore - Accessing Obsidian's internal API
    this.app.internalPlugins.getPluginById('global-search').instance.openGlobalSearch(searchQuery);
  }

  /**
   * Create test meeting note (debug mode only)
   */
  private async createTestNote(): Promise<void> {
    try {
      this.plugin.showNotice('Creating test meeting note...', 'info');
      
      const testMeeting = {
        id: `test-${Date.now()}`,
        title: 'Test Meeting',
        date: new Date(),
        participants: ['Test User 1', 'Test User 2'],
        tasks: [
          {
            description: 'Test task 1',
            assignee: 'Test User 1',
            priority: 'high' as const,
            confidence: 0.9,
          },
          {
            description: 'Test task 2',
            assignee: 'Test User 2',
            priority: 'medium' as const,
            confidence: 0.8,
          },
        ],
        summary: 'This is a test meeting for debugging purposes.',
        keyDecisions: ['Test decision 1', 'Test decision 2'],
        nextSteps: ['Test next step 1', 'Test next step 2'],
        transcript: 'Test transcript content',
        sourceEmail: 'test-email-id',
        processedAt: new Date(),
        confidence: 0.95,
      };
      
      await this.plugin.createMeetingNote(testMeeting);
      this.plugin.showNotice('Test meeting note created', 'success');
    } catch (error) {
      console.error('Failed to create test note:', error);
      this.plugin.showNotice('Failed to create test note', 'error');
    }
  }

  /**
   * Get selected text from the active editor
   */
  private getSelectedText(): string {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView && activeView.editor) {
      return activeView.editor.getSelection();
    }
    return '';
  }

  /**
   * Clean up commands
   */
  cleanup(): void {
    // Commands are automatically cleaned up by Obsidian
    this.commands = [];
  }
}