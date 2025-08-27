#!/usr/bin/env node

import * as dotenv from 'dotenv';

// Load environment variables early
dotenv.config({ quiet: true });
process.env['DOTENV_LOADED'] = 'true';

// Import argument parser
import { 
  processCommandLineArguments, 
  generateHelpInfo, 
  formatHelpText, 
  getVersion, 
  getResolvedConfiguration 
} from './cli/argumentParser';
import { applyPortConfiguration } from './config/config';

// Process command line arguments first
const args = process.argv.slice(2);
const parseResult = processCommandLineArguments(args);

// Check for errors
if (parseResult.errors.length > 0) {
  console.error('Error parsing arguments:');
  parseResult.errors.forEach(error => console.error(`  ${error}`));
  process.exit(1);
}

// Check for warnings
if (parseResult.warnings.length > 0) {
  parseResult.warnings.forEach(warning => console.warn(`Warning: ${warning}`));
}

// Handle help request
if (parseResult.arguments.help) {
  const helpInfo = generateHelpInfo();
  console.log(formatHelpText(helpInfo));
  process.exit(0);
}

// Handle version request
if (parseResult.arguments.version) {
  console.log(getVersion());
  process.exit(0);
}

// Handle config dump request
if (parseResult.arguments.configDump) {
  const configDump = getResolvedConfiguration(parseResult.arguments);
  console.log(configDump);
  process.exit(0);
}

// Apply port configuration from CLI arguments
if (parseResult.arguments.httpPort !== undefined || parseResult.arguments.gmailMcpPort !== undefined) {
  applyPortConfiguration({
    httpPort: parseResult.arguments.httpPort,
    gmailMcpPort: parseResult.arguments.gmailMcpPort
  });
}

// Set TUI mode based on headless flag
if (!parseResult.arguments.headless) {
  process.env['TUI_MODE'] = 'true';
}

// Import after environment and arguments are configured
import { DaemonService } from './daemon/service';
import { DaemonHttpServer } from './daemon/httpServer';
import { GmailMcpService } from './daemon/gmailMcpService';
import { TUIInterface } from './tui/interface';
import logger from './utils/logger';
import { patchConsole } from './utils/consolePatch';
import config from './config/config';
import { getResolvedPorts, getPortConfigDetails } from './config/config';

// Log startup configuration
logger.info('[Startup] Meeting Transcript Agent Daemon initializing...');

// Log CLI arguments if any were provided
const cliArgs: string[] = [];
if (parseResult.arguments.httpPort !== undefined) {
  cliArgs.push(`--http-port=${parseResult.arguments.httpPort}`);
}
if (parseResult.arguments.gmailMcpPort !== undefined) {
  cliArgs.push(`--gmail-mcp-port=${parseResult.arguments.gmailMcpPort}`);
}
if (parseResult.arguments.headless) {
  cliArgs.push('--headless');
}
if (cliArgs.length > 0) {
  logger.info('[Startup] CLI arguments: ' + cliArgs.join(' '));
}

// Log resolved port configuration
const resolvedPorts = getResolvedPorts();
const portConfigDetails = getPortConfigDetails();
logger.debug('[Startup] Port configuration resolved:');
logger.debug(`  HTTP Server: ${resolvedPorts.httpServer} (source: ${portConfigDetails.httpServer.source})`);
logger.debug(`  Gmail MCP: ${resolvedPorts.gmailMcp} (source: ${portConfigDetails.gmailMcp.source})`);

// Log configuration sources for debugging
if (portConfigDetails.httpServer.allSources && portConfigDetails.httpServer.allSources.length > 1) {
  logger.debug('[Startup] HTTP Server port sources (by priority):');
  portConfigDetails.httpServer.allSources.forEach(source => {
    logger.debug(`    ${source.source}: ${source.value} (priority: ${source.priority})`);
  });
}
if (portConfigDetails.gmailMcp.allSources && portConfigDetails.gmailMcp.allSources.length > 1) {
  logger.debug('[Startup] Gmail MCP port sources (by priority):');
  portConfigDetails.gmailMcp.allSources.forEach(source => {
    logger.debug(`    ${source.source}: ${source.value} (priority: ${source.priority})`);
  });
}

// Warn about port conflicts
if (resolvedPorts.httpServer === resolvedPorts.gmailMcp) {
  logger.warn(`[Startup] ⚠️  Port conflict detected! Both services configured for port ${resolvedPorts.httpServer}`);
  logger.warn('[Startup] Services will fail to start if they cannot share the port');
}

// Module-scoped variables for lifecycle management
let httpServer: DaemonHttpServer | null = null;
let gmailMcpService: GmailMcpService | null = null;

