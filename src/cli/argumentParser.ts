/**
 * Comprehensive CLI argument parsing system
 */

import {
  CLIArguments,
  CLIParseResult,
  PortConfiguration,
  HelpInfo,
  HelpSection
} from '../types/cli';
import {
  parsePort,
  validatePortRange,
  isValidPortConfiguration
} from './portValidator';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Known valid arguments for suggestion matching
 */
const KNOWN_ARGUMENTS = [
  '--help',
  '--version',
  '--headless',
  '--config-dump',
  '--http-port',
  '--gmail-mcp-port'
];

/**
 * Known short flags
 * Note: -h traditionally means --help, but for backward compatibility
 * with the daemon, we need to check context
 */
const SHORT_FLAGS: { [key: string]: string } = {
  '-h': '--headless',  // For daemon backward compatibility
  '-v': '--version'
};

/**
 * Calculate similarity between two strings (simplified Levenshtein distance)
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity score (lower is more similar)
 */
function calculateSimilarity(str1: string, str2: string): number {
  // Simple character difference calculation for suggestion matching
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // If strings are equal, similarity is 0 (perfect match)
  if (s1 === s2) return 0;
  
  // Check if one string starts with the other (partial match)
  if (s1.startsWith(s2) || s2.startsWith(s1)) {
    return Math.abs(s1.length - s2.length);
  }
  
  // Count character differences
  let differences = Math.abs(s1.length - s2.length);
  const minLength = Math.min(s1.length, s2.length);
  
  for (let i = 0; i < minLength; i++) {
    if (s1[i] !== s2[i]) {
      differences++;
    }
  }
  
  return differences;
}

/**
 * Find similar arguments to suggest
 * @param unknownArg The unknown argument
 * @returns Array of similar arguments
 */
function findSimilarArguments(unknownArg: string): string[] {
  const similarities = KNOWN_ARGUMENTS
    .map(known => ({
      arg: known,
      score: calculateSimilarity(unknownArg.toLowerCase(), known.toLowerCase())
    }))
    .filter(item => item.score <= 5) // Only suggest if reasonably similar
    .sort((a, b) => a.score - b.score)
    .slice(0, 2) // Return top 2 suggestions
    .map(item => item.arg);
  
  return similarities;
}

/**
 * Format error message with suggestions
 * @param message Base error message
 * @param suggestions Optional suggestions
 * @returns Formatted error message
 */
function formatErrorWithSuggestions(message: string, suggestions?: string[]): string {
  if (!suggestions || suggestions.length === 0) {
    return message;
  }
  
  if (suggestions.length === 1) {
    return `${message}. Did you mean '${suggestions[0]}'?`;
  }
  
  return `${message}. Did you mean one of: ${suggestions.join(', ')}?`;
}

/**
 * Parse command line arguments into structured format
 * @param args Array of command line arguments (typically process.argv.slice(2))
 * @returns Parsed CLI arguments with validation results
 */
