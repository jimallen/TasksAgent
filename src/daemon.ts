#!/usr/bin/env node

import * as dotenv from 'dotenv';

const args = process.argv.slice(2);
const command = args[0];

// Set TUI mode early if needed
if (command !== '--headless' && command !== '-h' && command !== '--help') {
  process.env['TUI_MODE'] = 'true';
  dotenv.config({ quiet: true });
} else {
  dotenv.config();
}

// Import after environment is configured
import { DaemonService } from './daemon/service';
import { DaemonHttpServer } from './daemon/httpServer';
import { TUIInterface } from './tui/interface';
import logger from './utils/logger';
import { patchConsole } from './utils/consolePatch';

// Module-scoped variables for lifecycle management
let httpServer: DaemonHttpServer | null = null;

async function startDaemon() {
  logger.info('Starting Meeting Transcript Agent Daemon...');
  
  // Create HTTP server first
  const tempHttpServer = new DaemonHttpServer(null as any, 3002);
  
  // Create service with HTTP server reference
  const service = new DaemonService(tempHttpServer);
  
  // Now update the HTTP server with the service reference
  (tempHttpServer as any).daemonService = service;
  httpServer = tempHttpServer;
  
  // Start HTTP server for external triggers
  try {
    await httpServer.start();
  } catch (error) {
    logger.error('Failed to start HTTP server:', error);
    logger.warn('Continuing without HTTP API - daemon will run but API endpoints will not be available');
    // Set httpServer to null so shutdown handlers don't try to stop it
    httpServer = null;
  }
  
  if (command === '--headless' || command === '-h') {
    logger.info('Running in headless mode');
    
    await service.start();
    
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      if (httpServer) {
        await httpServer.stop();
      }
      await service.stop();
      await service.cleanup();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      if (httpServer) {
        await httpServer.stop();
      }
      await service.stop();
      await service.cleanup();
      process.exit(0);
    });
    
    logger.info('Daemon is running in background. Press Ctrl+C to stop.');
  } else {
    logger.info('Starting TUI interface...');
    
    // Patch console to prevent subprocess output
    patchConsole();
    
    try {
      const tui = new TUIInterface(service);
      tui.start();
      
      // Keep the process alive
      process.stdin.resume();
    } catch (error) {
      logger.error('Failed to start TUI:', error);
      console.error('TUI Error:', error);
      
      // Fall back to headless mode
      logger.info('Falling back to headless mode due to TUI error');
      await service.start();
    }
    
    process.on('uncaughtException', async (err) => {
      logger.error('Uncaught exception:', err);
      if (httpServer) {
        try {
          await httpServer.stop();
        } catch (stopError) {
          logger.error('Error stopping HTTP server during uncaught exception:', stopError);
        }
      }
      await service.cleanup();
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    });
  }
}

function showHelp() {
  console.log(`
Meeting Transcript Agent Daemon

Usage:
  npm run daemon              Start daemon with TUI interface
  npm run daemon:headless     Start daemon in headless mode
  npm run daemon:stop         Stop running daemon
  npm run daemon:status       Check daemon status

Options:
  --headless, -h    Run in headless mode without TUI
  --help            Show this help message

TUI Controls:
  F1    Start service
  F2    Stop service
  F3    Process emails now
  F4    Clear statistics
  F5    View logs
  F6    Edit configuration
  Q     Quit TUI (service continues running)
`);
}

if (command === '--help') {
  showHelp();
  process.exit(0);
}

startDaemon().catch((error) => {
  logger.error('Failed to start daemon:', error);
  console.error('Failed to start daemon:', error);
  process.exit(1);
});