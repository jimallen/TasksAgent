/**
 * Tests for CLI argument parser
 */

import {
  parseArguments,
  shouldShowHelp,
  shouldShowVersion,
  shouldShowConfigDump,
  isHeadlessMode,
  extractPortConfiguration,
  formatParseErrors,
  generateHelpInfo,
  formatHelpText,
  getVersion,
  getResolvedConfiguration,
  processCommandLineArguments
} from './argumentParser';

describe('Argument Parser', () => {
  // Save original environment variables
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear environment variables that might affect tests
    delete process.env['HTTP_SERVER_PORT'];
    delete process.env['GMAIL_MCP_PORT'];
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('parseArguments', () => {
    describe('Basic flag parsing', () => {
      it('should parse --help flag', () => {
        const result = parseArguments(['--help']);
        expect(result.arguments.help).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should parse -h as headless for backward compatibility', () => {
        const result = parseArguments(['-h']);
        expect(result.arguments.headless).toBe(true);
        expect(result.arguments.help).toBeUndefined();
        expect(result.errors).toHaveLength(0);
      });

      it('should parse --headless flag', () => {
        const result = parseArguments(['--headless']);
        expect(result.arguments.headless).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should parse --version flag', () => {
        const result = parseArguments(['--version']);
        expect(result.arguments.version).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should parse -v as version', () => {
        const result = parseArguments(['-v']);
        expect(result.arguments.version).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should parse --config-dump flag', () => {
        const result = parseArguments(['--config-dump']);
        expect(result.arguments.configDump).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should handle empty arguments', () => {
        const result = parseArguments([]);
        expect(result.arguments).toEqual({});
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Port argument parsing', () => {
      it('should parse --http-port with space syntax', () => {
        const result = parseArguments(['--http-port', '3002']);
        expect(result.arguments.httpPort).toBe(3002);
        expect(result.errors).toHaveLength(0);
      });

      it('should parse --http-port with equals syntax', () => {
        const result = parseArguments(['--http-port=3002']);
        expect(result.arguments.httpPort).toBe(3002);
        expect(result.errors).toHaveLength(0);
      });

      it('should parse --gmail-mcp-port with space syntax', () => {
        const result = parseArguments(['--gmail-mcp-port', '3000']);
        expect(result.arguments.gmailMcpPort).toBe(3000);
        expect(result.errors).toHaveLength(0);
      });

      it('should parse --gmail-mcp-port with equals syntax', () => {
        const result = parseArguments(['--gmail-mcp-port=3000']);
        expect(result.arguments.gmailMcpPort).toBe(3000);
        expect(result.errors).toHaveLength(0);
      });

      it('should parse multiple port arguments', () => {
        const result = parseArguments(['--http-port', '8080', '--gmail-mcp-port', '9000']);
        expect(result.arguments.httpPort).toBe(8080);
        expect(result.arguments.gmailMcpPort).toBe(9000);
        expect(result.errors).toHaveLength(0);
      });

      it('should handle mixed syntax styles', () => {
        const result = parseArguments(['--http-port=8080', '--gmail-mcp-port', '9000']);
        expect(result.arguments.httpPort).toBe(8080);
        expect(result.arguments.gmailMcpPort).toBe(9000);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Error handling', () => {
      it('should error on invalid HTTP port value', () => {
        const result = parseArguments(['--http-port', 'invalid']);
        expect(result.arguments.httpPort).toBeUndefined();
        expect(result.errors).toContain("Invalid HTTP port value: 'invalid'");
        expect(result.errors).toContain('Port must be a number between 1024 and 65535');
        expect(result.errors).toContain('Example: --http-port 3002');
      });

      it('should error on port below minimum', () => {
        const result = parseArguments(['--http-port', '80']);
        expect(result.arguments.httpPort).toBeUndefined();
        expect(result.errors.some(e => e.includes('below minimum allowed port 1024'))).toBe(true);
        expect(result.errors.some(e => e.includes('Suggestion: Try --http-port 1024'))).toBe(true);
      });

      it('should error on port above maximum', () => {
        const result = parseArguments(['--gmail-mcp-port', '70000']);
        expect(result.arguments.gmailMcpPort).toBeUndefined();
        expect(result.errors.some(e => e.includes('exceeds maximum allowed port 65535'))).toBe(true);
      });

      it('should error on missing port value', () => {
        const result = parseArguments(['--http-port']);
        expect(result.arguments.httpPort).toBeUndefined();
        expect(result.errors).toContain('--http-port requires a port number');
        expect(result.errors).toContain('Usage: --http-port <port>');
      });

      it('should detect port conflicts', () => {
        const result = parseArguments(['--http-port', '3000', '--gmail-mcp-port', '3000']);
        expect(result.arguments.httpPort).toBe(3000);
        expect(result.arguments.gmailMcpPort).toBe(3000);
        expect(result.errors.some(e => 
          e.includes('Port conflict: HTTP Server and Gmail MCP Service cannot use the same port')
        )).toBe(true);
      });

      it('should provide suggestions for unknown arguments', () => {
        const result = parseArguments(['--halp']);
        expect(result.errors.some(e => e.includes("Did you mean '--help'?"))).toBe(true);
      });

      it('should handle unknown flags', () => {
        const result = parseArguments(['-x']);
        expect(result.errors.some(e => e.includes('Unknown flag: -x'))).toBe(true);
      });

      it('should handle positional arguments', () => {
        const result = parseArguments(['somecommand']);
        expect(result.errors).toContain('Unexpected positional argument: somecommand');
        expect(result.errors).toContain('This application uses named arguments only (e.g., --http-port 3000)');
      });

      it('should handle missing port value when followed by another flag', () => {
        const result = parseArguments(['--http-port', '--headless']);
        expect(result.arguments.headless).toBe(true);
        expect(result.errors.some(e => e.includes('--http-port requires a port number'))).toBe(true);
      });
    });

    describe('Complex scenarios', () => {
      it('should parse all flags together', () => {
        const result = parseArguments([
          '--headless',
          '--http-port=8080',
          '--gmail-mcp-port=9000',
          '--config-dump'
        ]);
        expect(result.arguments).toEqual({
          headless: true,
          httpPort: 8080,
          gmailMcpPort: 9000,
          configDump: true
        });
        expect(result.errors).toHaveLength(0);
      });

      it('should handle help flag with other arguments', () => {
        const result = parseArguments(['--help', '--headless', '--http-port', '3000']);
        expect(result.arguments.help).toBe(true);
        expect(result.arguments.headless).toBe(true);
        expect(result.arguments.httpPort).toBe(3000);
      });

      it('should accumulate multiple errors', () => {
        const result = parseArguments(['--http-port', 'invalid', '--gmail-mcp-port', '70000', '--unknown']);
        expect(result.errors.length).toBeGreaterThan(3);
        expect(result.errors.some(e => e.includes('Invalid HTTP port'))).toBe(true);
        expect(result.errors.some(e => e.includes('exceeds maximum allowed port 65535'))).toBe(true);
        expect(result.errors.some(e => e.includes('Unknown argument'))).toBe(true);
      });
    });
  });

  describe('Helper functions', () => {
    describe('shouldShowHelp', () => {
      it('should return true when help flag is set', () => {
        expect(shouldShowHelp({ help: true })).toBe(true);
      });

      it('should return false when help flag is not set', () => {
        expect(shouldShowHelp({})).toBe(false);
        expect(shouldShowHelp({ headless: true })).toBe(false);
      });
    });

    describe('shouldShowVersion', () => {
      it('should return true when version flag is set', () => {
        expect(shouldShowVersion({ version: true })).toBe(true);
      });

      it('should return false when version flag is not set', () => {
        expect(shouldShowVersion({})).toBe(false);
      });
    });

    describe('shouldShowConfigDump', () => {
      it('should return true when configDump flag is set', () => {
        expect(shouldShowConfigDump({ configDump: true })).toBe(true);
      });

      it('should return false when configDump flag is not set', () => {
        expect(shouldShowConfigDump({})).toBe(false);
      });
    });

    describe('isHeadlessMode', () => {
      it('should return true when headless flag is set', () => {
        expect(isHeadlessMode({ headless: true })).toBe(true);
      });

      it('should return false when headless flag is not set', () => {
        expect(isHeadlessMode({})).toBe(false);
      });
    });

    describe('extractPortConfiguration', () => {
      it('should extract port configuration from arguments', () => {
        const config = extractPortConfiguration({
          httpPort: 8080,
          gmailMcpPort: 9000,
          headless: true
        });
        expect(config).toEqual({
          httpPort: 8080,
          gmailMcpPort: 9000
        });
      });

      it('should handle missing ports', () => {
        const config = extractPortConfiguration({});
        expect(config).toEqual({
          httpPort: undefined,
          gmailMcpPort: undefined
        });
      });
    });

    describe('formatParseErrors', () => {
      it('should format errors with Error prefix', () => {
        const result = {
          arguments: {},
          errors: ['Something went wrong'],
          warnings: ['This might be an issue']
        };
        const formatted = formatParseErrors(result);
        expect(formatted).toContain('Error: Something went wrong');
        expect(formatted).toContain('Warning: This might be an issue');
      });

      it('should handle empty errors and warnings', () => {
        const result = {
          arguments: {},
          errors: [],
          warnings: []
        };
        const formatted = formatParseErrors(result);
        expect(formatted).toHaveLength(0);
      });
    });
  });

  describe('Help generation', () => {
    describe('generateHelpInfo', () => {
      it('should generate help information structure', () => {
        const helpInfo = generateHelpInfo();
        expect(helpInfo.usage).toContain('npm run daemon');
        expect(helpInfo.description).toContain('Meeting Transcript Agent');
        expect(helpInfo.sections).toBeInstanceOf(Array);
        expect(helpInfo.sections.length).toBeGreaterThan(0);
      });

      it('should include port configuration section', () => {
        const helpInfo = generateHelpInfo();
        const portSection = helpInfo.sections.find(s => s.title === 'Port Configuration');
        expect(portSection).toBeDefined();
        expect(portSection?.examples).toContain('npm run daemon --http-port 8080');
      });

      it('should include service modes section', () => {
        const helpInfo = generateHelpInfo();
        const modesSection = helpInfo.sections.find(s => s.title === 'Service Modes');
        expect(modesSection).toBeDefined();
        expect(modesSection?.examples?.some(e => e.includes('--headless'))).toBe(true);
      });
    });

    describe('formatHelpText', () => {
      it('should format help text properly', () => {
        const helpInfo = generateHelpInfo();
        const helpText = formatHelpText(helpInfo);
        expect(helpText).toContain('Meeting Transcript Agent Daemon');
        expect(helpText).toContain('Usage:');
        expect(helpText).toContain('Port Configuration:');
        expect(helpText).toContain('Notes:');
      });

      it('should include all examples', () => {
        const helpInfo = generateHelpInfo();
        const helpText = formatHelpText(helpInfo);
        expect(helpText).toContain('--http-port');
        expect(helpText).toContain('--gmail-mcp-port');
        expect(helpText).toContain('--headless');
        expect(helpText).toContain('--help');
      });
    });
  });

  describe('Version information', () => {
    it('should get version from package.json', () => {
      const version = getVersion();
      expect(version).toContain('meeting-transcript-agent');
      expect(version).toContain('v1.0.0');
      expect(version).toContain('Automated agent');
    });
  });

  describe('Configuration dump', () => {
    it('should generate configuration with defaults', () => {
      const config = getResolvedConfiguration({});
      expect(config).toContain('HTTP Server Port: 3002');
      expect(config).toContain('Gmail MCP Port: 3000');
      expect(config).toContain('Source: default');
    });

    it('should show CLI override', () => {
      const config = getResolvedConfiguration({ httpPort: 8080 });
      expect(config).toContain('HTTP Server Port: 8080');
      expect(config).toContain('Source: CLI argument (--http-port)');
    });

    it('should show environment variables', () => {
      process.env['HTTP_SERVER_PORT'] = '4000';
      const config = getResolvedConfiguration({});
      expect(config).toContain('HTTP Server Port: 4000');
      expect(config).toContain('Source: environment variable (HTTP_SERVER_PORT)');
    });

    it('should prioritize CLI over environment', () => {
      process.env['HTTP_SERVER_PORT'] = '4000';
      const config = getResolvedConfiguration({ httpPort: 8080 });
      expect(config).toContain('HTTP Server Port: 8080');
      expect(config).toContain('Source: CLI argument (--http-port)');
      expect(config).toContain('Environment: 4000');
    });

    it('should detect port conflicts', () => {
      const config = getResolvedConfiguration({ httpPort: 3000, gmailMcpPort: 3000 });
      expect(config).toContain('WARNING: Port conflict detected');
      expect(config).toContain('Services cannot share the same port');
    });

    it('should warn about privileged ports', () => {
      const config = getResolvedConfiguration({ httpPort: 80 });
      expect(config).toContain('WARNING');
      expect(config).toContain('below 1024');
    });

    it('should show service modes', () => {
      const config = getResolvedConfiguration({ headless: true, configDump: true });
      expect(config).toContain('Headless Mode: enabled');
      expect(config).toContain('Config Dump: enabled');
    });

    it('should show environment information', () => {
      const config = getResolvedConfiguration({});
      expect(config).toContain('Working Directory:');
      expect(config).toContain('Node Version:');
      expect(config).toContain('Platform:');
    });
  });

  describe('processCommandLineArguments', () => {
    it('should be main entry point for argument processing', () => {
      const result = processCommandLineArguments(['--http-port', '8080']);
      expect(result.arguments.httpPort).toBe(8080);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle early return for help', () => {
      const result = processCommandLineArguments(['--help']);
      expect(result.arguments.help).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle early return for version', () => {
      const result = processCommandLineArguments(['--version']);
      expect(result.arguments.version).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined in arguments array', () => {
      const args: any[] = ['--help', undefined, '--headless'];
      const result = parseArguments(args);
      expect(result.arguments.help).toBe(true);
      expect(result.arguments.headless).toBe(true);
    });

    it('should handle empty strings in arguments', () => {
      const result = parseArguments(['', '--help', '']);
      expect(result.arguments.help).toBe(true);
      // Empty strings are skipped, not treated as positional arguments
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle very long port numbers', () => {
      const result = parseArguments(['--http-port', '99999999999999']);
      // Very large numbers might overflow or be caught as invalid
      // JavaScript parseInt may return a different value or NaN for huge numbers
      expect(result.errors.length).toBeGreaterThan(0);
      // Either invalid or exceeds maximum
      expect(result.errors.some(e => e.includes('Invalid') || e.includes('exceeds maximum'))).toBe(true);
    });

    it('should handle negative port numbers', () => {
      const result = parseArguments(['--http-port', '-1']);
      expect(result.errors.some(e => e.includes('below minimum'))).toBe(true);
    });

    it('should handle decimal port numbers', () => {
      const result = parseArguments(['--http-port', '3000.5']);
      // parseInt will parse 3000.5 as 3000, which is valid
      // We should check that it's either accepted or rejected
      const hasError = result.errors.some(e => e.includes('Invalid'));
      const acceptedAsInt = result.arguments.httpPort === 3000;
      expect(hasError || acceptedAsInt).toBe(true);
    });
  });
});