export function parseArguments(args: string[]): CLIParseResult {
  const arguments_: CLIArguments = {};
  const errors: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    // Skip if arg is undefined or empty (should not happen in normal cases)
    if (!arg || arg === '') {
      continue;
    }
    
    // Handle help flag
    if (arg === '--help') {
      arguments_.help = true;
      continue;
    }
    
    // Handle -h flag (headless for backward compatibility)
    if (arg === '-h') {
      arguments_.headless = true;
      continue;
    }
    
    // Handle version flag
    if (arg === '--version' || arg === '-v') {
      arguments_.version = true;
      continue;
    }
    
    // Handle headless flag
    if (arg === '--headless') {
      arguments_.headless = true;
      continue;
    }
    
    // Handle config dump flag
    if (arg === '--config-dump') {
      arguments_.configDump = true;
      continue;
    }
    
    // Handle HTTP port arguments
    if (arg === '--http-port') {
      const portValue = args[i + 1];
      if (!portValue || portValue.startsWith('--')) {
        errors.push('--http-port requires a port number');
        errors.push('Usage: --http-port <port>');
        errors.push('Example: --http-port 3002');
        // Don't skip the next argument if it's a flag (it will be processed in next iteration)
        continue;
      }
      
      const parsedPort = parsePort(portValue);
      if (parsedPort === null) {
        errors.push(`Invalid HTTP port value: '${portValue}'`);
        errors.push(`Port must be a number between 1024 and 65535`);
        errors.push(`Example: --http-port 3002`);
      } else {
        const validation = validatePortRange(parsedPort);
        if (!validation.valid) {
          errors.push(`HTTP port error: ${validation.error}`);
          if (validation.suggestion) {
            errors.push(`Suggestion: Try --http-port ${validation.suggestion}`);
          }
          errors.push(`Note: Ports below 1024 require root/admin privileges`);
        } else {
          arguments_.httpPort = parsedPort;
        }
      }
      i++; // Skip next argument (port value)
      continue;
    }
    
    // Handle HTTP port with equals syntax (--http-port=3000)
    if (arg.startsWith('--http-port=')) {
      const portValue = arg.split('=')[1] || '';
      if (!portValue) {
        errors.push('--http-port= requires a port number after the equals sign');
        continue;
      }
      
      const parsedPort = parsePort(portValue);
      if (parsedPort === null) {
        errors.push(`Invalid HTTP port value: '${portValue}'`);
        errors.push(`Port must be a number between 1024 and 65535`);
        errors.push(`Example: --http-port=3002`);
      } else {
        const validation = validatePortRange(parsedPort);
        if (!validation.valid) {
          errors.push(`HTTP port error: ${validation.error}`);
          if (validation.suggestion) {
            errors.push(`Suggestion: Try --http-port=${validation.suggestion}`);
          }
          errors.push(`Note: Ports below 1024 require root/admin privileges`);
        } else {
          arguments_.httpPort = parsedPort;
        }
      }
      continue;
    }
    
    // Handle Gmail MCP port arguments
    if (arg === '--gmail-mcp-port') {
      const portValue = args[i + 1];
      if (!portValue || portValue.startsWith('--')) {
        errors.push('--gmail-mcp-port requires a port number');
        errors.push('Usage: --gmail-mcp-port <port>');
        errors.push('Example: --gmail-mcp-port 3000');
        // Don't skip the next argument if it's a flag (it will be processed in next iteration)
        continue;
      }
      
      const parsedPort = parsePort(portValue);
      if (parsedPort === null) {
        errors.push(`Invalid Gmail MCP port value: '${portValue}'`);
        errors.push(`Port must be a number between 1024 and 65535`);
        errors.push(`Example: --gmail-mcp-port 3000`);
      } else {
        const validation = validatePortRange(parsedPort);
        if (!validation.valid) {
          errors.push(`Gmail MCP port error: ${validation.error}`);
          if (validation.suggestion) {
            errors.push(`Suggestion: Try --gmail-mcp-port ${validation.suggestion}`);
          }
          errors.push(`Note: Ports below 1024 require root/admin privileges`);
        } else {
          arguments_.gmailMcpPort = parsedPort;
        }
      }
      i++; // Skip next argument (port value)
      continue;
    }
    
    // Handle Gmail MCP port with equals syntax
    if (arg.startsWith('--gmail-mcp-port=')) {
      const portValue = arg.split('=')[1] || '';
      if (!portValue) {
        errors.push('--gmail-mcp-port= requires a port number after the equals sign');
        continue;
      }
      
      const parsedPort = parsePort(portValue);
      if (parsedPort === null) {
        errors.push(`Invalid Gmail MCP port value: '${portValue}'`);
        errors.push(`Port must be a number between 1024 and 65535`);
        errors.push(`Example: --gmail-mcp-port=3000`);
      } else {
        const validation = validatePortRange(parsedPort);
        if (!validation.valid) {
          errors.push(`Gmail MCP port error: ${validation.error}`);
          if (validation.suggestion) {
            errors.push(`Suggestion: Try --gmail-mcp-port=${validation.suggestion}`);
          }
          errors.push(`Note: Ports below 1024 require root/admin privileges`);
        } else {
          arguments_.gmailMcpPort = parsedPort;
        }
      }
      continue;
    }
    
    // Handle unknown arguments
    if (arg.startsWith('--')) {
      const suggestions = findSimilarArguments(arg);
      const message = formatErrorWithSuggestions(`Unknown argument: ${arg}`, suggestions);
      errors.push(message);
      errors.push(`Run 'npm run daemon -- --help' to see all available options`);
      continue;
    }
    
    // Handle unknown short flags
    if (arg.startsWith('-')) {
      const suggestions = Object.keys(SHORT_FLAGS).filter(flag => 
        calculateSimilarity(arg, flag) <= 2
      );
      if (suggestions.length > 0) {
        errors.push(`Unknown flag: ${arg}. Did you mean '${suggestions[0]}'?`);
      } else {
        errors.push(`Unknown flag: ${arg}. Use '--help' or '-h' to see available options`);
      }
      continue;
    }
    
    // Handle positional arguments (not supported currently)
    errors.push(`Unexpected positional argument: ${arg}`);
    errors.push(`This application uses named arguments only (e.g., --http-port 3000)`);
    errors.push(`Run 'npm run daemon -- --help' for usage information`);
  }
  
  // Validate port configuration for conflicts
  if (arguments_.httpPort || arguments_.gmailMcpPort) {
    const portConfig: PortConfiguration = {
      httpPort: arguments_.httpPort,
      gmailMcpPort: arguments_.gmailMcpPort
    };
    
    if (!isValidPortConfiguration(portConfig)) {
      if (arguments_.httpPort === arguments_.gmailMcpPort) {
        errors.push(`Port conflict: HTTP Server and Gmail MCP Service cannot use the same port (${arguments_.httpPort})`);
        errors.push('Solutions:');
        errors.push('  CLI: --http-port 3002 --gmail-mcp-port 3001');
        errors.push('  Environment: HTTP_SERVER_PORT=3002 GMAIL_MCP_PORT=3001');
        errors.push('  View configuration: --config-dump');
      }
    }
  }
  
  return {
    arguments: arguments_,
    errors,
    warnings
  };
}

