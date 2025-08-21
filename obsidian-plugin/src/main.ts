import { App, Plugin, PluginSettingTab, Setting, Notice, addIcon } from 'obsidian';

// Plugin Settings Interface
interface MeetingTasksSettings {
  // Service Connection
  serviceUrl: string;
  webSocketUrl: string;
  
  // Gmail Settings (via proxy)
  gmailPatterns: string[];
  lookbackHours: number;
  maxEmails: number;
  
  // AI Settings (user-provided)
  anthropicApiKey: string;
  claudeModel: string;
  
  // Obsidian Integration
  targetFolder: string;
  noteTemplate: string;
  useTemplater: boolean;
  templaterTemplate: string;
  templateVariables: Record<string, string>;
  
  // Automation
  autoCheck: boolean;
  checkInterval: number;
  quietHours: {
    start: string;
    end: string;
  };
  
  // Notifications
  notifications: {
    enabled: boolean;
    onNewTasks: boolean;
    onErrors: boolean;
  };
  
  // Advanced
  advanced: {
    retryAttempts: number;
    timeout: number;
    cacheExpiry: number;
    enableTranscriptCache: boolean;
    webSocketReconnectDelay: number;
  };
}

// Default Settings
const DEFAULT_SETTINGS: MeetingTasksSettings = {
  serviceUrl: 'http://localhost:3000',
  webSocketUrl: 'ws://localhost:3000',
  gmailPatterns: [
    'Notes:',
    'Recording of',
    'Transcript for',
    'Meeting notes'
  ],
  lookbackHours: 120,
  maxEmails: 50,
  anthropicApiKey: '',
  claudeModel: 'claude-3-haiku-20240307',
  targetFolder: 'Meetings',
  noteTemplate: '',
  useTemplater: false,
  templaterTemplate: '',
  templateVariables: {},
  autoCheck: false,
  checkInterval: 60,
  quietHours: {
    start: '22:00',
    end: '08:00'
  },
  notifications: {
    enabled: true,
    onNewTasks: true,
    onErrors: true
  },
  advanced: {
    retryAttempts: 3,
    timeout: 60000,
    cacheExpiry: 3600000,
    enableTranscriptCache: true,
    webSocketReconnectDelay: 5000
  }
};

export default class MeetingTasksPlugin extends Plugin {
  settings: MeetingTasksSettings;
  statusBarItem: HTMLElement;
  ribbonIcon: HTMLElement;
  
  async onload() {
    console.log('Loading Meeting Tasks Plugin');
    
    // Load settings
    await this.loadSettings();
    
    // Add ribbon icon
    this.addRibbonIcon();
    
    // Add status bar item
    this.addStatusBar();
    
    // Register commands
    this.registerCommands();
    
    // Add settings tab
    this.addSettingTab(new MeetingTasksSettingTab(this.app, this));
    
    // Initialize services if enabled
    if (this.settings.autoCheck) {
      this.startAutoCheck();
    }
    
    // Setup WebSocket connection
    if (this.settings.notifications.enabled) {
      this.setupWebSocket();
    }
    
    console.log('Meeting Tasks Plugin loaded successfully');
  }
  
  onunload() {
    console.log('Unloading Meeting Tasks Plugin');
    
    // Clean up any intervals or connections
    this.cleanup();
    
    console.log('Meeting Tasks Plugin unloaded');
  }
  
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  
  async saveSettings() {
    await this.saveData(this.settings);
  }
  
  private addRibbonIcon() {
    // Add custom icon
    addIcon('meeting-tasks', `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="30" r="15" fill="currentColor"/>
        <circle cx="25" cy="70" r="12" fill="currentColor"/>
        <circle cx="75" cy="70" r="12" fill="currentColor"/>
        <path d="M50 45 L25 58 M50 45 L75 58" stroke="currentColor" stroke-width="3" fill="none"/>
      </svg>
    `);
    
    this.ribbonIcon = this.addRibbonIcon('meeting-tasks', 'Check for new meeting tasks', async (evt: MouseEvent) => {
      await this.checkForNewTasks();
    });
  }
  
  private addStatusBar() {
    this.statusBarItem = this.addStatusBarItem();
    this.updateStatusBar('Never checked');
  }
  
  private updateStatusBar(text: string) {
    if (this.statusBarItem) {
      this.statusBarItem.setText(`📅 ${text}`);
    }
  }
  
