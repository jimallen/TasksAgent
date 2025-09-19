/**
 * HTTP Server for TasksAgent Daemon
 * Provides HTTP endpoints for triggering email processing
 */

import express from 'express';
import cors from 'cors';
import * as net from 'net';
import { DaemonService } from './service';
import { GmailMcpService } from './gmailMcpService';
import logger from '../utils/logger';
import { getResolvedPorts, getPortConfigDetails } from '../config/config';
import { isPortInValidRange, suggestAlternativePorts } from '../cli/portValidator';

export class DaemonHttpServer {
  private app: express.Application;
  private daemonService: DaemonService;
  private gmailMcpService?: GmailMcpService;
  private port: number = 0;
  private server: any;
  private running: boolean = false;
  private connections: Set<any> = new Set();
  private startupTime: Date | null = null;

  /**
   * Create a new HTTP server for the daemon
   * @param daemonService The daemon service instance
   * @param gmailMcpService Optional Gmail MCP service instance
   */
  constructor(
    daemonService: DaemonService, 
    gmailMcpService?: GmailMcpService
  ) {
    this.daemonService = daemonService;
    this.gmailMcpService = gmailMcpService;
    
    this.app = express();
    
    // Middleware
    this.app.use(cors());
    this.app.use(express.json());
    
    // Setup routes
    this.setupRoutes();
    
    // Setup Gmail routes if service is available
    if (this.gmailMcpService) {
      this.setupGmailRoutes();
    }
  }

