import { 
  config, 
  validateConfig,
  ConfigPriority,
  ConfigResolver,
  updatePortsFromCLI,
  getResolvedPorts,
  getPortConfigDetails,
  resolveConfiguration,
  mergeConfigurationSources,
  getAllConfigurationSources,
  validatePortConfiguration,
  validateFullConfiguration,
  getActiveConfiguration,
  getActiveConfigurationJSON,
  resetConfiguration,
  getConfigPriorityInfo
} from './config';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Reset configuration to defaults before each test
    resetConfiguration();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('config object', () => {
    it('should load default values when environment variables are not set', () => {
      expect(config.gmail.checkIntervalHours).toBe(8);
      expect(config.scheduling.times).toEqual(['09:00', '13:00', '17:00']);
      // Jest sets NODE_ENV to 'test' by default
      expect(config.app.nodeEnv).toBe('test');
    });

    it('should parse gmail sender domains correctly', () => {
      expect(config.gmail.senderDomains).toContain('@google.com');
      expect(config.gmail.senderDomains).toContain('@meet.google.com');
    });

    it('should parse scheduling times as array', () => {
      expect(Array.isArray(config.scheduling.times)).toBe(true);
      expect(config.scheduling.times).toHaveLength(3);
    });

    it('should parse boolean values correctly', () => {
      expect(typeof config.notifications.enabled).toBe('boolean');
      expect(typeof config.performance.cleanupTempFiles).toBe('boolean');
    });

    it('should parse numeric values correctly', () => {
      expect(typeof config.gmail.checkIntervalHours).toBe('number');
      expect(typeof config.ai.temperature).toBe('number');
      expect(typeof config.performance.maxConcurrentTranscripts).toBe('number');
    });
  });

  describe('Port Configuration', () => {
    describe('Default Ports', () => {
      it('should have correct default port values', () => {
        const ports = getResolvedPorts();
        expect(ports.httpServer).toBe(3002);
        expect(ports.gmailMcp).toBe(3000);
      });

      it('should show defaults as source when no overrides', () => {
        const details = getPortConfigDetails();
        expect(details.httpServer.source).toContain('default');
        expect(details.gmailMcp.source).toContain('default');
        expect(details.httpServer.priority).toBe(ConfigPriority.DEFAULT);
        expect(details.gmailMcp.priority).toBe(ConfigPriority.DEFAULT);
      });
    });

    describe('Environment Variable Ports', () => {
      it('should use HTTP_SERVER_PORT environment variable', () => {
        process.env['HTTP_SERVER_PORT'] = '8080';
        resetConfiguration();
        
        const ports = getResolvedPorts();
        expect(ports.httpServer).toBe(8080);
        
        const details = getPortConfigDetails();
        expect(details.httpServer.source).toContain('HTTP_SERVER_PORT');
        expect(details.httpServer.priority).toBe(ConfigPriority.ENVIRONMENT);
      });

      it('should use GMAIL_MCP_PORT environment variable', () => {
        process.env['GMAIL_MCP_PORT'] = '9000';
        resetConfiguration();
        
        const ports = getResolvedPorts();
        expect(ports.gmailMcp).toBe(9000);
        
        const details = getPortConfigDetails();
        expect(details.gmailMcp.source).toContain('GMAIL_MCP_PORT');
        expect(details.gmailMcp.priority).toBe(ConfigPriority.ENVIRONMENT);
      });

      it('should ignore invalid environment variable ports', () => {
        process.env['HTTP_SERVER_PORT'] = 'invalid';
        process.env['GMAIL_MCP_PORT'] = '99999';
        resetConfiguration();
        
        const ports = getResolvedPorts();
        expect(ports.httpServer).toBe(3002); // Falls back to default
        expect(ports.gmailMcp).toBe(3000); // Falls back to default
      });
    });

    describe('CLI Argument Ports', () => {
      it('should override defaults with CLI arguments', () => {
        updatePortsFromCLI({ httpPort: 7777, gmailMcpPort: 8888 });
        
        const ports = getResolvedPorts();
        expect(ports.httpServer).toBe(7777);
        expect(ports.gmailMcp).toBe(8888);
        
        const details = getPortConfigDetails();
        expect(details.httpServer.source).toContain('--http-port');
        expect(details.httpServer.priority).toBe(ConfigPriority.CLI_ARGUMENT);
      });

      it('should override environment variables with CLI arguments', () => {
        process.env['HTTP_SERVER_PORT'] = '4000';
        process.env['GMAIL_MCP_PORT'] = '5000';
        resetConfiguration();
        
        updatePortsFromCLI({ httpPort: 6000, gmailMcpPort: 7000 });
        
        const ports = getResolvedPorts();
        expect(ports.httpServer).toBe(6000);
        expect(ports.gmailMcp).toBe(7000);
      });

      it('should handle partial CLI arguments', () => {
        process.env['GMAIL_MCP_PORT'] = '5000';
        resetConfiguration();
        
        updatePortsFromCLI({ httpPort: 8080 });
        
        const ports = getResolvedPorts();
        expect(ports.httpServer).toBe(8080); // CLI override
        expect(ports.gmailMcp).toBe(5000); // Environment variable
      });
    });

    describe('Priority Resolution', () => {
      it('should follow correct priority order', () => {
        // Set all three sources
        process.env['HTTP_SERVER_PORT'] = '4000';
        resetConfiguration();
        updatePortsFromCLI({ httpPort: 5000 });
        
        const ports = getResolvedPorts();
        expect(ports.httpServer).toBe(5000); // CLI wins
        
        // Reset and remove CLI
        resetConfiguration();
        const ports2 = getResolvedPorts();
        expect(ports2.httpServer).toBe(4000); // Environment wins
        
        // Remove environment
        delete process.env['HTTP_SERVER_PORT'];
        resetConfiguration();
        const ports3 = getResolvedPorts();
        expect(ports3.httpServer).toBe(3002); // Default wins
      });

      it('should track all configuration sources', () => {
        process.env['HTTP_SERVER_PORT'] = '4000';
        resetConfiguration();
        updatePortsFromCLI({ httpPort: 5000 });
        
        const sources = getAllConfigurationSources();
        expect(sources.httpPort).toHaveLength(3); // Default, Environment, CLI
        
        const priorities = sources.httpPort.map(s => s.priority);
        expect(priorities).toContain(ConfigPriority.DEFAULT);
        expect(priorities).toContain(ConfigPriority.ENVIRONMENT);
        expect(priorities).toContain(ConfigPriority.CLI_ARGUMENT);
      });
    });

    describe('Port Validation', () => {
      it('should detect port conflicts', () => {
        updatePortsFromCLI({ httpPort: 3000, gmailMcpPort: 3000 });
        
        const validation = config.ports.validate();
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain(
          'Port conflict: Both HTTP Server and Gmail MCP are using port 3000'
        );
      });

      it('should warn about privileged ports', () => {
        updatePortsFromCLI({ httpPort: 80, gmailMcpPort: 443 });
        
        const validation = config.ports.validate();
        expect(validation.warnings).toContain(
          'HTTP Server port 80 requires root/admin privileges (ports below 1024)'
        );
        expect(validation.warnings).toContain(
          'Gmail MCP port 443 requires root/admin privileges (ports below 1024)'
        );
      });

      it('should warn about well-known ports', () => {
        updatePortsFromCLI({ httpPort: 3306, gmailMcpPort: 5432 });
        
        const validation = config.ports.validate();
        expect(validation.warnings).toContain(
          'HTTP Server port 3306 is typically used for MySQL'
        );
        expect(validation.warnings).toContain(
          'Gmail MCP port 5432 is typically used for PostgreSQL'
        );
      });

      it('should reject invalid port ranges', () => {
        updatePortsFromCLI({ httpPort: -1, gmailMcpPort: 70000 });
        
        const validation = config.ports.validate();
        expect(validation.valid).toBe(false);
        expect(validation.errors.some(e => e.includes('invalid'))).toBe(true);
        expect(validation.errors.some(e => e.includes('exceeds maximum'))).toBe(true);
      });
    });
  });

  describe('ConfigResolver', () => {
    it('should resolve to highest priority value', () => {
      const resolver = new ConfigResolver<number>(100, 'default');
      resolver.addSource(200, ConfigPriority.ENVIRONMENT, 'env');
      resolver.addSource(300, ConfigPriority.CLI_ARGUMENT, 'cli');
      
      expect(resolver.resolve()).toBe(300);
      expect(resolver.getSource()).toBe('cli');
    });

    it('should update existing priority levels', () => {
      const resolver = new ConfigResolver<number>(100, 'default');
      resolver.addSource(200, ConfigPriority.ENVIRONMENT, 'env1');
      resolver.addSource(250, ConfigPriority.ENVIRONMENT, 'env2');
      
      const sources = resolver.getAllSources();
      const envSources = sources.filter(s => s.priority === ConfigPriority.ENVIRONMENT);
      expect(envSources).toHaveLength(1);
      expect(envSources[0]?.value).toBe(250);
    });

    it('should ignore undefined values', () => {
      const resolver = new ConfigResolver<string>('default', 'default');
      resolver.addSource(undefined, ConfigPriority.CLI_ARGUMENT, 'cli');
      
      expect(resolver.resolve()).toBe('default');
      expect(resolver.getSource()).toBe('default');
    });
  });

  describe('Configuration Resolution', () => {
    it('should resolve complete configuration', () => {
      process.env['HTTP_SERVER_PORT'] = '4000';
      resetConfiguration();
      
      const resolved = resolveConfiguration({ 
        httpPort: 5000,
        gmailMcpPort: 6000 
      });
      
      expect(resolved.ports.http).toBe(5000);
      expect(resolved.ports.gmailMcp).toBe(6000);
      expect(resolved.sources.httpPort.priority).toBe('CLI_ARGUMENT');
      expect(resolved.validation.valid).toBe(false); // Port conflict
    });

    it('should include warnings in resolution', () => {
      const resolved = resolveConfiguration({ 
        httpPort: 80,
        gmailMcpPort: 3000 
      });
      
      expect(resolved.validation.warnings).toContain(
        'HTTP Server port 80 requires elevated privileges'
      );
      expect(resolved.validation.warnings).toContain(
        'Gmail MCP port 3000 is commonly used - ensure it\'s available'
      );
    });
  });

  describe('mergeConfigurationSources', () => {
    it('should merge sources respecting priority', () => {
      interface TestConfig {
        a?: number;
        b?: number;
        c?: number;
      }
      
      const sources: Array<{ config: Partial<TestConfig>; priority: ConfigPriority }> = [
        { config: { a: 1, b: 2 }, priority: ConfigPriority.DEFAULT },
        { config: { b: 3, c: 4 }, priority: ConfigPriority.ENVIRONMENT },
        { config: { c: 5 }, priority: ConfigPriority.CLI_ARGUMENT }
      ];
      
      const merged = mergeConfigurationSources<TestConfig>(sources);
      expect(merged).toEqual({ a: 1, b: 3, c: 5 });
    });
  });

  describe('validatePortConfiguration', () => {
    it('should validate port configuration', async () => {
      updatePortsFromCLI({ httpPort: 3002, gmailMcpPort: 3000 });
      
      const validation = await validatePortConfiguration(false);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should check port availability when requested', async () => {
      // Mock the dynamic import
      jest.mock('../cli/portValidator', () => ({
        checkPortAvailable: jest.fn().mockResolvedValue(true),
        generatePortSuggestions: jest.fn().mockReturnValue([3003, 3004])
      }));
      
      const validation = await validatePortConfiguration(true);
      expect(validation.portStatus).toBeDefined();
    });

    it('should provide suggestions for conflicts', async () => {
      updatePortsFromCLI({ httpPort: 3000, gmailMcpPort: 3000 });
      
      const validation = await validatePortConfiguration(false);
      expect(validation.suggestions.some(s => 
        s.includes('Common development ports')
      )).toBe(true);
    });
  });

  describe('validateFullConfiguration', () => {
    it('should validate all configuration sections', () => {
      process.env['OBSIDIAN_VAULT_PATH'] = '/test/path';
      const validation = validateFullConfiguration();
      
      expect(validation.sections).toHaveProperty('ports');
      expect(validation.sections).toHaveProperty('obsidian');
      expect(validation.sections).toHaveProperty('gmail');
    });

    it('should collect all errors and warnings', () => {
      delete process.env['OBSIDIAN_VAULT_PATH'];
      updatePortsFromCLI({ httpPort: 80, gmailMcpPort: 80 });
      
      const validation = validateFullConfiguration();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('getActiveConfiguration', () => {
    it('should generate formatted configuration dump', () => {
      updatePortsFromCLI({ httpPort: 8080 });
      const dump = getActiveConfiguration();
      
      expect(dump).toContain('ACTIVE CONFIGURATION DUMP');
      expect(dump).toContain('HTTP Server:');
      expect(dump).toContain('Active Port: 8080');
      expect(dump).toContain('Source: --http-port');
      expect(dump).toContain('VALIDATION STATUS');
      expect(dump).toContain('ENVIRONMENT VARIABLES');
      expect(dump).toContain('HOW TO CHANGE CONFIGURATION');
    });

    it('should show all configuration sources', () => {
      process.env['HTTP_SERVER_PORT'] = '4000';
      resetConfiguration();
      updatePortsFromCLI({ httpPort: 5000 });
      
      const dump = getActiveConfiguration();
      expect(dump).toContain('✓'); // Active source marker
      expect(dump).toContain('[DEFAULT]');
      expect(dump).toContain('[ENVIRONMENT]');
      expect(dump).toContain('[CLI_ARGUMENT]');
    });
  });

  describe('getActiveConfigurationJSON', () => {
    it('should generate JSON configuration', () => {
      updatePortsFromCLI({ httpPort: 8080, gmailMcpPort: 9000 });
      const json = getActiveConfigurationJSON();
      
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('process');
      expect(json).toHaveProperty('ports');
      expect(json).toHaveProperty('validation');
      expect(json).toHaveProperty('environment');
      expect(json).toHaveProperty('configuration');
      
      expect(json['ports'].httpServer.active).toBe(8080);
      expect(json['ports'].gmailMcp.active).toBe(9000);
    });

    it('should include all sources in JSON', () => {
      process.env['GMAIL_MCP_PORT'] = '4000';
      resetConfiguration();
      
      const json = getActiveConfigurationJSON();
      const sources = json['ports'].gmailMcp.allSources;
      
      expect(sources.some((s: any) => s.priority === 'DEFAULT')).toBe(true);
      expect(sources.some((s: any) => s.priority === 'ENVIRONMENT')).toBe(true);
    });
  });

  describe('getConfigPriorityInfo', () => {
    it('should return priority information', () => {
      const info = getConfigPriorityInfo();
      
      expect(info).toContain('Configuration Priority System:');
      expect(info).toContain('CLI Arguments');
      expect(info).toContain('Environment Variables');
      expect(info).toContain('Default Values');
    });
  });

  describe('resetConfiguration', () => {
    it('should reset to defaults', () => {
      updatePortsFromCLI({ httpPort: 8080, gmailMcpPort: 9000 });
      
      let ports = getResolvedPorts();
      expect(ports.httpServer).toBe(8080);
      
      resetConfiguration();
      
      ports = getResolvedPorts();
      expect(ports.httpServer).toBe(3002);
      expect(ports.gmailMcp).toBe(3000);
    });

    it('should preserve environment variables after reset', () => {
      process.env['HTTP_SERVER_PORT'] = '4000';
      updatePortsFromCLI({ httpPort: 5000 });
      
      resetConfiguration();
      
      const ports = getResolvedPorts();
      expect(ports.httpServer).toBe(4000); // Environment variable preserved
    });
  });

  describe('validateConfig', () => {
    it('should not throw error in development mode without Gmail credentials', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['OBSIDIAN_VAULT_PATH'] = '/test/path';

      expect(() => validateConfig()).not.toThrow();
    });

    it('should throw error if OBSIDIAN_VAULT_PATH is not set', () => {
      delete process.env['OBSIDIAN_VAULT_PATH'];

      expect(() => validateConfig()).toThrow('Configuration validation failed');
    });

    it('should validate port configuration', () => {
      process.env['OBSIDIAN_VAULT_PATH'] = '/test/path';
      updatePortsFromCLI({ httpPort: 3000, gmailMcpPort: 3000 });

      expect(() => validateConfig()).toThrow('Port conflict');
    });

    it('should include port warnings', () => {
      process.env['OBSIDIAN_VAULT_PATH'] = '/test/path';
      updatePortsFromCLI({ httpPort: 80 });
      
      const spy = jest.spyOn(console, 'warn').mockImplementation();
      validateConfig();
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('requires root/admin privileges')
      );
      
      spy.mockRestore();
    });
  });
});