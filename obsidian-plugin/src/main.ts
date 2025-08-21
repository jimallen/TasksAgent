/**
 * Meeting Tasks Plugin for Obsidian
 * Main plugin entry point and lifecycle management
 */

import { App, Plugin, PluginManifest, TFile, Notice } from 'obsidian';

// Settings
import { 
  MeetingTasksSettings, 
  DEFAULT_SETTINGS, 
  migrateSettings,
  validateSettings 
} from './settings';
import { MeetingTasksSettingTab } from './ui/settingsTab';

// API & WebSocket
import { ApiClient } from './api/client';
import { WebSocketManager } from './api/websocket';

// Services
import { NoteCreatorService } from './services/noteCreator';
import { TaskProcessorService } from './services/taskProcessor';
import { SchedulerService } from './services/scheduler';

// UI Components
import { RibbonIconHandler } from './ui/ribbonIcon';
import { StatusBarItem } from './ui/statusBar';
import { CommandManager } from './ui/commands';
import { NotificationManager } from './ui/notifications';
import { ProgressModal, ResultsModal, ErrorModal } from './ui/modals';

// Utils
import { Logger } from './utils/logger';
import { GlobalErrorHandler } from './utils/errorHandler';
import { CacheService } from './services/cache';

// Types
import { 
  MeetingNote, 
  ProcessingResult, 
  ConnectionTestResult 
} from './api/types';

/**
 * Main plugin class
 */
export class MeetingTasksPlugin extends Plugin {
  settings: MeetingTasksSettings;
  
  // API & WebSocket
  apiClient: ApiClient | null = null;
  webSocketManager: WebSocketManager | null = null;
  
  // Services
  noteCreator: NoteCreatorService | null = null;
  taskProcessor: TaskProcessorService | null = null;
  scheduler: SchedulerService | null = null;
  cacheService: CacheService | null = null;
  
  // UI Components
  ribbonIcon: RibbonIconHandler | null = null;
  statusBar: StatusBarItem | null = null;
  commandManager: CommandManager | null = null;
  notificationManager: NotificationManager | null = null;
  
  // Utils
  logger: Logger | null = null;
  errorHandler: GlobalErrorHandler | null = null;
  
  // Modals
  progressModal: ProgressModal | null = null;
  
