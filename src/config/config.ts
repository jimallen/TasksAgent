import dotenv from 'dotenv';
import path from 'path';

// Load environment variables (quietly to avoid duplicate output)
// The daemon.ts file already loads dotenv with appropriate settings
if (!process.env['DOTENV_LOADED']) {
  dotenv.config({ quiet: true });
  process.env['DOTENV_LOADED'] = 'true';
}

/**
 * Configuration priority levels
 */
export enum ConfigPriority {
  DEFAULT = 0,
  ENVIRONMENT = 1,
  CLI_ARGUMENT = 2
}

/**
 * Configuration source tracking
 */
export interface ConfigSource<T> {
  value: T;
  priority: ConfigPriority;
  source: string;
}

/**
 * Generic configuration resolver that handles priority
 */
export class ConfigResolver<T> {
  private sources: ConfigSource<T>[] = [];
  
  constructor(private defaultValue: T, private defaultSource: string = 'default') {
    this.addSource(defaultValue, ConfigPriority.DEFAULT, defaultSource);
  }
  
  addSource(value: T | undefined, priority: ConfigPriority, source: string): void {
    if (value !== undefined && value !== null) {
      // Remove any existing source with same priority
      this.sources = this.sources.filter(s => s.priority !== priority);
      this.sources.push({ value, priority, source });
    }
  }
  
  resolve(): T {
    // Sort by priority (highest first) and return first value
    const sorted = [...this.sources].sort((a, b) => b.priority - a.priority);
    return sorted[0]?.value ?? this.defaultValue;
  }
  
  getSource(): string {
    const sorted = [...this.sources].sort((a, b) => b.priority - a.priority);
    return sorted[0]?.source ?? this.defaultSource;
  }
  
  getAllSources(): ConfigSource<T>[] {
    return [...this.sources].sort((a, b) => b.priority - a.priority);
  }
}

