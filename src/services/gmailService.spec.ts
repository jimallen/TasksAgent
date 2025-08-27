import { GmailService, GmailSearchQuery } from './gmailService';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Mock the MCP SDK
jest.mock('@modelcontextprotocol/sdk/client/index.js');
jest.mock('@modelcontextprotocol/sdk/client/stdio.js');

// Mock the logger
jest.mock('../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

// Mock config
jest.mock('../config/config', () => ({
  config: {
    gmail: {
      checkIntervalHours: 8,
      senderDomains: ['@google.com', '@meet.google.com'],
      subjectPatterns: ['Recording of', 'Transcript for'],
    },
  },
}));

describe('GmailService', () => {
  let gmailService: GmailService;
  let mockClient: jest.Mocked<Client>;
  let mockTransport: jest.Mocked<StdioClientTransport>;

  beforeEach(() => {
    jest.clearAllMocks();
    gmailService = new GmailService();

    // Setup mock client
    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      callTool: jest.fn(),
    } as any;

    mockTransport = {} as any;

    (Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockClient);
    (StdioClientTransport as jest.MockedClass<typeof StdioClientTransport>).mockImplementation(
      () => mockTransport
    );
  });

  describe('connect', () => {
    it('should connect to Gmail MCP Server', async () => {
      await gmailService.connect();

      expect(Client).toHaveBeenCalledWith(
        { name: 'meeting-transcript-agent', version: '1.0.0' },
        { capabilities: {} }
      );
      expect(mockClient.connect).toHaveBeenCalledWith(mockTransport);
    });

    it('should not reconnect if already connected', async () => {
      await gmailService.connect();
      await gmailService.connect();

      expect(mockClient.connect).toHaveBeenCalledTimes(1);
    });

    it('should handle connection errors', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(gmailService.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Gmail MCP Server', async () => {
      await gmailService.connect();
      await gmailService.disconnect();

      expect(mockClient.close).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', async () => {
      await gmailService.disconnect();

      expect(mockClient.close).not.toHaveBeenCalled();
    });
  });

  describe('searchEmails', () => {
    it('should search emails with query', async () => {
      const query: GmailSearchQuery = {
        from: '@google.com',
        subject: 'Meeting',
        hasAttachment: true,
      };

      const mockEmailData = [
        {
          id: 'email1',
          threadId: 'thread1',
          labelIds: ['INBOX'],
          payload: {
            headers: [
              { name: 'Subject', value: 'Meeting Recording' },
              { name: 'From', value: 'meet@google.com' },
              { name: 'Date', value: '2024-01-15T10:00:00Z' },
            ],
            body: { data: Buffer.from('Email body').toString('base64') },
          },
        },
      ];

      mockClient.callTool.mockResolvedValue({
        content: [{ text: JSON.stringify(mockEmailData) }],
      } as any);

      const emails = await gmailService.searchEmails(query);

      expect(mockClient.callTool).toHaveBeenCalledWith('gmail_search_emails', {
        query: 'from:@google.com subject:"Meeting" has:attachment',
        maxResults: 50,
      });

      expect(emails).toHaveLength(1);
      expect(emails[0]?.id).toBe('email1');
      expect(emails[0]?.subject).toBe('Meeting Recording');
    });

    it('should return empty array when no emails found', async () => {
      mockClient.callTool.mockResolvedValue({
        content: [],
      } as any);

      const emails = await gmailService.searchEmails({ from: '@test.com' });

      expect(emails).toEqual([]);
    });
  });

  describe('fetchRecentEmails', () => {
    it('should fetch emails from the last N hours', async () => {
      const mockEmailData = [
        {
          id: 'email1',
          threadId: 'thread1',
          payload: {
            headers: [
              { name: 'Subject', value: 'Recording of Team Meeting' },
              { name: 'From', value: 'meet@google.com' },
              { name: 'Date', value: new Date().toISOString() },
            ],
          },
        },
      ];

      mockClient.callTool.mockResolvedValue({
        content: [{ text: JSON.stringify(mockEmailData) }],
      } as any);

      const emails = await gmailService.fetchRecentEmails(8);

      expect(mockClient.callTool).toHaveBeenCalled();
      expect(emails).toHaveLength(1);
    });

    it('should deduplicate emails by ID', async () => {
      const mockEmailData = [
        {
          id: 'email1',
          threadId: 'thread1',
          payload: {
            headers: [
              { name: 'Subject', value: 'Meeting' },
              { name: 'From', value: 'test@google.com' },
            ],
          },
        },
      ];

      // Return same email for multiple queries
      mockClient.callTool.mockResolvedValue({
        content: [{ text: JSON.stringify(mockEmailData) }],
      } as any);

      const emails = await gmailService.fetchRecentEmails();

      // Should deduplicate even though multiple queries were made
      const uniqueIds = new Set(emails.map((e) => e.id));
      expect(uniqueIds.size).toBe(emails.length);
    });
  });

  describe('readEmail', () => {
    it('should read a specific email by ID', async () => {
      const mockEmailData = [
        {
          id: 'email1',
          payload: {
            headers: [{ name: 'Subject', value: 'Test Email' }],
          },
        },
      ];

      mockClient.callTool.mockResolvedValue({
        content: [{ text: JSON.stringify(mockEmailData) }],
      } as any);

      const email = await gmailService.readEmail('email1');

      expect(mockClient.callTool).toHaveBeenCalledWith('gmail_read_emails', {
        messageIds: ['email1'],
      });
      expect(email?.id).toBe('email1');
      expect(email?.subject).toBe('Test Email');
    });

    it('should return null when email not found', async () => {
      mockClient.callTool.mockResolvedValue({
        content: [],
      } as any);

      const email = await gmailService.readEmail('nonexistent');

      expect(email).toBeNull();
    });
  });

  describe('downloadAttachment', () => {
    it('should download attachment', async () => {
      const attachmentData = 'test attachment content';
      const base64Data = Buffer.from(attachmentData).toString('base64');

      mockClient.callTool.mockResolvedValue({
        content: [{ text: base64Data }],
      } as any);

      const buffer = await gmailService.downloadAttachment('email1', 'attach1');

      expect(mockClient.callTool).toHaveBeenCalledWith('gmail_download_attachment', {
        messageId: 'email1',
        attachmentId: 'attach1',
      });
      expect(buffer.toString()).toBe(attachmentData);
    });

    it('should throw error when no attachment data', async () => {
      mockClient.callTool.mockResolvedValue({
        content: [],
      } as any);

      await expect(
        gmailService.downloadAttachment('email1', 'attach1')
      ).rejects.toThrow('No attachment data received');
    });
  });

  describe('markAsRead', () => {
    it('should mark email as read', async () => {
      mockClient.callTool.mockResolvedValue({} as any);

      await gmailService.markAsRead('email1');

      expect(mockClient.callTool).toHaveBeenCalledWith('gmail_modify_labels', {
        messageId: 'email1',
        removeLabels: ['UNREAD'],
      });
    });
  });

  describe('addLabel', () => {
    it('should add label to email', async () => {
      mockClient.callTool.mockResolvedValue({} as any);

      await gmailService.addLabel('email1', 'PROCESSED');

      expect(mockClient.callTool).toHaveBeenCalledWith('gmail_modify_labels', {
        messageId: 'email1',
        addLabels: ['PROCESSED'],
      });
    });
  });
});