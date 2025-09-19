/**
 * Gmail MCP Service - Manages Gmail MCP child process within the daemon
 */

import { EventEmitter } from 'events';
import { ChildProcess, spawn } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import logger from '../utils/logger';
import {
  McpRequest,
  McpResponse,
  GmailMcpConfig,
  GmailMcpStatus,
  PendingRequest,
  GmailMcpEvent,
  GmailSearchParams,
  GmailReadParams,
  GmailMessage,
} from '../types/gmailMcp';
import { getResolvedPorts, getPortConfigDetails } from '../config/config';

/**
 * GmailMcpService class manages the Gmail MCP child process lifecycle
 * and handles communication between the daemon and Gmail MCP
 */
export class GmailMcpService extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: GmailMcpConfig;
  private status: GmailMcpStatus;
  private pendingRequests: Map<string | number, PendingRequest>;
  private responseBuffer: string = '';
  private restartTimer: NodeJS.Timeout | null = null;
  private initializePromise: Promise<void> | null = null;
  private port: number = 0;

  // Tool mapping for Google Workspace MCP
  private readonly TOOL_MAP: Record<string, string> = {
    'search_emails': 'search_gmail_messages',
    'read_email': 'get_gmail_message_content'
  };

  /**
   * Creates a new GmailMcpService instance
   * @param config - Gmail MCP configuration
   */
  constructor(config?: Partial<GmailMcpConfig>) {
    super();

    // Initialize with defaults (adjusted for Python processes)
    this.config = {
      restartAttempts: config?.restartAttempts ?? 3,
      startupTimeout: config?.startupTimeout ?? 15000, // 15 seconds for Python startup
      requestTimeout: config?.requestTimeout ?? 30000,
      mcpPath: config?.mcpPath ?? process.env['GOOGLE_WORKSPACE_MCP_PATH'],
    };

    // Initialize status
    this.status = {
      running: false,
      pid: undefined,
      startTime: undefined,
      uptime: undefined,
      requestCount: 0,
      errorCount: 0,
      lastError: undefined,
      restartCount: 0,
    };

    // Initialize request tracking
    this.pendingRequests = new Map();
    
    // Get configured port from configuration system
    const ports = getResolvedPorts();
    this.port = ports.gmailMcp;
    
    const portDetails = getPortConfigDetails();
    logger.info('[GmailMCP] Service initialized with config:', {
      port: this.port,
      portSource: portDetails.gmailMcp.source,
      restartAttempts: this.config.restartAttempts,
      startupTimeout: this.config.startupTimeout,
      requestTimeout: this.config.requestTimeout,
    });
  }

  /**
   * Starts the Gmail MCP process
   * @returns Promise that resolves when process is ready
   */
  async start(): Promise<void> {
    if (this.isRunning()) {
      logger.info('[GmailMCP] Process already running');
      return;
    }

    logger.info('[GmailMCP] Starting Gmail MCP process...');
    
    return new Promise((resolve, reject) => {
      const startTimeout = setTimeout(() => {
        const error = new Error(`Gmail MCP failed to start within ${this.config.startupTimeout}ms`);
        logger.error('[GmailMCP] Startup timeout:', error);
        this.cleanup();
        reject(error);
      }, this.config.startupTimeout);

      try {
        // Get the port configuration again in case it changed
        const ports = getResolvedPorts();
        this.port = ports.gmailMcp;
        
        const portDetails = getPortConfigDetails();
        logger.info(`[GmailMCP] Starting process with port ${this.port} from ${portDetails.gmailMcp.source}`);
        
        // Log configuration sources for debugging
        if (portDetails.gmailMcp.allSources.length > 1) {
          logger.debug('[GmailMCP] Available port configuration sources:');
          for (const source of portDetails.gmailMcp.allSources) {
            logger.debug(`  - ${source.source}: ${source.value} (priority: ${source.priority})`);
          }
        }
        
        // Prepare environment variables for child process
        const childEnv = {
          ...process.env,
          NODE_ENV: process.env['NODE_ENV'] || 'production',
          // Pass the configured port to the Google Workspace MCP server
          PORT: this.port.toString(),
          GMAIL_MCP_PORT: this.port.toString(),
          MCP_PORT: this.port.toString(),
          // Google Workspace MCP OAuth credentials from environment
          GOOGLE_OAUTH_CLIENT_ID: process.env['GOOGLE_OAUTH_CLIENT_ID'],
          GOOGLE_OAUTH_CLIENT_SECRET: process.env['GOOGLE_OAUTH_CLIENT_SECRET'],
        };

        logger.debug(`[GmailMCP] Spawning process with environment: PORT=${childEnv.PORT}, OAuth configured: ${!!childEnv.GOOGLE_OAUTH_CLIENT_ID}`);

        // Determine the path to Google Workspace MCP
        const mcpPath = this.config.mcpPath || 'google_workspace_mcp';
        const pythonCommand = 'python';
        const mcpMainFile = `${mcpPath}/main.py`;

        logger.info(`[GmailMCP] Starting Google Workspace MCP from: ${mcpMainFile}`);
        logger.debug(`[GmailMCP] Python command: ${pythonCommand}`);
        logger.debug(`[GmailMCP] Arguments: --tools gmail --port ${this.port}`);
        logger.debug(`[GmailMCP] Working directory: ${process.cwd()}`);

        // Log OAuth configuration status
        if (childEnv.GOOGLE_OAUTH_CLIENT_ID) {
          logger.debug('[GmailMCP] OAuth client ID configured');
        } else {
          logger.warn('[GmailMCP] WARNING: GOOGLE_OAUTH_CLIENT_ID not set - authentication will fail');
        }

        if (childEnv.GOOGLE_OAUTH_CLIENT_SECRET) {
          logger.debug('[GmailMCP] OAuth client secret configured');
        } else {
          logger.warn('[GmailMCP] WARNING: GOOGLE_OAUTH_CLIENT_SECRET not set - authentication will fail');
        }

        // Spawn the Google Workspace MCP process with Gmail-only tools
        // Python processes need proper signal handling
        this.process = spawn(pythonCommand, [mcpMainFile, '--tools', 'gmail', '--port', this.port.toString()], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: childEnv,
          cwd: process.cwd(),
          // Ensure Python process gets proper signal forwarding
          detached: false,
          shell: false,
        });

        if (!this.process.pid) {
          clearTimeout(startTimeout);
          const error = new Error('Failed to spawn Gmail MCP process');
          logger.error('[GmailMCP] Spawn failed:', error);
          reject(error);
          return;
        }

        // Update status
        this.status.running = true;
        this.status.pid = this.process.pid;
        this.status.startTime = new Date();
        logger.info(`[GmailMCP] Process started with PID: ${this.process.pid}`);

        // Set up process event handlers
        this.process.on('error', (error: any) => {
          clearTimeout(startTimeout);
          logger.error('[GmailMCP] Process error:', error);
          this.status.running = false;
          
          // Enhanced error handling for Python process and port conflicts
          if (error.code === 'ENOENT') {
            logger.error('[GmailMCP] Python or Google Workspace MCP not found');
            logger.error('[GmailMCP] Possible solutions:');
            logger.error('[GmailMCP]   1. Install Python 3.10+ and ensure it\'s in PATH');
            logger.error('[GmailMCP]   2. Clone Google Workspace MCP: git clone https://github.com/taylorwilsdon/google_workspace_mcp.git');
            logger.error('[GmailMCP]   3. Set GOOGLE_WORKSPACE_MCP_PATH environment variable to the cloned directory');
            logger.error('[GmailMCP]   4. Install dependencies: pip install uv && cd google_workspace_mcp && uv sync');

            this.status.lastError = 'Python or Google Workspace MCP not found';
          } else if (error.code === 'EADDRINUSE' || error.message?.includes('address already in use')) {
            const portDetails = getPortConfigDetails();
            logger.error(`[GmailMCP] Port ${this.port} is already in use`);
            logger.error('[GmailMCP] This usually means another MCP instance is already running');
            logger.error('[GmailMCP] Possible solutions:');
            logger.error(`[GmailMCP]   1. Kill the process using port ${this.port}: lsof -ti:${this.port} | xargs kill -9`);
            logger.error(`[GmailMCP]   2. Use --gmail-mcp-port <port> CLI argument or set GMAIL_MCP_PORT=<port> environment variable`);
            logger.error(`[GmailMCP]   3. Check if HTTP server is conflicting (current HTTP port: ${getResolvedPorts().httpServer})`);
            logger.error(`[GmailMCP] Current port source: ${portDetails.gmailMcp.source}`);

            this.status.lastError = `Port ${this.port} is already in use (configured from ${portDetails.gmailMcp.source})`;
          } else if (error.code === 'EACCES' || error.message?.includes('permission denied')) {
            logger.error(`[GmailMCP] Permission denied to use port ${this.port}`);
            logger.error('[GmailMCP] Port numbers below 1024 require elevated privileges');
            logger.error('[GmailMCP] Possible solutions:');
            logger.error('[GmailMCP]   1. Use a port number above 1024');
            logger.error(`[GmailMCP]   2. Use --gmail-mcp-port <port> CLI argument or set GMAIL_MCP_PORT=<port> environment variable`);
            
            this.status.lastError = `Permission denied for port ${this.port}`;
          } else {
            this.status.lastError = error.message;
          }
          
          this.status.errorCount++;
          this.emitEvent('error', error);
          reject(error);
        });

        this.process.on('exit', (code, signal) => {
          logger.info(`[GmailMCP] Process exited with code ${code} and signal ${signal}`);
          this.status.running = false;
          this.status.pid = undefined;
          
          if (code !== 0) {
            this.status.lastError = `Process exited with code ${code}`;
            this.status.errorCount++;
            this.emitEvent('crashed', code, signal);
            this.handleProcessCrash();
          } else {
            this.emitEvent('stopped');
          }
        });

        // Set up stdio handlers
        this.setupStdioHandlers(startTimeout, resolve, reject);

        // If we don't get a ready signal, initialize anyway after a short delay
        setTimeout(() => {
          if (this.status.running && !this.initializePromise) {
            clearTimeout(startTimeout);
            this.initializeMcp().then(() => {
              logger.info('[GmailMCP] Process initialized (fallback)');
              this.emitEvent('started');
              resolve();
            }).catch((initError) => {
              logger.error('[GmailMCP] Fallback initialization failed:', initError);
              this.cleanup();
              reject(initError);
            });
          }
        }, 2000);

      } catch (error) {
        clearTimeout(startTimeout);
        logger.error('[GmailMCP] Failed to start process:', error);
        this.status.lastError = error instanceof Error ? error.message : String(error);
        reject(error);
      }
    });
  }

  /**
   * Initializes the MCP connection
   * @returns Promise that resolves when initialized
   */
  private async initializeMcp(): Promise<void> {
    if (this.initializePromise) {
      return this.initializePromise;
    }

    const initParams: Record<string, unknown> = {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: true,
        resources: true,
      },
      clientInfo: {
        name: 'TasksAgent-Daemon',
        version: '1.0.0',
      },
    };
    
    this.initializePromise = this.sendRequest('initialize', initParams).then(() => {
      logger.info('[GmailMCP] MCP protocol initialized');
      this.initializePromise = null;
    }).catch((error) => {
      logger.error('[GmailMCP] Failed to initialize MCP protocol:', error);
      this.initializePromise = null;
      throw error;
    });

    return this.initializePromise;
  }

  /**
   * Sets up stdio handlers for the process
   */
  private setupStdioHandlers(
    startTimeout: NodeJS.Timeout,
    startResolve?: (value: void | PromiseLike<void>) => void,
    startReject?: (reason?: any) => void
  ): void {
    if (!this.process) {
      return;
    }

    // Handle stdout (responses from MCP)
    if (this.process.stdout) {
      this.process.stdout.setEncoding('utf8');
      this.process.stdout.on('data', (data: string) => {
        this.handleStdoutData(data, startTimeout, startResolve, startReject);
      });

      this.process.stdout.on('error', (error) => {
        logger.error('[GmailMCP] stdout error:', error);
        this.status.lastError = `stdout error: ${error.message}`;
        this.status.errorCount++;
      });
    }

    // Handle stderr (errors and logs)
    if (this.process.stderr) {
      this.process.stderr.setEncoding('utf8');
      this.process.stderr.on('data', (data: string) => {
        this.handleStderrData(data, startTimeout, startReject);
      });

      this.process.stderr.on('error', (error) => {
        logger.error('[GmailMCP] stderr error:', error);
        this.status.lastError = `stderr error: ${error.message}`;
        this.status.errorCount++;
      });
    }

    // Handle stdin (for sending requests)
    if (this.process.stdin) {
      this.process.stdin.on('error', (error) => {
        logger.error('[GmailMCP] stdin error:', error);
        this.status.lastError = `stdin error: ${error.message}`;
        this.status.errorCount++;
        
        // Reject all pending requests if stdin fails
        this.clearPendingRequests(new Error(`stdin error: ${error.message}`));
      });

      this.process.stdin.on('drain', () => {
        logger.debug('[GmailMCP] stdin drain event - ready for more data');
      });
    }
  }

  /**
   * Handles data from stdout
   */
  private handleStdoutData(
    data: string,
    startTimeout?: NodeJS.Timeout,
    startResolve?: (value: void | PromiseLike<void>) => void,
    startReject?: (reason?: any) => void
  ): void {
    // Add to buffer
    this.responseBuffer += data;

    // Log raw stdout for debugging Python process
    if (logger.level === 'debug') {
      const lines = data.split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.length > 200) {
          logger.debug(`[GmailMCP] stdout: ${line.substring(0, 200)}...`);
        } else {
          logger.debug(`[GmailMCP] stdout: ${line}`);
        }
      }
    }

    // Check if process is ready (during startup)
    // Python MCP may have different ready indicators
    if (startTimeout && (data.includes('MCP server running') ||
        data.includes('Server started') ||
        data.includes('ready') ||
        data.includes('Listening on') ||
        data.includes('Starting server'))) {
      clearTimeout(startTimeout);
      logger.info('[GmailMCP] Google Workspace MCP process is ready');
      if (startResolve && startReject) {
        this.initializeMcp().then(() => {
          logger.info('[GmailMCP] MCP protocol initialized successfully');
          this.emitEvent('started');
          startResolve();
        }).catch((initError) => {
          logger.error('[GmailMCP] Initialization failed:', initError);
          this.cleanup();
          startReject(initError);
        });
      }
    }

    // Try to parse JSON-RPC responses
    this.processResponseBuffer();
  }

  /**
   * Handles data from stderr
   */
  private handleStderrData(
    data: string,
    startTimeout?: NodeJS.Timeout,
    startReject?: (reason?: any) => void
  ): void {
    // Log stderr output
    const lines = data.split('\n').filter(line => line.trim());
    for (const line of lines) {
      if (line.includes('ERROR') || line.includes('FATAL')) {
        logger.error('[GmailMCP] stderr:', line);
        this.status.lastError = line;
        this.status.errorCount++;
      } else if (line.includes('WARN')) {
        logger.warn('[GmailMCP] stderr:', line);
      } else if (line.includes('DEBUG')) {
        logger.debug('[GmailMCP] stderr:', line);
      } else if (line.includes('Traceback') || line.includes('File "')) {
        // Python stack trace
        logger.error('[GmailMCP] Python error:', line);
      } else if (line.includes('ModuleNotFoundError') || line.includes('ImportError')) {
        // Python dependency errors
        logger.error('[GmailMCP] Python dependency missing:', line);
        logger.error('[GmailMCP] Run: cd google_workspace_mcp && pip install uv && uv sync');
      } else if (line.includes('GOOGLE_OAUTH_CLIENT_ID') || line.includes('GOOGLE_OAUTH_CLIENT_SECRET')) {
        // OAuth configuration errors
        logger.error('[GmailMCP] OAuth configuration missing:', line);
        logger.error('[GmailMCP] Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET environment variables');
      } else {
        logger.info('[GmailMCP] stderr:', line);
      }
    }

    // Check for port conflicts
    if (data.includes('EADDRINUSE') || 
        data.includes('address already in use') || 
        data.includes('Address already in use') ||
        data.includes(`port ${this.port}`)) {
      const portDetails = getPortConfigDetails();
      logger.error(`[GmailMCP] Port conflict detected on port ${this.port}`);
      logger.error('[GmailMCP] The Gmail MCP server cannot start because the port is in use');
      logger.error('[GmailMCP] To fix this issue:');
      logger.error(`[GmailMCP]   1. Use --gmail-mcp-port <port> CLI argument to specify a different port`);
      logger.error(`[GmailMCP]   2. Or set GMAIL_MCP_PORT=<port> environment variable`);
      logger.error(`[GmailMCP]   3. Or kill the conflicting process: lsof -ti:${this.port} | xargs kill -9`);
      logger.error(`[GmailMCP] Port was configured from: ${portDetails.gmailMcp.source}`);
      
      this.status.lastError = `Port ${this.port} conflict detected`;
      
      if (startReject) {
        clearTimeout(startTimeout!);
        const error = new Error(`Gmail MCP port ${this.port} is already in use`);
        startReject(error);
      }
    }
    
    // Check for critical errors during startup
    if (startTimeout && startReject) {
      if (data.includes('Authentication failed') || 
          data.includes('OAuth') || 
          data.includes('credentials') ||
          data.includes('401') ||
          data.includes('403') ||
          data.includes('Invalid token') ||
          data.includes('Token expired') ||
          data.includes('No refresh token')) {
        clearTimeout(startTimeout);
        const authError = new Error(
          'Gmail authentication failed. Please run: npx @gongrzhe/server-gmail-autoauth-mcp to re-authenticate'
        );
        (authError as any).code = 'GMAIL_AUTH_FAILED';
        (authError as any).recoveryAction = 'npx @gongrzhe/server-gmail-autoauth-mcp';
        logger.error('[GmailMCP] Auth error:', authError);
        this.status.lastError = authError.message;
        this.cleanup();
        startReject(authError);
      } else if (data.includes('ENOENT') || data.includes('not found') || data.includes('Cannot find module')) {
        clearTimeout(startTimeout);
        const notFoundError = new Error(
          'Gmail MCP package not found. Please run: npm install @gongrzhe/server-gmail-autoauth-mcp'
        );
        (notFoundError as any).code = 'GMAIL_MCP_NOT_FOUND';
        (notFoundError as any).recoveryAction = 'npm install @gongrzhe/server-gmail-autoauth-mcp';
        logger.error('[GmailMCP] Package error:', notFoundError);
        this.status.lastError = notFoundError.message;
        this.cleanup();
        startReject(notFoundError);
      }
    }
    
    // Always check for auth errors even after startup
    if (!startTimeout && (data.includes('Authentication failed') || 
        data.includes('Token expired') || 
        data.includes('401') || 
        data.includes('403'))) {
      logger.error('[GmailMCP] Authentication error detected during runtime');
      this.status.lastError = 'Gmail authentication failed - re-authentication required';
      this.status.errorCount++;
      
      // Emit auth error event
      const authError = new Error('Gmail authentication lost during runtime');
      (authError as any).code = 'GMAIL_AUTH_LOST';
      this.emitEvent('error', authError);
    }
  }

  /**
   * Processes the response buffer to extract complete JSON-RPC messages
   */
  private processResponseBuffer(): void {
    // Split buffer by newlines to find complete JSON messages
    const lines = this.responseBuffer.split('\n');
    
    // Keep the last incomplete line in the buffer
    this.responseBuffer = lines.pop() || '';
    
    // Process complete lines
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const response = JSON.parse(line) as McpResponse;

        // Enhanced response logging
        if (response.error) {
          logger.error(`[GmailMCP] Received error response for ${response.id}:`, response.error);
        } else {
          // Log response with truncation for large responses
          const responseStr = JSON.stringify(response.result);
          if (responseStr.length > 500) {
            logger.debug(`[GmailMCP] Received response for ${response.id}: ${responseStr.substring(0, 500)}...`);
          } else {
            logger.debug(`[GmailMCP] Received response for ${response.id}:`, response.result);
          }
        }

        // Find matching pending request
        const pendingRequest = this.pendingRequests.get(response.id);
        if (pendingRequest) {
          clearTimeout(pendingRequest.timeout);
          this.pendingRequests.delete(response.id);

          if (response.error) {
            logger.error(`[GmailMCP] Tool call failed for ${pendingRequest.method}: ${response.error.message}`);
            const error = new Error(response.error.message);
            (error as any).code = response.error.code;
            (error as any).data = response.error.data;
            pendingRequest.reject(error);
          } else {
            pendingRequest.resolve(response.result);
          }
          
          this.emitEvent('response', response);
        } else {
          // Handle unsolicited messages (notifications, etc.)
          if ((response as any).method) {
            logger.debug('[GmailMCP] Received notification:', response);
          }
        }
      } catch (error) {
        // Not valid JSON yet, might be partial
        logger.debug('[GmailMCP] Failed to parse line as JSON:', line);
      }
    }
  }

  /**
   * Handles process crashes with restart logic
   */
  private async handleProcessCrash(): Promise<void> {
    // Check if we should attempt a restart
    if (this.status.restartCount >= this.config.restartAttempts) {
      logger.error(`[GmailMCP] Maximum restart attempts (${this.config.restartAttempts}) reached. Giving up.`);
      this.status.lastError = `Process crashed after ${this.status.restartCount} restart attempts`;
      this.emitEvent('error', new Error(this.status.lastError));

      // Emit a critical error that should stop the daemon
      const criticalError = new Error(`Google Workspace MCP service failed permanently after ${this.config.restartAttempts} restart attempts`);
      (criticalError as any).code = 'GMAIL_MCP_PERMANENT_FAILURE';
      this.emitEvent('error', criticalError);
      return;
    }

    // Calculate exponential backoff delay
    // Python processes may need more time between restarts
    const baseDelay = 2000; // 2 seconds for Python startup
    const maxDelay = 60000; // 60 seconds max
    const delay = Math.min(baseDelay * Math.pow(2, this.status.restartCount), maxDelay);
    
    this.status.restartCount++;
    logger.warn(`[GmailMCP] Process crashed. Attempting restart ${this.status.restartCount}/${this.config.restartAttempts} in ${delay}ms...`);
    this.emitEvent('restarting', this.status.restartCount, delay);

    // Clear any existing restart timer
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
    }

    // Schedule restart with exponential backoff
    this.restartTimer = setTimeout(async () => {
      this.restartTimer = null;
      
      try {
        logger.info(`[GmailMCP] Restart attempt ${this.status.restartCount}/${this.config.restartAttempts}`);
        
        // Clear pending requests before restart
        this.clearPendingRequests(new Error('Service restarting after crash'));
        
        // Reset process state
        this.process = null;
        this.responseBuffer = '';
        this.initializePromise = null;
        
        // Attempt to start the process again
        await this.start();
        
        logger.info(`[GmailMCP] Successfully restarted after crash (attempt ${this.status.restartCount})`);
        
        // Don't reset restart count immediately - wait for stable operation
        setTimeout(() => {
          if (this.isRunning()) {
            logger.info('[GmailMCP] Process has been stable for 60 seconds, resetting restart counter');
            this.status.restartCount = 0;
          }
        }, 60000); // Reset counter after 60 seconds of stable operation
        
      } catch (restartError) {
        logger.error(`[GmailMCP] Restart attempt ${this.status.restartCount} failed:`, restartError);
        this.status.lastError = restartError instanceof Error ? restartError.message : String(restartError);
        
        // Try again if we haven't exceeded max attempts
        if (this.status.restartCount < this.config.restartAttempts) {
          this.handleProcessCrash();
        } else {
          logger.error('[GmailMCP] All restart attempts exhausted. Service will not recover.');
          const permanentError = new Error('Gmail MCP service permanently failed');
          (permanentError as any).code = 'GMAIL_MCP_PERMANENT_FAILURE';
          this.emitEvent('error', permanentError);
        }
      }
    }, delay);
  }

  /**
   * Stops the Gmail MCP process
   * @returns Promise that resolves when process is stopped
   */
  async stop(): Promise<void> {
    if (!this.isRunning()) {
      logger.info('[GmailMCP] Process not running, nothing to stop');
      return;
    }

    logger.info('[GmailMCP] Stopping Google Workspace MCP process...');

    return new Promise<void>((resolve) => {
      // Set a timeout for force kill if graceful shutdown fails
      // Python processes may take longer to clean up
      const killTimeout = setTimeout(() => {
        if (this.process && !this.process.killed) {
          logger.warn('[GmailMCP] Graceful shutdown timeout, force killing Python process');
          this.process.kill('SIGKILL');
        }
        this.status.running = false;
        this.status.pid = undefined;
        resolve();
      }, 8000); // 8 second timeout for Python process cleanup

      // Clear any pending requests first
      this.clearPendingRequests(new Error('Service shutting down'));

      // If process exists, try graceful shutdown
      if (this.process) {
        // Listen for the exit event
        this.process.once('exit', (code, signal) => {
          clearTimeout(killTimeout);
          logger.info(`[GmailMCP] Process stopped with code ${code} and signal ${signal}`);
          this.status.running = false;
          this.status.pid = undefined;
          this.process = null;
          this.responseBuffer = '';
          this.emitEvent('stopped');
          resolve();
        });

        // Try to send a shutdown command if stdin is available
        if (this.process.stdin && !this.process.stdin.destroyed) {
          try {
            // Send MCP shutdown command
            const shutdownRequest: McpRequest = {
              jsonrpc: '2.0',
              method: 'shutdown',
              params: {},
              id: 'shutdown-' + Date.now(),
            };
            
            this.process.stdin.write(JSON.stringify(shutdownRequest) + '\n', (error) => {
              if (error) {
                logger.error('[GmailMCP] Error sending shutdown command:', error);
              } else {
                logger.debug('[GmailMCP] Shutdown command sent');
              }
              
              // Give it a moment to process the shutdown command
              setTimeout(() => {
                if (this.process && !this.process.killed) {
                  // Send SIGTERM for graceful shutdown
                  logger.info('[GmailMCP] Sending SIGTERM signal');
                  this.process.kill('SIGTERM');
                }
              }, 500);
            });
          } catch (error) {
            logger.error('[GmailMCP] Error during shutdown:', error);
            // If we can't send shutdown command, just send SIGTERM
            if (this.process && !this.process.killed) {
              this.process.kill('SIGTERM');
            }
          }
        } else {
          // If stdin is not available, just send SIGTERM
          if (this.process && !this.process.killed) {
            logger.info('[GmailMCP] Sending SIGTERM signal (stdin not available)');
            this.process.kill('SIGTERM');
          }
        }
      } else {
        // No process to stop
        clearTimeout(killTimeout);
        this.status.running = false;
        this.status.pid = undefined;
        resolve();
      }
    });
  }

  /**
   * Adds a request to the pending queue
   * @param id - Request ID
   * @param method - The MCP method
   * @param params - Method parameters
   * @param resolve - Promise resolve function
   * @param reject - Promise reject function
   * @returns The PendingRequest object
   */
  private addPendingRequest(
    id: string | number,
    method: string,
    params: Record<string, unknown> | undefined,
    resolve: (value: unknown) => void,
    reject: (error: Error) => void
  ): PendingRequest {
    // Create timeout for this request
    const timeout = setTimeout(() => {
      const request = this.pendingRequests.get(id);
      if (request) {
        this.pendingRequests.delete(id);
        const error = new Error(`Request timeout: ${method} (${this.config.requestTimeout}ms)`);
        (error as any).code = -32603;
        (error as any).method = method;
        (error as any).requestId = id;
        request.reject(error);
        logger.warn(`[GmailMCP] Request timed out: ${method} with id ${id}`);
        this.status.errorCount++;
      }
    }, this.config.requestTimeout);

    // Create pending request object
    const pendingRequest: PendingRequest = {
      id,
      method,
      params,
      timeout,
      resolve,
      reject,
      timestamp: Date.now(),
    };

    // Add to queue
    this.pendingRequests.set(id, pendingRequest);
    
    // Log queue status
    logger.debug(`[GmailMCP] Added request to queue: ${method} (${id}), queue size: ${this.pendingRequests.size}`);
    
    return pendingRequest;
  }

  /**
   * Removes a request from the pending queue
   * @param id - Request ID to remove
   * @returns True if removed, false if not found
   */
  private removePendingRequest(id: string | number): boolean {
    const request = this.pendingRequests.get(id);
    if (request) {
      clearTimeout(request.timeout);
      this.pendingRequests.delete(id);
      logger.debug(`[GmailMCP] Removed request from queue: ${request.method} (${id}), queue size: ${this.pendingRequests.size}`);
      return true;
    }
    return false;
  }

  /**
   * Clears all pending requests with an error
   * @param error - Error to reject all requests with
   */
  private clearPendingRequests(error: Error): void {
    const count = this.pendingRequests.size;
    if (count > 0) {
      logger.warn(`[GmailMCP] Clearing ${count} pending request(s) with error: ${error.message}`);
      for (const [, request] of this.pendingRequests) {
        clearTimeout(request.timeout);
        request.reject(error);
      }
      this.pendingRequests.clear();
    }
  }

  // /**
  //  * Gets pending request statistics
  //  * @returns Object with queue statistics
  //  * @internal Reserved for future monitoring features
  //  */
  // private _getQueueStats(): { size: number; oldest?: number; methods: string[] } {
  //   const stats = {
  //     size: this.pendingRequests.size,
  //     oldest: undefined as number | undefined,
  //     methods: [] as string[],
  //   };

  //   if (stats.size > 0) {
  //     let oldestTimestamp = Date.now();
  //     const methodCounts = new Map<string, number>();
      
  //     for (const request of this.pendingRequests.values()) {
  //       if (request.timestamp < oldestTimestamp) {
  //         oldestTimestamp = request.timestamp;
  //       }
  //       methodCounts.set(request.method, (methodCounts.get(request.method) || 0) + 1);
  //     }
      
  //     stats.oldest = Date.now() - oldestTimestamp;
  //     stats.methods = Array.from(methodCounts.entries()).map(
  //       ([method, count]) => `${method}(${count})`
  //     );
  //   }

  //   return stats;
  // }

  /**
   * Sends a request to the Gmail MCP process
   * @param method - The MCP method to call
   * @param params - The parameters for the method
   * @returns Promise that resolves with the response
   */
  async sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    // Check if process is running
    if (!this.isRunning()) {
      throw new Error('Gmail MCP process is not running');
    }

    if (!this.process?.stdin || this.process.stdin.destroyed) {
      throw new Error('Gmail MCP stdin is not available');
    }

    // Generate unique request ID
    const requestId = `${method}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Create the MCP request
    const request: McpRequest = {
      jsonrpc: '2.0',
      method,
      params: params || {},
      id: requestId,
    };

    // Log the request
    logger.debug(`[GmailMCP] Sending request: ${method} (${requestId})`);
    if (method === 'tools/call' && params) {
      const toolName = (params as any).name;
      const toolArgs = (params as any).arguments;
      logger.info(`[GmailMCP] Calling tool: ${toolName}`);
      logger.debug(`[GmailMCP] Tool arguments:`, toolArgs);
    } else {
      logger.debug(`[GmailMCP] Request params:`, params);
    }
    this.status.requestCount++;

    return new Promise((resolve, reject) => {
      // Add to pending requests queue with timeout
      this.addPendingRequest(
        requestId,
        method,
        params,
        resolve,
        reject
      );

      try {
        // Serialize request to JSON
        const requestJson = JSON.stringify(request);
        
        // Write to stdin with newline delimiter
        const writeSuccess = this.process!.stdin!.write(requestJson + '\n', (error) => {
          if (error) {
            // Remove from queue if write failed
            this.removePendingRequest(requestId);
            
            const writeError = new Error(`Failed to write to Gmail MCP stdin: ${error.message}`);
            (writeError as any).code = -32603;
            (writeError as any).originalError = error;
            
            logger.error(`[GmailMCP] Write error for ${method}:`, error);
            this.status.errorCount++;
            this.status.lastError = writeError.message;
            
            reject(writeError);
          } else {
            logger.debug(`[GmailMCP] Request sent successfully: ${method} (${requestId})`);
            
            // Emit request event
            this.emitEvent('request', request);
          }
        });

        // Handle backpressure
        if (!writeSuccess) {
          logger.warn(`[GmailMCP] stdin buffer full, waiting for drain event`);
          
          // Wait for drain event before continuing
          this.process!.stdin!.once('drain', () => {
            logger.debug(`[GmailMCP] stdin drained, request ${requestId} should be processed`);
          });
        }
      } catch (error) {
        // Remove from queue if an error occurred
        this.removePendingRequest(requestId);
        
        const sendError = error instanceof Error ? error : new Error(String(error));
        (sendError as any).code = -32603;
        (sendError as any).method = method;
        (sendError as any).requestId = requestId;
        
        logger.error(`[GmailMCP] Failed to send request ${method}:`, error);
        this.status.errorCount++;
        this.status.lastError = sendError.message;
        
        reject(sendError);
      }
    });
  }

  /**
   * Adapts request parameters for Google Workspace MCP
   * @param tool - Original tool name
   * @param args - Original arguments
   * @returns Adapted tool name and arguments
   */
  private adaptRequestForGoogleWorkspace(tool: string, args: Record<string, unknown>): {
    tool: string;
    args: Record<string, unknown>
  } {
    const mappedTool = this.TOOL_MAP[tool] || tool;
    const adaptedArgs = { ...args };

    // Add required user_google_email for Gmail operations
    if (mappedTool.includes('gmail')) {
      adaptedArgs.user_google_email = process.env['GMAIL_USER_EMAIL'] ||
                                      process.env['GOOGLE_USER_EMAIL'] ||
                                      'me';
    }

    // Parameter name mappings
    if (tool === 'search_emails') {
      if ('maxResults' in adaptedArgs) {
        adaptedArgs.page_size = adaptedArgs.maxResults;
        delete adaptedArgs.maxResults;
      }
      // Google Workspace MCP uses 'query_string' instead of 'query'
      if ('query' in adaptedArgs) {
        adaptedArgs.query_string = adaptedArgs.query;
        delete adaptedArgs.query;
      }
    }

    if (tool === 'read_email') {
      if ('messageId' in adaptedArgs) {
        adaptedArgs.message_id = adaptedArgs.messageId;
        delete adaptedArgs.messageId;
      }
      // Always include body content
      adaptedArgs.include_body = true;
    }

    return { tool: mappedTool, args: adaptedArgs };
  }

  /**
   * Searches for Gmail messages
   * @param params - Search parameters
   * @returns Promise that resolves with search results
   */
  async searchEmails(params: GmailSearchParams): Promise<GmailMessage[]> {
    const { tool, args } = this.adaptRequestForGoogleWorkspace('search_emails', params);
    const result = await this.sendRequest('tools/call', {
      name: tool,
      arguments: args,
    });

    // Parse and return results
    return this.parseSearchResults(result);
  }

  /**
   * Reads a Gmail message
   * @param params - Read parameters
   * @returns Promise that resolves with the email content
   */
  async readEmail(params: GmailReadParams): Promise<GmailMessage> {
    const { tool, args } = this.adaptRequestForGoogleWorkspace('read_email', params);
    const result = await this.sendRequest('tools/call', {
      name: tool,
      arguments: args,
    });

    // Parse and return email, preserving the message ID from params
    const email = this.parseEmailResult(result);
    if (email.id.startsWith('email_') && params.messageId) {
      // Replace placeholder ID with actual message ID
      email.id = params.messageId;
    }
    return email;
  }

  /**
   * Gets the current status of the Gmail MCP service
   * @returns Current service status
   */
  getStatus(): GmailMcpStatus {
    // Calculate uptime if running
    if (this.status.running && this.status.startTime) {
      this.status.uptime = Date.now() - this.status.startTime.getTime();
    }
    
    return { ...this.status };
  }

  /**
   * Checks if the Gmail MCP process is running
   * @returns True if process is running, false otherwise
   */
  isRunning(): boolean {
    return this.status.running && this.process !== null && !this.process.killed;
  }

  /**
   * Gets the configured port for Gmail MCP
   * @returns The port number
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Gets the process ID if running
   * @returns Process ID or undefined
   */
  getPid(): number | undefined {
    return this.process?.pid;
  }

  /**
   * Parses search results from MCP response
   * @param result - Raw MCP response
   * @returns Parsed Gmail messages
   */
  private parseSearchResults(result: unknown): GmailMessage[] {
    // Implementation will be refined based on actual MCP response format
    logger.debug('[GmailMCP] Parsing search results:', result);
    
    if (!result || typeof result !== 'object') {
      return [];
    }
    
    // Handle MCP response format
    const response = result as any;
    if (response.content && Array.isArray(response.content)) {
      // Parse text content if present
      const textContent = response.content[0]?.text;
      if (textContent) {
        return this.parseTextToMessages(textContent);
      }
    }
    
    return [];
  }

  /**
   * Parses email result from MCP response
   * @param result - Raw MCP response
   * @returns Parsed Gmail message
   */
  private parseEmailResult(result: unknown): GmailMessage {
    // Implementation will be refined based on actual MCP response format
    logger.info('[GmailMCP] Parsing email result:', JSON.stringify(result).substring(0, 500));
    
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid email response');
    }
    
    // Handle MCP response format
    const response = result as any;
    
    // Check if response is the weird object with numeric keys
    if (typeof response === 'object' && '0' in response) {
      // Convert numeric-keyed object to string
      const chars = [];
      let i = 0;
      while (i.toString() in response) {
        chars.push(response[i.toString()]);
        i++;
      }
      const jsonStr = chars.join('');
      logger.info('[GmailMCP] Converted numeric-keyed object to string:', jsonStr.substring(0, 200));
      
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.content && Array.isArray(parsed.content)) {
          const textContent = parsed.content[0]?.text;
          if (textContent) {
            logger.info('[GmailMCP] Text content found, length:', textContent.length);
            return this.parseTextToMessage(textContent);
          }
        }
      } catch (e) {
        logger.error('[GmailMCP] Failed to parse converted string:', e);
      }
    }
    
    // Normal response handling
    if (response.content && Array.isArray(response.content)) {
      let textContent = response.content[0]?.text;
      
      // Check if textContent is the weird numeric-keyed object
      if (textContent && typeof textContent === 'object' && '0' in textContent) {
        // Convert numeric-keyed object to string
        const chars = [];
        let i = 0;
        while (i.toString() in textContent) {
          chars.push(textContent[i.toString()]);
          i++;
        }
        textContent = chars.join('');
        logger.info('[GmailMCP] Converted text content from numeric-keyed object, new length:', textContent.length);
      }
      
      if (textContent) {
        logger.info('[GmailMCP] Text content type:', typeof textContent);
        logger.info('[GmailMCP] Text content found, length:', typeof textContent === 'string' ? textContent.length : 'not a string');
        const message = this.parseTextToMessage(textContent);
        logger.info('[GmailMCP] Parsed message has body:', !!message.body, 'body length:', message.body ? message.body.length : 0);
        return message;
      }
    }
    
    throw new Error('Unable to parse email response');
  }

  /**
   * Parses text content to Gmail messages
   * @param text - Text content from MCP
   * @returns Array of parsed messages
   */
  private parseTextToMessages(text: string | any): GmailMessage[] {
    // Check if text is the weird numeric-keyed object
    if (typeof text === 'object' && text !== null && '0' in text) {
      // Convert numeric-keyed object to string
      const chars = [];
      let i = 0;
      while (i.toString() in text) {
        chars.push(text[i.toString()]);
        i++;
      }
      text = chars.join('');
      logger.info('[GmailMCP] Converted numeric-keyed object to string in parseTextToMessages');
    }
    
    // This will be refined based on actual Gmail MCP output format
    logger.info('[GmailMCP] parseTextToMessages input length:', typeof text === 'string' ? text.length : 'not a string');
    logger.info('[GmailMCP] First 1000 chars of text:', typeof text === 'string' ? text.substring(0, 1000) : 'not a string');
    const messages: GmailMessage[] = [];
    const blocks = text.split('\n\n');
    
    for (const block of blocks) {
      const lines = block.split('\n');
      const message: Partial<GmailMessage> = {};
      
      for (const line of lines) {
        if (line.startsWith('ID: ')) {
          message.id = line.substring(4);
        } else if (line.startsWith('Subject: ')) {
          message.subject = line.substring(9);
        } else if (line.startsWith('From: ')) {
          message.from = line.substring(6);
        } else if (line.startsWith('Date: ')) {
          message.date = line.substring(6);
        }
      }
      
      if (message.id) {
        messages.push(message as GmailMessage);
      }
    }
    
    return messages;
  }

  /**
   * Parses text content to a single Gmail message
   * @param text - Text content from MCP
   * @returns Parsed message
   */
  private parseTextToMessage(text: string | any): GmailMessage {
    // Check if text is the weird numeric-keyed object
    if (typeof text === 'object' && text !== null && '0' in text) {
      // Convert numeric-keyed object to string
      const chars = [];
      let i = 0;
      while (i.toString() in text) {
        chars.push(text[i.toString()]);
        i++;
      }
      text = chars.join('');
      logger.info('[GmailMCP] Converted numeric-keyed object to string, length:', text.length);
    }
    
    logger.info('[GmailMCP] Parsing text to message, length:', typeof text === 'string' ? text.length : 'not a string');
    logger.info('[GmailMCP] First 500 chars:', typeof text === 'string' ? text.substring(0, 500) : 'not a string');
    
    // Try to parse as JSON first (common MCP format)
    try {
      const parsed = JSON.parse(text);
      // Check for various ID field names that Gmail MCP might use
      const messageId = parsed.id || parsed.messageId || parsed.message_id || parsed.emailId || parsed.email_id;
      if (messageId || parsed.subject || parsed.from) {
        return {
          id: messageId || 'email_' + Date.now(),
          subject: parsed.subject || '',
          from: parsed.from || '',
          to: parsed.to || '',
          date: parsed.date || '',
          body: parsed.body || parsed.content || parsed.snippet || '',
          snippet: parsed.snippet,
          attachments: parsed.attachments || []
        };
      }
    } catch (e) {
      // Not JSON, try text parsing
    }
    
    // Parse as formatted text
    const message: Partial<GmailMessage> = {};
    
    // Check if the entire text is the email content (common for read_email)
    if (!text.includes('ID:') && !text.includes('Subject:')) {
      // The entire text is likely the email body
      // Extract message ID from the request context or generate a placeholder
      message.id = 'email_' + Date.now();
      message.body = text;
      message.subject = 'Email Content';
      return message as GmailMessage;
    }
    
    // Parse structured text format
    const lines = text.split('\n');
    let bodyStartIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      if (line.startsWith('ID: ') || line.startsWith('Thread ID: ')) {
        message.id = line.substring(line.indexOf(':') + 1).trim();
      } else if (line.startsWith('Subject: ')) {
        message.subject = line.substring(9).trim();
      } else if (line.startsWith('From: ')) {
        message.from = line.substring(6).trim();
      } else if (line.startsWith('To: ')) {
        message.to = line.substring(4).trim();
      } else if (line.startsWith('Date: ')) {
        message.date = line.substring(6).trim();
      } else if (line.startsWith('Body: ')) {
        message.body = lines.slice(i).join('\n').substring(6).trim();
        break;
      } else if (line === '' && i > 0 && bodyStartIndex === -1) {
        // Empty line after headers indicates start of body
        bodyStartIndex = i + 1;
      }
    }
    
    // If we found a body start index but didn't find "Body:" prefix, take everything after the empty line
    if (!message.body && bodyStartIndex > 0) {
      message.body = lines.slice(bodyStartIndex).join('\n');
    }
    
    // If no structured format found, treat entire text as body
    if (!message.id && !message.subject) {
      message.id = 'email_' + Date.now();
      message.body = text;
      message.subject = 'Email Content';
    }
    
    if (!message.id) {
      logger.warn('[GmailMCP] No message ID found, generating placeholder');
      message.id = 'email_' + Date.now();
    }
    
    return message as GmailMessage;
  }

  /**
   * Emits a typed event
   * @param event - Event name
   * @param args - Event arguments
   */
  private emitEvent(event: GmailMcpEvent, ...args: any[]): boolean {
    logger.debug(`[GmailMCP] Event: ${event}`, args);
    return this.emit(event, ...args);
  }

  /**
   * Cleans up resources
   */
  async cleanup(): Promise<void> {
    // Clear any pending requests
    this.clearPendingRequests(new Error('Service shutting down'));

    // Clear restart timer if any
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    // Stop the process if running
    if (this.isRunning()) {
      await this.stop();
    }
  }
}