  // State
  isLoaded: boolean = false;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
  }

  /**
   * Plugin load lifecycle
   */
  async onload() {
    console.log('Loading Meeting Tasks Plugin...');
    
    try {
      // Load and migrate settings
      await this.loadSettings();
      
      // Initialize logger first
      this.logger = new Logger(this.app, this.settings);
      this.logger.info('Plugin loading...', { version: this.manifest.version });
      
      // Initialize error handler
      this.errorHandler = new GlobalErrorHandler(this, this.logger);
      this.errorHandler.init();
      
      // Initialize API client
      this.initializeApiClient();
      
      // Initialize services
      await this.initializeServices();
      
      // Initialize UI components
      this.initializeUI();
      
      // Initialize WebSocket if enabled
      if (this.settings.enableWebSocket) {
        await this.connectWebSocket();
      }
      
      // Start scheduler if enabled
      if (this.settings.autoCheck) {
        this.scheduler?.start();
      }
      
      // Process on startup if configured
      if (this.settings.processOnStartup) {
        setTimeout(() => {
          this.checkForMeetingTasks();
        }, 5000); // Delay to allow plugin to fully initialize
      }
      
      this.isLoaded = true;
      this.logger.info('Plugin loaded successfully');
      
    } catch (error) {
      console.error('Failed to load Meeting Tasks Plugin:', error);
      new Notice('Failed to load Meeting Tasks Plugin. Check console for details.');
      this.errorHandler?.handleError(error as Error, 'Plugin load');
    }
  }

  /**
   * Plugin unload lifecycle
   */
  onunload() {
    console.log('Unloading Meeting Tasks Plugin...');
    
    if (this.logger) {
      this.logger.info('Plugin unloading...');
    }
    
    // Stop scheduler
    if (this.scheduler) {
      this.scheduler.cleanup();
      this.scheduler = null;
    }
    
    // Disconnect WebSocket
    if (this.webSocketManager) {
      this.webSocketManager.disconnect();
      this.webSocketManager = null;
    }
    
    // Clean up UI components
    if (this.ribbonIcon) {
      this.ribbonIcon.cleanup();
      this.ribbonIcon = null;
    }
    
    if (this.statusBar) {
      this.statusBar.cleanup();
      this.statusBar = null;
    }
    
    if (this.commandManager) {
      this.commandManager.cleanup();
      this.commandManager = null;
    }
    
    if (this.notificationManager) {
      this.notificationManager.cleanup();
      this.notificationManager = null;
    }
    
    // Close any open modals
    if (this.progressModal) {
      this.progressModal.close();
      this.progressModal = null;
    }
    
    // Clean up services
    if (this.taskProcessor) {
      this.taskProcessor.clearResults();
      this.taskProcessor = null;
    }
    
    if (this.noteCreator) {
      this.noteCreator = null;
    }
    
    if (this.cacheService) {
      this.cacheService.cleanup();
      this.cacheService = null;
    }
    
    // Clean up API client
    if (this.apiClient) {
      this.apiClient = null;
    }
    
    // Clean up error handler
    if (this.errorHandler) {
      this.errorHandler.cleanup();
      this.errorHandler = null;
    }
    
    // Clean up logger last
    if (this.logger) {
      this.logger.cleanup();
      this.logger = null;
    }
    
    this.isLoaded = false;
    console.log('Meeting Tasks Plugin unloaded');
  }

  /**
   * Load and migrate settings
   */
  async loadSettings() {
    const loadedData = await this.loadData();
    this.settings = migrateSettings(loadedData);
    
    // Validate settings
    const validation = validateSettings(this.settings);
    if (!validation.valid) {
      console.warn('Settings validation errors:', validation.errors);
      new Notice('Some plugin settings are invalid. Please check the settings tab.');
    }
  }

  /**
   * Save settings
   */
  async saveSettings() {
    await this.saveData(this.settings);
    
    // Update services with new settings
    if (this.noteCreator) {
      this.noteCreator.updateSettings(this.settings);
    }
    
    if (this.notificationManager) {
      this.notificationManager.updateSettings();
    }
    
    if (this.logger) {
      this.logger.setLogLevel(this.settings.advanced.logLevel);
      this.logger.enableConsoleLogging(this.settings.advanced.debugMode);
    }
  }

  /**
   * Initialize API client
   */
  private initializeApiClient() {
    this.apiClient = new ApiClient({
      baseUrl: this.settings.serviceUrl,
      apiKey: this.settings.anthropicApiKey,
      timeout: this.settings.advanced.timeout,
      retryAttempts: this.settings.advanced.retryAttempts,
      retryDelay: this.settings.advanced.webSocketReconnectDelay,
    });
  }

  /**
   * Initialize services
   */
  private async initializeServices() {
    // Note creator service
    this.noteCreator = new NoteCreatorService(this.app, this.settings);
    
    // Task processor service
    this.taskProcessor = new TaskProcessorService(
      this as any,
      this.apiClient!,
      this.noteCreator
    );
    
    // Scheduler service
    this.scheduler = new SchedulerService(this as any);
    
    // Cache service
    this.cacheService = new CacheService(
      this.app,
      this.settings.advanced.cacheExpiry,
      this.settings.advanced.enableTranscriptCache
    );
    
    // Initialize cache
    await this.cacheService.initialize();
  }

  /**
   * Initialize UI components
   */
  private initializeUI() {
    // Settings tab
    this.addSettingTab(new MeetingTasksSettingTab(this.app, this));
    
    // Ribbon icon
    this.ribbonIcon = new RibbonIconHandler(this as any);
    this.ribbonIcon.init();
    
    // Status bar
    this.statusBar = new StatusBarItem(this as any);
    this.statusBar.init();
    
    // Command manager
    this.commandManager = new CommandManager(this as any);
    this.commandManager.registerCommands();
    
    // Notification manager
    this.notificationManager = new NotificationManager(this as any);
  }

  /**
   * Connect to WebSocket
   */
  async connectWebSocket() {
    if (!this.settings.enableWebSocket) {
      return;
    }
    
    try {
      this.logger?.info('Connecting to WebSocket...');
      
      this.webSocketManager = new WebSocketManager({
        url: this.settings.webSocketUrl,
        reconnect: true,
        reconnectDelay: this.settings.advanced.webSocketReconnectDelay,
        maxReconnectAttempts: this.settings.advanced.maxReconnectAttempts,
        debug: this.settings.advanced.debugMode,
      });
      
      // Set up event handlers
      this.setupWebSocketHandlers();
      
      // Connect
      await this.webSocketManager.connect();
      
      // Subscribe to topics
      this.webSocketManager.subscribe('meetings');
      this.webSocketManager.subscribe('tasks');
      
      // Update UI
      this.statusBar?.updateStatus('connected');
      this.ribbonIcon?.updateConnectionStatus(true);
      
    } catch (error) {
      this.logger?.error('WebSocket connection failed', error);
      this.errorHandler?.handleError(error as Error, 'WebSocket connection');
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket() {
    if (this.webSocketManager) {
      this.webSocketManager.disconnect();
      this.webSocketManager = null;
      
      // Update UI
      this.statusBar?.updateStatus('disconnected');
      this.ribbonIcon?.updateConnectionStatus(false);
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers() {
    if (!this.webSocketManager) return;
    
    this.webSocketManager.on('connected', () => {
      this.logger?.info('WebSocket connected');
      this.notificationManager?.showConnectionStatus(true);
    });
    
    this.webSocketManager.on('disconnected', () => {
      this.logger?.info('WebSocket disconnected');
      this.notificationManager?.showConnectionStatus(false);
    });
    
    this.webSocketManager.on('task:new', async (task) => {
      this.logger?.info('New task received via WebSocket', task);
      // Process new task
    });
    
    this.webSocketManager.on('meeting:processed', async (meeting) => {
      this.logger?.info('Meeting processed via WebSocket', meeting);
      // Create note for meeting
      try {
        const file = await this.noteCreator?.createMeetingNote(meeting);
        if (file && meeting.tasks) {
          this.notificationManager?.showNewTasks(meeting.tasks, meeting);
        }
      } catch (error) {
        this.errorHandler?.handleError(error as Error, 'WebSocket meeting processing');
      }
    });
  }

  /**
   * Check for meeting tasks
   */
  async checkForMeetingTasks(forceRefresh: boolean = false) {
    if (!this.taskProcessor) {
      throw new Error('Task processor not initialized');
    }
    
    return this.taskProcessor.processEmails({
      forceRefresh,
      showProgress: true,
    });
  }

  /**
   * Process a single email
   */
  async processSingleEmail(emailId: string) {
    if (!this.taskProcessor) {
      throw new Error('Task processor not initialized');
    }
    
    return this.taskProcessor.processSingleEmail(emailId);
  }

  /**
   * Test connection to service
   */
  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.apiClient) {
      return {
        success: false,
        error: 'API client not initialized',
      };
    }
    
    return this.apiClient.testConnection();
  }

  /**
   * UI Helper Methods
   */

  showNotice(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
    this.notificationManager?.show(message, type);
  }

  showProgressModal() {
    this.progressModal = new ProgressModal(this as any);
    this.progressModal.open();
  }

  hideProgressModal() {
    if (this.progressModal) {
      this.progressModal.close();
      this.progressModal = null;
    }
  }

  updateProgress(current: number, total: number, message: string, details?: string) {
    this.progressModal?.updateProgress(current, total, message, details);
  }

  updateStatus(status: any) {
    this.statusBar?.updateStatus(status);
  }

  showResultsModal(results: ProcessingResult) {
    const modal = new ResultsModal(this as any, results);
    modal.open();
  }

  showErrorModal(error: Error, context: string) {
    const modal = new ErrorModal(this as any, error, context);
    modal.open();
  }

  showLastResults() {
    const results = this.taskProcessor?.getLastResults();
    if (results) {
      this.showResultsModal(results);
    } else {
      this.showNotice('No results available', 'info');
    }
  }

  async openMeetingNote(meeting: MeetingNote) {
    const note = await this.noteCreator?.findExistingNote(meeting);
    if (note) {
      await this.noteCreator?.openNote(note);
    }
  }

  async openNote(file: TFile) {
    await this.noteCreator?.openNote(file);
  }

  async getLastProcessedMeeting(): Promise<TFile | null> {
    // This would need to track last processed meeting
    return null;
  }

  async createMeetingNote(meeting: MeetingNote) {
    return this.noteCreator?.createMeetingNote(meeting);
  }

  cancelProcessing() {
    this.taskProcessor?.cancelProcessing();
  }

  startScheduler() {
    this.scheduler?.start();
  }

  stopScheduler() {
    this.scheduler?.stop();
  }

  openSettings() {
    // @ts-ignore
    this.app.setting.open();
    // @ts-ignore
    this.app.setting.openTabById(this.manifest.id);
  }

  async clearCache() {
    await this.cacheService?.clear();
  }

  /**
   * Emergency shutdown
   */
  emergencyShutdown() {
    this.logger?.fatal('Emergency shutdown initiated');
    
    try {
      // Stop all active operations
      this.scheduler?.stop();
      this.webSocketManager?.disconnect();
      this.taskProcessor?.cancelProcessing();
      
      // Close modals
      this.hideProgressModal();
      
      // Show notice
      new Notice('Meeting Tasks Plugin has been shut down due to errors', 0);
      
    } catch (error) {
      console.error('Error during emergency shutdown:', error);
    }
  }
}

// Export as default for Obsidian
export default MeetingTasksPlugin;