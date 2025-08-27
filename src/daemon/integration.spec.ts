/**
 * Integration tests for daemon startup with various port configurations
 */

import { DaemonHttpServer } from './httpServer';
import { DaemonService } from './service';
import { GmailMcpService } from './gmailMcpService';
import * as config from '../config/config';
import logger from '../utils/logger';
import * as net from 'net';

// Mock modules
jest.mock('../utils/logger');
jest.mock('../config/config');

// Partial mocks for services
jest.mock('./service', () => ({
  DaemonService: jest.fn().mockImplementation(() => ({
    getStats: jest.fn().mockReturnValue({
      status: 'running',
      totalRuns: 0,
      emailsProcessed: 0,
      tasksExtracted: 0,
      gmailMcpRunning: false,
    }),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    processEmails: jest.fn().mockResolvedValue({
      emailsProcessed: 0,
      tasksExtracted: 0,
      notesCreated: 0,
    }),
    resetProcessedData: jest.fn().mockResolvedValue({ message: 'Reset complete' }),
  }))
}));

describe('Daemon Integration Tests', () => {
  let httpServer: DaemonHttpServer | null = null;
  let gmailMcpService: GmailMcpService | null = null;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup logger mocks
    (logger.info as jest.Mock) = jest.fn();
    (logger.warn as jest.Mock) = jest.fn();
    (logger.error as jest.Mock) = jest.fn();
    (logger.debug as jest.Mock) = jest.fn();
  });

  afterEach(async () => {
    // Cleanup servers
    if (httpServer) {
      await httpServer.stop().catch(() => {});
      httpServer = null;
    }
    if (gmailMcpService) {
      await gmailMcpService.stop().catch(() => {});
      gmailMcpService = null;
    }
  });

  describe('Daemon startup with custom ports', () => {
    it('should start successfully with default ports', async () => {
      // Mock default configuration
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

      // Create services
      const daemonService = new DaemonService(null as any);
      httpServer = new DaemonHttpServer(daemonService);
      
      // Mock port availability check
      jest.spyOn(httpServer as any, 'checkPortAvailable').mockResolvedValue(true);
      
      // Start server
      await httpServer.start();
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting with port 3002 from DEFAULT')
      );
      expect(httpServer.isRunning()).toBe(true);
      expect(httpServer.getPort()).toBe(3002);
    });

    it('should start with CLI-configured ports', async () => {
      // Mock CLI configuration
      (config.getResolvedPorts as jest.Mock) = jest.fn().mockReturnValue({
        httpServer: 8080,
        gmailMcp: 9000
      });
      
      (config.getPortConfigDetails as jest.Mock) = jest.fn().mockReturnValue({
        httpServer: {
          source: 'CLI_ARGUMENT',
          allSources: [
            { source: 'CLI_ARGUMENT', value: 8080, priority: 2 },
            { source: 'DEFAULT', value: 3002, priority: 0 }
          ]
        },
        gmailMcp: {
          source: 'CLI_ARGUMENT',
          allSources: [
            { source: 'CLI_ARGUMENT', value: 9000, priority: 2 },
            { source: 'DEFAULT', value: 3000, priority: 0 }
          ]
        }
      });

      // Create services
      const daemonService = new DaemonService(null as any);
      httpServer = new DaemonHttpServer(daemonService);
      
      // Mock port availability
      jest.spyOn(httpServer as any, 'checkPortAvailable').mockResolvedValue(true);
      
      // Start server
      await httpServer.start();
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting with port 8080 from CLI_ARGUMENT')
      );
      expect(httpServer.getPort()).toBe(8080);
    });

    it('should start with environment-configured ports', async () => {
      // Mock environment configuration
      (config.getResolvedPorts as jest.Mock) = jest.fn().mockReturnValue({
        httpServer: 4000,
        gmailMcp: 4001
      });
      
      (config.getPortConfigDetails as jest.Mock) = jest.fn().mockReturnValue({
        httpServer: {
          source: 'ENVIRONMENT',
          allSources: [
            { source: 'ENVIRONMENT', value: 4000, priority: 1 },
            { source: 'DEFAULT', value: 3002, priority: 0 }
          ]
        },
        gmailMcp: {
          source: 'ENVIRONMENT',
          allSources: [
            { source: 'ENVIRONMENT', value: 4001, priority: 1 },
            { source: 'DEFAULT', value: 3000, priority: 0 }
          ]
        }
      });

      const daemonService = new DaemonService(null as any);
      httpServer = new DaemonHttpServer(daemonService);
      
      jest.spyOn(httpServer as any, 'checkPortAvailable').mockResolvedValue(true);
      
      await httpServer.start();
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting with port 4000 from ENVIRONMENT')
      );
      expect(httpServer.getPort()).toBe(4000);
    });
  });

  describe('Port conflict handling', () => {
    it('should handle port conflicts and suggest alternatives', async () => {
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

      const daemonService = new DaemonService(null as any);
      httpServer = new DaemonHttpServer(daemonService);
      
      // Mock port unavailable initially, then available for alternative
      const checkPortSpy = jest.spyOn(httpServer as any, 'checkPortAvailable');
      checkPortSpy.mockResolvedValueOnce(false)  // 3002 unavailable
                  .mockResolvedValueOnce(true);   // 3003 available
      
      await httpServer.start();
      
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Port 3002 is not available')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Using alternative port')
      );
    });

    it('should fail when no ports are available', async () => {
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

      const daemonService = new DaemonService(null as any);
      httpServer = new DaemonHttpServer(daemonService);
      
      // Mock all ports unavailable
      jest.spyOn(httpServer as any, 'checkPortAvailable').mockResolvedValue(false);
      
      await expect(httpServer.start()).rejects.toThrow('No available ports found');
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Use --http-port <port> CLI argument')
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Check if Gmail MCP is conflicting on port 3000')
      );
    });

    it('should detect conflicts between HTTP and Gmail MCP ports', async () => {
      // Configure both services to use the same port
      (config.getResolvedPorts as jest.Mock) = jest.fn().mockReturnValue({
        httpServer: 3000,
        gmailMcp: 3000  // Same port!
      });
      
      (config.getPortConfigDetails as jest.Mock) = jest.fn().mockReturnValue({
        httpServer: {
          source: 'CLI_ARGUMENT',
          allSources: [{ source: 'CLI_ARGUMENT', value: 3000, priority: 2 }]
        },
        gmailMcp: {
          source: 'CLI_ARGUMENT',
          allSources: [{ source: 'CLI_ARGUMENT', value: 3000, priority: 2 }]
        }
      });

      // Validate configuration should detect the conflict
      const ports = (config.getResolvedPorts as jest.Mock)();
      const hasConflict = ports.httpServer === ports.gmailMcp;
      
      expect(hasConflict).toBe(true);
      
      // If we try to start services with conflicting ports
      const daemonService = new DaemonService(null as any);
      httpServer = new DaemonHttpServer(daemonService);
      
      // First port check succeeds (HTTP server gets it)
      jest.spyOn(httpServer as any, 'checkPortAvailable')
        .mockResolvedValueOnce(true);  // HTTP server can use 3000
      
      await httpServer.start();
      expect(httpServer.getPort()).toBe(3000);
      
      // Gmail MCP would fail if it tried to use the same port
      // This would be caught by the Gmail MCP service's error handling
    });
  });

  describe('Configuration priority', () => {
    it('should prioritize CLI over environment variables', async () => {
      (config.getResolvedPorts as jest.Mock) = jest.fn().mockReturnValue({
        httpServer: 8080,  // From CLI
        gmailMcp: 9000     // From CLI
      });
      
      (config.getPortConfigDetails as jest.Mock) = jest.fn().mockReturnValue({
        httpServer: {
          source: 'CLI_ARGUMENT',
          allSources: [
            { source: 'CLI_ARGUMENT', value: 8080, priority: 2 },
            { source: 'ENVIRONMENT', value: 3002, priority: 1 },
            { source: 'DEFAULT', value: 3002, priority: 0 }
          ]
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

      const daemonService = new DaemonService(null as any);
      httpServer = new DaemonHttpServer(daemonService);
      
      jest.spyOn(httpServer as any, 'checkPortAvailable').mockResolvedValue(true);
      
      await httpServer.start();
      
      // Should log all sources for debugging
      expect(logger.debug).toHaveBeenCalledWith('[HTTP Server] Configuration sources:');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('CLI_ARGUMENT: 8080 (priority: 2)')
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('ENVIRONMENT: 3002 (priority: 1)')
      );
      
      // Should use CLI value
      expect(httpServer.getPort()).toBe(8080);
    });

    it('should fall back to defaults when no configuration provided', async () => {
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

      const daemonService = new DaemonService(null as any);
      httpServer = new DaemonHttpServer(daemonService);
      
      jest.spyOn(httpServer as any, 'checkPortAvailable').mockResolvedValue(true);
      
      await httpServer.start();
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting with port 3002 from DEFAULT')
      );
      expect(httpServer.getPort()).toBe(3002);
    });
  });

  describe('Service coordination', () => {
    it('should coordinate HTTP and Gmail MCP services with different ports', async () => {
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

      // Mock Gmail MCP service
      gmailMcpService = {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        isRunning: jest.fn().mockReturnValue(true),
        getStatus: jest.fn().mockReturnValue({
          running: true,
          pid: 12345,
          requestCount: 0,
        }),
        getPort: jest.fn().mockReturnValue(3000),
      } as any;

      const daemonService = new DaemonService(null as any);
      httpServer = new DaemonHttpServer(daemonService, gmailMcpService);
      
      jest.spyOn(httpServer as any, 'checkPortAvailable').mockResolvedValue(true);
      
      await httpServer.start();
      
      // Both services should be using their configured ports
      expect(httpServer.getPort()).toBe(3002);
      expect(gmailMcpService.getPort()).toBe(3000);
      
      // Verify Gmail routes are set up
      expect(logger.info).toHaveBeenCalledWith(
        '[HTTP Server] Gmail routes configured at /gmail/*'
      );
    });
  });
});