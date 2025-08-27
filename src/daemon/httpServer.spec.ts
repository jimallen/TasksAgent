import { DaemonHttpServer } from './httpServer';
import { DaemonService } from './service';
import express from 'express';
import * as net from 'net';
import logger from '../utils/logger';

jest.mock('./service');
jest.mock('../utils/logger');

describe('DaemonHttpServer', () => {
  let httpServer: DaemonHttpServer;
  let mockService: jest.Mocked<DaemonService>;
  let mockExpressApp: any;
  let mockServerInstance: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = { ...process.env };
    
    // Mock service
    mockService = {
      getStats: jest.fn().mockReturnValue({
        status: 'running',
        totalRuns: 5,
        emailsProcessed: 10,
        tasksExtracted: 15,
      }),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      processEmails: jest.fn().mockResolvedValue({
        emailsProcessed: 3,
        tasksExtracted: 7,
        notesCreated: 2,
      }),
      resetProcessedData: jest.fn().mockResolvedValue({
        message: 'Reset complete',
      }),
    } as any;

    // Mock Express app
    mockExpressApp = {
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      listen: jest.fn(),
    };

    // Mock server instance
    mockServerInstance = {
      on: jest.fn(),
      close: jest.fn(),
      address: jest.fn().mockReturnValue({ port: 3002 }),
    };

    // Mock express
    (express as any).mockReturnValue(mockExpressApp);

    mockExpressApp.listen.mockImplementation((_port: number, callback: Function) => {
      callback();
      return mockServerInstance;
    });

    httpServer = new DaemonHttpServer(mockService, 3002);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Graceful Shutdown', () => {
    it('should close all tracked connections on stop', async () => {
      const mockConnections = [
        { destroy: jest.fn(), on: jest.fn() },
        { destroy: jest.fn(), on: jest.fn() },
        { destroy: jest.fn(), on: jest.fn() },
      ];

      // Start server
      await httpServer.start();
      expect(httpServer.isRunning()).toBe(true);

      // Simulate connections
      const connectionHandler = mockServerInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'connection'
      )?.[1];

      mockConnections.forEach(conn => {
        connectionHandler(conn);
      });

      // Setup close callback
      mockServerInstance.close.mockImplementation((callback: Function) => {
        callback();
      });

      // Stop server
      await httpServer.stop();

      // Verify all connections were destroyed
      mockConnections.forEach(conn => {
        expect(conn.destroy).toHaveBeenCalled();
      });

      expect(httpServer.isRunning()).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('[HTTP Server] Stopped gracefully');
    });

    it('should force close after timeout if connections do not close', async () => {
      jest.useFakeTimers();
      
      const mockConnection = { 
        destroy: jest.fn(),
        on: jest.fn(),
      };

      await httpServer.start();

      // Add a connection
      const connectionHandler = mockServerInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'connection'
      )?.[1];
      connectionHandler(mockConnection);

      // Make server.close not call its callback (simulating hanging connections)
      mockServerInstance.close.mockImplementation(() => {
        // Don't call callback - simulate hanging
      });

      // Start stop process
      const stopPromise = httpServer.stop();

      // Fast-forward time by 5 seconds to trigger timeout
      jest.advanceTimersByTime(5000);

      // Wait for stop to complete
      await stopPromise;

      // Verify force close occurred
      expect(mockConnection.destroy).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('[HTTP Server] Force closing after 5 second timeout');
      expect(logger.info).toHaveBeenCalledWith('[HTTP Server] Stopped (forced)');
      expect(httpServer.isRunning()).toBe(false);

      jest.useRealTimers();
    });

    it('should track connection count during shutdown', async () => {
      const mockConnections = Array(5).fill(null).map(() => ({
        destroy: jest.fn(),
        on: jest.fn(),
      }));

      await httpServer.start();

      // Add connections
      const connectionHandler = mockServerInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'connection'
      )?.[1];
      
      mockConnections.forEach(conn => {
        connectionHandler(conn);
      });

      mockServerInstance.close.mockImplementation((callback: Function) => {
        callback();
      });

      await httpServer.stop();

      expect(logger.info).toHaveBeenCalledWith(
        `[HTTP Server] Closing ${mockConnections.length} active connection(s)...`
      );
    });

    it('should handle connections that close normally', async () => {
      const mockConnection = {
        destroy: jest.fn(),
        on: jest.fn(),
      };

      await httpServer.start();

      // Add connection
      const connectionHandler = mockServerInstance.on.mock.calls.find(
        (call: any[]) => call[0] === 'connection'
      )?.[1];
      connectionHandler(mockConnection);

      // Simulate connection close
      const closeHandler = mockConnection.on.mock.calls.find(
        (call: any[]) => call[0] === 'close'
      )?.[1];
      closeHandler();

      mockServerInstance.close.mockImplementation((callback: Function) => {
        callback();
      });

      await httpServer.stop();

      // Connection should still be destroyed even though it already closed
      expect(mockConnection.destroy).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('[HTTP Server] Closing 0 active connection(s)...');
    });
  });

  describe('Port Conflict Handling', () => {
    it('should detect port conflicts using checkPortAvailable', async () => {
      // Mock net.createServer for port checking
      const mockTester = {
        once: jest.fn().mockReturnThis(),
        listen: jest.fn().mockReturnThis(),
        close: jest.fn(),
      };

      jest.spyOn(net, 'createServer').mockReturnValue(mockTester as any);

      // Simulate port in use
      mockTester.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          setTimeout(() => handler({ code: 'EADDRINUSE' }), 0);
        }
        return mockTester;
      });

      // Start should try alternative ports
      await httpServer.start();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Port 3002 is not available')
      );
    });

    it('should try alternative ports if primary port is unavailable', async () => {
      const mockTester = {
        once: jest.fn().mockReturnThis(),
        listen: jest.fn().mockReturnThis(),
        close: jest.fn(),
      };

      jest.spyOn(net, 'createServer').mockReturnValue(mockTester as any);

      let portCheckCount = 0;
      mockTester.listen.mockImplementation((_port: number) => {
        // First port (3002) is in use, second port (3003) is available
        if (portCheckCount === 0) {
          setTimeout(() => {
            const errorHandler = mockTester.once.mock.calls.find(
              (call: any[]) => call[0] === 'error'
            )?.[1];
            errorHandler({ code: 'EADDRINUSE' });
          }, 0);
        } else if (portCheckCount === 1) {
          setTimeout(() => {
            const listeningHandler = mockTester.once.mock.calls.find(
              (call: any[]) => call[0] === 'listening'
            )?.[1];
            listeningHandler();
          }, 0);
        }
        portCheckCount++;
        return mockTester;
      });

      mockTester.close.mockImplementation((callback: Function) => {
        callback();
      });

      await httpServer.start();

      expect(logger.info).toHaveBeenCalledWith('[HTTP Server] Using alternative port 3003');
      expect(httpServer.getPort()).toBe(3003);
    });

    it('should use HTTP_SERVER_PORT environment variable if set', async () => {
      process.env['HTTP_SERVER_PORT'] = '8080';
      
      const newServer = new DaemonHttpServer(mockService, 3002);

      // Mock port as available
      const mockTester = {
        once: jest.fn().mockReturnThis(),
        listen: jest.fn().mockReturnThis(),
        close: jest.fn(),
      };

      jest.spyOn(net, 'createServer').mockReturnValue(mockTester as any);
      
      mockTester.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'listening') {
          setTimeout(() => handler(), 0);
        }
        return mockTester;
      });

      mockTester.close.mockImplementation((callback: Function) => {
        callback();
      });

      await newServer.start();

      expect(logger.info).toHaveBeenCalledWith(
        '[HTTP Server] Using port 8080 from HTTP_SERVER_PORT environment variable'
      );
      expect(newServer.getPort()).toBe(8080);
    });

    it('should handle invalid HTTP_SERVER_PORT values', async () => {
      process.env['HTTP_SERVER_PORT'] = 'invalid';
      
      const newServer = new DaemonHttpServer(mockService, 3002);

      // Mock port as available
      const mockTester = {
        once: jest.fn().mockReturnThis(),
        listen: jest.fn().mockReturnThis(),
        close: jest.fn(),
      };

      jest.spyOn(net, 'createServer').mockReturnValue(mockTester as any);
      
      mockTester.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'listening') {
          setTimeout(() => handler(), 0);
        }
        return mockTester;
      });

      mockTester.close.mockImplementation((callback: Function) => {
        callback();
      });

      await newServer.start();

      expect(logger.warn).toHaveBeenCalledWith(
        '[HTTP Server] Invalid HTTP_SERVER_PORT value: invalid, using default port 3002'
      );
      expect(newServer.getPort()).toBe(3002);
    });

    it('should throw error if no ports are available', async () => {
      const mockTester = {
        once: jest.fn().mockReturnThis(),
        listen: jest.fn().mockReturnThis(),
        close: jest.fn(),
      };

      jest.spyOn(net, 'createServer').mockReturnValue(mockTester as any);

      // All ports are in use
      mockTester.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          setTimeout(() => handler({ code: 'EADDRINUSE' }), 0);
        }
        return mockTester;
      });

      await expect(httpServer.start()).rejects.toThrow('No available ports found for HTTP server');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('No available ports found')
      );
    });
  });

  describe('Status Tracking', () => {
    it('should track startup time', async () => {
      const startTime = new Date();
      jest.spyOn(global, 'Date').mockImplementation(() => startTime as any);

      await httpServer.start();

      // Check that server is running with startup time set
      expect(httpServer.isRunning()).toBe(true);

      (global.Date as any).mockRestore();
    });

    it('should clear startup time on stop', async () => {
      await httpServer.start();
      expect(httpServer.isRunning()).toBe(true);

      mockServerInstance.close.mockImplementation((callback: Function) => {
        callback();
      });

      await httpServer.stop();
      expect(httpServer.isRunning()).toBe(false);
    });

    it('should report correct port number', () => {
      expect(httpServer.getPort()).toBe(3002);
    });
  });

  describe('Error Handling', () => {
    it('should handle EADDRINUSE error with helpful messages', async () => {
      const errorHandler = jest.fn();
      
      mockServerInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          errorHandler.mockImplementation(handler as any);
        }
        return mockServerInstance;
      });

      const startPromise = httpServer.start();

      // Trigger EADDRINUSE error
      errorHandler({ code: 'EADDRINUSE' });

      await expect(startPromise).rejects.toThrow('Port 3002 is already in use');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Port 3002 is already in use')
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Kill the process using port')
      );
    });

    it('should handle EACCES error with helpful messages', async () => {
      const errorHandler = jest.fn();
      
      mockServerInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          errorHandler.mockImplementation(handler as any);
        }
        return mockServerInstance;
      });

      const startPromise = httpServer.start();

      // Trigger EACCES error
      errorHandler({ code: 'EACCES' });

      await expect(startPromise).rejects.toThrow('Permission denied for port 3002');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied to use port')
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Use a port number above 1024')
      );
    });
  });
});