export const config = {
  async load() {
    // Configuration is already loaded from environment variables
    return this;
  },
  
  // Port configuration for services using priority resolver
  ports: {
    // HTTP Server port resolver
    httpServer: (() => {
      const resolver = new ConfigResolver<number>(3002, 'default (3002)');
      
      // Add environment variable if set
      const envPort = process.env['HTTP_SERVER_PORT'];
      if (envPort) {
        const parsed = parseInt(envPort, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
          resolver.addSource(parsed, ConfigPriority.ENVIRONMENT, `HTTP_SERVER_PORT (${parsed})`);
        }
      }
      
      return {
        resolver,
        default: 3002,
        resolved: () => resolver.resolve(),
        getSource: () => resolver.getSource(),
        setCLI: (port: number) => {
          resolver.addSource(port, ConfigPriority.CLI_ARGUMENT, `--http-port (${port})`);
        }
      };
    })(),
    
    // Gmail MCP service port resolver
    gmailMcp: (() => {
      const resolver = new ConfigResolver<number>(3000, 'default (3000)');
      
      // Add environment variable if set
      const envPort = process.env['GMAIL_MCP_PORT'];
      if (envPort) {
        const parsed = parseInt(envPort, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
          resolver.addSource(parsed, ConfigPriority.ENVIRONMENT, `GMAIL_MCP_PORT (${parsed})`);
        }
      }
      
      return {
        resolver,
        default: 3000,
        resolved: () => resolver.resolve(),
        getSource: () => resolver.getSource(),
        setCLI: (port: number) => {
          resolver.addSource(port, ConfigPriority.CLI_ARGUMENT, `--gmail-mcp-port (${port})`);
        }
      };
    })(),
    
    // Validate that ports don't conflict
    validate: function(): { valid: boolean; errors: string[]; warnings: string[] } {
      const errors: string[] = [];
      const warnings: string[] = [];
      const httpPort = this.httpServer.resolved();
      const gmailPort = this.gmailMcp.resolved();
      
      // Check for port conflicts between services
      if (httpPort === gmailPort) {
        errors.push(`Port conflict: Both HTTP Server and Gmail MCP are using port ${httpPort}`);
        errors.push(`Use different ports for each service (e.g., --http-port 3002 --gmail-mcp-port 3000)`);
      }
      
      // Check for valid port ranges (1024-65535 for non-root users)
      if (httpPort < 1) {
        errors.push(`HTTP Server port ${httpPort} is invalid (must be positive)`);
      } else if (httpPort < 1024) {
        warnings.push(`HTTP Server port ${httpPort} requires root/admin privileges (ports below 1024)`);
      } else if (httpPort > 65535) {
        errors.push(`HTTP Server port ${httpPort} exceeds maximum port number 65535`);
      }
      
      if (gmailPort < 1) {
        errors.push(`Gmail MCP port ${gmailPort} is invalid (must be positive)`);
      } else if (gmailPort < 1024) {
        warnings.push(`Gmail MCP port ${gmailPort} requires root/admin privileges (ports below 1024)`);
      } else if (gmailPort > 65535) {
        errors.push(`Gmail MCP port ${gmailPort} exceeds maximum port number 65535`);
      }
      
      // Check for well-known ports that might cause conflicts
      const wellKnownPorts: { [key: number]: string } = {
        21: 'FTP',
        22: 'SSH',
        25: 'SMTP',
        80: 'HTTP',
        443: 'HTTPS',
        3306: 'MySQL',
        5432: 'PostgreSQL',
        6379: 'Redis',
        27017: 'MongoDB'
      };
      
      if (wellKnownPorts[httpPort]) {
        warnings.push(`HTTP Server port ${httpPort} is typically used for ${wellKnownPorts[httpPort]}`);
      }
      if (wellKnownPorts[gmailPort]) {
        warnings.push(`Gmail MCP port ${gmailPort} is typically used for ${wellKnownPorts[gmailPort]}`);
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    }
  },
  
  gmail: {
    mcp: {
      serverUrl: process.env['GMAIL_MCP_SERVER_URL'] || '',
      clientId: process.env['GMAIL_CLIENT_ID'] || '',
      clientSecret: process.env['GMAIL_CLIENT_SECRET'] || '',
      refreshToken: process.env['GMAIL_REFRESH_TOKEN'] || '',
      accessToken: process.env['GMAIL_ACCESS_TOKEN'] || '',
      // New Gmail MCP daemon configuration
      restartAttempts: parseInt(process.env['GMAIL_MCP_RESTART_ATTEMPTS'] || '3', 10),
      startupTimeout: parseInt(process.env['GMAIL_MCP_STARTUP_TIMEOUT'] || '10000', 10),
      requestTimeout: parseInt(process.env['GMAIL_MCP_REQUEST_TIMEOUT'] || '30000', 10),
      authPath: process.env['GMAIL_MCP_AUTH_PATH'] || '~/.gmail-mcp/',
    },
    hoursToLookBack: process.env['GMAIL_HOURS_LOOKBACK'] || '24',
    checkIntervalHours: parseInt(process.env['GMAIL_CHECK_INTERVAL_HOURS'] || '8', 10),
    senderDomains: (process.env['GMAIL_SENDER_DOMAINS'] || '@google.com,@meet.google.com').split(
      ','
    ),
    subjectPatterns: (
      process.env['GMAIL_SUBJECT_PATTERNS'] || 'Recording of,Transcript for,Meeting notes,Notes:'
    ).split(','),
  },

  obsidian: {
    vaultPath:
      process.env['OBSIDIAN_VAULT_PATH'] || path.join(process.env['HOME'] || '', 'Obsidian'),
    meetingsFolder: process.env['OBSIDIAN_MEETINGS_FOLDER'] || 'Meetings',
    taskTag: process.env['OBSIDIAN_TASK_TAG'] || '#meeting-task',
  },

  scheduling: {
    times: (process.env['SCHEDULE_TIMES'] || '09:00,13:00,17:00').split(','),
    timezone: process.env['TIMEZONE'] || 'America/New_York',
  },

  notifications: {
    enabled: process.env['ENABLE_NOTIFICATIONS'] === 'true',
    type: process.env['NOTIFICATION_TYPE'] || 'desktop',
  },

  app: {
    nodeEnv: process.env['NODE_ENV'] || 'development',
    logLevel: process.env['LOG_LEVEL'] || 'info',
    logFilePath: process.env['LOG_FILE_PATH'] || './logs/app.log',
  },

  ai: {
    openaiApiKey: process.env['OPENAI_API_KEY'] || '',
    model: process.env['AI_MODEL'] || 'gpt-3.5-turbo',
    temperature: parseFloat(process.env['AI_TEMPERATURE'] || '0.3'),
    maxTokens: parseInt(process.env['AI_MAX_TOKENS'] || '500', 10),
  },

  database: {
    stateFilePath: process.env['STATE_FILE_PATH'] || './data/processed-emails.json',
    taskHistoryPath: process.env['TASK_HISTORY_PATH'] || './data/task-history.json',
    maxHistoryDays: parseInt(process.env['MAX_HISTORY_DAYS'] || '30', 10),
  },

  errorHandling: {
    maxRetryAttempts: parseInt(process.env['MAX_RETRY_ATTEMPTS'] || '3', 10),
    retryDelayMs: parseInt(process.env['RETRY_DELAY_MS'] || '5000', 10),
    errorNotification: process.env['ERROR_NOTIFICATION'] === 'true',
  },

  performance: {
    maxConcurrentTranscripts: parseInt(process.env['MAX_CONCURRENT_TRANSCRIPTS'] || '3', 10),
    transcriptTimeoutMs: parseInt(process.env['TRANSCRIPT_TIMEOUT_MS'] || '30000', 10),
    cleanupTempFiles: process.env['CLEANUP_TEMP_FILES'] !== 'false',
  },
};

// Validate required configuration
export function validateConfig(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.obsidian.vaultPath) {
    errors.push('OBSIDIAN_VAULT_PATH is required');
  }

  // Port configuration validation
  const portValidation = config.ports.validate();
  if (!portValidation.valid) {
    errors.push(...portValidation.errors);
  }

  // Gmail MCP validation
  if (config.gmail.mcp.restartAttempts < 1 || config.gmail.mcp.restartAttempts > 10) {
    warnings.push(`GMAIL_MCP_RESTART_ATTEMPTS should be between 1 and 10 (got: ${config.gmail.mcp.restartAttempts})`);
  }
  
  if (config.gmail.mcp.startupTimeout < 5000 || config.gmail.mcp.startupTimeout > 60000) {
    warnings.push(`GMAIL_MCP_STARTUP_TIMEOUT should be between 5000 and 60000ms (got: ${config.gmail.mcp.startupTimeout})`);
  }
  
  if (config.gmail.mcp.requestTimeout < 10000 || config.gmail.mcp.requestTimeout > 120000) {
    warnings.push(`GMAIL_MCP_REQUEST_TIMEOUT should be between 10000 and 120000ms (got: ${config.gmail.mcp.requestTimeout})`);
  }

  if (config.app.nodeEnv === 'production') {
    if (!config.gmail.mcp.clientId || !config.gmail.mcp.clientSecret) {
      warnings.push('Gmail MCP OAuth credentials may be required - ensure Gmail MCP is authenticated');
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn('Configuration warnings:\n' + warnings.join('\n'));
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Update port configuration from CLI arguments
 * @param cliArgs Object containing httpPort and/or gmailMcpPort from CLI
 */
export function updatePortsFromCLI(cliArgs: { httpPort?: number; gmailMcpPort?: number }): void {
  if (cliArgs.httpPort !== undefined) {
    config.ports.httpServer.setCLI(cliArgs.httpPort);
  }
  if (cliArgs.gmailMcpPort !== undefined) {
    config.ports.gmailMcp.setCLI(cliArgs.gmailMcpPort);
  }
}

/**
 * Get resolved port configuration for all services
 * @returns Object with resolved port numbers
 */
export function getResolvedPorts(): { httpServer: number; gmailMcp: number } {
  return {
    httpServer: config.ports.httpServer.resolved(),
    gmailMcp: config.ports.gmailMcp.resolved()
  };
}

/**
 * Get port configuration details including sources
 * @returns Detailed port configuration with sources
 */
export function getPortConfigDetails(): {
  httpServer: { 
    port: number; 
    source: string; 
    priority: ConfigPriority;
    allSources: ConfigSource<number>[];
  };
  gmailMcp: { 
    port: number; 
    source: string;
    priority: ConfigPriority;
    allSources: ConfigSource<number>[];
  };
} {
  const httpServer = config.ports.httpServer;
  const gmailMcp = config.ports.gmailMcp;
  
  const httpSources = httpServer.resolver.getAllSources();
  const gmailSources = gmailMcp.resolver.getAllSources();
  
  return {
    httpServer: {
      port: httpServer.resolved(),
      source: httpServer.getSource(),
      priority: httpSources[0]?.priority ?? ConfigPriority.DEFAULT,
      allSources: httpSources
    },
    gmailMcp: {
      port: gmailMcp.resolved(),
      source: gmailMcp.getSource(),
      priority: gmailSources[0]?.priority ?? ConfigPriority.DEFAULT,
      allSources: gmailSources
    }
  };
}

/**
 * Get configuration priority information
 * @returns Human-readable priority explanation
 */
export function getConfigPriorityInfo(): string[] {
  return [
    'Configuration Priority System:',
    '1. CLI Arguments (--http-port, --gmail-mcp-port) - Highest priority',
    '2. Environment Variables (HTTP_SERVER_PORT, GMAIL_MCP_PORT) - Medium priority',
    '3. Default Values (HTTP: 3002, Gmail MCP: 3000) - Lowest priority',
    '',
    'The first available value in priority order is used.'
  ];
}

/**
 * Resolve all configuration from all sources with proper precedence
 * @param cliArgs Optional CLI arguments to include in resolution
 * @returns Complete resolved configuration
 */
export function resolveConfiguration(cliArgs?: { 
  httpPort?: number; 
  gmailMcpPort?: number;
  [key: string]: any;
}): {
  ports: {
    http: number;
    gmailMcp: number;
  };
  sources: {
    httpPort: { value: number; source: string; priority: string };
    gmailMcpPort: { value: number; source: string; priority: string };
  };
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
} {
  // Apply CLI arguments if provided
  if (cliArgs) {
    updatePortsFromCLI(cliArgs);
  }
  
  // Get resolved ports
  const ports = getResolvedPorts();
  const details = getPortConfigDetails();
  
  // Perform validation
  const portValidation = config.ports.validate();
  
  // Combine warnings from validation
  const warnings: string[] = [...portValidation.warnings];
  
  // Check for common port conflicts (only add if not already warned)
  const commonPorts = [80, 443, 3000, 3001, 3002, 5000, 8000, 8080, 8888];
  if (commonPorts.includes(ports.httpServer) && 
      !warnings.some(w => w.includes(`port ${ports.httpServer}`))) {
    warnings.push(`HTTP Server port ${ports.httpServer} is commonly used - ensure it's available`);
  }
  if (commonPorts.includes(ports.gmailMcp) && 
      !warnings.some(w => w.includes(`port ${ports.gmailMcp}`))) {
    warnings.push(`Gmail MCP port ${ports.gmailMcp} is commonly used - ensure it's available`);
  }
  
  return {
    ports: {
      http: ports.httpServer,
      gmailMcp: ports.gmailMcp
    },
    sources: {
      httpPort: {
        value: details.httpServer.port,
        source: details.httpServer.source,
        priority: ConfigPriority[details.httpServer.priority]
      },
      gmailMcpPort: {
        value: details.gmailMcp.port,
        source: details.gmailMcp.source,
        priority: ConfigPriority[details.gmailMcp.priority]
      }
    },
    validation: {
      valid: portValidation.valid,
      errors: portValidation.errors,
      warnings
    }
  };
}

/**
 * Merge configuration from multiple sources maintaining priority
 * @param sources Array of configuration sources with their priorities
 * @returns Merged configuration respecting priority order
 */
export function mergeConfigurationSources<T extends Record<string, any>>(
  sources: Array<{ config: Partial<T>; priority: ConfigPriority }>
): T {
  // Sort sources by priority (highest first)
  const sorted = [...sources].sort((a, b) => b.priority - a.priority);
  
  // Merge from lowest to highest priority (so highest overwrites)
  const reversed = [...sorted].reverse();
  let merged = {} as T;
  
  for (const source of reversed) {
    merged = { ...merged, ...source.config };
  }
  
  return merged;
}

/**
 * Get all configuration sources for debugging
 * @returns All configuration sources with their values and priorities
 */
export function getAllConfigurationSources(): {
  httpPort: ConfigSource<number>[];
  gmailMcpPort: ConfigSource<number>[];
} {
  return {
    httpPort: config.ports.httpServer.resolver.getAllSources(),
    gmailMcpPort: config.ports.gmailMcp.resolver.getAllSources()
  };
}

/**
 * Comprehensive configuration validation
 * @param checkAvailability Whether to check if ports are actually available (async operation)
 * @returns Validation results with errors, warnings, and suggestions
 */
export async function validatePortConfiguration(checkAvailability: boolean = false): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  portStatus?: {
    httpServer: { port: number; available?: boolean };
    gmailMcp: { port: number; available?: boolean };
  };
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  // Get current port configuration
  const ports = getResolvedPorts();
  const portValidation = config.ports.validate();
  
  // Add validation results
  errors.push(...portValidation.errors);
  warnings.push(...portValidation.warnings);
  
  // Add detailed port information
  const portStatus = {
    httpServer: { port: ports.httpServer, available: undefined as boolean | undefined },
    gmailMcp: { port: ports.gmailMcp, available: undefined as boolean | undefined }
  };
  
  // Check port availability if requested
  if (checkAvailability) {
    try {
      // Dynamic import to avoid circular dependencies
      const { checkPortAvailable, generatePortSuggestions } = await import('../cli/portValidator');
      
      // Check HTTP server port
      const httpAvailable = await checkPortAvailable(ports.httpServer);
      portStatus.httpServer.available = httpAvailable;
      if (!httpAvailable) {
        errors.push(`HTTP Server port ${ports.httpServer} is already in use`);
        const httpSuggestions = generatePortSuggestions(ports.httpServer, [ports.httpServer], 3);
        if (httpSuggestions.length > 0) {
          suggestions.push(`Try HTTP Server port: ${httpSuggestions.join(', ')}`);
        }
      }
      
      // Check Gmail MCP port
      const gmailAvailable = await checkPortAvailable(ports.gmailMcp);
      portStatus.gmailMcp.available = gmailAvailable;
      if (!gmailAvailable) {
        errors.push(`Gmail MCP port ${ports.gmailMcp} is already in use`);
        const gmailSuggestions = generatePortSuggestions(ports.gmailMcp, [ports.gmailMcp], 3);
        if (gmailSuggestions.length > 0) {
          suggestions.push(`Try Gmail MCP port: ${gmailSuggestions.join(', ')}`);
        }
      }
    } catch (error) {
      warnings.push(`Could not check port availability: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Add configuration source information
  const details = getPortConfigDetails();
  if (details.httpServer.priority === ConfigPriority.DEFAULT && 
      details.gmailMcp.priority === ConfigPriority.DEFAULT) {
    suggestions.push('Using default ports. Customize with --http-port and --gmail-mcp-port or environment variables');
  }
  
  // Check for Docker/container environment
  if (process.env['DOCKER'] || process.env['CONTAINER']) {
    suggestions.push('Running in container - ensure ports are properly exposed/mapped');
  }
  
  // Suggest using standard development ports if having conflicts
  if (errors.some(e => e.includes('already in use'))) {
    suggestions.push('Common development ports: 3000-3010, 8000-8010, 5000-5010');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    portStatus
  };
}

/**
 * Validate full configuration including non-port settings
 * @returns Validation results for entire configuration
 */
export function validateFullConfiguration(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sections: {
    ports: { valid: boolean; errors: string[]; warnings: string[] };
    obsidian: { valid: boolean; errors: string[]; warnings: string[] };
    gmail: { valid: boolean; errors: string[]; warnings: string[] };
  };
} {
  const sections = {
    ports: config.ports.validate(),
    obsidian: { valid: true, errors: [] as string[], warnings: [] as string[] },
    gmail: { valid: true, errors: [] as string[], warnings: [] as string[] }
  };
  
  // Validate Obsidian configuration
  if (!config.obsidian.vaultPath) {
    sections.obsidian.errors.push('OBSIDIAN_VAULT_PATH is required');
    sections.obsidian.valid = false;
  }
  
  // Validate Gmail MCP configuration
  if (config.gmail.mcp.restartAttempts < 1 || config.gmail.mcp.restartAttempts > 10) {
    sections.gmail.warnings.push(`GMAIL_MCP_RESTART_ATTEMPTS should be between 1 and 10 (got: ${config.gmail.mcp.restartAttempts})`);
  }
  
  if (config.gmail.mcp.startupTimeout < 5000 || config.gmail.mcp.startupTimeout > 60000) {
    sections.gmail.warnings.push(`GMAIL_MCP_STARTUP_TIMEOUT should be between 5000 and 60000ms (got: ${config.gmail.mcp.startupTimeout})`);
  }
  
  if (config.gmail.mcp.requestTimeout < 10000 || config.gmail.mcp.requestTimeout > 120000) {
    sections.gmail.warnings.push(`GMAIL_MCP_REQUEST_TIMEOUT should be between 10000 and 120000ms (got: ${config.gmail.mcp.requestTimeout})`);
  }
  
  // Collect all errors and warnings
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  
  for (const section of Object.values(sections)) {
    allErrors.push(...section.errors);
    allWarnings.push(...section.warnings);
  }
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    sections
  };
}

/**
 * Get active configuration for --config-dump feature
 * @param cliArgs Optional CLI arguments to include in the dump
 * @returns Formatted configuration dump string
 */
export function getActiveConfiguration(cliArgs?: { 
  httpPort?: number; 
  gmailMcpPort?: number;
  [key: string]: any;
}): string {
  // Apply CLI arguments if provided
  if (cliArgs) {
    updatePortsFromCLI(cliArgs);
  }
  
  const lines: string[] = [];
  const ports = getResolvedPorts();
  const details = getPortConfigDetails();
  const validation = config.ports.validate();
  
  // Header
  lines.push('');
  lines.push('='.repeat(80));
  lines.push('ACTIVE CONFIGURATION DUMP');
  lines.push('='.repeat(80));
  lines.push('');
  
  // Timestamp
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Process ID: ${process.pid}`);
  lines.push(`Node Version: ${process.version}`);
  lines.push(`Platform: ${process.platform} ${process.arch}`);
  lines.push(`Working Directory: ${process.cwd()}`);
  lines.push('');
  
  // Port Configuration Section
  lines.push('PORT CONFIGURATION');
  lines.push('-'.repeat(40));
  
  // HTTP Server Port
  lines.push('HTTP Server:');
  lines.push(`  Active Port: ${ports.httpServer}`);
  lines.push(`  Source: ${details.httpServer.source}`);
  lines.push(`  Priority Level: ${ConfigPriority[details.httpServer.priority]}`);
  lines.push('  All Sources (in priority order):');
  for (const source of details.httpServer.allSources) {
    const marker = source.priority === details.httpServer.priority ? ' ✓' : '  ';
    lines.push(`  ${marker} [${ConfigPriority[source.priority]}] ${source.source}: ${source.value}`);
  }
  lines.push('');
  
  // Gmail MCP Port
  lines.push('Gmail MCP Service:');
  lines.push(`  Active Port: ${ports.gmailMcp}`);
  lines.push(`  Source: ${details.gmailMcp.source}`);
  lines.push(`  Priority Level: ${ConfigPriority[details.gmailMcp.priority]}`);
  lines.push('  All Sources (in priority order):');
  for (const source of details.gmailMcp.allSources) {
    const marker = source.priority === details.gmailMcp.priority ? ' ✓' : '  ';
    lines.push(`  ${marker} [${ConfigPriority[source.priority]}] ${source.source}: ${source.value}`);
  }
  lines.push('');
  
  // Validation Status
  lines.push('VALIDATION STATUS');
  lines.push('-'.repeat(40));
  
  if (validation.valid) {
    lines.push('✓ Configuration is valid');
  } else {
    lines.push('✗ Configuration has errors:');
    for (const error of validation.errors) {
      lines.push(`  ERROR: ${error}`);
    }
  }
  
  if (validation.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const warning of validation.warnings) {
      lines.push(`  ⚠ ${warning}`);
    }
  }
  lines.push('');
  
  // Environment Variables
  lines.push('ENVIRONMENT VARIABLES');
  lines.push('-'.repeat(40));
  
  const envVars = {
    'HTTP_SERVER_PORT': process.env['HTTP_SERVER_PORT'] || '(not set)',
    'GMAIL_MCP_PORT': process.env['GMAIL_MCP_PORT'] || '(not set)',
    'OBSIDIAN_VAULT_PATH': process.env['OBSIDIAN_VAULT_PATH'] || '(not set)',
    'GMAIL_HOURS_LOOKBACK': process.env['GMAIL_HOURS_LOOKBACK'] || '(not set)',
    'NODE_ENV': process.env['NODE_ENV'] || '(not set)',
  };
  
  for (const [key, value] of Object.entries(envVars)) {
    lines.push(`${key}: ${value}`);
  }
  lines.push('');
  
  // Key Configuration Values
  lines.push('KEY CONFIGURATION');
  lines.push('-'.repeat(40));
  
  lines.push('Obsidian:');
  lines.push(`  Vault Path: ${config.obsidian.vaultPath || '(not configured)'}`);
  lines.push(`  Meetings Folder: ${config.obsidian.meetingsFolder}`);
  lines.push('');
  
  lines.push('Gmail MCP:');
  lines.push(`  Auth Path: ${config.gmail.mcp.authPath}`);
  lines.push(`  Restart Attempts: ${config.gmail.mcp.restartAttempts}`);
  lines.push(`  Startup Timeout: ${config.gmail.mcp.startupTimeout}ms`);
  lines.push(`  Request Timeout: ${config.gmail.mcp.requestTimeout}ms`);
  lines.push('');
  
  lines.push('Gmail Settings:');
  lines.push(`  Hours to Look Back: ${config.gmail.hoursToLookBack}`);
  lines.push(`  Check Interval: ${config.gmail.checkIntervalHours} hours`);
  lines.push('');
  
  // Priority Information
  lines.push('CONFIGURATION PRIORITY');
  lines.push('-'.repeat(40));
  const priorityInfo = getConfigPriorityInfo();
  for (const line of priorityInfo) {
    lines.push(line);
  }
  
  // How to Change Configuration
  lines.push('');
  lines.push('HOW TO CHANGE CONFIGURATION');
  lines.push('-'.repeat(40));
  lines.push('1. Command Line (highest priority):');
  lines.push('   npm run daemon -- --http-port 8080 --gmail-mcp-port 9000');
  lines.push('');
  lines.push('2. Environment Variables (medium priority):');
  lines.push('   export HTTP_SERVER_PORT=8080');
  lines.push('   export GMAIL_MCP_PORT=9000');
  lines.push('');
  lines.push('3. Edit .env file (loaded as environment variables):');
  lines.push('   HTTP_SERVER_PORT=8080');
  lines.push('   GMAIL_MCP_PORT=9000');
  lines.push('');
  
  // Footer
  lines.push('='.repeat(80));
  lines.push('END OF CONFIGURATION DUMP');
  lines.push('='.repeat(80));
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Get active configuration as JSON for programmatic use
 * @param cliArgs Optional CLI arguments to include
 * @returns Configuration object
 */
export function getActiveConfigurationJSON(cliArgs?: { 
  httpPort?: number; 
  gmailMcpPort?: number;
  [key: string]: any;
}): Record<string, any> {
  // Apply CLI arguments if provided
  if (cliArgs) {
    updatePortsFromCLI(cliArgs);
  }
  
  const ports = getResolvedPorts();
  const details = getPortConfigDetails();
  const validation = config.ports.validate();
  
  return {
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd()
    },
    ports: {
      httpServer: {
        active: ports.httpServer,
        source: details.httpServer.source,
        priority: ConfigPriority[details.httpServer.priority],
        allSources: details.httpServer.allSources.map(s => ({
          value: s.value,
          priority: ConfigPriority[s.priority],
          source: s.source
        }))
      },
      gmailMcp: {
        active: ports.gmailMcp,
        source: details.gmailMcp.source,
        priority: ConfigPriority[details.gmailMcp.priority],
        allSources: details.gmailMcp.allSources.map(s => ({
          value: s.value,
          priority: ConfigPriority[s.priority],
          source: s.source
        }))
      }
    },
    validation: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings
    },
    environment: {
      HTTP_SERVER_PORT: process.env['HTTP_SERVER_PORT'],
      GMAIL_MCP_PORT: process.env['GMAIL_MCP_PORT'],
      OBSIDIAN_VAULT_PATH: process.env['OBSIDIAN_VAULT_PATH'],
      GMAIL_HOURS_LOOKBACK: process.env['GMAIL_HOURS_LOOKBACK'],
      NODE_ENV: process.env['NODE_ENV']
    },
    configuration: {
      obsidian: {
        vaultPath: config.obsidian.vaultPath,
        meetingsFolder: config.obsidian.meetingsFolder
      },
      gmailMcp: {
        authPath: config.gmail.mcp.authPath,
        restartAttempts: config.gmail.mcp.restartAttempts,
        startupTimeout: config.gmail.mcp.startupTimeout,
        requestTimeout: config.gmail.mcp.requestTimeout
      },
      gmail: {
        hoursToLookBack: config.gmail.hoursToLookBack,
        checkIntervalHours: config.gmail.checkIntervalHours
      }
    }
  };
}

/**
 * Reset configuration to defaults (useful for testing)
 */
export function resetConfiguration(): void {
  // Create new resolvers with only default values
  const httpResolver = new ConfigResolver<number>(3002, 'default (3002)');
  const gmailResolver = new ConfigResolver<number>(3000, 'default (3000)');
  
  // Re-add environment variables if they exist
  const httpEnv = process.env['HTTP_SERVER_PORT'];
  if (httpEnv) {
    const parsed = parseInt(httpEnv, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
      httpResolver.addSource(parsed, ConfigPriority.ENVIRONMENT, `HTTP_SERVER_PORT (${parsed})`);
    }
  }
  
  const gmailEnv = process.env['GMAIL_MCP_PORT'];
  if (gmailEnv) {
    const parsed = parseInt(gmailEnv, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
      gmailResolver.addSource(parsed, ConfigPriority.ENVIRONMENT, `GMAIL_MCP_PORT (${parsed})`);
    }
  }
  
  // Update the config ports with new resolvers
  (config.ports.httpServer as any).resolver = httpResolver;
  (config.ports.gmailMcp as any).resolver = gmailResolver;
}

export default config;
