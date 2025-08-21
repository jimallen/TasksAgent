/**
 * Unit tests for Settings Management
 */

import {
  MeetingTasksSettings,
  DEFAULT_SETTINGS,
  validateSettings,
  migrateSettings,
  addHistoryEntry,
  ProcessingHistoryEntry,
} from './settings';

describe('Settings Management', () => {
  describe('DEFAULT_SETTINGS', () => {
    it('should have valid default settings', () => {
      const validation = validateSettings(DEFAULT_SETTINGS);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should have all required fields', () => {
      expect(DEFAULT_SETTINGS.serviceUrl).toBeDefined();
      expect(DEFAULT_SETTINGS.webSocketUrl).toBeDefined();
      expect(DEFAULT_SETTINGS.gmailPatterns).toBeInstanceOf(Array);
      expect(DEFAULT_SETTINGS.lookbackHours).toBeGreaterThan(0);
      expect(DEFAULT_SETTINGS.maxEmails).toBeGreaterThan(0);
      expect(DEFAULT_SETTINGS.targetFolder).toBeDefined();
    });
  });

  describe('validateSettings', () => {
    let settings: MeetingTasksSettings;

    beforeEach(() => {
      settings = { ...DEFAULT_SETTINGS };
    });

    describe('URL validation', () => {
      it('should accept valid service URLs', () => {
        settings.serviceUrl = 'http://localhost:3000';
        expect(validateSettings(settings).valid).toBe(true);
        
        settings.serviceUrl = 'https://api.example.com';
        expect(validateSettings(settings).valid).toBe(true);
      });

      it('should reject invalid service URLs', () => {
        settings.serviceUrl = 'not-a-url';
        const validation = validateSettings(settings);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Invalid service URL');
      });

      it('should accept valid WebSocket URLs', () => {
        settings.webSocketUrl = 'ws://localhost:3000';
        expect(validateSettings(settings).valid).toBe(true);
        
        settings.webSocketUrl = 'wss://api.example.com';
        expect(validateSettings(settings).valid).toBe(true);
      });

      it('should reject invalid WebSocket URLs', () => {
        settings.webSocketUrl = 'http://not-websocket';
        const validation = validateSettings(settings);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Invalid WebSocket URL');
      });
    });

    describe('Required fields validation', () => {
      it('should require API key for auto-check', () => {
        settings.anthropicApiKey = '';
        settings.autoCheck = true;
        const validation = validateSettings(settings);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Anthropic API key is required for automatic checking');
      });

      it('should not require API key when auto-check is disabled', () => {
        settings.anthropicApiKey = '';
        settings.autoCheck = false;
        const validation = validateSettings(settings);
        expect(validation.valid).toBe(true);
      });

      it('should require target folder', () => {
        settings.targetFolder = '';
        const validation = validateSettings(settings);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Target folder is required');
      });
    });

    describe('Numeric range validation', () => {
      it('should validate lookback hours range', () => {
        settings.lookbackHours = 0;
        let validation = validateSettings(settings);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Lookback hours must be between 1 and 720 (30 days)');

        settings.lookbackHours = 721;
        validation = validateSettings(settings);
        expect(validation.valid).toBe(false);

        settings.lookbackHours = 120;
        validation = validateSettings(settings);
        expect(validation.valid).toBe(true);
      });

      it('should validate max emails range', () => {
        settings.maxEmails = 0;
        let validation = validateSettings(settings);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Max emails must be between 1 and 100');

        settings.maxEmails = 101;
        validation = validateSettings(settings);
        expect(validation.valid).toBe(false);

        settings.maxEmails = 50;
        validation = validateSettings(settings);
        expect(validation.valid).toBe(true);
      });

      it('should validate check interval range', () => {
        settings.checkInterval = 4;
        let validation = validateSettings(settings);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Check interval must be between 5 and 1440 minutes (24 hours)');

        settings.checkInterval = 1441;
        validation = validateSettings(settings);
        expect(validation.valid).toBe(false);

        settings.checkInterval = 60;
        validation = validateSettings(settings);
        expect(validation.valid).toBe(true);
      });

      it('should validate temperature range', () => {
        settings.temperature = -0.1;
        let validation = validateSettings(settings);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Temperature must be between 0 and 1');

        settings.temperature = 1.1;
        validation = validateSettings(settings);
        expect(validation.valid).toBe(false);

        settings.temperature = 0.7;
        validation = validateSettings(settings);
        expect(validation.valid).toBe(true);
      });
    });

    describe('Time format validation', () => {
      it('should validate quiet hours time format', () => {
        settings.quietHours.enabled = true;
        
        settings.quietHours.start = '25:00';
        let validation = validateSettings(settings);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Invalid quiet hours start time format (use HH:mm)');

        settings.quietHours.start = '22:00';
        settings.quietHours.end = '8:00 AM';
        validation = validateSettings(settings);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Invalid quiet hours end time format (use HH:mm)');

        settings.quietHours.end = '08:00';
        validation = validateSettings(settings);
        expect(validation.valid).toBe(true);
      });

      it('should not validate quiet hours when disabled', () => {
        settings.quietHours.enabled = false;
        settings.quietHours.start = 'invalid';
        settings.quietHours.end = 'invalid';
        const validation = validateSettings(settings);
        expect(validation.valid).toBe(true);
      });
    });

    describe('Templater validation', () => {
      it('should require template path when using Templater', () => {
        settings.useTemplater = true;
        settings.templaterTemplate = '';
        const validation = validateSettings(settings);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Templater template path is required when using Templater');
      });

      it('should not require template path when not using Templater', () => {
        settings.useTemplater = false;
        settings.templaterTemplate = '';
        const validation = validateSettings(settings);
        expect(validation.valid).toBe(true);
      });
    });
  });

  describe('migrateSettings', () => {
    it('should return default settings for null input', () => {
      const migrated = migrateSettings(null);
      expect(migrated).toEqual(DEFAULT_SETTINGS);
    });

    it('should return default settings for undefined input', () => {
      const migrated = migrateSettings(undefined);
      expect(migrated).toEqual(DEFAULT_SETTINGS);
    });

    it('should preserve existing valid settings', () => {
      const oldSettings = {
        serviceUrl: 'http://custom:4000',
        anthropicApiKey: 'test-key',
        lookbackHours: 48,
        gmailPatterns: ['Custom pattern'],
      };
      
      const migrated = migrateSettings(oldSettings);
      expect(migrated.serviceUrl).toBe('http://custom:4000');
      expect(migrated.anthropicApiKey).toBe('test-key');
      expect(migrated.lookbackHours).toBe(48);
      expect(migrated.gmailPatterns).toEqual(['Custom pattern']);
    });

    it('should merge nested objects correctly', () => {
      const oldSettings = {
        notifications: {
          enabled: false,
          onNewTasks: false,
        },
        advanced: {
          debugMode: true,
          timeout: 30000,
        },
      };
      
      const migrated = migrateSettings(oldSettings);
      expect(migrated.notifications.enabled).toBe(false);
      expect(migrated.notifications.onNewTasks).toBe(false);
      expect(migrated.notifications.onErrors).toBe(DEFAULT_SETTINGS.notifications.onErrors);
      expect(migrated.advanced.debugMode).toBe(true);
      expect(migrated.advanced.timeout).toBe(30000);
    });

    it('should handle array fields correctly', () => {
      const oldSettings = {
        defaultTags: ['custom', 'tags'],
        activeDays: [0, 6], // Weekend only
        processingHistory: [
          { timestamp: '2024-01-01', action: 'check' },
          { timestamp: '2024-01-02', action: 'process' },
        ],
      };
      
      const migrated = migrateSettings(oldSettings);
      expect(migrated.defaultTags).toEqual(['custom', 'tags']);
      expect(migrated.activeDays).toEqual([0, 6]);
      expect(migrated.processingHistory).toHaveLength(2);
    });

    it('should limit processing history to maxHistoryEntries', () => {
      const history = Array.from({ length: 200 }, (_, i) => ({
        timestamp: `2024-01-${i + 1}`,
        action: 'check' as const,
        details: 'test',
        meetingsFound: 0,
        tasksExtracted: 0,
        success: true,
      }));
      
      const oldSettings = {
        processingHistory: history,
        maxHistoryEntries: 100,
      };
      
      const migrated = migrateSettings(oldSettings);
      expect(migrated.processingHistory).toHaveLength(100);
      expect(migrated.processingHistory[0]).toEqual(history[100]); // Should keep last 100
    });
  });

  describe('addHistoryEntry', () => {
    let settings: MeetingTasksSettings;

    beforeEach(() => {
      settings = { ...DEFAULT_SETTINGS };
      settings.processingHistory = [];
      settings.totalMeetingsProcessed = 0;
      settings.totalTasksExtracted = 0;
    });

    it('should add new history entry with timestamp', () => {
      const entry = {
        action: 'check' as const,
        details: 'Test check',
        meetingsFound: 0,
        tasksExtracted: 0,
        success: true,
      };
      
      addHistoryEntry(settings, entry);
      
      expect(settings.processingHistory).toHaveLength(1);
      expect(settings.processingHistory[0].timestamp).toBeDefined();
      expect(settings.processingHistory[0].action).toBe('check');
      expect(settings.processingHistory[0].details).toBe('Test check');
    });

    it('should update statistics for successful processing', () => {
      const entry = {
        action: 'process' as const,
        details: 'Processed meetings',
        meetingsFound: 5,
        tasksExtracted: 15,
        success: true,
      };
      
      addHistoryEntry(settings, entry);
      
      expect(settings.totalMeetingsProcessed).toBe(5);
      expect(settings.totalTasksExtracted).toBe(15);
    });

    it('should not update statistics for failed processing', () => {
      const entry = {
        action: 'process' as const,
        details: 'Failed processing',
        meetingsFound: 5,
        tasksExtracted: 15,
        success: false,
        error: 'Test error',
      };
      
      addHistoryEntry(settings, entry);
      
      expect(settings.totalMeetingsProcessed).toBe(0);
      expect(settings.totalTasksExtracted).toBe(0);
    });

    it('should update lastCheckTime for check actions', () => {
      const entry = {
        action: 'check' as const,
        details: 'Check completed',
        meetingsFound: 0,
        tasksExtracted: 0,
        success: true,
      };
      
      addHistoryEntry(settings, entry);
      
      expect(settings.lastCheckTime).toBeDefined();
      expect(new Date(settings.lastCheckTime!).getTime()).toBeCloseTo(Date.now(), -2);
    });

    it('should trim history to maxHistoryEntries', () => {
      settings.maxHistoryEntries = 5;
      
      // Add 10 entries
      for (let i = 0; i < 10; i++) {
        addHistoryEntry(settings, {
          action: 'check',
          details: `Entry ${i}`,
          meetingsFound: 0,
          tasksExtracted: 0,
          success: true,
        });
      }
      
      expect(settings.processingHistory).toHaveLength(5);
      expect(settings.processingHistory[0].details).toBe('Entry 5');
      expect(settings.processingHistory[4].details).toBe('Entry 9');
    });

    it('should handle error entries', () => {
      const entry = {
        action: 'error' as const,
        details: 'Connection failed',
        meetingsFound: 0,
        tasksExtracted: 0,
        success: false,
        error: 'Network timeout',
      };
      
      addHistoryEntry(settings, entry);
      
      expect(settings.processingHistory[0].error).toBe('Network timeout');
      expect(settings.processingHistory[0].success).toBe(false);
    });
  });
});