/**
 * Generate comprehensive help information
 * @returns Structured help information
 */
export function generateHelpInfo(): HelpInfo {
  const sections: HelpSection[] = [
    {
      title: 'Port Configuration',
      description: 'Configure network ports for the daemon services',
      examples: [
        'npm run daemon --http-port 8080',
        'npm run daemon --http-port=3000 --gmail-mcp-port=3001',
        'npm run daemon:headless --http-port 8000'
      ]
    },
    {
      title: 'Service Modes',
      description: 'Control how the daemon runs',
      examples: [
        'npm run daemon                    # Interactive TUI mode',
        'npm run daemon --headless         # Background mode without UI',
        'npm run daemon -h                 # Same as --headless (backward compatibility)',
        'npm run daemon --config-dump      # Show configuration and exit'
      ]
    },
    {
      title: 'Information & Help',
      description: 'Get information about the daemon',
      examples: [
        'npm run daemon --help             # Show this help',
        'npm run daemon --version          # Show version information'
      ]
    },
    {
      title: 'Port Options',
      description: 'Available port configuration options',
      examples: [
        '--http-port <port>      Set HTTP server port (default: 3002)',
        '--gmail-mcp-port <port> Set Gmail MCP service port (default: 3000)',
        '                        Both support --option=value syntax'
      ]
    },
    {
      title: 'Common Usage Examples',
      description: 'Typical deployment scenarios',
      examples: [
        '# Development - Local testing with non-standard ports',
        'npm run daemon --http-port 3333 --gmail-mcp-port 3334',
        '',
        '# Development - Multiple developers on same machine',
        'npm run daemon --http-port 4000 --gmail-mcp-port 4001  # Developer A',
        'npm run daemon --http-port 5000 --gmail-mcp-port 5001  # Developer B',
        '',
        '# Production - Standard web port with headless mode',
        'npm run daemon:headless --http-port 8080 --gmail-mcp-port 3000',
        '',
        '# Production - Behind reverse proxy (nginx/apache)',
        'npm run daemon:headless --http-port 3002  # Default internal port',
        '',
        '# Docker - Container with exposed ports',
        'docker run -p 8080:8080 -p 9000:9000 myapp \\',
        '  npm run daemon:headless --http-port 8080 --gmail-mcp-port 9000',
        '',
        '# Docker Compose - Service configuration',
        'services:',
        '  daemon:',
        '    command: npm run daemon:headless --http-port 3002 --gmail-mcp-port 3000',
        '    ports:',
        '      - "8080:3002"  # Map external 8080 to internal 3002',
        '      - "9000:3000"  # Map external 9000 to internal 3000',
        '',
        '# Multiple instances - Different services or environments',
        'npm run daemon:headless --http-port 8080 --gmail-mcp-port 8081  # Instance 1',
        'npm run daemon:headless --http-port 8082 --gmail-mcp-port 8083  # Instance 2',
        '',
        '# Environment variables - Alternative configuration method',
        'HTTP_SERVER_PORT=8080 GMAIL_MCP_PORT=9000 npm run daemon:headless',
        '',
        '# Systemd service - Production Linux deployment',
        'ExecStart=/usr/bin/npm run daemon:headless --http-port 8080 --gmail-mcp-port 3000'
      ]
    }
  ];

  return {
    usage: 'npm run daemon [options]',
    description: 'Meeting Transcript Agent - Automated task extraction from Gmail transcripts',
    sections
  };
}

