/**
 * HTTP Server for TasksAgent Daemon
 * Provides HTTP endpoints for triggering email processing
 */

import express from 'express';
import cors from 'cors';
import { DaemonService } from './service';
import logger from '../utils/logger';

export class DaemonHttpServer {
  private app: express.Application;
  private daemonService: DaemonService;
  private port: number;
  private server: any;
  private running: boolean = false;
  private connections: Set<any> = new Set();

  constructor(daemonService: DaemonService, port = 3000) {
    this.daemonService = daemonService;
    this.port = port;
    this.app = express();
    
    // Middleware
    this.app.use(cors());
    this.app.use(express.json());
    
    // Setup routes
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req, res) => {
      const stats = this.daemonService.getStats();
      res.json({
        status: 'ok',
        daemon: stats.status,
        uptime: process.uptime(),
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
        const { source, quiet = false, lookbackHours } = req.body;
        
        logger.info(`Processing triggered by ${source || 'unknown'}${quiet ? ' (quiet mode)' : ''}${lookbackHours ? ` (${lookbackHours} hours)` : ''}`);
        
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

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        this.running = true;
        
        // Track connections for graceful shutdown
        this.server.on('connection', (connection: any) => {
          this.connections.add(connection);
          connection.on('close', () => {
            this.connections.delete(connection);
          });
        });
        
        logger.info(`Daemon HTTP server running on http://localhost:${this.port}`);
        logger.info('Available endpoints:');
        logger.info('  GET  /health - Health check');
        logger.info('  POST /trigger - Trigger email processing');
        logger.info('  GET  /status - Get daemon status');
        logger.info('  POST /start - Start daemon');
        logger.info('  POST /stop - Stop daemon');
        logger.info('  POST /reset - Reset processed emails data');
        resolve();
      });
      
      // Handle errors during startup
      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`[HTTP Server] Port ${this.port} is already in use`);
          logger.error('[HTTP Server] Possible solutions:');
          logger.error(`[HTTP Server]   1. Kill the process using port ${this.port}: lsof -ti:${this.port} | xargs kill -9`);
          logger.error(`[HTTP Server]   2. Use a different port by setting HTTP_SERVER_PORT environment variable`);
          logger.error(`[HTTP Server]   3. Wait for the other process to finish`);
          reject(new Error(`Port ${this.port} is already in use`));
        } else if (error.code === 'EACCES') {
          logger.error(`[HTTP Server] Permission denied to use port ${this.port}`);
          logger.error('[HTTP Server] Port numbers below 1024 require elevated privileges');
          logger.error('[HTTP Server] Try using a port number above 1024 or run with sudo');
          reject(new Error(`Permission denied for port ${this.port}`));
        } else {
          logger.error(`[HTTP Server] Failed to start on port ${this.port}: ${error.message}`);
          logger.error(`[HTTP Server] Error code: ${error.code || 'unknown'}`);
          reject(error);
        }
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        // Set a timeout to force close after 5 seconds
        const forceCloseTimeout = setTimeout(() => {
          logger.warn('Force closing HTTP server after 5 second timeout');
          for (const connection of this.connections) {
            connection.destroy();
          }
          this.connections.clear();
          this.running = false;
          resolve();
        }, 5000);
        
        // Close all tracked connections
        for (const connection of this.connections) {
          connection.destroy();
        }
        this.connections.clear();
        
        this.server.close(() => {
          clearTimeout(forceCloseTimeout);
          this.running = false;
          logger.info('Daemon HTTP server stopped gracefully');
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