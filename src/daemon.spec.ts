import { DaemonService } from './daemon/service';
import { DaemonHttpServer } from './daemon/httpServer';
import logger from './utils/logger';

// Mock modules
jest.mock('./daemon/service');
jest.mock('./daemon/httpServer');
jest.mock('./utils/logger');
jest.mock('./tui/interface');

describe('Daemon Lifecycle Management', () => {
  let mockService: jest.Mocked<DaemonService>;
  let mockHttpServer: jest.Mocked<DaemonHttpServer>;
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

    // Mock constructors
    (DaemonService as unknown as jest.Mock).mockImplementation(() => mockService);
    (DaemonHttpServer as unknown as jest.Mock).mockImplementation(() => mockHttpServer);

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

  describe('SIGINT Handler', () => {
    it('should stop HTTP server before daemon service on SIGINT in headless mode', async () => {
      process.argv = ['node', 'daemon.js', '--headless'];
      
      // Dynamically import to trigger module execution
      jest.isolateModules(() => {
        require('./daemon');
      });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify startDaemon was called
      expect(DaemonService).toHaveBeenCalled();
      expect(DaemonHttpServer).toHaveBeenCalled();
      expect(mockHttpServer.start).toHaveBeenCalled();
      expect(mockService.start).toHaveBeenCalled();

      // Verify SIGINT handler was registered
      expect(signalHandlers['SIGINT']).toBeDefined();

      // Trigger SIGINT handler
      try {
        await signalHandlers['SIGINT']!();
      } catch (error: any) {
        expect(error.message).toBe('process.exit called');
      }

      // Verify shutdown sequence
      expect(mockHttpServer.stop).toHaveBeenCalled();
      expect(mockService.stop).toHaveBeenCalled();
      expect(mockService.cleanup).toHaveBeenCalled();

      // Verify order: HTTP server stops before service
      const httpStopOrder = mockHttpServer.stop.mock.invocationCallOrder[0];
      const serviceStopOrder = mockService.stop.mock.invocationCallOrder[0];
      expect(httpStopOrder!).toBeLessThan(serviceStopOrder!);
      
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle HTTP server stop failure gracefully', async () => {
      process.argv = ['node', 'daemon.js', '--headless'];
      
      // Make HTTP server stop fail
      mockHttpServer.stop.mockRejectedValue(new Error('HTTP stop failed'));
      
      jest.isolateModules(() => {
        require('./daemon');
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger SIGINT handler
      try {
        await signalHandlers['SIGINT']!();
      } catch (error: any) {
        expect(error.message).toBe('process.exit called');
      }

      // Service should still stop even if HTTP server fails
      expect(mockHttpServer.stop).toHaveBeenCalled();
      expect(mockService.stop).toHaveBeenCalled();
      expect(mockService.cleanup).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should not attempt to stop HTTP server if it was never started', async () => {
      process.argv = ['node', 'daemon.js', '--headless'];
      
      // Make HTTP server start fail
      mockHttpServer.start.mockRejectedValue(new Error('Port in use'));
      
      jest.isolateModules(() => {
        require('./daemon');
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger SIGINT handler
      try {
        await signalHandlers['SIGINT']!();
      } catch (error: any) {
        expect(error.message).toBe('process.exit called');
      }

      // HTTP server stop should not be called if it never started
      expect(mockHttpServer.stop).not.toHaveBeenCalled();
      expect(mockService.stop).toHaveBeenCalled();
      expect(mockService.cleanup).toHaveBeenCalled();
    });
  });

  describe('SIGTERM Handler', () => {
    it('should stop HTTP server before daemon service on SIGTERM', async () => {
      process.argv = ['node', 'daemon.js', '--headless'];
      
      jest.isolateModules(() => {
        require('./daemon');
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify SIGTERM handler was registered
      expect(signalHandlers['SIGTERM']).toBeDefined();

      // Trigger SIGTERM handler
      try {
        await signalHandlers['SIGTERM']!();
      } catch (error: any) {
        expect(error.message).toBe('process.exit called');
      }

      // Verify shutdown sequence
      expect(mockHttpServer.stop).toHaveBeenCalled();
      expect(mockService.stop).toHaveBeenCalled();
      expect(mockService.cleanup).toHaveBeenCalled();

      // Verify order
      const httpStopOrder = mockHttpServer.stop.mock.invocationCallOrder[0];
      const serviceStopOrder = mockService.stop.mock.invocationCallOrder[0];
      expect(httpStopOrder!).toBeLessThan(serviceStopOrder!);
      
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('Uncaught Exception Handler (TUI mode)', () => {
    it('should stop HTTP server on uncaught exception in TUI mode', async () => {
      process.argv = ['node', 'daemon.js'];
      delete process.env['TUI_MODE']; // Will be set by daemon.ts
      
      jest.isolateModules(() => {
        require('./daemon');
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify uncaughtException handler was registered (TUI mode)
      expect(signalHandlers['uncaughtException']).toBeDefined();

      // Trigger uncaughtException handler
      const testError = new Error('Test uncaught exception');
      try {
        await signalHandlers['uncaughtException']!(testError);
      } catch (error: any) {
        expect(error.message).toBe('process.exit called');
      }

      // Verify HTTP server stop was attempted
      expect(mockHttpServer.stop).toHaveBeenCalled();
      expect(mockService.cleanup).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Uncaught exception:', testError);
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle HTTP server stop error during uncaught exception', async () => {
      process.argv = ['node', 'daemon.js'];
      
      // Make HTTP server stop fail
      mockHttpServer.stop.mockRejectedValue(new Error('Stop failed'));
      
      jest.isolateModules(() => {
        require('./daemon');
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger uncaughtException handler
      try {
        await signalHandlers['uncaughtException']!(new Error('Test error'));
      } catch (error: any) {
        expect(error.message).toBe('process.exit called');
      }

      expect(mockHttpServer.stop).toHaveBeenCalled();
      expect(mockService.cleanup).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Error stopping HTTP server during uncaught exception:',
        expect.any(Error)
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('HTTP Server Initialization', () => {
    it('should pass HTTP server reference to daemon service', async () => {
      process.argv = ['node', 'daemon.js', '--headless'];
      
      jest.isolateModules(() => {
        require('./daemon');
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify HTTP server was created with service
      expect(DaemonHttpServer).toHaveBeenCalledWith(expect.any(Object), 3002);
      
      // Verify service was created with HTTP server reference
      expect(DaemonService).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should continue without HTTP server if start fails', async () => {
      process.argv = ['node', 'daemon.js', '--headless'];
      
      // Make HTTP server start fail
      mockHttpServer.start.mockRejectedValue(new Error('Port in use'));
      
      jest.isolateModules(() => {
        require('./daemon');
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Service should still start even if HTTP server fails
      expect(mockHttpServer.start).toHaveBeenCalled();
      expect(mockService.start).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Failed to start HTTP server:', expect.any(Error));
      expect(logger.warn).toHaveBeenCalledWith(
        'Continuing without HTTP API - daemon will run but API endpoints will not be available'
      );
    });
  });
});