/**
 * Format help information as readable text
 * @param helpInfo Help information structure
 * @returns Formatted help text
 */
export function formatHelpText(helpInfo: HelpInfo): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('Meeting Transcript Agent Daemon');
  lines.push('================================');
  lines.push('');
  lines.push(`Usage: ${helpInfo.usage}`);
  lines.push('');
  lines.push(helpInfo.description);
  lines.push('');
  
  for (const section of helpInfo.sections) {
    lines.push(`${section.title}:`);
    if (section.description) {
      lines.push(`  ${section.description}`);
    }
    lines.push('');
    
    if (section.examples) {
      for (const example of section.examples) {
        if (example.startsWith('#') || example === '') {
          lines.push(`  ${example}`);
        } else if (example.includes('--')) {
          lines.push(`  ${example}`);
        } else {
          lines.push(`  ${example}`);
        }
      }
    }
    lines.push('');
  }
  
  lines.push('Notes:');
  lines.push('  - All ports must be between 1024-65535 for security');
  lines.push('  - HTTP Server and Gmail MCP Service must use different ports');
  lines.push('  - Use environment variables HTTP_SERVER_PORT and GMAIL_MCP_PORT as alternatives');
  lines.push('  - Configuration priority: CLI arguments > Environment variables > Defaults');
  lines.push('  - The -h flag means --headless (not --help) for backward compatibility');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Check if arguments indicate help should be shown
 * @param args CLI arguments
 * @returns True if help should be displayed
 */
export function shouldShowHelp(args: CLIArguments): boolean {
  return Boolean(args.help);
}

/**
 * Check if arguments indicate version should be shown
 * @param args CLI arguments
 * @returns True if version should be displayed
 */
export function shouldShowVersion(args: CLIArguments): boolean {
  return Boolean(args.version);
}

/**
 * Check if arguments indicate config dump should be shown
 * @param args CLI arguments
 * @returns True if config dump should be displayed
 */
export function shouldShowConfigDump(args: CLIArguments): boolean {
  return Boolean(args.configDump);
}

/**
 * Check if daemon should run in headless mode
 * @param args CLI arguments
 * @returns True if headless mode is requested
 */
export function isHeadlessMode(args: CLIArguments): boolean {
  return Boolean(args.headless);
}

/**
 * Extract port configuration from CLI arguments
 * @param args CLI arguments
 * @returns Port configuration object
 */
export function extractPortConfiguration(args: CLIArguments): PortConfiguration {
  return {
    httpPort: args.httpPort,
    gmailMcpPort: args.gmailMcpPort
  };
}

/**
 * Validate CLI parse result and return user-friendly error messages
 * @param parseResult Result from parseArguments
 * @returns Array of formatted error messages for display
 */
export function formatParseErrors(parseResult: CLIParseResult): string[] {
  const messages: string[] = [];
  
  // Add errors
  for (const error of parseResult.errors) {
    messages.push(`Error: ${error}`);
  }
  
  // Add warnings
  for (const warning of parseResult.warnings) {
    messages.push(`Warning: ${warning}`);
  }
  
  return messages;
}

/**
 * Get resolved configuration with all sources merged
 * @param args CLI arguments
 * @returns Resolved configuration with priority information
 */
