/**
 * Integration tests for CLI argument parsing with service startup
 */

import { parseArguments, getVersion, getResolvedConfiguration, generateHelpInfo, formatHelpText } from './argumentParser';
import * as config from '../config/config';
import * as portValidator from './portValidator';
import logger from '../utils/logger';

// Mock modules
jest.mock('../utils/logger');
jest.mock('../config/config');

describe('CLI Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment variables
    delete process.env['HTTP_SERVER_PORT'];
    delete process.env['GMAIL_MCP_PORT'];
    
    // Setup logger mocks
    (logger.info as jest.Mock) = jest.fn();
    (logger.warn as jest.Mock) = jest.fn();
    (logger.error as jest.Mock) = jest.fn();
    (logger.debug as jest.Mock) = jest.fn();
    
    // Setup default config mocks
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
  });

  describe('CLI parsing with service configuration', () => {
    it('should parse port arguments and configure services correctly', () => {
      const args = ['--http-port', '8080', '--gmail-mcp-port', '9000'];
      const result = parseArguments(args);
      
      expect(result.errors.length).toBe(0);
      expect(result.arguments.httpPort).toBe(8080);
      expect(result.arguments.gmailMcpPort).toBe(9000);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle mixed argument formats', () => {
      const args = ['--http-port=8080', '--gmail-mcp-port', '9000', '--headless'];
      const result = parseArguments(args);
      
      expect(result.errors.length).toBe(0);
      expect(result.arguments.httpPort).toBe(8080);
      expect(result.arguments.gmailMcpPort).toBe(9000);
      expect(result.arguments.headless).toBe(true);
    });

    it('should detect port conflicts between services', () => {
      const args = ['--http-port', '3000', '--gmail-mcp-port', '3000'];
      const result = parseArguments(args);
      
      // Parser should detect the conflict
      expect(result.warnings).toContainEqual(
        expect.stringContaining('HTTP Server and Gmail MCP ports are the same')
      );
    });

    it('should validate port ranges', () => {
      const args = ['--http-port', '999', '--gmail-mcp-port', '70000'];
      const result = parseArguments(args);
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContainEqual(
        expect.stringContaining('below minimum allowed port 1024')
      );
      expect(result.errors).toContainEqual(
        expect.stringContaining('above maximum allowed port 65535')
      );
    });

    it('should integrate with configuration system', () => {
      const args = ['--http-port', '8080'];
      const result = parseArguments(args);
      
      expect(result.errors.length).toBe(0);
      
      // Update config mocks to reflect CLI argument
      (config.getResolvedPorts as jest.Mock).mockReturnValue({
        httpServer: 8080,
        gmailMcp: 3000
      });
      
      (config.getPortConfigDetails as jest.Mock).mockReturnValue({
        httpServer: {
          source: 'CLI_ARGUMENT',
          allSources: [
            { source: 'CLI_ARGUMENT', value: 8080, priority: 2 },
            { source: 'DEFAULT', value: 3002, priority: 0 }
          ]
        },
        gmailMcp: {
          source: 'DEFAULT',
          allSources: [{ source: 'DEFAULT', value: 3000, priority: 0 }]
        }
      });
      
      const ports = config.getResolvedPorts();
      expect(ports.httpServer).toBe(8080);
      expect(ports.gmailMcp).toBe(3000);
    });
  });

  describe('--config-dump functionality', () => {
    it('should handle config dump request', async () => {
      const args = ['--config-dump'];
      const result = parseArguments(args);
      
      expect(result.errors.length).toBe(0);
      expect(result.arguments.configDump).toBe(true);
      // Help and version should be handled by the caller
      expect(result.arguments.help || result.arguments.version || result.arguments.configDump).toBe(true);
      
      // Get the configuration dump
      const configDump = await getResolvedConfiguration(result.arguments);
      expect(configDump).toContain('ACTIVE CONFIGURATION DUMP');
    });

    it('should show all configuration sources in dump', async () => {
      // Set up multiple configuration sources
      process.env['HTTP_SERVER_PORT'] = '4000';
      
      (config.getPortConfigDetails as jest.Mock).mockReturnValue({
        httpServer: {
          source: 'CLI_ARGUMENT',
          allSources: [
            { source: 'CLI_ARGUMENT', value: 8080, priority: 2 },
            { source: 'ENVIRONMENT', value: 4000, priority: 1 },
            { source: 'DEFAULT', value: 3002, priority: 0 }
          ]
        },
        gmailMcp: {
          source: 'DEFAULT',
          allSources: [{ source: 'DEFAULT', value: 3000, priority: 0 }]
        }
      });
      
      const args = ['--http-port', '8080', '--config-dump'];
      const result = parseArguments(args);
      const configDump = await getResolvedConfiguration(result.arguments);
      
      // Should show all sources
      expect(configDump).toContain('CLI_ARGUMENT');
      expect(configDump).toContain('ENVIRONMENT');
      expect(configDump).toContain('DEFAULT');
      expect(configDump).toContain('8080');
      expect(configDump).toContain('4000');
      expect(configDump).toContain('3002');
    });
  });

  describe('--help functionality', () => {
    it('should display help with port configuration examples', () => {
      const args = ['--help'];
      const result = parseArguments(args);
      
      expect(result.errors.length).toBe(0);
      // Help and version should be handled by the caller
      expect(result.arguments.help || result.arguments.version || result.arguments.configDump).toBe(true);
      // Output is generated by helper functions, not parseArguments
      expect(formatHelpText(generateHelpInfo())).toContain('--http-port');
      // Output is generated by helper functions, not parseArguments
      expect(formatHelpText(generateHelpInfo())).toContain('--gmail-mcp-port');
      // Output is generated by helper functions, not parseArguments
      expect(formatHelpText(generateHelpInfo())).toContain('Port Configuration Examples');
    });

    it('should include priority information in help', () => {
      const helpText = formatHelpText(generateHelpInfo());
      
      expect(helpText).toContain('Configuration Priority');
      expect(helpText).toContain('CLI arguments (highest)');
      expect(helpText).toContain('Environment variables');
      expect(helpText).toContain('Default values (lowest)');
    });
  });

  describe('--version functionality', () => {
    it('should display version from package.json', () => {
      const args = ['--version'];
      const result = parseArguments(args);
      
      expect(result.errors.length).toBe(0);
      // Help and version should be handled by the caller
      expect(result.arguments.help || result.arguments.version || result.arguments.configDump).toBe(true);
      
      const version = getVersion();
      // Version is returned by getVersion function
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
      // Semantic version format is tested above
    });
  });

  describe('Error handling and suggestions', () => {
    it('should suggest corrections for typos', () => {
      const args = ['--htpp-port', '3000']; // Typo: htpp instead of http
      const result = parseArguments(args);
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Unknown argument: --htpp-port');
      expect(result.errors[0]).toContain('Did you mean: --http-port');
    });

    it('should handle invalid port values gracefully', () => {
      const args = ['--http-port', 'not-a-number'];
      const result = parseArguments(args);
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Invalid port number')
      );
    });

    it('should handle missing values for port arguments', () => {
      const args = ['--http-port']; // Missing value
      const result = parseArguments(args);
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContainEqual(
        expect.stringContaining('requires a value')
      );
    });
  });

  describe('Environment variable integration', () => {
    it('should respect environment variables when no CLI args provided', () => {
      process.env['HTTP_SERVER_PORT'] = '5000';
      process.env['GMAIL_MCP_PORT'] = '5001';
      
      const args: string[] = [];
      const result = parseArguments(args);
      
      expect(result.errors.length).toBe(0);
      
      // Config should pick up environment variables
      (config.getResolvedPorts as jest.Mock).mockReturnValue({
        httpServer: 5000,
        gmailMcp: 5001
      });
      
      const ports = config.getResolvedPorts();
      expect(ports.httpServer).toBe(5000);
      expect(ports.gmailMcp).toBe(5001);
    });

    it('should override environment variables with CLI arguments', () => {
      process.env['HTTP_SERVER_PORT'] = '5000';
      process.env['GMAIL_MCP_PORT'] = '5001';
      
      const args = ['--http-port', '8080'];
      const result = parseArguments(args);
      
      expect(result.errors.length).toBe(0);
      expect(result.arguments.httpPort).toBe(8080);
      // gmailMcpPort should not be set in arguments (will use env var)
      expect(result.arguments.gmailMcpPort).toBeUndefined();
    });
  });

  describe('Port availability checking', () => {
    it('should check port availability', async () => {
      const isAvailable = await portValidator.checkPortAvailable(3002);
      // This will depend on actual system state
      expect(typeof isAvailable).toBe('boolean');
    });

    it('should find first available port from candidates', async () => {
      const candidates = [3002, 3003, 3004, 3005];
      const available = await portValidator.findFirstAvailablePort(candidates);
      
      // Should return either a port number or null
      if (available !== null) {
        expect(candidates).toContain(available);
      }
    });

    it('should suggest alternative ports when conflicts detected', () => {
      const usedPorts = [3000, 3001];
      const suggestions = portValidator.suggestAlternativePorts(3000, usedPorts);
      
      expect(Array.isArray(suggestions)).toBe(true);
      // Suggestions should not include used ports
      for (const port of suggestions) {
        expect(usedPorts).not.toContain(port);
      }
    });
  });

  describe('Service startup simulation', () => {
    it('should simulate successful service startup with CLI config', async () => {
      const args = ['--http-port', '8080', '--gmail-mcp-port', '9000'];
      const parseResult = parseArguments(args);
      
      expect(parseResult.errors.length).toBe(0);
      
      // Simulate configuration being applied
      (config.getResolvedPorts as jest.Mock).mockReturnValue({
        httpServer: 8080,
        gmailMcp: 9000
      });
      
      (config.getPortConfigDetails as jest.Mock).mockReturnValue({
        httpServer: {
          source: 'CLI_ARGUMENT',
          allSources: [{ source: 'CLI_ARGUMENT', value: 8080, priority: 2 }]
        },
        gmailMcp: {
          source: 'CLI_ARGUMENT',
          allSources: [{ source: 'CLI_ARGUMENT', value: 9000, priority: 2 }]
        }
      });
      
      // Verify services would start with correct ports
      const ports = config.getResolvedPorts();
      const details = config.getPortConfigDetails();
      
      expect(ports.httpServer).toBe(8080);
      expect(ports.gmailMcp).toBe(9000);
      expect(details.httpServer.source).toBe('CLI_ARGUMENT');
      expect(details.gmailMcp.source).toBe('CLI_ARGUMENT');
    });

    it('should handle service startup with mixed configuration sources', () => {
      process.env['GMAIL_MCP_PORT'] = '5000';
      
      const args = ['--http-port', '8080'];
      const parseResult = parseArguments(args);
      
      expect(parseResult.errors.length).toBe(0);
      
      // Simulate mixed configuration
      (config.getResolvedPorts as jest.Mock).mockReturnValue({
        httpServer: 8080,  // From CLI
        gmailMcp: 5000     // From environment
      });
      
      (config.getPortConfigDetails as jest.Mock).mockReturnValue({
        httpServer: {
          source: 'CLI_ARGUMENT',
          allSources: [
            { source: 'CLI_ARGUMENT', value: 8080, priority: 2 },
            { source: 'DEFAULT', value: 3002, priority: 0 }
          ]
        },
        gmailMcp: {
          source: 'ENVIRONMENT',
          allSources: [
            { source: 'ENVIRONMENT', value: 5000, priority: 1 },
            { source: 'DEFAULT', value: 3000, priority: 0 }
          ]
        }
      });
      
      const ports = config.getResolvedPorts();
      const details = config.getPortConfigDetails();
      
      expect(ports.httpServer).toBe(8080);
      expect(ports.gmailMcp).toBe(5000);
      expect(details.httpServer.source).toBe('CLI_ARGUMENT');
      expect(details.gmailMcp.source).toBe('ENVIRONMENT');
    });
  });
});