  private async checkPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const tester = net.createServer()
        .once('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            resolve(false);
          } else {
            resolve(false);
          }
        })
        .once('listening', () => {
          tester.close(() => {
            resolve(true);
          });
        })
        .listen(port);
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req, res) => {
      const stats = this.daemonService.getStats();
      const httpUptime = this.startupTime ? 
        Math.floor((Date.now() - this.startupTime.getTime()) / 1000) : 0;
      
      res.json({
        status: 'ok',
        daemon: stats.status,
        uptime: process.uptime(),
        httpServer: {
          running: this.isRunning(),
          port: this.port,
          startupTime: this.startupTime,
          uptime: httpUptime
        },
        gmailMcp: this.gmailMcpService ? {
          running: stats.gmailMcpRunning || false,
          pid: stats.gmailMcpPid,
          port: this.gmailMcpService.getPort(),
          requestCount: stats.gmailMcpRequestCount || 0
        } : { configured: false },
        stats: {
          totalRuns: stats.totalRuns,
          emailsProcessed: stats.emailsProcessed,
          tasksExtracted: stats.tasksExtracted
        }
      });
    });

    // Trigger email processing
    this.app.post('/trigger', async (req, res) => {
      try {
        const { source, quiet = false, lookbackHours, anthropicApiKey } = req.body;
        
        logger.info(`Processing triggered by ${source || 'unknown'}${quiet ? ' (quiet mode)' : ''}${lookbackHours ? ` (${lookbackHours} hours)` : ''}`);
        
        // Set API key in environment if provided
        if (anthropicApiKey) {
          process.env['ANTHROPIC_API_KEY'] = anthropicApiKey;
        }
        
        // Trigger processing and get the result directly
        const processingResult = await this.daemonService.processEmails(true, quiet, lookbackHours);
        
        // Use the actual result from processing
        const result = {
          success: true,
          emailsProcessed: processingResult?.emailsProcessed || 0,
          tasksExtracted: processingResult?.tasksExtracted || 0,
          notesCreated: processingResult?.notesCreated || 0,
          message: 'Processing completed'
        };
        
        res.json(result);
      } catch (error: any) {
        logger.error('Trigger endpoint error:', error);
        res.status(500).json({
          success: false,
          error: error?.message || 'Processing failed'
        });
      }
    });

    // Get daemon status
    this.app.get('/status', (_req, res) => {
      const stats = this.daemonService.getStats();
      res.json(stats);
    });

    // Stop daemon
    this.app.post('/stop', async (_req, res) => {
      try {
        await this.daemonService.stop();
        res.json({ success: true, message: 'Daemon stopped' });
      } catch (error: any) {
        res.status(500).json({ 
          success: false, 
          error: error?.message 
        });
      }
    });

    // Start daemon
    this.app.post('/start', async (_req, res) => {
      try {
        await this.daemonService.start();
        res.json({ success: true, message: 'Daemon started' });
      } catch (error: any) {
        res.status(500).json({ 
          success: false, 
          error: error?.message 
        });
      }
    });

    // Reset processed emails
    this.app.post('/reset', async (req, res) => {
      try {
        const { type = 'all' } = req.body; // 'all', 'emails', 'stats'
        logger.info(`Reset requested: ${type}`);
        
        const result = await this.daemonService.resetProcessedData(type);
        
        res.json({ 
          success: true, 
          message: `Reset completed: ${result.message}`,
          details: result
        });
      } catch (error: any) {
        logger.error('Reset endpoint error:', error);
        res.status(500).json({ 
          success: false, 
          error: error?.message || 'Reset failed'
        });
      }
    });
  }

  private setupGmailRoutes(): void {
    if (!this.gmailMcpService) {
      logger.warn('[HTTP Server] Gmail routes not set up - Gmail MCP service not provided');
      return;
    }

    // Gmail health check endpoint
    this.app.get('/gmail/health', (_req, res) => {
      if (!this.gmailMcpService) {
        res.status(503).json({
          status: 'unavailable',
          error: 'Gmail MCP service not configured'
        });
        return;
      }

      const status = this.gmailMcpService.getStatus();
      res.json({
        status: status.running ? 'healthy' : 'unhealthy',
        running: status.running,
        pid: status.pid,
        port: this.gmailMcpService.getPort(),
        uptime: status.uptime,
        requestCount: status.requestCount,
        errorCount: status.errorCount,
        lastError: status.lastError,
        restartCount: status.restartCount
      });
    });

    // Gmail search endpoint
    this.app.post('/gmail/search', async (req, res) => {
      if (!this.gmailMcpService) {
        res.status(503).json({
          success: false,
          error: 'Gmail MCP service not configured'
        });
        return;
      }

      try {
        const { query, maxResults, pageToken, labelIds } = req.body;
        
        if (!this.gmailMcpService.isRunning()) {
          res.status(503).json({
            success: false,
            error: 'Gmail MCP service is not running'
          });
          return;
        }

        logger.info(`[Gmail] Search request: ${query || 'all'}, max: ${maxResults || 'default'}`);
        
        const results = await this.gmailMcpService.searchEmails({
          query,
          maxResults,
          pageToken,
          labelIds
        });
        
        res.json({
          success: true,
          results,
          count: results.length
        });
      } catch (error: any) {
        logger.error('[Gmail] Search error:', error);
        res.status(500).json({
          success: false,
          error: error?.message || 'Search failed'
        });
      }
    });

    // Gmail read email endpoint
    this.app.post('/gmail/read', async (req, res) => {
      if (!this.gmailMcpService) {
        res.status(503).json({
          success: false,
          error: 'Gmail MCP service not configured'
        });
        return;
      }

      try {
        const { messageId, format } = req.body;
        
        if (!messageId) {
          res.status(400).json({
            success: false,
            error: 'messageId is required'
          });
          return;
        }
        
        if (!this.gmailMcpService.isRunning()) {
          res.status(503).json({
            success: false,
            error: 'Gmail MCP service is not running'
          });
          return;
        }

        logger.info(`[Gmail] Read email request: ${messageId}, format: ${format || 'default'}`);
        
        const email = await this.gmailMcpService.readEmail({
          messageId,
          format
        });
        
        res.json({
          success: true,
          email
        });
      } catch (error: any) {
        logger.error('[Gmail] Read email error:', error);
        res.status(500).json({
          success: false,
          error: error?.message || 'Failed to read email'
        });
      }
    });

    // Gmail generic MCP proxy endpoint
    this.app.post('/gmail/mcp', async (req, res) => {
      if (!this.gmailMcpService) {
        res.status(503).json({
          success: false,
          error: 'Gmail MCP service not configured'
        });
        return;
      }

      try {
        const { method, params } = req.body;
        
        if (!method) {
          res.status(400).json({
            success: false,
            error: 'method is required'
          });
          return;
        }
        
        if (!this.gmailMcpService.isRunning()) {
          res.status(503).json({
            success: false,
            error: 'Gmail MCP service is not running'
          });
          return;
        }

        logger.info(`[Gmail] MCP request: ${method}`, params);
        
        const result = await this.gmailMcpService.sendRequest(method, params);
        
        res.json({
          success: true,
          result
        });
      } catch (error: any) {
        logger.error('[Gmail] MCP proxy error:', error);
        res.status(500).json({
          success: false,
          error: error?.message || 'MCP request failed',
          code: (error as any)?.code
        });
      }
    });

    // Gmail status endpoint
    this.app.get('/gmail/status', (_req, res) => {
      if (!this.gmailMcpService) {
        res.status(503).json({
          configured: false,
          error: 'Gmail MCP service not configured'
        });
        return;
      }

      const status = this.gmailMcpService.getStatus();
      res.json({
        configured: true,
        port: this.gmailMcpService.getPort(),
        ...status
      });
    });

    logger.info('[HTTP Server] Gmail routes configured at /gmail/*');
  }

  async start(): Promise<void> {
    // Get the resolved port from configuration
    // This handles CLI args > Environment > Default priority
    const ports = getResolvedPorts();
    this.port = ports.httpServer;
    
    const details = getPortConfigDetails();
    logger.info(`[HTTP Server] Starting with port ${this.port} from ${details.httpServer.source}`);
    
    // Log all available sources for debugging
    if (details.httpServer.allSources.length > 1) {
      logger.debug('[HTTP Server] Configuration sources:');
      for (const source of details.httpServer.allSources) {
        logger.debug(`  - ${source.source}: ${source.value} (priority: ${source.priority})`);
      }
    }

    // Check if port is available before trying to start
    const isAvailable = await this.checkPortAvailable(this.port);
    if (!isAvailable) {
      logger.warn(`[HTTP Server] Port ${this.port} is not available, attempting to find alternative port...`);
      
      // Get all configured ports to avoid conflicts
      const ports = getResolvedPorts();
      const usedPorts = [ports.httpServer, ports.gmailMcp];
      
      // Generate intelligent alternatives using our port validation utility
      const suggestedPorts = suggestAlternativePorts(this.port, usedPorts);
      
      // Also add some additional alternatives based on the base port
      const basePort = this.port;
      const alternativePorts: number[] = [...suggestedPorts];
      
      // Add sequential ports if not already included
      for (let offset = 1; offset <= 10; offset++) {
        const altPort = basePort + offset;
        if (isPortInValidRange(altPort) && !alternativePorts.includes(altPort) && !usedPorts.includes(altPort)) {
          alternativePorts.push(altPort);
        }
      }
      
      // Try ports in reverse order if base is high
      if (basePort > 5000) {
        for (let offset = 1; offset <= 5; offset++) {
          const altPort = basePort - offset;
          if (isPortInValidRange(altPort) && !alternativePorts.includes(altPort) && !usedPorts.includes(altPort)) {
            alternativePorts.push(altPort);
          }
        }
      }
      
      let foundPort = false;
      for (const altPort of alternativePorts) {
        if (await this.checkPortAvailable(altPort)) {
          this.port = altPort;
          logger.info(`[HTTP Server] Using alternative port ${this.port}`);
          foundPort = true;
          break;
        }
      }
      
      if (!foundPort) {
        const testedPorts = alternativePorts.slice(0, 10).join(', ');
        logger.error(`[HTTP Server] No available ports found. Tested: ${this.port}, ${testedPorts}${alternativePorts.length > 10 ? '...' : ''}`);
        logger.error(`[HTTP Server] To fix this issue:`);
        logger.error(`[HTTP Server]   1. Kill the process using port: lsof -ti:${basePort} | xargs kill -9`);
        logger.error(`[HTTP Server]   2. Use --http-port <port> CLI argument or set HTTP_SERVER_PORT=<port> environment variable`);
        logger.error(`[HTTP Server]   3. Check if Gmail MCP is conflicting on port ${ports.gmailMcp}`);
        throw new Error(`No available ports found for HTTP server`);
      }
    }

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        this.running = true;
        this.startupTime = new Date();
        logger.info(`[HTTP Server] Starting on port ${this.port}...`);
        
        // Track connections for graceful shutdown
        this.server.on('connection', (connection: any) => {
          this.connections.add(connection);
          connection.on('close', () => {
            this.connections.delete(connection);
          });
        });
        
        logger.info(`[HTTP Server] Started successfully on http://localhost:${this.port}`);
        logger.info('Available endpoints:');
        logger.info('  GET  /health - Health check');
        logger.info('  POST /trigger - Trigger email processing');
        logger.info('  GET  /status - Get daemon status');
        logger.info('  POST /start - Start daemon');
        logger.info('  POST /stop - Stop daemon');
        logger.info('  POST /reset - Reset processed emails data');
        
        if (this.gmailMcpService) {
          logger.info('Gmail MCP endpoints:');
          logger.info('  GET  /gmail/health - Gmail MCP health check');
          logger.info('  GET  /gmail/status - Gmail MCP detailed status');
          logger.info('  POST /gmail/search - Search Gmail emails');
          logger.info('  POST /gmail/read - Read Gmail email by ID');
          logger.info('  POST /gmail/mcp - Generic MCP proxy');
        }
        resolve();
      });
      
      // Handle errors during startup
      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`[HTTP Server] Port ${this.port} is already in use`);
          logger.error('[HTTP Server] This usually means another instance is already running');
          logger.error('[HTTP Server] Possible solutions:');
          logger.error(`[HTTP Server]   1. Kill the process using port ${this.port}: lsof -ti:${this.port} | xargs kill -9`);
          logger.error(`[HTTP Server]   2. Use --http-port <port> CLI argument or set HTTP_SERVER_PORT=<port> environment variable`);
          logger.error(`[HTTP Server]   3. Check for other running instances: ps aux | grep "npm run daemon"`);
          logger.error(`[HTTP Server]   4. Wait for the other process to finish`);
          reject(new Error(`Port ${this.port} is already in use`));
        } else if (error.code === 'EACCES') {
          logger.error(`[HTTP Server] Permission denied to use port ${this.port}`);
          logger.error('[HTTP Server] Port numbers below 1024 require elevated privileges');
          logger.error('[HTTP Server] Possible solutions:');
          logger.error('[HTTP Server]   1. Use a port number above 1024');
          logger.error('[HTTP Server]   2. Use --http-port <port> CLI argument or set HTTP_SERVER_PORT=<port> environment variable');
          logger.error('[HTTP Server]   3. Run with elevated privileges (not recommended): sudo npm run daemon');
          reject(new Error(`Permission denied for port ${this.port}`));
        } else if (error.code === 'ENOTFOUND' || error.code === 'ENOENT') {
          logger.error(`[HTTP Server] Network or filesystem error: ${error.message}`);
          logger.error('[HTTP Server] Possible solutions:');
          logger.error('[HTTP Server]   1. Check network connectivity');
          logger.error('[HTTP Server]   2. Verify filesystem permissions');
          logger.error('[HTTP Server]   3. Restart the daemon service');
          reject(error);
        } else {
          logger.error(`[HTTP Server] Unexpected error starting on port ${this.port}: ${error.message}`);
          logger.error(`[HTTP Server] Error code: ${error.code || 'unknown'}`);
          logger.error('[HTTP Server] Possible solutions:');
          logger.error('[HTTP Server]   1. Check system logs for more details');
          logger.error('[HTTP Server]   2. Try a different port with --http-port <port> CLI argument or HTTP_SERVER_PORT=<port> environment variable');
          logger.error('[HTTP Server]   3. Restart the daemon service');
          logger.error('[HTTP Server]   4. Check firewall/security settings');
          reject(error);
        }
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      logger.info(`[HTTP Server] Stopping server on port ${this.port}...`);
      return new Promise((resolve) => {
        // Set a timeout to force close after 5 seconds
        const forceCloseTimeout = setTimeout(() => {
          logger.warn('[HTTP Server] Force closing after 5 second timeout');
          for (const connection of this.connections) {
            connection.destroy();
          }
          this.connections.clear();
          this.running = false;
          this.startupTime = null;
          logger.info('[HTTP Server] Stopped (forced)');
          resolve();
        }, 5000);
        
        // Close all tracked connections
        logger.info(`[HTTP Server] Closing ${this.connections.size} active connection(s)...`);
        for (const connection of this.connections) {
          connection.destroy();
        }
        this.connections.clear();
        
        this.server.close(() => {
          clearTimeout(forceCloseTimeout);
          this.running = false;
          this.startupTime = null;
          logger.info('[HTTP Server] Stopped gracefully');
          resolve();
        });
      });
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getPort(): number {
    return this.port;
  }
}