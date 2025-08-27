/**
 * Comprehensive test cases for port validation utilities
 */

import * as net from 'net';
import {
  MIN_PORT,
  MAX_PORT,
  validatePortRange,
  parsePort,
  validatePortConfiguration,
  detectPortConflictsAcrossConfigurations,
  doesPortConflictWithConfiguration,
  getPortConflictDetails,
  formatConflictSummary,
  generatePortSuggestions,
  generateSmartPortSuggestions,
  formatPortSuggestions,
  checkPortAvailable,
  checkPortsAvailable,
  findFirstAvailablePort,
  validatePortConfigurationWithAvailability,
  validatePorts,
  getPortErrorMessage,
  isValidPortConfiguration,
  SuggestionStrategy,
  SERVICE_PORT_RANGES
} from './portValidator';

import {
  PortConfiguration,
  PortValidationResult,
  PortConflict
} from '../types/cli';

// Mock net module for controlled testing
jest.mock('net');
const mockNet = net as jest.Mocked<typeof net>;

describe('Port Validator', () => {
  let mockServer: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = { ...process.env };
    
    // Mock net.createServer
    mockServer = {
      once: jest.fn().mockReturnThis(),
      listen: jest.fn().mockReturnThis(),
      close: jest.fn()
    };
    mockNet.createServer.mockReturnValue(mockServer);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllTimers();
  });

  describe('Constants', () => {
    it('should have correct port range constants', () => {
      expect(MIN_PORT).toBe(1024);
      expect(MAX_PORT).toBe(65535);
    });

    it('should have service port ranges defined', () => {
      expect(SERVICE_PORT_RANGES).toHaveProperty('HTTP Server');
      expect(SERVICE_PORT_RANGES).toHaveProperty('Gmail MCP Service');
      expect(Array.isArray(SERVICE_PORT_RANGES['HTTP Server'])).toBe(true);
      expect(Array.isArray(SERVICE_PORT_RANGES['Gmail MCP Service'])).toBe(true);
    });
  });

  describe('validatePortRange', () => {
    it('should validate ports within allowed range', () => {
      const result = validatePortRange(3000);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject ports below minimum', () => {
      const result = validatePortRange(1023);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('below minimum allowed port');
      expect(result.suggestion).toBe(MIN_PORT);
    });

    it('should reject ports above maximum', () => {
      const result = validatePortRange(65536);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed port');
      expect(result.suggestion).toBe(MAX_PORT);
    });

    it('should reject non-integer ports', () => {
      const result = validatePortRange(3000.5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be an integer');
      expect(result.suggestion).toBe(3002);
    });

    it('should handle edge cases', () => {
      expect(validatePortRange(MIN_PORT).valid).toBe(true);
      expect(validatePortRange(MAX_PORT).valid).toBe(true);
      expect(validatePortRange(MIN_PORT - 1).valid).toBe(false);
      expect(validatePortRange(MAX_PORT + 1).valid).toBe(false);
    });
  });

  describe('parsePort', () => {
    it('should parse valid port strings', () => {
      expect(parsePort('3000')).toBe(3000);
      expect(parsePort('8080')).toBe(8080);
      expect(parsePort(' 9000 ')).toBe(9000); // with whitespace
    });

    it('should return null for invalid inputs', () => {
      expect(parsePort('')).toBeNull();
      expect(parsePort('  ')).toBeNull();
      expect(parsePort('abc')).toBeNull();
      expect(parsePort('3000.5')).toBe(3000); // parseInt truncates
    });

    it('should handle undefined and null inputs', () => {
      expect(parsePort('')).toBeNull();
    });
  });

  describe('validatePortConfiguration', () => {
    it('should validate configuration with no conflicts', () => {
      const config: PortConfiguration = {
        httpPort: 3000,
        gmailMcpPort: 3001
      };
      const conflicts = validatePortConfiguration(config);
      expect(conflicts).toHaveLength(0);
    });

    it('should detect conflicts between services', () => {
      const config: PortConfiguration = {
        httpPort: 3000,
        gmailMcpPort: 3000
      };
      const conflicts = validatePortConfiguration(config);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]?.port).toBe(3000);
      expect(conflicts[0]?.services).toContain('HTTP Server');
      expect(conflicts[0]?.services).toContain('Gmail MCP Service');
      expect(conflicts[0]?.suggestions).toBeDefined();
      expect(conflicts[0]?.suggestions?.length).toBeGreaterThan(0);
    });

    it('should handle partial configurations', () => {
      const config1: PortConfiguration = { httpPort: 3000 };
      const config2: PortConfiguration = { gmailMcpPort: 3001 };
      
      expect(validatePortConfiguration(config1)).toHaveLength(0);
      expect(validatePortConfiguration(config2)).toHaveLength(0);
    });

    it('should handle empty configurations', () => {
      const config: PortConfiguration = {};
      expect(validatePortConfiguration(config)).toHaveLength(0);
    });
  });

  describe('detectPortConflictsAcrossConfigurations', () => {
    it('should detect conflicts across multiple configurations', () => {
      const configs: PortConfiguration[] = [
        { httpPort: 3000, gmailMcpPort: 3001 },
        { httpPort: 3000, gmailMcpPort: 3002 }, // Conflict on 3000
        { httpPort: 3003, gmailMcpPort: 3001 }  // Conflict on 3001
      ];

      const conflicts = detectPortConflictsAcrossConfigurations(configs);
      expect(conflicts).toHaveLength(2);
      
      const portNumbers = conflicts.map(c => c.port).sort();
      expect(portNumbers).toEqual([3000, 3001]);
    });

    it('should handle no conflicts across configurations', () => {
      const configs: PortConfiguration[] = [
        { httpPort: 3000, gmailMcpPort: 3001 },
        { httpPort: 3002, gmailMcpPort: 3003 }
      ];

      const conflicts = detectPortConflictsAcrossConfigurations(configs);
      expect(conflicts).toHaveLength(0);
    });

    it('should handle empty configurations list', () => {
      const conflicts = detectPortConflictsAcrossConfigurations([]);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('doesPortConflictWithConfiguration', () => {
    const config: PortConfiguration = {
      httpPort: 3000,
      gmailMcpPort: 3001
    };

    it('should detect conflicts correctly', () => {
      expect(doesPortConflictWithConfiguration(3000, config)).toBe(true);
      expect(doesPortConflictWithConfiguration(3001, config)).toBe(true);
      expect(doesPortConflictWithConfiguration(3002, config)).toBe(false);
    });

    it('should handle partial configurations', () => {
      const partialConfig: PortConfiguration = { httpPort: 3000 };
      expect(doesPortConflictWithConfiguration(3000, partialConfig)).toBe(true);
      expect(doesPortConflictWithConfiguration(3001, partialConfig)).toBe(false);
    });
  });

  describe('getPortConflictDetails', () => {
    const config: PortConfiguration = {
      httpPort: 3000,
      gmailMcpPort: 3001
    };

    it('should provide detailed conflict information', () => {
      const details = getPortConflictDetails(3000, config);
      expect(details.isConflict).toBe(true);
      expect(details.conflictingServices).toContain('HTTP Server');
      expect(details.suggestions).toHaveLength(3);
    });

    it('should handle no conflicts', () => {
      const details = getPortConflictDetails(3002, config);
      expect(details.isConflict).toBe(false);
      expect(details.conflictingServices).toHaveLength(0);
      expect(details.suggestions).toHaveLength(0);
    });
  });

  describe('formatConflictSummary', () => {
    it('should format conflict summary correctly', () => {
      const conflicts: PortConflict[] = [
        {
          port: 3000,
          services: ['HTTP Server', 'Gmail MCP Service'],
          suggestions: [3002, 3003, 3004]
        }
      ];

      const summary = formatConflictSummary(conflicts);
      expect(summary).toContain('Found 1 port conflict');
      expect(summary).toContain('Port 3000');
      expect(summary).toContain('HTTP Server and Gmail MCP Service');
      expect(summary).toContain('Try: 3002, 3003, 3004');
    });

    it('should handle multiple conflicts', () => {
      const conflicts: PortConflict[] = [
        { port: 3000, services: ['Service A', 'Service B'], suggestions: [3001] },
        { port: 4000, services: ['Service C', 'Service D'], suggestions: [4001] }
      ];

      const summary = formatConflictSummary(conflicts);
      expect(summary).toContain('Found 2 port conflicts');
    });

    it('should handle no conflicts', () => {
      const summary = formatConflictSummary([]);
      expect(summary).toBe('No port conflicts detected.');
    });
  });

  describe('generatePortSuggestions', () => {
    it('should generate incremental suggestions by default', () => {
      const suggestions = generatePortSuggestions(3000, [3001, 3002], 3);
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toBeGreaterThan(3000);
      expect(suggestions).not.toContain(3001);
      expect(suggestions).not.toContain(3002);
    });

    it('should generate common range suggestions', () => {
      const suggestions = generatePortSuggestions(
        5000, 
        [], 
        3, 
        SuggestionStrategy.COMMON_RANGES
      );
      expect(suggestions).toHaveLength(3);
      // Should start with development range (3000-3099)
      expect(suggestions[0]).toBe(3000);
    });

    it('should generate service-specific suggestions', () => {
      const suggestions = generatePortSuggestions(
        5000,
        [],
        3,
        SuggestionStrategy.SERVICE_SPECIFIC,
        'HTTP Server'
      );
      expect(suggestions).toHaveLength(3);
      // Should use ports from SERVICE_PORT_RANGES['HTTP Server']
      const httpServerPorts = SERVICE_PORT_RANGES['HTTP Server'];
      expect(httpServerPorts).toContain(suggestions[0]);
    });

    it('should avoid used ports', () => {
      const usedPorts = [3000, 3001, 3002];
      const suggestions = generatePortSuggestions(2999, usedPorts, 3);
      expect(suggestions.every(port => !usedPorts.includes(port))).toBe(true);
    });

    it('should respect max suggestions limit', () => {
      const suggestions = generatePortSuggestions(3000, [], 2);
      expect(suggestions).toHaveLength(2);
    });
  });

  describe('generateSmartPortSuggestions', () => {
    it('should provide multiple suggestion strategies', () => {
      const result = generateSmartPortSuggestions(3000, [3001]);
      
      expect(result).toHaveProperty('incremental');
      expect(result).toHaveProperty('commonRanges');
      expect(result).toHaveProperty('serviceSpecific');
      expect(result).toHaveProperty('recommended');
      
      expect(Array.isArray(result.incremental)).toBe(true);
      expect(Array.isArray(result.commonRanges)).toBe(true);
      expect(Array.isArray(result.serviceSpecific)).toBe(true);
      expect(typeof result.recommended).toBe('number');
    });

    it('should provide different recommendations for different service types', () => {
      const httpResult = generateSmartPortSuggestions(5000, [], 'HTTP Server');
      const gmailResult = generateSmartPortSuggestions(5000, [], 'Gmail MCP Service');
      
      // Service-specific suggestions should be different
      expect(httpResult.serviceSpecific).not.toEqual(gmailResult.serviceSpecific);
    });
  });

  describe('formatPortSuggestions', () => {
    it('should format single suggestion', () => {
      const message = formatPortSuggestions(3000, [3001], 'HTTP Server');
      expect(message).toContain('HTTP Server port 3000 is in use');
      expect(message).toContain('Try port 3001');
    });

    it('should format multiple suggestions', () => {
      const message = formatPortSuggestions(3000, [3001, 3002, 3003]);
      expect(message).toContain('port 3000 is in use');
      expect(message).toContain('Try ports: 3001, 3002, 3003');
    });

    it('should handle no suggestions', () => {
      const message = formatPortSuggestions(3000, []);
      expect(message).toContain('No alternative ports found');
    });

    it('should handle service type context', () => {
      const message = formatPortSuggestions(3000, [3001], 'Gmail MCP Service');
      expect(message).toContain('Gmail MCP Service');
    });
  });

  describe('checkPortAvailable', () => {
    it('should return true when port is available', async () => {
      // Mock successful listening
      mockServer.once.mockImplementation((event: string, callback: () => void) => {
        if (event === 'listening') {
          setTimeout(callback, 0);
        }
        return mockServer;
      });
      
      mockServer.close.mockImplementation((callback: () => void) => {
        setTimeout(callback, 0);
      });

      const result = await checkPortAvailable(3000);
      expect(result).toBe(true);
      expect(mockNet.createServer).toHaveBeenCalled();
    });

    it('should return false when port is in use', async () => {
      // Mock EADDRINUSE error
      mockServer.once.mockImplementation((event: string, callback: (error?: any) => void) => {
        if (event === 'error') {
          setTimeout(() => callback({ code: 'EADDRINUSE' }), 0);
        }
        return mockServer;
      });

      const result = await checkPortAvailable(3000);
      expect(result).toBe(false);
    });

    it('should return false for other errors', async () => {
      // Mock permission denied error
      mockServer.once.mockImplementation((event: string, callback: (error?: any) => void) => {
        if (event === 'error') {
          setTimeout(() => callback({ code: 'EACCES' }), 0);
        }
        return mockServer;
      });

      const result = await checkPortAvailable(3000);
      expect(result).toBe(false);
    });
  });

  describe('checkPortsAvailable', () => {
    it('should check multiple ports concurrently', async () => {
      // Mock all ports as available
      mockServer.once.mockImplementation((event: string, callback: () => void) => {
        if (event === 'listening') {
          setTimeout(callback, 0);
        }
        return mockServer;
      });
      
      mockServer.close.mockImplementation((callback: () => void) => {
        setTimeout(callback, 0);
      });

      const result = await checkPortsAvailable([3000, 3001, 3002]);
      expect(result).toEqual({
        3000: true,
        3001: true,
        3002: true
      });
      expect(mockNet.createServer).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed availability results', async () => {
      let callCount = 0;
      mockServer.once.mockImplementation((event: string, callback: (error?: any) => void) => {
        callCount++;
        if (event === 'error' && callCount === 1) {
          // First port in use
          setTimeout(() => callback({ code: 'EADDRINUSE' }), 0);
        } else if (event === 'listening') {
          // Other ports available
          setTimeout(callback, 0);
        }
        return mockServer;
      });
      
      mockServer.close.mockImplementation((callback: () => void) => {
        setTimeout(callback, 0);
      });

      const result = await checkPortsAvailable([3000, 3001]);
      expect(result[3000]).toBe(false);
      expect(result[3001]).toBe(true);
    });
  });

  describe('findFirstAvailablePort', () => {
    it('should find first available port', async () => {
      let callCount = 0;
      mockServer.once.mockImplementation((event: string, callback: (error?: any) => void) => {
        callCount++;
        if (event === 'error' && callCount === 1) {
          // First port in use
          setTimeout(() => callback({ code: 'EADDRINUSE' }), 0);
        } else if (event === 'listening' && callCount >= 2) {
          // Second port available
          setTimeout(callback, 0);
        }
        return mockServer;
      });
      
      mockServer.close.mockImplementation((callback: () => void) => {
        setTimeout(callback, 0);
      });

      const result = await findFirstAvailablePort([3000, 3001, 3002]);
      expect(result).toBe(3001);
    });

    it('should return null when no ports are available', async () => {
      // Mock all ports as in use
      mockServer.once.mockImplementation((event: string, callback: (error?: any) => void) => {
        if (event === 'error') {
          setTimeout(() => callback({ code: 'EADDRINUSE' }), 0);
        }
        return mockServer;
      });

      const result = await findFirstAvailablePort([3000, 3001]);
      expect(result).toBeNull();
    });

    it('should skip invalid port ranges', async () => {
      mockServer.once.mockImplementation((event: string, callback: () => void) => {
        if (event === 'listening') {
          setTimeout(callback, 0);
        }
        return mockServer;
      });
      
      mockServer.close.mockImplementation((callback: () => void) => {
        setTimeout(callback, 0);
      });

      const result = await findFirstAvailablePort([500, 3000]); // 500 is below MIN_PORT
      expect(result).toBe(3000);
    });
  });

  describe('validatePorts', () => {
    it('should validate multiple named ports', () => {
      const ports = {
        http: 3000,
        gmail: 3001,
        invalid: 500
      };

      const results = validatePorts(ports);
      expect(results['http']?.valid).toBe(true);
      expect(results['gmail']?.valid).toBe(true);
      expect(results['invalid']?.valid).toBe(false);
      expect(results['invalid']?.error).toContain('below minimum');
    });
  });

  describe('getPortErrorMessage', () => {
    it('should generate clear error messages', () => {
      const result: PortValidationResult = {
        valid: false,
        error: 'Port is below minimum',
        suggestion: 1024
      };

      const message = getPortErrorMessage('HTTP Server', 500, result);
      expect(message).toContain('HTTP Server port configuration error');
      expect(message).toContain('Port is below minimum');
      expect(message).toContain('Try --http-server-port 1024');
    });

    it('should return empty string for valid ports', () => {
      const result: PortValidationResult = { valid: true };
      const message = getPortErrorMessage('HTTP Server', 3000, result);
      expect(message).toBe('');
    });
  });

  describe('isValidPortConfiguration', () => {
    it('should validate complete configuration', () => {
      const validConfig: PortConfiguration = {
        httpPort: 3000,
        gmailMcpPort: 3001
      };
      expect(isValidPortConfiguration(validConfig)).toBe(true);
    });

    it('should reject configuration with invalid ports', () => {
      const invalidConfig: PortConfiguration = {
        httpPort: 500, // Below minimum
        gmailMcpPort: 3001
      };
      expect(isValidPortConfiguration(invalidConfig)).toBe(false);
    });

    it('should reject configuration with conflicts', () => {
      const conflictConfig: PortConfiguration = {
        httpPort: 3000,
        gmailMcpPort: 3000 // Same port
      };
      expect(isValidPortConfiguration(conflictConfig)).toBe(false);
    });
  });

  describe('validatePortConfigurationWithAvailability', () => {
    it('should validate without availability check', async () => {
      const config: PortConfiguration = {
        httpPort: 3000,
        gmailMcpPort: 3001
      };

      const result = await validatePortConfigurationWithAvailability(config, false);
      expect(result.valid).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.unavailablePorts).toHaveLength(0);
      expect(Object.keys(result.suggestions)).toHaveLength(0);
    });

    it('should include availability check when requested', async () => {
      mockServer.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          setTimeout(() => callback({ code: 'EADDRINUSE' }), 0);
        }
        return mockServer;
      });

      const config: PortConfiguration = {
        httpPort: 3000,
        gmailMcpPort: 3001
      };

      const result = await validatePortConfigurationWithAvailability(config, true);
      expect(result.valid).toBe(false);
      expect(result.unavailablePorts).toContain(3000);
      expect(result.unavailablePorts).toContain(3001);
      expect(result.suggestions).toHaveProperty('3000');
      expect(result.suggestions).toHaveProperty('3001');
    });
  });
});