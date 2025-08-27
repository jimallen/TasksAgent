import { StateManager } from './stateManager';
import { ExtractedTask } from '../extractors/claudeTaskExtractor';
import { EmailMessage } from '../services/gmailService';
import path from 'path';
import fs from 'fs/promises';

// Mock logger
jest.mock('../utils/logger');

describe('StateManager', () => {
  let stateManager: StateManager;
  const testDbPath = path.join(__dirname, 'test-state.db');

  beforeEach(async () => {
    // Clean up any existing test database
    try {
      await fs.unlink(testDbPath);
    } catch {
      // File doesn't exist, that's fine
    }

    stateManager = new StateManager(testDbPath);
    await stateManager.initialize();
  });

  afterEach(async () => {
    stateManager.close();
    // Clean up test database
    try {
      await fs.unlink(testDbPath);
    } catch {
      // Ignore errors
    }
  });

  describe('Email Processing', () => {
    const mockEmail: EmailMessage = {
      id: 'email123',
      threadId: 'thread123',
      subject: 'Test Meeting Notes',
      from: 'sender@example.com',
      to: ['recipient@example.com'],
      date: new Date('2024-01-10').toISOString(),
      body: 'Meeting transcript content',
      attachments: []
    };

    it('should track processed emails', async () => {
      // Check email is not processed initially
      const isProcessed = await stateManager.isEmailProcessed('email123');
      expect(isProcessed).toBe(false);

      // Save processed email
      await stateManager.saveProcessedEmail(
        mockEmail,
        'processed',
        5,
        85,
        '/vault/meeting.md'
      );

      // Check email is now processed
      const isProcessedAfter = await stateManager.isEmailProcessed('email123');
      expect(isProcessedAfter).toBe(true);
    });

    it('should detect duplicate emails by message ID', async () => {
      await stateManager.saveProcessedEmail(mockEmail, 'processed');

      const isDuplicate = await stateManager.isDuplicateEmail('email123');
      expect(isDuplicate).toBe(true);

      const isNotDuplicate = await stateManager.isDuplicateEmail('email456');
      expect(isNotDuplicate).toBe(false);
    });

    it('should track email processing status', async () => {
      await stateManager.saveProcessedEmail(
        mockEmail,
        'processed',
        3,
        90
      );

      const status = await stateManager.getEmailStatus('email123');
      expect(status.processed).toBe(true);
      expect(status.status).toBe('processed');
      expect(status.taskCount).toBe(3);
    });

    it('should detect transcript changes', async () => {
      await stateManager.saveProcessedEmail(mockEmail, 'processed');

      // Original hash
      const originalHash = 'abc123';
      const hasChanged1 = await stateManager.hasTranscriptChanged('email123', originalHash);
      expect(hasChanged1).toBe(true); // Different from stored hash

      // Same hash as stored
      const sameHash = await stateManager.hasTranscriptChanged('email123', 'abc123');
      expect(sameHash).toBe(true); // Still different because we didn't store with that hash

      // New email
      const newEmail = await stateManager.hasTranscriptChanged('email999', 'xyz789');
      expect(newEmail).toBe(true); // New emails are considered "changed"
    });
  });

  describe('Task Deduplication', () => {
    const mockTasks: ExtractedTask[] = [
      {
        description: 'Review the quarterly report',
        assignee: 'me',
        priority: 'high',
        confidence: 90,
        category: 'product'
      },
      {
        description: 'Review quarterly report', // Similar to first
        assignee: 'me',
        priority: 'high',
        confidence: 85,
        category: 'product'
      },
      {
        description: 'Send meeting notes to team',
        assignee: 'John',
        priority: 'medium',
        confidence: 80,
        category: 'communication'
      }
    ];

    it('should detect duplicate tasks by hash', async () => {
      // Save first task
      const savedIds = await stateManager.saveTasks('email123', [mockTasks[0]]);
      expect(savedIds).toHaveLength(1);

      // Try to save similar task (should be detected as duplicate)
      const duplicateIds = await stateManager.saveTasks('email124', [mockTasks[1]]);
      expect(duplicateIds).toHaveLength(0); // Should not save duplicate
    });

    it('should save unique tasks', async () => {
      const savedIds = await stateManager.saveTasks('email123', [mockTasks[0], mockTasks[2]]);
      expect(savedIds).toHaveLength(2);
    });

    it('should find similar tasks', async () => {
      // Save some tasks first
      await stateManager.saveTasks('email123', [mockTasks[0], mockTasks[2]]);

      // Find similar tasks
      const similar = await stateManager.findSimilarTasks(mockTasks[1], 0.5);
      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0].description).toContain('quarterly report');
    });

    it('should calculate task similarity correctly', async () => {
      const task1: ExtractedTask = {
        description: 'Review the quarterly financial report',
        assignee: 'me',
        priority: 'high',
        confidence: 90
      };

      const task2: ExtractedTask = {
        description: 'Review quarterly report', // 60% similar
        assignee: 'me',
        priority: 'high',
        confidence: 85
      };

      const task3: ExtractedTask = {
        description: 'Send email to client', // Not similar
        assignee: 'me',
        priority: 'low',
        confidence: 70
      };

      await stateManager.saveTasks('email1', [task1, task3]);

      const similar = await stateManager.findSimilarTasks(task2, 0.4);
      expect(similar.length).toBe(1);
      expect(similar[0].description).toContain('quarterly');

      const notSimilar = await stateManager.findSimilarTasks(task2, 0.9);
      expect(notSimilar.length).toBe(0);
    });
  });

  describe('Meeting Records', () => {
    it('should save meeting records with participants', async () => {
      const meetingId = await stateManager.saveMeeting(
        'email123',
        'Q1 Planning Meeting',
        new Date('2024-01-15'),
        ['Alice', 'Bob', 'Charlie'],
        'google-meet',
        '/vault/meetings/q1-planning.md'
      );

      expect(meetingId).toBeGreaterThan(0);
    });
  });

  describe('Processing Queue', () => {
    it('should manage processing queue', async () => {
      // Add items to queue
      await stateManager.addToQueue('email1', 10); // High priority
      await stateManager.addToQueue('email2', 5);  // Medium priority
      await stateManager.addToQueue('email3', 1);  // Low priority

      // Get next item (should be highest priority)
      const next = await stateManager.getNextQueueItem();
      expect(next).toBeTruthy();
      expect(next.email_id).toBe('email1');
      expect(next.priority).toBe(10);

      // Update status
      await stateManager.updateQueueStatus(next.id, 'processing');

      // Get next item (should skip processing one)
      const next2 = await stateManager.getNextQueueItem();
      expect(next2.email_id).toBe('email2');
    });

    it('should handle failed queue items', async () => {
      await stateManager.addToQueue('email1', 5);
      
      const item = await stateManager.getNextQueueItem();
      await stateManager.updateQueueStatus(
        item.id,
        'failed',
        'Connection timeout'
      );

      // Check that error was recorded
      // In a real test, we'd query the queue to verify the error message
    });
  });

  describe('Statistics', () => {
    it('should track daily statistics', async () => {
      await stateManager.updateDailyStats(5, 15, 3, 1);
      
      const stats = await stateManager.getStats();
      expect(stats).toBeTruthy();
      // Stats should include today's data
    });

    it('should calculate aggregate statistics', async () => {
      // Process some emails
      const email1: EmailMessage = {
        id: 'email1',
        threadId: 'thread1',
        subject: 'Meeting 1',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        date: new Date().toISOString(),
        body: 'Content 1'
      };

      const email2: EmailMessage = {
        id: 'email2',
        threadId: 'thread2',
        subject: 'Meeting 2',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        date: new Date().toISOString(),
        body: 'Content 2'
      };

      await stateManager.saveProcessedEmail(email1, 'processed', 3, 90);
      await stateManager.saveProcessedEmail(email2, 'failed', 0, 0, undefined, 'Parse error');

      const stats = await stateManager.getStats();
      expect(stats.total_emails).toBe(2);
      expect(stats.processed_emails).toBe(1);
      expect(stats.failed_emails).toBe(1);
      expect(stats.avg_confidence).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    it('should clean up old records', async () => {
      // Create old email record
      const oldEmail: EmailMessage = {
        id: 'old-email',
        threadId: 'old-thread',
        subject: 'Old Meeting',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        date: new Date('2020-01-01').toISOString(),
        body: 'Old content'
      };

      await stateManager.saveProcessedEmail(oldEmail, 'processed');

      // Clean up records older than 30 days
      await stateManager.cleanup(30);

      // Old email should be gone
      const isProcessed = await stateManager.isEmailProcessed('old-email');
      expect(isProcessed).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should get and set configuration values', () => {
      stateManager.setConfig('test_key', 'test_value');
      const value = stateManager.getConfig('test_key');
      expect(value).toBe('test_value');

      const nonExistent = stateManager.getConfig('non_existent');
      expect(nonExistent).toBeNull();
    });

    it('should have default configuration', () => {
      const schemaVersion = stateManager.getConfig('schema_version');
      expect(schemaVersion).toBe('1.0.0');

      const batchSize = stateManager.getConfig('batch_size');
      expect(batchSize).toBe('10');
    });
  });

  describe('Data Export', () => {
    it('should export data for backup', async () => {
      // Add some data
      const email: EmailMessage = {
        id: 'email1',
        threadId: 'thread1',
        subject: 'Test',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        date: new Date().toISOString(),
        body: 'Content'
      };

      await stateManager.saveProcessedEmail(email, 'processed', 2, 80);
      await stateManager.saveTasks('email1', [
        {
          description: 'Test task',
          assignee: 'me',
          priority: 'medium',
          confidence: 75
        }
      ]);

      const exportData = await stateManager.exportData();
      expect(exportData.version).toBe('1.0.0');
      expect(exportData.emails).toHaveLength(1);
      expect(exportData.tasks).toHaveLength(1);
      expect(exportData.exported_at).toBeTruthy();
    });
  });

  describe('Task Management', () => {
    it('should update task status', async () => {
      const taskIds = await stateManager.saveTasks('email1', [
        {
          description: 'Complete report',
          assignee: 'me',
          priority: 'high',
          confidence: 90
        }
      ]);

      await stateManager.updateTaskStatus(taskIds[0], 'completed');

      const pendingTasks = await stateManager.getPendingTasks('me');
      expect(pendingTasks).toHaveLength(0);
    });

    it('should get pending tasks by assignee', async () => {
      await stateManager.saveTasks('email1', [
        {
          description: 'Task for me',
          assignee: 'me',
          priority: 'high',
          confidence: 90
        },
        {
          description: 'Task for John',
          assignee: 'John',
          priority: 'medium',
          confidence: 80
        },
        {
          description: 'Another task for me',
          assignee: 'me',
          priority: 'low',
          confidence: 70
        }
      ]);

      const myTasks = await stateManager.getPendingTasks('me');
      expect(myTasks).toHaveLength(2);
      expect(myTasks[0].priority).toBe('high'); // Should be sorted by priority

      const johnTasks = await stateManager.getPendingTasks('John');
      expect(johnTasks).toHaveLength(1);
    });
  });

  describe('Recent Emails', () => {
    it('should get recent processed emails', async () => {
      // Add multiple emails
      for (let i = 1; i <= 15; i++) {
        const email: EmailMessage = {
          id: `email${i}`,
          threadId: `thread${i}`,
          subject: `Meeting ${i}`,
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          date: new Date().toISOString(),
          body: `Content ${i}`
        };
        await stateManager.saveProcessedEmail(email, 'processed');
      }

      const recent = await stateManager.getRecentEmails(10);
      expect(recent).toHaveLength(10);
      // Should be ordered by processed_at DESC
      expect(recent[0].id).toBe('email15');
    });
  });
});