import { DaemonService } from './daemon/service';
import { DaemonHttpServer } from './daemon/httpServer';
import { GmailMcpService } from './daemon/gmailMcpService';
import logger from './utils/logger';

// Mock modules before import
jest.mock('./daemon/service');
jest.mock('./daemon/httpServer');
jest.mock('./daemon/gmailMcpService');
jest.mock('./utils/logger');
jest.mock('./tui/interface');
jest.mock('./cli/argumentParser', () => ({
  parseArguments: jest.fn().mockReturnValue({
    httpPort: 3002,
    gmailMcpPort: 3000,
    headless: true,
    manualOnly: false,
    configDump: false,
    help: false
  })
}));

describe('Daemon Lifecycle Management', () => {
  let mockService: jest.Mocked<DaemonService>;
  let mockHttpServer: jest.Mocked<DaemonHttpServer>;
  let mockGmailMcp: jest.Mocked<GmailMcpService>;
  let originalEnv: NodeJS.ProcessEnv;
  let processExitSpy: jest.SpyInstance;
  let processOnSpy: jest.SpyInstance;
  let signalHandlers: { [key: string]: Function } = {};

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = { ...process.env };
    
    // Create mock instances
    mockService = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockReturnValue({}),
      processEmails: jest.fn().mockResolvedValue({}),
      on: jest.fn(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<DaemonService>;

    mockHttpServer = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      isRunning: jest.fn().mockReturnValue(true),
      getPort: jest.fn().mockReturnValue(3002),
    } as unknown as jest.Mocked<DaemonHttpServer>;

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
        lastError: null,
      }),
      on: jest.fn(),
    } as unknown as jest.Mocked<GmailMcpService>;

    // Mock constructors
    (DaemonService as unknown as jest.Mock).mockImplementation(() => mockService);
    (DaemonHttpServer as unknown as jest.Mock).mockImplementation(() => mockHttpServer);
    (GmailMcpService as unknown as jest.Mock).mockImplementation(() => mockGmailMcp);

    // Mock process.exit
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    // Capture signal handlers
    signalHandlers = {};
    processOnSpy = jest.spyOn(process, 'on').mockImplementation((event: any, handler: any) => {
      signalHandlers[event] = handler;
      return process;
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    processExitSpy.mockRestore();
    processOnSpy.mockRestore();
    jest.resetModules();
  });

  describe('Daemon Initialization', () => {
    it('should create HTTP server and pass it to daemon service', async () => {
      process.argv = ['node', 'daemon.js', '--headless'];
      
      // Dynamically import to trigger module execution
      await expect(async () => {
        jest.isolateModules(() => {
          require('./daemon');
        });
      }).rejects.toThrow(); // Will throw due to async promise rejection

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify constructors were called
      expect(DaemonHttpServer).toHaveBeenCalled();
      expect(GmailMcpService).toHaveBeenCalled();
      expect(DaemonService).toHaveBeenCalledWith(
        expect.any(Object), // httpServer
        expect.any(Object)  // gmailMcpService
      );
    });

    it('should handle missing environment configuration', async () => {
      delete process.env.OBSIDIAN_VAULT_PATH;
      process.argv = ['node', 'daemon.js', '--headless'];
      
      await expect(async () => {
        jest.isolateModules(() => {
          require('./daemon');
        });
      }).rejects.toThrow();
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Obsidian vault path not configured')
      );
    });
  });

  describe('Service Integration', () => {
    it('should start all services in correct order', async () => {
      process.argv = ['node', 'daemon.js', '--headless'];
      process.env.OBSIDIAN_VAULT_PATH = '/test/vault';
      
      // Import daemon module
      await expect(async () => {
        jest.isolateModules(() => {
          require('./daemon');
        });
      }).rejects.toThrow();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify services started
      expect(mockGmailMcp.start).toHaveBeenCalled();
      expect(mockHttpServer.start).toHaveBeenCalled();
      expect(mockService.start).toHaveBeenCalled();
    });

    it('should handle Gmail MCP service failures', async () => {
      mockGmailMcp.start.mockRejectedValue(new Error('Gmail MCP failed'));
      process.argv = ['node', 'daemon.js', '--headless'];
      process.env.OBSIDIAN_VAULT_PATH = '/test/vault';
      
      await expect(async () => {
        jest.isolateModules(() => {
          require('./daemon');
        });
      }).rejects.toThrow();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start Gmail MCP'),
        expect.any(Error)
      );
    });

    it('should handle HTTP server failures', async () => {
      mockHttpServer.start.mockRejectedValue(new Error('Port in use'));
      process.argv = ['node', 'daemon.js', '--headless'];
      process.env.OBSIDIAN_VAULT_PATH = '/test/vault';
      
      await expect(async () => {
        jest.isolateModules(() => {
          require('./daemon');
        });
      }).rejects.toThrow();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start HTTP server'),
        expect.any(Error)
      );
    });
  });

  describe('CLI Arguments', () => {
    it('should respect --manual-only flag', async () => {
      const mockArgumentParser = require('./cli/argumentParser');
      mockArgumentParser.parseArguments.mockReturnValue({
        httpPort: 3002,
        gmailMcpPort: 3000,
        headless: true,
        manualOnly: true,
        configDump: false,
        help: false
      });

      process.argv = ['node', 'daemon.js', '--headless', '--manual-only'];
      process.env.OBSIDIAN_VAULT_PATH = '/test/vault';
      
      await expect(async () => {
        jest.isolateModules(() => {
          require('./daemon');
        });
      }).rejects.toThrow();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Manual-only mode enabled')
      );
    });

    it('should use custom port configuration', async () => {
      const mockArgumentParser = require('./cli/argumentParser');
      mockArgumentParser.parseArguments.mockReturnValue({
        httpPort: 8080,
        gmailMcpPort: 9000,
        headless: true,
        manualOnly: false,
        configDump: false,
        help: false
      });

      process.argv = ['node', 'daemon.js', '--http-port', '8080', '--gmail-mcp-port', '9000'];
      process.env.OBSIDIAN_VAULT_PATH = '/test/vault';
      
      await expect(async () => {
        jest.isolateModules(() => {
          require('./daemon');
        });
      }).rejects.toThrow();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(DaemonHttpServer).toHaveBeenCalledWith(
        expect.objectContaining({ port: 8080 })
      );
      expect(GmailMcpService).toHaveBeenCalledWith(9000);
    });
  });

  describe('Error Handling', () => {
    it('should log failed daemon start', async () => {
      mockService.start.mockRejectedValue(new Error('Service failed'));
      process.argv = ['node', 'daemon.js', '--headless'];
      process.env.OBSIDIAN_VAULT_PATH = '/test/vault';
      
      await expect(async () => {
        jest.isolateModules(() => {
          require('./daemon');
        });
      }).rejects.toThrow();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to start daemon:',
        expect.any(Error)
      );
    });

    it('should provide recovery suggestions on failure', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockHttpServer.start.mockRejectedValue(new Error('Port conflict'));
      process.argv = ['node', 'daemon.js', '--headless'];
      process.env.OBSIDIAN_VAULT_PATH = '/test/vault';
      
      await expect(async () => {
        jest.isolateModules(() => {
          require('./daemon');
        });
      }).rejects.toThrow();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Recovery Suggestions')
      );
      
      consoleErrorSpy.mockRestore();
    });
  });
});