async function startDaemon() {
  logger.info('[Daemon] Starting services...');
  
  // Log final port configuration
  const ports = getResolvedPorts();
  const portDetails = getPortConfigDetails();
  logger.info('[Daemon] Using port configuration:', {
    httpServer: `${ports.httpServer} (from ${portDetails.httpServer.source})`,
    gmailMcp: `${ports.gmailMcp} (from ${portDetails.gmailMcp.source})`
  });
  
  // Log Gmail MCP configuration
  logger.info('[Config] Gmail MCP settings:', {
    restartAttempts: config.gmail.mcp.restartAttempts,
    startupTimeout: config.gmail.mcp.startupTimeout,
    requestTimeout: config.gmail.mcp.requestTimeout,
    authPath: config.gmail.mcp.authPath,
  });
  
  // Create Gmail MCP service using config
  gmailMcpService = new GmailMcpService({
    restartAttempts: config.gmail.mcp.restartAttempts,
    startupTimeout: config.gmail.mcp.startupTimeout,
    requestTimeout: config.gmail.mcp.requestTimeout,
    authPath: config.gmail.mcp.authPath,
  });
  
  // Set up Gmail MCP error event listener
  gmailMcpService.on('error', (error: any) => {
    if (error.code === 'GMAIL_MCP_PERMANENT_FAILURE') {
      logger.error('[Daemon] Gmail MCP permanently failed, stopping daemon:', error.message);
      // Trigger graceful shutdown
      process.kill(process.pid, 'SIGTERM');
    } else if (error.code === 'GMAIL_AUTH_FAILED' || error.code === 'GMAIL_AUTH_LOST') {
      logger.error('[Daemon] Gmail authentication issue:', error.message);
      if (error.recoveryAction) {
        logger.info(`[Daemon] Recovery action: ${error.recoveryAction}`);
      }
    }
  });
  
  // Start Gmail MCP service
  try {
    logger.info(`[Gmail MCP] Starting service on port ${ports.gmailMcp}...`);
    await gmailMcpService.start();
    logger.info(`[Gmail MCP] Service started successfully on port ${ports.gmailMcp}`);
  } catch (error: any) {
    logger.error('Failed to start Gmail MCP service:', error);
    
    // Provide recovery suggestions based on error type
    if (error.code === 'GMAIL_AUTH_FAILED') {
      logger.error('[Gmail MCP] Authentication failed. To fix:');
      logger.error('[Gmail MCP]   1. Run: npx @gongrzhe/server-gmail-autoauth-mcp');
      logger.error('[Gmail MCP]   2. Follow the OAuth flow in your browser');
      logger.error('[Gmail MCP]   3. Restart the daemon after authentication');
    } else if (error.code === 'GMAIL_MCP_NOT_FOUND') {
      logger.error('[Gmail MCP] Package not installed. To fix:');
      logger.error('[Gmail MCP]   1. Run: npm install @gongrzhe/server-gmail-autoauth-mcp');
      logger.error('[Gmail MCP]   2. Restart the daemon');
    } else if (error.message?.includes('port') || error.message?.includes('EADDRINUSE')) {
      logger.error('[Gmail MCP] Port conflict detected. To fix:');
      logger.error(`[Gmail MCP]   1. Use CLI: npm run daemon -- --gmail-mcp-port <port>`);
      logger.error(`[Gmail MCP]   2. Use environment: GMAIL_MCP_PORT=<port> npm run daemon`);
      logger.error(`[Gmail MCP]   3. Kill conflicting process: lsof -ti:${ports.gmailMcp} | xargs kill -9`);
      logger.error(`[Gmail MCP]   4. Check current configuration: npm run daemon -- --config-dump`);
    } else {
      logger.error('[Gmail MCP] Generic startup failure. Try:');
      logger.error('[Gmail MCP]   1. Check logs for detailed error messages');
      logger.error('[Gmail MCP]   2. Verify Gmail MCP is installed: npm list @gongrzhe/server-gmail-autoauth-mcp');
      logger.error('[Gmail MCP]   3. Try a different port: npm run daemon -- --gmail-mcp-port 3001');
      logger.error('[Gmail MCP]   4. Check system resources and permissions');
    }
    
    logger.warn('Continuing without Gmail MCP - Gmail features will not be available');
    // Don't throw - allow daemon to continue without Gmail
    gmailMcpService = null;
  }
  
  // Create HTTP server first (will update with service reference later)
  const tempHttpServer = new DaemonHttpServer(null!, gmailMcpService || undefined);
  
  // Create service with HTTP server reference (and Gmail MCP if available)
  const service = new DaemonService(tempHttpServer, gmailMcpService || undefined);
  
  // Now update the HTTP server with the service reference
  // This is a necessary workaround for circular dependency
  (tempHttpServer as unknown as { daemonService: DaemonService }).daemonService = service;
  httpServer = tempHttpServer;
  
  // Start HTTP server for external triggers
  try {
    logger.info(`[HTTP Server] Starting on port ${ports.httpServer}...`);
    await httpServer.start();
    logger.info(`[HTTP Server] Started successfully on port ${ports.httpServer}`);
    logger.info(`[HTTP Server] API available at http://localhost:${ports.httpServer}`);
  } catch (error: any) {
    logger.error(`[HTTP Server] Failed to start on port ${ports.httpServer}:`, error);
    
    // Provide detailed recovery suggestions
    if (error.message?.includes('already in use') || error.message?.includes('EADDRINUSE')) {
      logger.error('[HTTP Server] Port is already in use. Solutions:');
      logger.error(`[HTTP Server]   1. Use CLI argument: npm run daemon -- --http-port <port>`);
      logger.error(`[HTTP Server]   2. Use environment variable: HTTP_SERVER_PORT=<port> npm run daemon`);
      logger.error(`[HTTP Server]   3. Kill conflicting process: lsof -ti:${ports.httpServer} | xargs kill -9`);
      logger.error(`[HTTP Server]   4. View current config: npm run daemon -- --config-dump`);
      logger.error(`[HTTP Server]   5. Check for other daemon instances: ps aux | grep "daemon.js"`);
    } else if (error.message?.includes('permission') || error.message?.includes('EACCES')) {
      logger.error('[HTTP Server] Permission denied. Solutions:');
      logger.error('[HTTP Server]   1. Use a port above 1024 (current port: ' + ports.httpServer + ')');
      logger.error('[HTTP Server]   2. CLI: npm run daemon -- --http-port 8080');
      logger.error('[HTTP Server]   3. Environment: HTTP_SERVER_PORT=8080 npm run daemon');
    } else {
      logger.error('[HTTP Server] Generic startup failure. Try:');
      logger.error('[HTTP Server]   1. Check if port is available: nc -zv localhost ' + ports.httpServer);
      logger.error('[HTTP Server]   2. Try a different port: npm run daemon -- --http-port 8080');
      logger.error('[HTTP Server]   3. Set via environment: HTTP_SERVER_PORT=8080 npm run daemon');
      logger.error('[HTTP Server]   4. Check firewall/security settings');
    }
    
    logger.warn('[HTTP Server] Continuing without HTTP API - daemon will run but API endpoints will not be available');
    // Set httpServer to null so shutdown handlers don't try to stop it
    httpServer = null;
  }
  
  if (parseResult.arguments.headless) {
    logger.info('Running in headless mode');
    
    await service.start();
    
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      if (gmailMcpService) {
        try {
          await gmailMcpService.stop();
        } catch (error) {
          logger.error('Error stopping Gmail MCP service:', error);
        }
      }
      if (httpServer) {
        await httpServer.stop();
      }
      await service.stop();
      await service.cleanup();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      if (gmailMcpService) {
        try {
          await gmailMcpService.stop();
        } catch (error) {
          logger.error('Error stopping Gmail MCP service:', error);
        }
      }
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
      if (gmailMcpService) {
        try {
          await gmailMcpService.stop();
        } catch (stopError) {
          logger.error('Error stopping Gmail MCP service during uncaught exception:', stopError);
        }
      }
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

// Start the daemon
startDaemon().catch((error) => {
  logger.error('Failed to start daemon:', error);
  console.error('Failed to start daemon:', error);
  
  // Provide recovery suggestions
  console.error('\n=== Recovery Suggestions ===');
  console.error('1. Check port configuration:');
  console.error('   npm run daemon -- --config-dump');
  console.error('');
  console.error('2. Use custom ports via CLI:');
  console.error('   npm run daemon -- --http-port 8080 --gmail-mcp-port 9000');
  console.error('');
  console.error('3. Use custom ports via environment:');
  console.error('   HTTP_SERVER_PORT=8080 GMAIL_MCP_PORT=9000 npm run daemon');
  console.error('');
  console.error('4. Find and kill conflicting processes:');
  console.error('   lsof -ti:3002 | xargs kill -9  # HTTP Server');
  console.error('   lsof -ti:3000 | xargs kill -9  # Gmail MCP');
  console.error('');
  console.error('5. Check daemon logs:');
  console.error('   tail -f data/daemon.log');
  console.error('');
  console.error('6. Get help:');
  console.error('   npm run daemon -- --help');
  console.error('============================\n');
  
  process.exit(1);
});