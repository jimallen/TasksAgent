import { EventEmitter } from 'events';
import * as child_process from 'child_process';

// Mock child_process module
jest.mock('child_process');

// Mock logger with proper module structure
jest.mock('../utils/logger');

// Mock config module
jest.mock('../config/config');

// Import after mocks
import { GmailMcpService } from './gmailMcpService';
import logger from '../utils/logger';
import * as config from '../config/config';

describe('GmailMcpService', () => {
  let service: GmailMcpService;
  let mockProcess: any;
  let mockSpawn: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
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
    
    // Create mock process
    mockProcess = new EventEmitter() as any;
    
    // Create stdin as EventEmitter with write method
    const stdinEmitter = new EventEmitter();
    (stdinEmitter as any).write = jest.fn((_data: any, callback?: any) => {
      if (callback) callback();
    });
    mockProcess.stdin = stdinEmitter;
    
    // Create stdout with setEncoding method
    const stdoutEmitter = new EventEmitter();
    (stdoutEmitter as any).setEncoding = jest.fn();
    mockProcess.stdout = stdoutEmitter;
    
    // Create stderr with setEncoding method  
    const stderrEmitter = new EventEmitter();
    (stderrEmitter as any).setEncoding = jest.fn();
    mockProcess.stderr = stderrEmitter;
    
    mockProcess.pid = 12345;
    mockProcess.kill = jest.fn();
    
    // Setup spawn mock
    mockSpawn = child_process.spawn as jest.Mock;
    mockSpawn.mockReturnValue(mockProcess);
    
    // Setup logger mocks
    (logger.info as jest.Mock) = jest.fn();
    (logger.warn as jest.Mock) = jest.fn();
    (logger.error as jest.Mock) = jest.fn();
    (logger.debug as jest.Mock) = jest.fn();
    
    // Create service instance
    service = new GmailMcpService({
      restartAttempts: 3,
      startupTimeout: 100,
      requestTimeout: 100
    });
  });

  afterEach(async () => {
    // Ensure service is stopped
    if (service) {
      await service.stop();
    }
  });

  describe('start()', () => {
    it('should spawn Gmail MCP process successfully', async () => {
      const startPromise = service.start();
      
      // Immediately simulate successful startup and initialization
      process.nextTick(() => {
        // First emit startup signal
        mockProcess.stdout.emit('data', Buffer.from('Gmail MCP server started\n'));
        
        // Then handle the initialize request
        process.nextTick(() => {
          const sentData = mockProcess.stdin.write.mock.calls[0]?.[0];
          if (sentData) {
            const sentRequest = JSON.parse(sentData);
            if (sentRequest.method === 'initialize') {
              const response = {
                jsonrpc: '2.0',
                result: {
                  protocolVersion: '2024-11-05',
                  capabilities: {}
                },
                id: sentRequest.id
              };
              mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));
            }
          }
        });
      });
      
      await startPromise;
      
      expect(mockSpawn).toHaveBeenCalledWith(
        'npx',
        ['@gongrzhe/server-gmail-autoauth-mcp'],
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
          env: expect.objectContaining({
            NODE_ENV: expect.any(String)
          })
        })
      );
      
      expect(service.isRunning()).toBe(true);
    });

    it('should reject if process fails to start within timeout', async () => {
      service = new GmailMcpService({
        restartAttempts: 3,
        startupTimeout: 50,
        requestTimeout: 100
      });
      
      await expect(service.start()).rejects.toThrow('Gmail MCP failed to start within timeout');
    });

    it('should handle authentication error messages', async () => {
      const startPromise = service.start();
      
      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('Authentication failed\n'));
        mockProcess.stdout.emit('data', Buffer.from('Gmail MCP server started\n'));
      }, 10);
      
      await startPromise;
      
      // Service should still start but log the error
      expect(service.isRunning()).toBe(true);
    });

    it('should not start if already running', async () => {
      const startPromise = service.start();
      
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Started\n'));
      }, 10);
      
      await startPromise;
      
      // Try to start again
      await service.start();
      
      // Should only be called once
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop()', () => {
    beforeEach(async () => {
      const startPromise = service.start();
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Started\n'));
      }, 10);
      await startPromise;
    });

    it('should stop running process gracefully', async () => {
      await service.stop();
      
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(service.isRunning()).toBe(false);
    });

    it('should clear pending requests on stop', async () => {
      // Add a pending request
      const requestPromise = service.sendRequest('test', {});
      
      // Stop the service
      await service.stop();
      
      // Request should be rejected
      await expect(requestPromise).rejects.toThrow('Gmail MCP service stopped');
    });

    it('should do nothing if not running', async () => {
      await service.stop();
      await service.stop(); // Stop again
      
      expect(mockProcess.kill).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendRequest()', () => {
    beforeEach(async () => {
      const startPromise = service.start();
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Started\n'));
      }, 10);
      await startPromise;
    });

    it('should send request and receive response', async () => {
      const responsePromise = service.sendRequest('tools/list', {});
      
      // Simulate response
      setTimeout(() => {
        // Extract the ID from the request that was sent
        const sentData = mockProcess.stdin.write.mock.calls[0][0];
        const sentRequest = JSON.parse(sentData);
        const response = {
          jsonrpc: '2.0',
          result: { tools: [] },
          id: sentRequest.id
        };
        mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));
      }, 10);
      
      const result = await responsePromise;
      
      expect(result).toEqual({ tools: [] });
      expect(mockProcess.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining('"method":"tools/list"'),
        expect.any(Function)
      );
    });

    it('should handle error responses', async () => {
      const responsePromise = service.sendRequest('invalid/method', {});
      
      // Simulate error response
      setTimeout(() => {
        // Extract the ID from the request that was sent
        const sentData = mockProcess.stdin.write.mock.calls[0][0];
        const sentRequest = JSON.parse(sentData);
        const response = {
          jsonrpc: '2.0',
          error: { code: -32601, message: 'Method not found' },
          id: sentRequest.id
        };
        mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));
      }, 10);
      
      await expect(responsePromise).rejects.toThrow('Method not found');
    });

    it('should timeout if no response received', async () => {
      await expect(service.sendRequest('slow/method', {})).rejects.toThrow('Request timeout');
    });

    it('should reject if service not running', async () => {
      await service.stop();
      
      await expect(service.sendRequest('test', {})).rejects.toThrow('Gmail MCP service not running');
    });

    it('should handle chunked JSON responses', async () => {
      const responsePromise = service.sendRequest('test', {});
      
      // Send response in chunks
      setTimeout(() => {
        // Extract the ID from the request that was sent
        const sentData = mockProcess.stdin.write.mock.calls[0][0];
        const sentRequest = JSON.parse(sentData);
        const response = JSON.stringify({
          jsonrpc: '2.0',
          result: { data: 'test' },
          id: sentRequest.id
        });
        
        // Split response into chunks
        const chunk1 = response.substring(0, 10);
        const chunk2 = response.substring(10) + '\n';
        
        mockProcess.stdout.emit('data', Buffer.from(chunk1));
        mockProcess.stdout.emit('data', Buffer.from(chunk2));
      }, 10);
      
      const result = await responsePromise;
      expect(result).toEqual({ data: 'test' });
    });
  });

  describe('process crash handling', () => {
    beforeEach(async () => {
      const startPromise = service.start();
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Started\n'));
      }, 10);
      await startPromise;
    });

    it('should restart on crash with exponential backoff', async () => {
      const restartSpy = jest.spyOn(service as any, 'handleProcessCrash');
      
      // Simulate crash
      mockProcess.emit('exit', 1, null);
      
      // Wait for restart attempt
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(restartSpy).toHaveBeenCalled();
      expect(mockSpawn).toHaveBeenCalledTimes(2); // Initial + restart
    });

    it('should stop after max restart attempts', async () => {
      service = new GmailMcpService({
        restartAttempts: 2,
        startupTimeout: 50,
        requestTimeout: 100
      });
      
      const startPromise = service.start();
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Started\n'));
      }, 10);
      await startPromise;
      
      // Simulate multiple crashes
      for (let i = 0; i < 3; i++) {
        mockProcess.emit('exit', 1, null);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Create new mock process for restart
        mockProcess = new EventEmitter() as any;
        
        const newStdin = new EventEmitter();
        (newStdin as any).write = jest.fn();
        mockProcess.stdin = newStdin;
        
        const newStdout = new EventEmitter();
        (newStdout as any).setEncoding = jest.fn();
        mockProcess.stdout = newStdout;
        
        const newStderr = new EventEmitter();
        (newStderr as any).setEncoding = jest.fn();
        mockProcess.stderr = newStderr;
        
        mockProcess.pid = 12345 + i;
        mockProcess.kill = jest.fn();
        mockSpawn.mockReturnValue(mockProcess);
        
        // Simulate startup for restart attempts
        if (i < 2) {
          setTimeout(() => {
            mockProcess.stdout.emit('data', Buffer.from('Started\n'));
          }, 10);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Should stop trying after 2 attempts
      expect(mockSpawn).toHaveBeenCalledTimes(3); // Initial + 2 restarts
    });

    it('should reset restart count after successful operation', async () => {
      // Make a successful request
      const responsePromise = service.sendRequest('test', {});
      
      setTimeout(() => {
        // Extract the ID from the request that was sent
        const sentData = mockProcess.stdin.write.mock.calls[0][0];
        const sentRequest = JSON.parse(sentData);
        const response = {
          jsonrpc: '2.0',
          result: { success: true },
          id: sentRequest.id
        };
        mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));
      }, 10);
      
      await responsePromise;
      
      // Restart count should be reset
      expect((service as any).restartCount).toBe(0);
    });
  });

  describe('getStatus()', () => {
    it('should return not running status when stopped', () => {
      const status = service.getStatus();
      
      expect(status).toEqual({
        running: false,
        pid: null,
        requestCount: 0,
        restartCount: 0,
        lastError: null
      });
    });

    it('should return running status when started', async () => {
      const startPromise = service.start();
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Started\n'));
      }, 10);
      await startPromise;
      
      const status = service.getStatus();
      
      expect(status).toEqual({
        running: true,
        pid: 12345,
        requestCount: 0,
        restartCount: 0,
        lastError: null
      });
    });

    it('should track request count', async () => {
      const startPromise = service.start();
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Started\n'));
      }, 10);
      await startPromise;
      
      // Make a request
      const requestPromise = service.sendRequest('test', {});
      
      setTimeout(() => {
        // Extract the ID from the request that was sent
        const sentData = mockProcess.stdin.write.mock.calls[0][0];
        const sentRequest = JSON.parse(sentData);
        const response = {
          jsonrpc: '2.0',
          result: {},
          id: sentRequest.id
        };
        mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));
      }, 10);
      
      await requestPromise;
      
      const status = service.getStatus();
      expect(status.requestCount).toBe(1);
    });
  });

  describe('event emissions', () => {
    it('should emit started event', async () => {
      const startedHandler = jest.fn();
      service.on('started', startedHandler);
      
      const startPromise = service.start();
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Started\n'));
      }, 10);
      await startPromise;
      
      expect(startedHandler).toHaveBeenCalled();
    });

    it('should emit stopped event', async () => {
      const stoppedHandler = jest.fn();
      service.on('stopped', stoppedHandler);
      
      const startPromise = service.start();
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Started\n'));
      }, 10);
      await startPromise;
      
      await service.stop();
      
      expect(stoppedHandler).toHaveBeenCalled();
    });

    it('should emit error event', async () => {
      const errorHandler = jest.fn();
      service.on('error', errorHandler);
      
      const startPromise = service.start();
      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('Error: Authentication failed\n'));
        mockProcess.stdout.emit('data', Buffer.from('Started\n'));
      }, 10);
      await startPromise;
      
      expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Authentication')
      }));
    });

    it('should emit crashed event', async () => {
      const crashedHandler = jest.fn();
      service.on('crashed', crashedHandler);
      
      const startPromise = service.start();
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Started\n'));
      }, 10);
      await startPromise;
      
      mockProcess.emit('exit', 1, null);
      
      expect(crashedHandler).toHaveBeenCalledWith(1, null);
    });
  });

  describe('Port Configuration', () => {
    it('should use port from configuration system', () => {
      // Service constructor should read port from config
      const testService = new GmailMcpService();
      expect(config.getResolvedPorts).toHaveBeenCalled();
      expect(testService.getPort()).toBe(3000);
    });

    it('should pass configured port to child process via environment variables', async () => {
      (config.getResolvedPorts as jest.Mock).mockReturnValue({
        httpServer: 3002,
        gmailMcp: 8080
      });

      const testService = new GmailMcpService();
      const startPromise = testService.start();
      
      // Simulate successful startup
      process.nextTick(() => {
        mockProcess.stdout.emit('data', Buffer.from('Started\n'));
        process.nextTick(() => {
          const sentData = mockProcess.stdin.write.mock.calls[0]?.[0];
          if (sentData) {
            const sentRequest = JSON.parse(sentData);
            if (sentRequest.method === 'initialize') {
              const response = {
                jsonrpc: '2.0',
                result: { protocolVersion: '2024-11-05' },
                id: sentRequest.id
              };
              mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));
            }
          }
        });
      });
      
      await startPromise;

      // Verify spawn was called with correct environment variables
      expect(mockSpawn).toHaveBeenCalledWith(
        'npx',
        ['@gongrzhe/server-gmail-autoauth-mcp'],
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '8080',
            GMAIL_MCP_PORT: '8080',
            MCP_PORT: '8080'
          })
        })
      );
    });

    it('should use port from CLI argument when configured', async () => {
      (config.getPortConfigDetails as jest.Mock).mockReturnValue({
        httpServer: {
          source: 'DEFAULT',
          allSources: [{ source: 'DEFAULT', value: 3002, priority: 0 }]
        },
        gmailMcp: {
          source: 'CLI_ARGUMENT',
          allSources: [
            { source: 'CLI_ARGUMENT', value: 9000, priority: 2 },
            { source: 'ENVIRONMENT', value: 3000, priority: 1 },
            { source: 'DEFAULT', value: 3000, priority: 0 }
          ]
        }
      });

      (config.getResolvedPorts as jest.Mock).mockReturnValue({
        httpServer: 3002,
        gmailMcp: 9000
      });

      const testService = new GmailMcpService();
      expect(testService.getPort()).toBe(9000);
      
      // Verify logging includes port source
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('[GmailMCP] Service initialized'),
        expect.objectContaining({
          port: 9000,
          portSource: 'CLI_ARGUMENT'
        })
      );
    });

    it('should re-read port configuration on each start', async () => {
      const testService = new GmailMcpService();
      
      // First start with port 3000
      (config.getResolvedPorts as jest.Mock).mockReturnValue({
        httpServer: 3002,
        gmailMcp: 3000
      });
      
      let startPromise = testService.start();
      process.nextTick(() => {
        mockProcess.stdout.emit('data', Buffer.from('Started\n'));
        process.nextTick(() => {
          const sentData = mockProcess.stdin.write.mock.calls[0]?.[0];
          if (sentData) {
            const sentRequest = JSON.parse(sentData);
            const response = {
              jsonrpc: '2.0',
              result: { protocolVersion: '2024-11-05' },
              id: sentRequest.id
            };
            mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));
          }
        });
      });
      await startPromise;
      
      expect(mockSpawn).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '3000'
          })
        })
      );
      
      await testService.stop();
      
      // Change port configuration
      (config.getResolvedPorts as jest.Mock).mockReturnValue({
        httpServer: 3002,
        gmailMcp: 4000
      });
      
      // Start again with new port
      startPromise = testService.start();
      process.nextTick(() => {
        mockProcess.stdout.emit('data', Buffer.from('Started\n'));
        process.nextTick(() => {
          const sentData = mockProcess.stdin.write.mock.calls[0]?.[0];
          if (sentData) {
            const sentRequest = JSON.parse(sentData);
            const response = {
              jsonrpc: '2.0',
              result: { protocolVersion: '2024-11-05' },
              id: sentRequest.id
            };
            mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));
          }
        });
      });
      await startPromise;
      
      expect(mockSpawn).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '4000'
          })
        })
      );
    });

    it('should handle port conflict errors with CLI parameter guidance', async () => {
      const testService = new GmailMcpService();
      const startPromise = testService.start();
      
      // Simulate port conflict error
      process.nextTick(() => {
        const error: any = new Error('Port already in use');
        error.code = 'EADDRINUSE';
        mockProcess.emit('error', error);
      });
      
      await expect(startPromise).rejects.toThrow();
      
      // Verify error messages include CLI parameters
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Use --gmail-mcp-port <port> CLI argument')
      );
    });

    it('should detect port conflicts in stderr output', async () => {
      const testService = new GmailMcpService();
      const startPromise = testService.start();
      
      // Simulate stderr with port conflict message
      process.nextTick(() => {
        mockProcess.stderr.emit('data', 'Error: EADDRINUSE: address already in use :::3000\n');
      });
      
      await expect(startPromise).rejects.toThrow('Gmail MCP port 3000 is already in use');
      
      // Verify helpful error messages
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Port conflict detected on port 3000')
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Use --gmail-mcp-port <port> CLI argument')
      );
    });

    it('should handle permission denied errors for privileged ports', async () => {
      (config.getResolvedPorts as jest.Mock).mockReturnValue({
        httpServer: 3002,
        gmailMcp: 80  // Privileged port
      });

      const testService = new GmailMcpService();
      const startPromise = testService.start();
      
      // Simulate permission denied error
      process.nextTick(() => {
        const error: any = new Error('Permission denied');
        error.code = 'EACCES';
        mockProcess.emit('error', error);
      });
      
      await expect(startPromise).rejects.toThrow();
      
      // Verify error messages
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied to use port 80')
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Use --gmail-mcp-port <port> CLI argument')
      );
    });

    it('should pass auth path via environment variable', async () => {
      const testService = new GmailMcpService({
        authPath: '/custom/auth/path'
      });
      
      const startPromise = testService.start();
      
      // Simulate successful startup
      process.nextTick(() => {
        mockProcess.stdout.emit('data', Buffer.from('Started\n'));
        process.nextTick(() => {
          const sentData = mockProcess.stdin.write.mock.calls[0]?.[0];
          if (sentData) {
            const response = {
              jsonrpc: '2.0',
              result: { protocolVersion: '2024-11-05' },
              id: JSON.parse(sentData).id
            };
            mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n'));
          }
        });
      });
      
      await startPromise;
      
      // Verify auth path was passed
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            GMAIL_AUTH_PATH: '/custom/auth/path'
          })
        })
      );
    });
  });
});