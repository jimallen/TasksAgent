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
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
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
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('Daemon HTTP server stopped');
          resolve();
        });
      });
    }
  }
}