export function getResolvedConfiguration(args: CLIArguments): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('Meeting Transcript Agent - Configuration');
  lines.push('=========================================');
  lines.push('');
  
  // Port Configuration
  lines.push('Port Configuration:');
  lines.push('-------------------');
  
  // HTTP Server Port
  const httpPortDefault = 3002;
  const httpPortEnv = process.env['HTTP_SERVER_PORT'];
  const httpPortCli = args.httpPort;
  
  let httpPortResolved = httpPortDefault;
  let httpPortSource = 'default';
  
  if (httpPortCli !== undefined) {
    httpPortResolved = httpPortCli;
    httpPortSource = 'CLI argument (--http-port)';
  } else if (httpPortEnv) {
    const parsed = parseInt(httpPortEnv, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
      httpPortResolved = parsed;
      httpPortSource = 'environment variable (HTTP_SERVER_PORT)';
    }
  }
  
  lines.push(`  HTTP Server Port: ${httpPortResolved}`);
  lines.push(`    Source: ${httpPortSource}`);
  if (httpPortCli !== undefined) {
    lines.push(`    CLI Override: ${httpPortCli}`);
  }
  if (httpPortEnv) {
    lines.push(`    Environment: ${httpPortEnv}`);
  }
  lines.push(`    Default: ${httpPortDefault}`);
  lines.push('');
  
  // Gmail MCP Port
  const gmailPortDefault = 3000;
  const gmailPortEnv = process.env['GMAIL_MCP_PORT'];
  const gmailPortCli = args.gmailMcpPort;
  
  let gmailPortResolved = gmailPortDefault;
  let gmailPortSource = 'default';
  
  if (gmailPortCli !== undefined) {
    gmailPortResolved = gmailPortCli;
    gmailPortSource = 'CLI argument (--gmail-mcp-port)';
  } else if (gmailPortEnv) {
    const parsed = parseInt(gmailPortEnv, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
      gmailPortResolved = parsed;
      gmailPortSource = 'environment variable (GMAIL_MCP_PORT)';
    }
  }
  
  lines.push(`  Gmail MCP Port: ${gmailPortResolved}`);
  lines.push(`    Source: ${gmailPortSource}`);
  if (gmailPortCli !== undefined) {
    lines.push(`    CLI Override: ${gmailPortCli}`);
  }
  if (gmailPortEnv) {
    lines.push(`    Environment: ${gmailPortEnv}`);
  }
  lines.push(`    Default: ${gmailPortDefault}`);
  lines.push('');
  
  // Service Modes
  lines.push('Service Modes:');
  lines.push('--------------');
  lines.push(`  Headless Mode: ${args.headless === true ? 'enabled' : 'disabled'}`);
  lines.push(`  Config Dump: ${args.configDump === true ? 'enabled' : 'disabled'}`);
  lines.push(`  Help Mode: ${args.help === true ? 'enabled' : 'disabled'}`);
  lines.push(`  Version Mode: ${args.version === true ? 'enabled' : 'disabled'}`);
  lines.push('');
  
  // Configuration Priority
  lines.push('Configuration Priority:');
  lines.push('----------------------');
  lines.push('  1. CLI Arguments (highest priority)');
  lines.push('  2. Environment Variables');
  lines.push('  3. Default Values (lowest priority)');
  lines.push('');
  
  // Port Validation
  lines.push('Port Validation:');
  lines.push('----------------');
  
  if (httpPortResolved === gmailPortResolved) {
    lines.push(`  ⚠️  WARNING: Port conflict detected!`);
    lines.push(`     Both HTTP Server and Gmail MCP are configured to use port ${httpPortResolved}`);
    lines.push(`     Services cannot share the same port.`);
  } else {
    lines.push('  ✓ No port conflicts detected');
  }
  
  if (httpPortResolved < 1024) {
    lines.push(`  ⚠️  WARNING: HTTP Server port ${httpPortResolved} is below 1024 (requires root/admin)`);
  }
  if (gmailPortResolved < 1024) {
    lines.push(`  ⚠️  WARNING: Gmail MCP port ${gmailPortResolved} is below 1024 (requires root/admin)`);
  }
  
  lines.push('');
  
  // Environment Information
  lines.push('Environment:');
  lines.push('------------');
  lines.push(`  Working Directory: ${process.cwd()}`);
  lines.push(`  Node Version: ${process.version}`);
  lines.push(`  Platform: ${process.platform}`);
  lines.push(`  Architecture: ${process.arch}`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Get version information from package.json
 * @returns Version string or error message
 */
export function getVersion(): string {
  try {
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJson = readFileSync(packageJsonPath, 'utf8');
    const parsedPackage = JSON.parse(packageJson);
    
    const name = parsedPackage.name || 'meeting-transcript-agent';
    const version = parsedPackage.version || 'unknown';
    const description = parsedPackage.description || '';
    
    const lines: string[] = [];
    lines.push(`${name} v${version}`);
    if (description) {
      lines.push(description);
    }
    lines.push('');
    
    return lines.join('\n');
  } catch (error) {
    return `Version information unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Complete argument parsing with validation and error handling
 * This is the main entry point for CLI argument processing
 * @param args Command line arguments
 * @returns Parse result with structured data and validation
 */
export function processCommandLineArguments(args: string[]): CLIParseResult {
  const parseResult = parseArguments(args);
  
  // Early return for help/version requests (no validation needed)
  if (parseResult.arguments.help || parseResult.arguments.version) {
    return parseResult;
  }
  
  // Additional validation can be added here if needed
  // For now, all validation is handled in parseArguments
  
  return parseResult;
}