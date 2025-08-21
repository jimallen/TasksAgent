import { App, Plugin, Notice, addIcon } from 'obsidian';
import { 
  MeetingTasksSettings, 
  DEFAULT_SETTINGS, 
  migrateSettings,
  validateSettings,
  addHistoryEntry,
} from './settings';
import { MeetingTasksSettingTab } from './ui/settingsTab';
import { ApiClient } from './api/client';

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
    try {
      const loadedData = await this.loadData();
      // Use migration function to handle old settings formats
      this.settings = migrateSettings(loadedData || {});
      
      // Validate settings on load
      const validation = validateSettings(this.settings);
      if (!validation.valid && this.settings.advanced?.debugMode) {
        console.warn('Settings validation warnings:', validation.errors);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Fall back to defaults on error
      this.settings = { ...DEFAULT_SETTINGS };
      new Notice('Failed to load settings, using defaults');
    }
  }
  
  async saveSettings() {
    try {
      // Validate before saving
      const validation = validateSettings(this.settings);
      if (!validation.valid) {
        // Show validation errors but still save
        if (validation.errors.length > 0) {
          new Notice(`Settings saved with warnings: ${validation.errors[0]}`);
        }
      }
      
      await this.saveData(this.settings);
      
      // Update any dependent services after save
      await this.updateServices();
    } catch (error) {
      console.error('Failed to save settings:', error);
      new Notice('Failed to save settings: ' + error.message);
    }
  }
  
  /**
   * Update services after settings change
   */
  private async updateServices() {
    // This will be implemented when we add the actual services
    // For now, just log
    if (this.settings.advanced?.debugMode) {
      console.log('Settings updated, services would be refreshed here');
    }
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