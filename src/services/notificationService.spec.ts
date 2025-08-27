import { NotificationService, NotificationOptions } from './notificationService';
import { TaskExtractionResult } from '../extractors/claudeTaskExtractor';
import notifier from 'node-notifier';

// Mock dependencies
jest.mock('node-notifier');
jest.mock('../utils/logger');
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    on: jest.fn(),
    unref: jest.fn()
  }))
}));

// Mock console.log to test console notifications
const originalConsoleLog = console.log;
const mockConsoleLog = jest.fn();

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = mockConsoleLog;
    process.env['NOTIFICATION_CHANNELS'] = 'console,desktop';
    service = new NotificationService();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    delete process.env['NOTIFICATION_CHANNELS'];
    delete process.env['SLACK_WEBHOOK_URL'];
    delete process.env['OBSIDIAN_VAULT_NAME'];
  });

  describe('send', () => {
    it('should send notification to console channel', async () => {
      const options: NotificationOptions = {
        title: 'Test Title',
        message: 'Test Message',
        channels: ['console']
      };

      const results = await service.send(options);

      expect(results).toHaveLength(1);
      expect(results[0].channel).toBe('console');
      expect(results[0].success).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Test Title'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Test Message'));
    });

    it('should send notification to desktop channel', async () => {
      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(null, 'response');
      });

      const options: NotificationOptions = {
        title: 'Desktop Test',
        message: 'Desktop Message',
        channels: ['desktop'],
        sound: true
      };

      const results = await service.send(options);

      expect(results).toHaveLength(1);
      expect(results[0].channel).toBe('desktop');
      expect(results[0].success).toBe(true);
      expect(notifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Desktop Test',
          message: 'Desktop Message',
          sound: true
        }),
        expect.any(Function)
      );
    });

    it('should handle desktop notification errors', async () => {
      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(new Error('Notification failed'), null);
      });

      const options: NotificationOptions = {
        title: 'Error Test',
        message: 'Error Message',
        channels: ['desktop']
      };

      const results = await service.send(options);

      expect(results).toHaveLength(1);
      expect(results[0].channel).toBe('desktop');
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Notification failed');
    });

    it('should send to multiple channels', async () => {
      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(null, 'response');
      });

      const options: NotificationOptions = {
        title: 'Multi Channel',
        message: 'Multi Message',
        channels: ['console', 'desktop']
      };

      const results = await service.send(options);

      expect(results).toHaveLength(2);
      expect(results.map(r => r.channel)).toContain('console');
      expect(results.map(r => r.channel)).toContain('desktop');
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should respect priority levels', async () => {
      const options: NotificationOptions = {
        title: 'Urgent Task',
        message: 'Urgent Message',
        priority: 'urgent',
        channels: ['console']
      };

      await service.send(options);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('[URGENT]'));
    });
  });

  describe('notifyTasksExtracted', () => {
    const mockExtraction: TaskExtractionResult = {
      tasks: [
        {
          description: 'High priority task',
          assignee: 'me',
          priority: 'high',
          confidence: 90,
          dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() // 12 hours from now
        },
        {
          description: 'Normal task',
          assignee: 'me',
          priority: 'medium',
          confidence: 80
        }
      ],
      summary: 'Test meeting summary',
      participants: ['Alice', 'Bob'],
      meetingDate: new Date(),
      keyDecisions: ['Decision 1'],
      nextSteps: ['Next step 1'],
      confidence: 85
    };

    it('should notify about extracted tasks', async () => {
      await service.notifyTasksExtracted(
        'Test Meeting',
        mockExtraction,
        '/vault/meeting.md'
      );

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('2 tasks extracted from: Test Meeting')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test meeting summary')
      );
    });

    it('should set urgent priority for tasks due soon', async () => {
      const urgentExtraction: TaskExtractionResult = {
        ...mockExtraction,
        tasks: [
          {
            description: 'Urgent task due today',
            assignee: 'me',
            priority: 'high',
            confidence: 95,
            dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
          }
        ]
      };

      await service.notifyTasksExtracted('Urgent Meeting', urgentExtraction);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('[URGENT]'));
    });

    it('should include high priority tasks in summary', async () => {
      await service.notifyTasksExtracted('Test Meeting', mockExtraction);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('High Priority Tasks:')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('High priority task')
      );
    });

    it('should include key decisions in summary', async () => {
      await service.notifyTasksExtracted('Test Meeting', mockExtraction);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Key Decisions:')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Decision 1')
      );
    });

    it('should show participants', async () => {
      await service.notifyTasksExtracted('Test Meeting', mockExtraction);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Participants: Alice, Bob')
      );
    });

    it('should show confidence score', async () => {
      await service.notifyTasksExtracted('Test Meeting', mockExtraction);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Confidence: 85%')
      );
    });
  });

  describe('notifyError', () => {
    it('should send error notification', async () => {
      const error = new Error('Test error message');

      await service.notifyError(error, 'Processing email', 'email123');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Processing Error: Processing email')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test error message')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('email123')
      );
    });

    it('should use high priority for errors', async () => {
      const error = new Error('Critical error');

      await service.notifyError(error, 'Critical operation');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('[HIGH]'));
    });
  });

  describe('notifyDailySummary', () => {
    it('should send daily summary notification', async () => {
      const stats = {
        emailsProcessed: 10,
        tasksExtracted: 25,
        meetingsFound: 5,
        errors: 0
      };

      await service.notifyDailySummary(stats);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Daily Summary')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Emails Processed: 10')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Tasks Extracted: 25')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('No errors')
      );
    });

    it('should highlight errors in daily summary', async () => {
      const stats = {
        emailsProcessed: 8,
        tasksExtracted: 20,
        meetingsFound: 4,
        errors: 2
      };

      await service.notifyDailySummary(stats);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Errors: 2')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('[HIGH]'));
    });
  });

  describe('Obsidian integration', () => {
    it('should create Obsidian URI', async () => {
      process.env['OBSIDIAN_VAULT_NAME'] = 'MyVault';
      const spawn = require('child_process').spawn as jest.Mock;

      const options: NotificationOptions = {
        title: 'Obsidian Test',
        message: 'Test',
        channels: ['obsidian'],
        obsidianUri: 'obsidian://open?vault=MyVault&file=test.md'
      };

      await service.send(options);

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        [options.obsidianUri],
        expect.objectContaining({
          detached: true,
          stdio: 'ignore'
        })
      );
    });

    it('should generate Obsidian URI from data', async () => {
      process.env['OBSIDIAN_VAULT_NAME'] = 'TestVault';
      const spawn = require('child_process').spawn as jest.Mock;

      const options: NotificationOptions = {
        title: 'Auto URI Test',
        message: 'Test',
        channels: ['obsidian'],
        data: {
          obsidianNotePath: 'Meetings/2024/01/meeting.md'
        }
      };

      await service.send(options);

      const expectedUri = expect.stringContaining('obsidian://');
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        [expectedUri],
        expect.any(Object)
      );
    });
  });

  describe('Channel management', () => {
    it('should update enabled channels', () => {
      service.setChannels(['console', 'slack']);
      
      // Test by sending to desktop (which should now be disabled)
      const options: NotificationOptions = {
        title: 'Channel Test',
        message: 'Test',
        channels: ['desktop', 'console']
      };

      service.send(options).then(results => {
        const desktopResult = results.find(r => r.channel === 'desktop');
        const consoleResult = results.find(r => r.channel === 'console');
        
        expect(desktopResult).toBeUndefined();
        expect(consoleResult).toBeDefined();
        expect(consoleResult?.success).toBe(true);
      });
    });
  });

  describe('Platform-specific features', () => {
    it('should handle macOS specific options', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      });

      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(null, 'response');
      });

      const options: NotificationOptions = {
        title: 'macOS Test',
        message: 'Test',
        priority: 'high',
        channels: ['desktop'],
        actions: ['Open', 'Dismiss', 'Extra'] // Should be limited to 2
      };

      await service.send(options);

      expect(notifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          subtitle: expect.stringContaining('High Priority'),
          actions: expect.arrayContaining(['Open', 'Dismiss'])
        }),
        expect.any(Function)
      );
    });

    it('should handle Linux specific options', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux'
      });

      (notifier.notify as jest.Mock).mockImplementation((options, callback) => {
        callback(null, 'response');
      });

      const options: NotificationOptions = {
        title: 'Linux Test',
        message: 'Test',
        priority: 'urgent',
        channels: ['desktop']
      };

      await service.send(options);

      expect(notifier.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          urgency: 'critical',
          category: 'email.arrived'
        }),
        expect.any(Function)
      );
    });
  });

  describe('test method', () => {
    it('should send test notification', async () => {
      await service.test();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Test Notification')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('working correctly')
      );
    });
  });
});