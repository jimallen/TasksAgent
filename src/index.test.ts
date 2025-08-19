import { MeetingTranscriptAgent } from './index';
import { gmailServiceRateLimited } from './services/gmailServiceRateLimited';
import { transcriptParser } from './parsers/transcriptParser';
import { emailParser } from './parsers/emailParser';
import { claudeTaskExtractor } from './extractors/claudeTaskExtractor';
import { obsidianService } from './services/obsidianService';
import { stateManager } from './database/stateManager';
import { notificationService } from './services/notificationService';
import { cronScheduler } from './scheduler/cronScheduler';
import { EmailMessage } from './services/gmailService';

// Mock all dependencies
jest.mock('./config/config');
jest.mock('./services/gmailServiceRateLimited');
jest.mock('./parsers/transcriptParser');
jest.mock('./parsers/emailParser');
jest.mock('./extractors/claudeTaskExtractor');
jest.mock('./services/obsidianService');
jest.mock('./database/stateManager');
jest.mock('./services/notificationService');
jest.mock('./scheduler/cronScheduler');
jest.mock('./utils/logger');

describe('MeetingTranscriptAgent Integration Tests', () => {
  let agent: MeetingTranscriptAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new MeetingTranscriptAgent();
    
    // Setup default mocks
    (stateManager.initialize as jest.Mock).mockResolvedValue(undefined);
    (gmailServiceRateLimited.connect as jest.Mock).mockResolvedValue(undefined);
    (obsidianService.initialize as jest.Mock).mockResolvedValue(undefined);
    (transcriptParser.initialize as jest.Mock).mockResolvedValue(undefined);
    (cronScheduler.setProcessingFunction as jest.Mock).mockImplementation(() => {});
    (cronScheduler.start as jest.Mock).mockResolvedValue(undefined);
    (cronScheduler.stop as jest.Mock).mockResolvedValue(undefined);
    (stateManager.close as jest.Mock).mockImplementation(() => {});
    (gmailServiceRateLimited.disconnect as jest.Mock).mockResolvedValue(undefined);
    (transcriptParser.cleanup as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Initialization', () => {
    it('should initialize all services successfully', async () => {
      await agent.initialize();

      expect(stateManager.initialize).toHaveBeenCalled();
      expect(gmailServiceRateLimited.connect).toHaveBeenCalled();
      expect(obsidianService.initialize).toHaveBeenCalled();
      expect(transcriptParser.initialize).toHaveBeenCalled();
      expect(cronScheduler.setProcessingFunction).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Database connection failed');
      (stateManager.initialize as jest.Mock).mockRejectedValue(error);

      await expect(agent.initialize()).rejects.toThrow('Database connection failed');
    });
  });

  describe('Email Processing', () => {
    const mockEmails: EmailMessage[] = [
      {
        id: 'email1',
        threadId: 'thread1',
        subject: 'Team Meeting Recording - Jan 10',
        from: 'calendar@google.com',
        to: ['user@example.com'],
        date: new Date().toISOString(),
        body: 'Meeting transcript attached',
        attachments: [{
          id: 'att1',
          filename: 'transcript.pdf',
          mimeType: 'application/pdf',
          size: 1024
        }]
      },
      {
        id: 'email2',
        threadId: 'thread2',
        subject: 'Regular Email',
        from: 'colleague@example.com',
        to: ['user@example.com'],
        date: new Date().toISOString(),
        body: 'Just a regular email'
      }
    ];

    beforeEach(async () => {
      await agent.initialize();
      
      // Setup email mocks
      (gmailServiceRateLimited.fetchRecentEmails as jest.Mock).mockResolvedValue(mockEmails);
      (emailParser.parseEmail as jest.Mock).mockImplementation((email) => {
        if (email.id === 'email1') {
          return Promise.resolve({
            isTranscript: true,
            confidence: 85,
            service: 'google-meet',
            transcriptLocation: 'attachment',
            meetingInfo: {
              title: 'Team Meeting',
              date: new Date(),
              participants: ['Alice', 'Bob']
            }
          });
        }
        return Promise.resolve({
          isTranscript: false,
          confidence: 10,
          service: 'unknown',
          transcriptLocation: 'none'
        });
      });

      // Setup state manager mocks
      (stateManager.getEmailStatus as jest.Mock).mockResolvedValue({
        processed: false
      });
      (stateManager.saveProcessedEmail as jest.Mock).mockResolvedValue(undefined);
      (stateManager.saveTasks as jest.Mock).mockResolvedValue([1, 2, 3]);
      (stateManager.saveMeeting as jest.Mock).mockResolvedValue(1);
      (stateManager.updateDailyStats as jest.Mock).mockResolvedValue(undefined);

      // Setup transcript processing mocks
      (gmailServiceRateLimited.downloadAttachment as jest.Mock).mockResolvedValue(
        Buffer.from('PDF content')
      );
      (transcriptParser.parseTranscript as jest.Mock).mockResolvedValue({
        text: 'Meeting transcript content...',
        format: 'pdf',
        extractedTasks: ['Task 1', 'Task 2']
      });

      // Setup task extraction mock
      (claudeTaskExtractor.extractTasks as jest.Mock).mockResolvedValue({
        tasks: [
          {
            description: 'Review Q1 budget',
            assignee: 'me',
            priority: 'high',
            confidence: 90
          },
          {
            description: 'Send meeting notes',
            assignee: 'me',
            priority: 'medium',
            confidence: 85
          }
        ],
        summary: 'Team meeting about Q1 planning',
        participants: ['Alice', 'Bob', 'Charlie'],
        meetingDate: new Date(),
        keyDecisions: ['Approved Q1 budget'],
        nextSteps: ['Schedule follow-up'],
        confidence: 87
      });

      // Setup Obsidian mock
      (obsidianService.createMeetingNote as jest.Mock).mockResolvedValue({
        metadata: {
          title: 'Team Meeting - Jan 10',
          date: new Date(),
          participants: ['Alice', 'Bob', 'Charlie']
        },
        filepath: '/vault/Meetings/2024/01/team-meeting.md',
        content: 'Note content...'
      });
      (obsidianService.linkToDailyNote as jest.Mock).mockResolvedValue(undefined);

      // Setup notification mock
      (notificationService.notifyTasksExtracted as jest.Mock).mockResolvedValue(undefined);
      (notificationService.send as jest.Mock).mockResolvedValue([]);
    });

    it('should process emails and extract tasks', async () => {
      await agent.processEmails();

      // Verify email fetching
      expect(gmailServiceRateLimited.fetchRecentEmails).toHaveBeenCalledWith(24);

      // Verify email parsing
      expect(emailParser.parseEmail).toHaveBeenCalledTimes(2);

      // Verify only transcript email was processed
      expect(gmailServiceRateLimited.downloadAttachment).toHaveBeenCalledWith('email1', 'att1');
      expect(transcriptParser.parseTranscript).toHaveBeenCalled();
      expect(claudeTaskExtractor.extractTasks).toHaveBeenCalled();

      // Verify Obsidian note creation
      expect(obsidianService.createMeetingNote).toHaveBeenCalled();
      expect(obsidianService.linkToDailyNote).toHaveBeenCalled();

      // Verify database updates
      expect(stateManager.saveProcessedEmail).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'email1' }),
        'processed',
        2, // task count
        87, // confidence
        expect.stringContaining('.md')
      );
      expect(stateManager.saveTasks).toHaveBeenCalled();
      expect(stateManager.saveMeeting).toHaveBeenCalled();
      expect(stateManager.updateDailyStats).toHaveBeenCalledWith(1, 2, 1, 0);

      // Verify notifications
      expect(notificationService.notifyTasksExtracted).toHaveBeenCalled();
      expect(notificationService.send).toHaveBeenCalled();
    });

    it('should skip already processed emails', async () => {
      (stateManager.getEmailStatus as jest.Mock).mockResolvedValue({
        processed: true,
        status: 'processed'
      });

      await agent.processEmails();

      expect(claudeTaskExtractor.extractTasks).not.toHaveBeenCalled();
      expect(obsidianService.createMeetingNote).not.toHaveBeenCalled();
    });

    it('should handle processing errors gracefully', async () => {
      const error = new Error('Task extraction failed');
      (claudeTaskExtractor.extractTasks as jest.Mock).mockRejectedValue(error);

      await agent.processEmails();

      // Should save as failed
      expect(stateManager.saveProcessedEmail).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'email1' }),
        'failed',
        0,
        0,
        undefined,
        'Task extraction failed'
      );

      // Should update stats with error
      expect(stateManager.updateDailyStats).toHaveBeenCalledWith(0, 0, 0, 1);
    });

    it('should prevent concurrent processing', async () => {
      // Start first processing
      const promise1 = agent.processEmails();
      
      // Try to start second processing immediately
      const promise2 = agent.processEmails();

      await Promise.all([promise1, promise2]);

      // Should only fetch emails once
      expect(gmailServiceRateLimited.fetchRecentEmails).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scheduler Integration', () => {
    it('should start scheduler on agent start', async () => {
      process.env['RUN_ON_START'] = 'false';
      
      await agent.start();

      expect(cronScheduler.start).toHaveBeenCalled();
    });

    it('should run initial processing if configured', async () => {
      process.env['RUN_ON_START'] = 'true';
      (gmailServiceRateLimited.fetchRecentEmails as jest.Mock).mockResolvedValue([]);

      await agent.start();

      expect(gmailServiceRateLimited.fetchRecentEmails).toHaveBeenCalled();
      
      delete process.env['RUN_ON_START'];
    });
  });

  describe('Manual Trigger', () => {
    it('should allow manual triggering of processing', async () => {
      (gmailServiceRateLimited.fetchRecentEmails as jest.Mock).mockResolvedValue([]);
      
      await agent.initialize();
      await agent.triggerManual();

      expect(gmailServiceRateLimited.fetchRecentEmails).toHaveBeenCalled();
    });
  });

  describe('Status Reporting', () => {
    it('should report agent status', async () => {
      await agent.initialize();
      
      const status = agent.getStatus();

      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('isProcessing');
      expect(status).toHaveProperty('startTime');
      expect(status).toHaveProperty('processedCount');
      expect(status).toHaveProperty('errorCount');
      expect(status).toHaveProperty('uptime');
    });
  });

  describe('Graceful Shutdown', () => {
    it('should shutdown all services gracefully', async () => {
      await agent.initialize();
      
      // Mock process.exit to prevent test from exiting
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await agent.shutdown(0);
      } catch (e: any) {
        expect(e.message).toBe('process.exit called');
      }

      expect(cronScheduler.stop).toHaveBeenCalled();
      expect(stateManager.close).toHaveBeenCalled();
      expect(gmailServiceRateLimited.disconnect).toHaveBeenCalled();
      expect(transcriptParser.cleanup).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
    });

    it('should handle shutdown errors', async () => {
      await agent.initialize();
      
      const error = new Error('Cleanup failed');
      (transcriptParser.cleanup as jest.Mock).mockRejectedValue(error);
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      try {
        await agent.shutdown(1);
      } catch (e: any) {
        expect(e.message).toBe('process.exit called');
      }

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('End-to-End Workflow', () => {
    it('should complete full workflow from email to Obsidian note', async () => {
      const mockTranscriptEmail: EmailMessage = {
        id: 'e2e-email',
        threadId: 'e2e-thread',
        subject: 'Product Planning Meeting - Recording',
        from: 'meet@google.com',
        to: ['user@example.com'],
        date: new Date().toISOString(),
        body: 'Transcript attached',
        attachments: [{
          id: 'att-e2e',
          filename: 'meeting-transcript.pdf',
          mimeType: 'application/pdf',
          size: 2048
        }]
      };

      // Setup mocks for full workflow
      (gmailServiceRateLimited.fetchRecentEmails as jest.Mock).mockResolvedValue([mockTranscriptEmail]);
      
      await agent.processEmails();

      // Verify complete workflow
      expect(emailParser.parseEmail).toHaveBeenCalledWith(mockTranscriptEmail);
      expect(gmailServiceRateLimited.downloadAttachment).toHaveBeenCalled();
      expect(transcriptParser.parseTranscript).toHaveBeenCalled();
      expect(claudeTaskExtractor.extractTasks).toHaveBeenCalled();
      expect(obsidianService.createMeetingNote).toHaveBeenCalled();
      expect(stateManager.saveProcessedEmail).toHaveBeenCalledWith(
        expect.anything(),
        'processed',
        expect.any(Number),
        expect.any(Number),
        expect.any(String)
      );
      expect(notificationService.notifyTasksExtracted).toHaveBeenCalled();
    });
  });
});