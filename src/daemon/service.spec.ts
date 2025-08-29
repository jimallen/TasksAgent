import { DaemonService } from './service';
import { DaemonHttpServer } from './httpServer';
import { GmailMcpService } from './gmailMcpService';
import { EmailProcessor } from '../processors/emailProcessor';
import logger from '../utils/logger';
import Database from 'better-sqlite3';

jest.mock('../processors/emailProcessor');
jest.mock('../utils/logger');
jest.mock('better-sqlite3');
jest.mock('./httpServer');
jest.mock('./gmailMcpService');

describe('DaemonService', () => {
  let service: DaemonService;
  let mockHttpServer: jest.Mocked<DaemonHttpServer>;
  let mockGmailMcp: jest.Mocked<GmailMcpService>;
  let mockProcessor: jest.Mocked<EmailProcessor>;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database
    mockDb = {
      exec: jest.fn(),
      prepare: jest.fn().mockReturnValue({
        get: jest.fn(),
        all: jest.fn().mockReturnValue([]),
        run: jest.fn(),
      }),
      close: jest.fn(),
    };
    (Database as unknown as jest.Mock).mockReturnValue(mockDb);

    // Mock processor
    mockProcessor = {
      processEmails: jest.fn().mockResolvedValue({
        emailsProcessed: 5,
        tasksExtracted: 10,
        notesCreated: 3,
      }),
    } as unknown as jest.Mocked<EmailProcessor>;
    (EmailProcessor as jest.Mock).mockReturnValue(mockProcessor);

    // Mock HTTP server
    mockHttpServer = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      isRunning: jest.fn().mockReturnValue(true),
      getPort: jest.fn().mockReturnValue(3002),
    } as unknown as jest.Mocked<DaemonHttpServer>;
    (DaemonHttpServer as jest.Mock).mockImplementation(() => mockHttpServer);

    // Mock Gmail MCP service
    mockGmailMcp = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined),
      isRunning: jest.fn().mockReturnValue(true),
      getStatus: jest.fn().mockReturnValue({
        running: true,
        pid: 12345,
        requestCount: 0,
        restartCount: 0,
        errorCount: 0,
        lastError: null,
      }),
      sendRequest: jest.fn(),
      on: jest.fn(),
    } as unknown as jest.Mocked<GmailMcpService>;
    (GmailMcpService as unknown as jest.Mock).mockImplementation(() => mockGmailMcp);
  });

  describe('Cleanup with HTTP Server and Gmail MCP', () => {
    it('should stop HTTP server during cleanup if provided', async () => {
      service = new DaemonService(mockHttpServer);
      
      await service.cleanup();

      expect(mockHttpServer.stop).toHaveBeenCalled();
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should stop Gmail MCP service during cleanup if provided', async () => {
      service = new DaemonService(mockHttpServer, mockGmailMcp);
      
      await service.cleanup();

      expect(mockGmailMcp.cleanup).toHaveBeenCalled();
      expect(mockHttpServer.stop).toHaveBeenCalled();
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should handle HTTP server stop failure during cleanup', async () => {
      mockHttpServer.stop.mockRejectedValue(new Error('Stop failed'));
      service = new DaemonService(mockHttpServer);
      
      // Should not throw even if HTTP server stop fails
      await expect(service.cleanup()).resolves.not.toThrow();
      
      expect(mockHttpServer.stop).toHaveBeenCalled();
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should handle Gmail MCP stop failure during cleanup', async () => {
      mockGmailMcp.cleanup.mockRejectedValue(new Error('Gmail MCP cleanup failed'));
      service = new DaemonService(mockHttpServer, mockGmailMcp);
      
      // Should not throw even if Gmail MCP cleanup fails
      await expect(service.cleanup()).resolves.not.toThrow();
      
      expect(mockGmailMcp.cleanup).toHaveBeenCalled();
      expect(mockHttpServer.stop).toHaveBeenCalled();
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should cleanup without HTTP server if not provided', async () => {
      service = new DaemonService();
      
      await service.cleanup();

      expect(mockHttpServer.stop).not.toHaveBeenCalled();
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should close database even if HTTP server stop fails', async () => {
      mockHttpServer.stop.mockRejectedValue(new Error('HTTP stop error'));
      service = new DaemonService(mockHttpServer);
      
      await service.cleanup();

      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should close database even if Gmail MCP stop fails', async () => {
      mockGmailMcp.cleanup.mockRejectedValue(new Error('Gmail MCP cleanup error'));
      service = new DaemonService(mockHttpServer, mockGmailMcp);
      
      await service.cleanup();

      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should stop services in correct order during cleanup', async () => {
      const stopOrder: string[] = [];
      
      mockGmailMcp.cleanup.mockImplementation(async () => {
        stopOrder.push('gmail');
      });
      
      mockHttpServer.stop.mockImplementation(async () => {
        stopOrder.push('http');
      });
      
      service = new DaemonService(mockHttpServer, mockGmailMcp);
      
      await service.cleanup();

      // Gmail MCP should stop first, then HTTP server
      expect(stopOrder).toEqual(['gmail', 'http']);
      expect(mockDb.close).toHaveBeenCalled();
    });
  });

  describe('Stats with HTTP Server and Gmail MCP', () => {
    it('should include HTTP server status in stats when server is provided', () => {
      service = new DaemonService(mockHttpServer);
      
      const stats = service.getStats();

      expect(stats.httpServerRunning).toBe(true);
      expect(stats.httpServerPort).toBe(3002);
      expect(mockHttpServer.isRunning).toHaveBeenCalled();
      expect(mockHttpServer.getPort).toHaveBeenCalled();
    });

    it('should include Gmail MCP status in stats when service is provided', () => {
      service = new DaemonService(mockHttpServer, mockGmailMcp);
      
      const stats = service.getStats();

      expect(stats.gmailMcpRunning).toBe(true);
      expect(stats.gmailMcpPid).toBe(12345);
      expect(stats.gmailMcpRequestCount).toBe(0);
      expect(mockGmailMcp.getStatus).toHaveBeenCalled();
    });

    it('should not include HTTP server status when server is not provided', () => {
      service = new DaemonService();
      
      const stats = service.getStats();

      expect(stats.httpServerRunning).toBeUndefined();
      expect(stats.httpServerPort).toBeUndefined();
    });

    it('should not include Gmail MCP status when service is not provided', () => {
      service = new DaemonService(mockHttpServer);
      
      const stats = service.getStats();

      expect(stats.gmailMcpRunning).toBeUndefined();
      expect(stats.gmailMcpPid).toBeUndefined();
    });

    it('should reflect HTTP server stopped state', () => {
      mockHttpServer.isRunning.mockReturnValue(false);
      service = new DaemonService(mockHttpServer);
      
      const stats = service.getStats();

      expect(stats.httpServerRunning).toBe(false);
      expect(stats.httpServerPort).toBe(3002);
    });

    it('should reflect Gmail MCP stopped state', () => {
      mockGmailMcp.isRunning.mockReturnValue(false);
      mockGmailMcp.getStatus.mockReturnValue({
        running: false,
        pid: undefined,
        requestCount: 0,
        restartCount: 3,
        errorCount: 5,
        lastError: 'Max restart attempts reached',
      });
      
      service = new DaemonService(mockHttpServer, mockGmailMcp);
      
      const stats = service.getStats();

      expect(stats.gmailMcpRunning).toBe(false);
      expect(stats.gmailMcpPid).toBeUndefined();
    });
  });

  describe('Service Lifecycle', () => {
    it('should start service without errors', async () => {
      service = new DaemonService();
      
      await service.start();

      const stats = service.getStats();
      expect(stats.status).toBe('running');
      expect(logger.info).toHaveBeenCalledWith(
        'Starting daemon service (manual trigger only - no scheduled processing)...'
      );
    });

    it('should stop service gracefully', async () => {
      service = new DaemonService();
      
      await service.start();
      await service.stop();

      const stats = service.getStats();
      expect(stats.status).toBe('stopped');
      expect(logger.info).toHaveBeenCalledWith('Stopping daemon service...');
      expect(logger.info).toHaveBeenCalledWith('Daemon service stopped');
    });

    it('should wait for processing to complete before stopping', async () => {
      service = new DaemonService();
      
      // Mock the processor to simulate processing
      let resolveProcessing: any;
      const processingPromise = new Promise(resolve => {
        resolveProcessing = resolve;
      });
      
      const mockProcessor = (EmailProcessor as jest.Mock).mock.results[0].value;
      mockProcessor.processEmails.mockReturnValue(processingPromise);
      
      // Start service
      await service.start();
      
      // Start processing
      const processPromise = service.processEmails();
      
      // Try to stop while processing (won't complete until processing is done)
      const stopPromise = service.stop();
      
      // Verify waiting message was logged
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(logger.info).toHaveBeenCalledWith('Waiting for current processing to complete...');
      
      // Complete processing
      resolveProcessing({
        emailsProcessed: 0,
        tasksExtracted: 0,
        notesCreated: 0,
      });
      
      await processPromise;
      await stopPromise;
      
      expect(logger.info).toHaveBeenCalledWith('Daemon service stopped');
    });
  });

  describe('Email Processing', () => {
    it('should process emails and update stats', async () => {
      service = new DaemonService();
      await service.start();
      
      const result = await service.processEmails(true, false, 24);

      expect(result).toEqual({
        emailsProcessed: 5,
        tasksExtracted: 10,
        notesCreated: 3,
      });
      
      const stats = service.getStats();
      expect(stats.totalRuns).toBe(1);
      expect(stats.successfulRuns).toBe(1);
      expect(stats.emailsProcessed).toBe(5);
      expect(stats.tasksExtracted).toBe(10);
      expect(stats.notesCreated).toBe(3);
    });

    it('should handle processing errors', async () => {
      mockProcessor.processEmails.mockRejectedValue(new Error('Processing failed'));
      service = new DaemonService();
      await service.start();
      
      await expect(service.processEmails()).rejects.toThrow('Processing failed');
      
      const stats = service.getStats();
      expect(stats.failedRuns).toBe(1);
      expect(stats.status).toBe('error');
    });

    it('should prevent concurrent processing', async () => {
      service = new DaemonService();
      await service.start();
      
      // Start first processing
      const promise1 = service.processEmails();
      
      // Try to start second processing
      const promise2 = service.processEmails();
      
      await Promise.all([promise1, promise2]);
      
      expect(logger.warn).toHaveBeenCalledWith('Already processing emails, skipping this run');
      expect(mockProcessor.processEmails).toHaveBeenCalledTimes(1);
    });
  });

  describe('Data Reset', () => {
    it('should reset processed emails data', async () => {
      const mockStateDb = {
        prepare: jest.fn().mockReturnValue({
          run: jest.fn().mockReturnValue({ changes: 10 }),
        }),
        close: jest.fn(),
      };
      (Database as unknown as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('state.db')) {
          return mockStateDb;
        }
        return mockDb;
      });

      service = new DaemonService();
      
      const result = await service.resetProcessedData('emails');

      expect(result.emailsDeleted).toBe(10);
      expect(result.message).toContain('10 emails deleted');
      expect(mockStateDb.close).toHaveBeenCalled();
    });

    it('should clear stats when requested', async () => {
      service = new DaemonService();
      await service.start();
      
      // Add some stats
      await service.processEmails();
      
      // Clear stats
      service.clearStats();
      
      const stats = service.getStats();
      expect(stats.totalRuns).toBe(0);
      expect(stats.successfulRuns).toBe(0);
      expect(stats.emailsProcessed).toBe(0);
      expect(stats.tasksExtracted).toBe(0);
      expect(stats.notesCreated).toBe(0);
    });
  });
});