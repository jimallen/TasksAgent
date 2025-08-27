import { DaemonHttpServer } from './httpServer';
import { DaemonService } from './service';
import { GmailMcpService } from './gmailMcpService';
import express from 'express';
import * as net from 'net';
import logger from '../utils/logger';
import * as config from '../config/config';
import * as portValidator from '../cli/portValidator';

jest.mock('./service');
jest.mock('./gmailMcpService');
jest.mock('../utils/logger');
jest.mock('../config/config');
jest.mock('../cli/portValidator');

describe('DaemonHttpServer', () => {
  let httpServer: DaemonHttpServer;
  let mockService: jest.Mocked<DaemonService>;
  let mockGmailMcp: jest.Mocked<GmailMcpService>;
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
    } as unknown as jest.Mocked<DaemonService>;

    // Mock Gmail MCP service
    mockGmailMcp = {
      isRunning: jest.fn().mockReturnValue(true),
      getStatus: jest.fn().mockReturnValue({
        running: true,
        pid: 12345,
        requestCount: 10,
        restartCount: 0,
        lastError: null,
      }),
      sendRequest: jest.fn().mockResolvedValue({ result: 'test' }),
      on: jest.fn(),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<GmailMcpService>;

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
    (express as unknown as jest.Mock).mockReturnValue(mockExpressApp);

    mockExpressApp.listen.mockImplementation((_port: number, callback: Function) => {
      callback();
      return mockServerInstance;
    });

    // Mock configuration functions
    (config.getResolvedPorts as jest.Mock) = jest.fn().mockReturnValue({
      httpServer: 3002,
      gmailMcp: 3000
    });
    
    (config.getPortConfigDetails as jest.Mock) = jest.fn().mockReturnValue({
      httpServer: {
        source: 'DEFAULT',
        allSources: [{ source: 'DEFAULT', value: 3002, priority: 0 }]
      },
      gmailMcp: {
        source: 'DEFAULT',
        allSources: [{ source: 'DEFAULT', value: 3000, priority: 0 }]
      }
    });
    
    // Mock port validation functions
    (portValidator.isPortInValidRange as jest.Mock) = jest.fn().mockImplementation(
      (port: number) => port >= 1024 && port <= 65535
    );
    
    (portValidator.suggestAlternativePorts as jest.Mock) = jest.fn().mockReturnValue(
      [3003, 3004, 3005, 8080, 8081]
    );

    httpServer = new DaemonHttpServer(mockService, mockGmailMcp);
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

      jest.spyOn(net, 'createServer').mockReturnValue(mockTester as unknown as net.Server);

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

      jest.spyOn(net, 'createServer').mockReturnValue(mockTester as unknown as net.Server);

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
      
      const newServer = new DaemonHttpServer(mockService, mockGmailMcp);

      // Mock port as available
      const mockTester = {
        once: jest.fn().mockReturnThis(),
        listen: jest.fn().mockReturnThis(),
        close: jest.fn(),
      };

      jest.spyOn(net, 'createServer').mockReturnValue(mockTester as unknown as net.Server);
      
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
      
      const newServer = new DaemonHttpServer(mockService, mockGmailMcp);

      // Mock port as available
      const mockTester = {
        once: jest.fn().mockReturnThis(),
        listen: jest.fn().mockReturnThis(),
        close: jest.fn(),
      };

      jest.spyOn(net, 'createServer').mockReturnValue(mockTester as unknown as net.Server);
      
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

      jest.spyOn(net, 'createServer').mockReturnValue(mockTester as unknown as net.Server);

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
      jest.spyOn(global, 'Date').mockImplementation(() => startTime as unknown as string);

      await httpServer.start();

      // Check that server is running with startup time set
      expect(httpServer.isRunning()).toBe(true);

      (global.Date as unknown as jest.SpyInstance).mockRestore();
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
          errorHandler.mockImplementation(handler as (...args: unknown[]) => unknown);
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
          errorHandler.mockImplementation(handler as (...args: unknown[]) => unknown);
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

  describe('Gmail MCP Endpoints', () => {
    beforeEach(async () => {
      // Setup route handlers
      const handlers: { [key: string]: any } = {};
      
      mockExpressApp.get.mockImplementation((path: string, ...middlewares: any[]) => {
        const handler = middlewares[middlewares.length - 1];
        handlers[`GET ${path}`] = handler;
      });
      
      mockExpressApp.post.mockImplementation((path: string, ...middlewares: any[]) => {
        const handler = middlewares[middlewares.length - 1];
        handlers[`POST ${path}`] = handler;
      });
      
      await httpServer.start();
      
      // Store handlers for testing
      (httpServer as any).testHandlers = handlers;
    });

    it('should handle GET /gmail/health endpoint', async () => {
      const req = {};
      const res = {
        json: jest.fn(),
      };
      
      const handler = (httpServer as any).testHandlers['GET /gmail/health'];
      await handler(req, res);
      
      expect(res.json).toHaveBeenCalledWith({
        status: 'healthy',
        gmailMcp: {
          running: true,
          pid: 12345,
          requestCount: 10,
          restartCount: 0,
          lastError: null,
        },
      });
    });

    it('should handle Gmail MCP not running in health check', async () => {
      mockGmailMcp.getStatus.mockReturnValue({
        running: false,
        pid: null,
        requestCount: 0,
        restartCount: 0,
        lastError: 'Authentication failed',
      });
      
      const req = {};
      const res = {
        json: jest.fn(),
      };
      
      const handler = (httpServer as any).testHandlers['GET /gmail/health'];
      await handler(req, res);
      
      expect(res.json).toHaveBeenCalledWith({
        status: 'unhealthy',
        gmailMcp: {
          running: false,
          pid: null,
          requestCount: 0,
          restartCount: 0,
          lastError: 'Authentication failed',
        },
      });
    });

    it('should handle POST /gmail/search endpoint', async () => {
      mockGmailMcp.sendRequest.mockResolvedValue({
        emails: [
          { id: '1', subject: 'Test Email' },
        ],
      });
      
      const req = {
        body: {
          query: 'subject:meeting',
          maxResults: 10,
        },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      
      const handler = (httpServer as any).testHandlers['POST /gmail/search'];
      await handler(req, res);
      
      expect(mockGmailMcp.sendRequest).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'search_emails',
          arguments: {
            query: 'subject:meeting',
            maxResults: 10,
          },
        },
        id: expect.any(String),
      });
      
      expect(res.json).toHaveBeenCalledWith({
        emails: [
          { id: '1', subject: 'Test Email' },
        ],
      });
    });

    it('should handle POST /gmail/read endpoint', async () => {
      mockGmailMcp.sendRequest.mockResolvedValue({
        email: {
          id: '123',
          subject: 'Test Email',
          body: 'Email content',
        },
      });
      
      const req = {
        body: {
          id: '123',
        },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      
      const handler = (httpServer as any).testHandlers['POST /gmail/read'];
      await handler(req, res);
      
      expect(mockGmailMcp.sendRequest).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'read_email',
          arguments: {
            id: '123',
          },
        },
        id: expect.any(String),
      });
      
      expect(res.json).toHaveBeenCalledWith({
        email: {
          id: '123',
          subject: 'Test Email',
          body: 'Email content',
        },
      });
    });

    it('should handle POST /gmail/mcp endpoint for generic commands', async () => {
      mockGmailMcp.sendRequest.mockResolvedValue({
        tools: ['search_emails', 'read_email'],
      });
      
      const req = {
        body: {
          method: 'tools/list',
          params: {},
        },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      
      const handler = (httpServer as any).testHandlers['POST /gmail/mcp'];
      await handler(req, res);
      
      expect(mockGmailMcp.sendRequest).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: expect.any(String),
      });
      
      expect(res.json).toHaveBeenCalledWith({
        tools: ['search_emails', 'read_email'],
      });
    });

    it('should handle Gmail MCP errors gracefully', async () => {
      mockGmailMcp.sendRequest.mockRejectedValue(new Error('Gmail MCP error'));
      
      const req = {
        body: {
          query: 'test',
        },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      
      const handler = (httpServer as any).testHandlers['POST /gmail/search'];
      await handler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Gmail MCP error',
      });
    });

    it('should validate required parameters', async () => {
      const req = {
        body: {}, // Missing required params
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      
      const handler = (httpServer as any).testHandlers['POST /gmail/mcp'];
      await handler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing required parameter: method',
      });
    });

    it('should handle GET /gmail/status endpoint', async () => {
      mockGmailMcp.getStatus.mockReturnValue({
        running: true,
        pid: 12345,
        requestCount: 25,
        restartCount: 1,
        lastError: null,
      });
      
      const req = {};
      const res = {
        json: jest.fn(),
      };
      
      const handler = (httpServer as any).testHandlers['GET /gmail/status'];
      await handler(req, res);
      
      expect(res.json).toHaveBeenCalledWith({
        running: true,
        pid: 12345,
        requestCount: 25,
        restartCount: 1,
        lastError: null,
        uptime: expect.any(Number),
      });
    });
  });

  describe('Configuration-based Port Management', () => {
    it('should use port from configuration system', async () => {
      // Mock configuration to return custom port
      (config.getResolvedPorts as jest.Mock).mockReturnValue({
        httpServer: 8080,
        gmailMcp: 3000
      });
      
      (config.getPortConfigDetails as jest.Mock).mockReturnValue({
        httpServer: {
          source: 'CLI_ARGUMENT',
          allSources: [
            { source: 'CLI_ARGUMENT', value: 8080, priority: 2 },
            { source: 'ENVIRONMENT', value: 3002, priority: 1 },
            { source: 'DEFAULT', value: 3002, priority: 0 }
          ]
        },
        gmailMcp: {
          source: 'DEFAULT',
          allSources: [{ source: 'DEFAULT', value: 3000, priority: 0 }]
        }
      });

      const testServer = new DaemonHttpServer(mockService, mockGmailMcp);
      await testServer.start();

      // Verify it used port 8080
      expect(mockExpressApp.listen).toHaveBeenCalledWith(8080, expect.any(Function));
      expect(logger.info).toHaveBeenCalledWith(
        '[HTTP Server] Starting with port 8080 from CLI_ARGUMENT'
      );
    });

    it('should log all configuration sources when multiple exist', async () => {
      (config.getPortConfigDetails as jest.Mock).mockReturnValue({
        httpServer: {
          source: 'ENVIRONMENT',
          allSources: [
            { source: 'ENVIRONMENT', value: 4000, priority: 1 },
            { source: 'DEFAULT', value: 3002, priority: 0 }
          ]
        },
        gmailMcp: {
          source: 'DEFAULT',
          allSources: [{ source: 'DEFAULT', value: 3000, priority: 0 }]
        }
      });

      await httpServer.start();

      expect(logger.debug).toHaveBeenCalledWith('[HTTP Server] Configuration sources:');
      expect(logger.debug).toHaveBeenCalledWith('  - ENVIRONMENT: 4000 (priority: 1)');
      expect(logger.debug).toHaveBeenCalledWith('  - DEFAULT: 3002 (priority: 0)');
    });

    it('should use intelligent port suggestions when port is unavailable', async () => {
      // Mock port unavailable
      const mockTester = {
        once: jest.fn().mockReturnThis(),
        listen: jest.fn().mockReturnThis(),
        close: jest.fn()
      };
      
      let portCheckCount = 0;
      (net.createServer as jest.Mock) = jest.fn().mockImplementation(() => {
        const tester = { ...mockTester };
        tester.once = jest.fn((event: string, callback: Function) => {
          if (event === 'error' && portCheckCount === 0) {
            // First port (3002) is unavailable
            portCheckCount++;
            callback({ code: 'EADDRINUSE' });
          } else if (event === 'listening') {
            // Second port (3003) is available
            callback();
          }
          return tester;
        });
        return tester;
      });

      (portValidator.suggestAlternativePorts as jest.Mock).mockReturnValue([3003, 3004, 8080]);

      await httpServer.start();

      expect(portValidator.suggestAlternativePorts).toHaveBeenCalledWith(3002, [3002, 3000]);
      expect(logger.info).toHaveBeenCalledWith('[HTTP Server] Using alternative port 3003');
    });

    it('should avoid conflicts with Gmail MCP port when suggesting alternatives', async () => {
      (config.getResolvedPorts as jest.Mock).mockReturnValue({
        httpServer: 3000, // Same as Gmail MCP!
        gmailMcp: 3000
      });

      // Mock all ports unavailable to trigger suggestion logic
      (net.createServer as jest.Mock) = jest.fn().mockImplementation(() => {
        const tester: any = {
          once: jest.fn((event: string, callback: Function): any => {
            if (event === 'error') {
              callback({ code: 'EADDRINUSE' });
            }
            return tester;
          }),
          listen: jest.fn().mockReturnThis(),
          close: jest.fn()
        };
        return tester;
      });

      await expect(httpServer.start()).rejects.toThrow('No available ports found');
      
      // Verify it passed the correct used ports to suggestion function
      expect(portValidator.suggestAlternativePorts).toHaveBeenCalledWith(3000, [3000, 3000]);
    });

    it('should validate port ranges using portValidator', async () => {
      // Mock port check to trigger alternative selection
      let checkCount = 0;
      (net.createServer as jest.Mock) = jest.fn().mockImplementation(() => {
        const tester: any = {
          once: jest.fn((event: string, callback: Function): any => {
            if (event === 'error' && checkCount < 2) {
              checkCount++;
              callback({ code: 'EADDRINUSE' });
            } else if (event === 'listening') {
              callback();
            }
            return tester;
          }),
          listen: jest.fn().mockReturnThis(),
          close: jest.fn()
        };
        return tester;
      });

      await httpServer.start();

      // Verify isPortInValidRange was called for alternative ports
      expect(portValidator.isPortInValidRange).toHaveBeenCalled();
    });

    it('should show enhanced error messages with configuration options', async () => {
      // Mock all ports unavailable
      (net.createServer as jest.Mock) = jest.fn().mockImplementation(() => {
        const tester: any = {
          once: jest.fn((event: string, callback: Function): any => {
            if (event === 'error') {
              callback({ code: 'EADDRINUSE' });
            }
            return tester;
          }),
          listen: jest.fn().mockReturnThis(),
          close: jest.fn()
        };
        return tester;
      });

      (portValidator.suggestAlternativePorts as jest.Mock).mockReturnValue([3003, 3004]);
      
      await expect(httpServer.start()).rejects.toThrow('No available ports found');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Use --http-port <port> CLI argument or set HTTP_SERVER_PORT=<port> environment variable')
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Check if Gmail MCP is conflicting on port 3000')
      );
    });

    it('should handle server without Gmail MCP service', async () => {
      const serverWithoutGmail = new DaemonHttpServer(mockService);
      await serverWithoutGmail.start();

      expect(mockExpressApp.get).not.toHaveBeenCalledWith('/gmail/health', expect.any(Function));
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Gmail MCP endpoints')
      );
    });
  });

  describe('Enhanced Error Messages with CLI Parameters', () => {
    let errorHandler: Function;

    beforeEach(() => {
      // Capture the error handler
      mockServerInstance.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          errorHandler = handler;
        }
        return mockServerInstance;
      });
    });

    it('should mention CLI parameters in EADDRINUSE error', async () => {
      const startPromise = httpServer.start();
      
      // Wait for server to start listening
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Trigger EADDRINUSE error
      errorHandler({ code: 'EADDRINUSE' });

      await expect(startPromise).rejects.toThrow('Port 3002 is already in use');

      // Check all error messages mention CLI parameters
      expect(logger.error).toHaveBeenCalledWith(
        '[HTTP Server] Port 3002 is already in use'
      );
      expect(logger.error).toHaveBeenCalledWith(
        '[HTTP Server]   2. Use --http-port <port> CLI argument or set HTTP_SERVER_PORT environment variable'
      );
    });

    it('should mention CLI parameters in EACCES error', async () => {
      // Set port to a privileged port
      (config.getResolvedPorts as jest.Mock).mockReturnValue({
        httpServer: 80,
        gmailMcp: 3000
      });

      const testServer = new DaemonHttpServer(mockService, mockGmailMcp);
      const startPromise = testServer.start();
      
      // Wait for server to start listening
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Trigger EACCES error
      errorHandler({ code: 'EACCES' });

      await expect(startPromise).rejects.toThrow('Permission denied for port 80');

      expect(logger.error).toHaveBeenCalledWith(
        '[HTTP Server] Permission denied to use port 80'
      );
      expect(logger.error).toHaveBeenCalledWith(
        '[HTTP Server]   2. Use --http-port <port> CLI argument or set HTTP_SERVER_PORT=<port> environment variable'
      );
    });

    it('should mention CLI parameters in generic error', async () => {
      const startPromise = httpServer.start();
      
      // Wait for server to start listening
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Trigger generic error
      errorHandler({ code: 'UNKNOWN', message: 'Something went wrong' });

      await expect(startPromise).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected error starting on port 3002')
      );
      expect(logger.error).toHaveBeenCalledWith(
        '[HTTP Server]   2. Try a different port with --http-port CLI argument or HTTP_SERVER_PORT environment variable'
      );
    });

    it('should include Gmail MCP conflict info when no ports available', async () => {
      // Mock all ports unavailable
      (net.createServer as jest.Mock) = jest.fn().mockImplementation(() => {
        const tester: any = {
          once: jest.fn((event: string, callback: Function): any => {
            if (event === 'error') {
              callback({ code: 'EADDRINUSE' });
            }
            return tester;
          }),
          listen: jest.fn().mockReturnThis(),
          close: jest.fn()
        };
        return tester;
      });

      (portValidator.suggestAlternativePorts as jest.Mock).mockReturnValue([]);

      await expect(httpServer.start()).rejects.toThrow('No available ports found');

      expect(logger.error).toHaveBeenCalledWith(
        '[HTTP Server]   3. Check if Gmail MCP is conflicting on port 3000'
      );
    });

    it('should show correct source in log messages based on configuration', async () => {
      (config.getPortConfigDetails as jest.Mock).mockReturnValue({
        httpServer: {
          source: 'CLI_ARGUMENT',
          allSources: [
            { source: 'CLI_ARGUMENT', value: 4000, priority: 2 }
          ]
        },
        gmailMcp: {
          source: 'ENVIRONMENT',
          allSources: [
            { source: 'ENVIRONMENT', value: 3001, priority: 1 }
          ]
        }
      });

      (config.getResolvedPorts as jest.Mock).mockReturnValue({
        httpServer: 4000,
        gmailMcp: 3001
      });

      const cliServer = new DaemonHttpServer(mockService, mockGmailMcp);
      await cliServer.start();

      expect(logger.info).toHaveBeenCalledWith(
        '[HTTP Server] Starting with port 4000 from CLI_ARGUMENT'
      );
    });

    it('should show network/filesystem error with CLI parameter guidance', async () => {
      const startPromise = httpServer.start();
      
      // Wait for server to start listening
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Trigger network error
      errorHandler({ code: 'ENOTFOUND', message: 'Network error' });

      await expect(startPromise).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        '[HTTP Server] Network or filesystem error: Network error'
      );
      // This error doesn't mention ports but let's verify it completes properly
      expect(logger.error).toHaveBeenCalledWith(
        '[HTTP Server]   3. Restart the daemon service'
      );
    });
  });
});