  private registerCommands() {
    // Check for new meeting tasks
    this.addCommand({
      id: 'check-new-tasks',
      name: 'Check for new meeting tasks',
      callback: async () => {
        await this.checkForNewTasks();
      }
    });
    
    // Open plugin settings
    this.addCommand({
      id: 'open-settings',
      name: 'Open Meeting Tasks settings',
      callback: () => {
        // @ts-ignore - accessing private API
        this.app.setting.open();
        // @ts-ignore
        this.app.setting.openTabById(this.manifest.id);
      }
    });
    
    // View processing history
    this.addCommand({
      id: 'view-history',
      name: 'View processing history',
      callback: () => {
        this.viewProcessingHistory();
      }
    });
    
    // Force reprocess last meeting
    this.addCommand({
      id: 'reprocess-last',
      name: 'Force reprocess last meeting',
      callback: async () => {
        await this.reprocessLastMeeting();
      }
    });
  }
  
  private async checkForNewTasks() {
    new Notice('🔍 Checking for new meeting tasks...');
    
    try {
      // TODO: Implement actual API call to TasksAgent service
      // This will be implemented in task 2.0
      
      // For now, just simulate the check
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const timestamp = new Date().toLocaleTimeString();
      this.updateStatusBar(`Last: ${timestamp}`);
      new Notice('✅ Check complete! No new tasks found.');
      
    } catch (error) {
      console.error('Error checking for tasks:', error);
      new Notice('❌ Error checking for tasks. Check console for details.');
    }
  }
  
  private startAutoCheck() {
    // TODO: Implement auto-check scheduler
    // This will be implemented in task 6.11
    console.log('Auto-check will be implemented in a future task');
  }
  
  private setupWebSocket() {
    // TODO: Implement WebSocket connection
    // This will be implemented in task 6.0
    console.log('WebSocket connection will be implemented in a future task');
  }
  
  private viewProcessingHistory() {
    // TODO: Implement history view
    new Notice('Processing history view coming soon!');
  }
  
  private async reprocessLastMeeting() {
    // TODO: Implement reprocessing
    new Notice('Reprocessing feature coming soon!');
  }
  
  private cleanup() {
    // TODO: Clean up any intervals, WebSocket connections, etc.
    console.log('Cleanup completed');
  }
}

// Settings Tab Implementation
class MeetingTasksSettingTab extends PluginSettingTab {
  plugin: MeetingTasksPlugin;
  
  constructor(app: App, plugin: MeetingTasksPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  
  display(): void {
    const { containerEl } = this;
    
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Meeting Tasks Settings' });
    
    // Service Connection Section
    containerEl.createEl('h3', { text: 'Service Connection' });
    
    new Setting(containerEl)
      .setName('Service URL')
      .setDesc('URL of the TasksAgent service')
      .addText(text => text
        .setPlaceholder('http://localhost:3000')
        .setValue(this.plugin.settings.serviceUrl)
        .onChange(async (value) => {
          this.plugin.settings.serviceUrl = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('WebSocket URL')
      .setDesc('WebSocket URL for real-time updates')
      .addText(text => text
        .setPlaceholder('ws://localhost:3000')
        .setValue(this.plugin.settings.webSocketUrl)
        .onChange(async (value) => {
          this.plugin.settings.webSocketUrl = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Test Connection')
      .setDesc('Test the connection to the TasksAgent service')
      .addButton(button => button
        .setButtonText('Test')
        .onClick(async () => {
          new Notice('🔍 Testing connection...');
          // TODO: Implement connection test in task 2.8
          await new Promise(resolve => setTimeout(resolve, 1000));
          new Notice('✅ Connection test will be implemented in task 2.8');
        }));
    
    // AI Settings Section
    containerEl.createEl('h3', { text: 'AI Settings' });
    
    new Setting(containerEl)
      .setName('Anthropic API Key')
      .setDesc('Your personal Anthropic API key for Claude')
      .addText(text => text
        .setPlaceholder('sk-ant-...')
        .setValue(this.plugin.settings.anthropicApiKey)
        .onChange(async (value) => {
          this.plugin.settings.anthropicApiKey = value;
          await this.plugin.saveSettings();
        }))
      .addExtraButton(button => button
        .setIcon('eye')
        .setTooltip('Toggle visibility')
        .onClick(() => {
          // TODO: Implement password toggle
        }));
    
    // Obsidian Integration Section
    containerEl.createEl('h3', { text: 'Obsidian Integration' });
    
    new Setting(containerEl)
      .setName('Target Folder')
      .setDesc('Folder where meeting notes will be created')
      .addText(text => text
        .setPlaceholder('Meetings')
        .setValue(this.plugin.settings.targetFolder)
        .onChange(async (value) => {
          this.plugin.settings.targetFolder = value;
          await this.plugin.saveSettings();
        }));
    
    // Add more settings sections as needed...
    // The full settings implementation will be completed in task 3.0
  }
}