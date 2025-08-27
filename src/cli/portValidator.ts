/**
 * Port validation utilities and conflict detection
 */

import * as net from 'net';
import { PortValidationResult, PortConflict, PortConfiguration } from '../types/cli';

/**
 * Minimum allowed port number (above system/privileged ports)
 */
export const MIN_PORT = 1024;

/**
 * Maximum allowed port number
 */
export const MAX_PORT = 65535;

/**
 * Default port ranges for suggestions
 */
export const DEFAULT_PORT_RANGES = {
  development: [3000, 3099],
  production: [8000, 8099],
  docker: [30000, 30099]
};

/**
 * Validate if a port number is within the allowed range
 * @param port Port number to validate
 * @returns Validation result with error message if invalid
 */
export function validatePortRange(port: number): PortValidationResult {
  // Check if port is a valid integer
  if (!Number.isInteger(port)) {
    return {
      valid: false,
      error: `Port must be an integer, got: ${port}`,
      suggestion: 3002
    };
  }

  // Check minimum port range
  if (port < MIN_PORT) {
    return {
      valid: false,
      error: `Port ${port} is below minimum allowed port ${MIN_PORT}. Use ports above 1024 to avoid system/privileged port conflicts.`,
      suggestion: MIN_PORT
    };
  }

  // Check maximum port range
  if (port > MAX_PORT) {
    return {
      valid: false,
      error: `Port ${port} exceeds maximum allowed port ${MAX_PORT}`,
      suggestion: MAX_PORT
    };
  }

  return {
    valid: true
  };
}

/**
 * Parse port from string, handling various input formats
 * @param portString Port as string (e.g., "3000", "3000.5", "invalid")
 * @returns Parsed port number or null if invalid
 */
export function parsePort(portString: string): number | null {
  if (!portString || portString.trim() === '') {
    return null;
  }

  const parsed = parseInt(portString.trim(), 10);
  if (isNaN(parsed)) {
    return null;
  }

  return parsed;
}

/**
 * Validate port configuration for conflicts
 * @param config Port configuration to validate
 * @returns Array of port conflicts found
 */
export function validatePortConfiguration(config: PortConfiguration): PortConflict[] {
  const conflicts: PortConflict[] = [];
  const portToServices: Map<number, string[]> = new Map();

  // Track HTTP port
  if (config.httpPort) {
    const services = portToServices.get(config.httpPort) || [];
    services.push('HTTP Server');
    portToServices.set(config.httpPort, services);
  }

  // Track Gmail MCP port
  if (config.gmailMcpPort) {
    const services = portToServices.get(config.gmailMcpPort) || [];
    services.push('Gmail MCP Service');
    portToServices.set(config.gmailMcpPort, services);
  }

  // Find conflicts (ports used by multiple services)
  for (const [port, services] of portToServices) {
    if (services.length > 1) {
      conflicts.push({
        port,
        services,
        suggestions: generatePortSuggestions(port, Array.from(portToServices.keys()))
      });
    }
  }

  return conflicts;
}

/**
 * Advanced conflict detection for multiple port configurations
 * Useful for validating multiple daemon instances or service configurations
 * @param configs Array of port configurations to check for inter-config conflicts
 * @returns Array of conflicts found across all configurations
 */
export function detectPortConflictsAcrossConfigurations(configs: PortConfiguration[]): PortConflict[] {
  const conflicts: PortConflict[] = [];
  const globalPortToServices: Map<number, Array<{ service: string; configIndex: number }>> = new Map();

  // Build global port usage map
  configs.forEach((config, configIndex) => {
    if (config.httpPort) {
      const entries = globalPortToServices.get(config.httpPort) || [];
      entries.push({ service: `HTTP Server (Config ${configIndex + 1})`, configIndex });
      globalPortToServices.set(config.httpPort, entries);
    }

    if (config.gmailMcpPort) {
      const entries = globalPortToServices.get(config.gmailMcpPort) || [];
      entries.push({ service: `Gmail MCP Service (Config ${configIndex + 1})`, configIndex });
      globalPortToServices.set(config.gmailMcpPort, entries);
    }
  });

  // Find conflicts across configurations
  for (const [port, entries] of globalPortToServices) {
    if (entries.length > 1) {
      const allUsedPorts = Array.from(globalPortToServices.keys());
      conflicts.push({
        port,
        services: entries.map(entry => entry.service),
        suggestions: generatePortSuggestions(port, allUsedPorts)
      });
    }
  }

  return conflicts;
}

/**
 * Check if a specific port conflicts with a configuration
 * @param port Port number to check
 * @param config Configuration to check against
 * @returns True if port conflicts with any service in the configuration
 */
export function doesPortConflictWithConfiguration(port: number, config: PortConfiguration): boolean {
  return (
    (config.httpPort !== undefined && config.httpPort === port) ||
    (config.gmailMcpPort !== undefined && config.gmailMcpPort === port)
  );
}

/**
 * Get detailed conflict information for a specific port
 * @param port Port number to analyze
 * @param config Configuration to check
 * @returns Detailed conflict information or null if no conflict
 */
export function getPortConflictDetails(port: number, config: PortConfiguration): {
  isConflict: boolean;
  conflictingServices: string[];
  suggestions: number[];
} {
  const conflictingServices: string[] = [];
  const usedPorts: number[] = [];

  // Check HTTP server conflict
  if (config.httpPort === port) {
    conflictingServices.push('HTTP Server');
  }
  if (config.httpPort) {
    usedPorts.push(config.httpPort);
  }

  // Check Gmail MCP service conflict
  if (config.gmailMcpPort === port) {
    conflictingServices.push('Gmail MCP Service');
  }
  if (config.gmailMcpPort) {
    usedPorts.push(config.gmailMcpPort);
  }

  return {
    isConflict: conflictingServices.length > 0,
    conflictingServices,
    suggestions: conflictingServices.length > 0 ? generatePortSuggestions(port, usedPorts) : []
  };
}

/**
 * Generate human-readable conflict summary
 * @param conflicts Array of port conflicts
 * @returns Formatted string describing all conflicts
 */
export function formatConflictSummary(conflicts: PortConflict[]): string {
  if (conflicts.length === 0) {
    return 'No port conflicts detected.';
  }

  const lines: string[] = [];
  lines.push(`Found ${conflicts.length} port conflict${conflicts.length > 1 ? 's' : ''}:`);

  conflicts.forEach((conflict, index) => {
    const servicesText = conflict.services.join(' and ');
    const suggestionsText = conflict.suggestions.length > 0 
      ? ` Try: ${conflict.suggestions.slice(0, 3).join(', ')}`
      : '';
    
    lines.push(`  ${index + 1}. Port ${conflict.port} is used by: ${servicesText}.${suggestionsText}`);
  });

  return lines.join('\n');
}

/**
 * Port suggestion strategies for different scenarios
 */
export enum SuggestionStrategy {
  INCREMENTAL = 'incremental',      // Start from original port and increment
  COMMON_RANGES = 'common_ranges',  // Use well-known port ranges
  RANDOM_SAFE = 'random_safe',      // Random ports in safe ranges
  SERVICE_SPECIFIC = 'service_specific' // Suggestions based on service type
}

/**
 * Service-specific port ranges for intelligent suggestions
 */
export const SERVICE_PORT_RANGES = {
  'HTTP Server': [3000, 3010, 8000, 8010, 8080, 8090],
  'Gmail MCP Service': [3001, 3011, 8001, 8011, 8081, 8091],
  'WebSocket': [3002, 3012, 8002, 8012, 8082, 8092],
  'Database': [5432, 5433, 3306, 3307, 27017, 27018]
};

/**
 * Enhanced port suggestion generator with multiple strategies
 * @param originalPort The original conflicted port
 * @param usedPorts List of currently used ports to avoid
 * @param maxSuggestions Maximum number of suggestions to generate
 * @param strategy Suggestion strategy to use
 * @param serviceType Optional service type for service-specific suggestions
 * @returns Array of suggested alternative ports
 */
export function generatePortSuggestions(
  originalPort: number, 
  usedPorts: number[] = [], 
  maxSuggestions: number = 3,
  strategy: SuggestionStrategy = SuggestionStrategy.INCREMENTAL,
  serviceType?: string
): number[] {
  const usedPortSet = new Set(usedPorts);

  switch (strategy) {
    case SuggestionStrategy.INCREMENTAL:
      return generateIncrementalSuggestions(originalPort, usedPortSet, maxSuggestions);
    
    case SuggestionStrategy.COMMON_RANGES:
      return generateCommonRangeSuggestions(usedPortSet, maxSuggestions);
    
    case SuggestionStrategy.RANDOM_SAFE:
      return generateRandomSafeSuggestions(usedPortSet, maxSuggestions);
    
    case SuggestionStrategy.SERVICE_SPECIFIC:
      return generateServiceSpecificSuggestions(serviceType, usedPortSet, maxSuggestions);
    
    default:
      return generateIncrementalSuggestions(originalPort, usedPortSet, maxSuggestions);
  }
}

/**
 * Generate suggestions by incrementing from the original port
 * @param originalPort Starting port
 * @param usedPortSet Set of ports to avoid
 * @param maxSuggestions Maximum suggestions to generate
 * @returns Array of suggested ports
 */
function generateIncrementalSuggestions(
  originalPort: number,
  usedPortSet: Set<number>,
  maxSuggestions: number
): number[] {
  const suggestions: number[] = [];

  // Try incrementing from original port
  let candidate = originalPort + 1;
  while (suggestions.length < maxSuggestions && candidate <= MAX_PORT) {
    if (!usedPortSet.has(candidate) && candidate >= MIN_PORT) {
      suggestions.push(candidate);
    }
    candidate++;
  }

  // If we need more, also try decrementing (in case we're near the end of a range)
  if (suggestions.length < maxSuggestions) {
    candidate = originalPort - 1;
    while (suggestions.length < maxSuggestions && candidate >= MIN_PORT) {
      if (!usedPortSet.has(candidate) && !suggestions.includes(candidate)) {
        suggestions.push(candidate);
      }
      candidate--;
    }
  }

  return suggestions;
}

/**
 * Generate suggestions from common development and production port ranges
 * @param usedPortSet Set of ports to avoid
 * @param maxSuggestions Maximum suggestions to generate
 * @returns Array of suggested ports
 */
function generateCommonRangeSuggestions(
  usedPortSet: Set<number>,
  maxSuggestions: number
): number[] {
  const suggestions: number[] = [];
  
  // Development range (3000-3099)
  for (let port = 3000; port <= 3099 && suggestions.length < maxSuggestions; port++) {
    if (!usedPortSet.has(port)) {
      suggestions.push(port);
    }
  }

  // Production range (8000-8099) 
  for (let port = 8000; port <= 8099 && suggestions.length < maxSuggestions; port++) {
    if (!usedPortSet.has(port) && !suggestions.includes(port)) {
      suggestions.push(port);
    }
  }

  // Alternative ranges (9000-9099, 4000-4099)
  const alternativeRanges = [
    [9000, 9099],
    [4000, 4099],
    [5000, 5099]
  ];

  for (const [start, end] of alternativeRanges) {
    if (start !== undefined && end !== undefined) {
      for (let port = start; port <= end && suggestions.length < maxSuggestions; port++) {
        if (!usedPortSet.has(port) && !suggestions.includes(port)) {
          suggestions.push(port);
        }
      }
    }
  }

  return suggestions;
}

/**
 * Generate random suggestions from safe port ranges
 * @param usedPortSet Set of ports to avoid
 * @param maxSuggestions Maximum suggestions to generate
 * @returns Array of suggested ports
 */
function generateRandomSafeSuggestions(
  usedPortSet: Set<number>,
  maxSuggestions: number
): number[] {
  const suggestions: number[] = [];
  const safeRanges = [
    [3000, 3999],
    [8000, 8999],
    [9000, 9999],
    [4000, 4999]
  ];

  const attempts = maxSuggestions * 10; // Try up to 10x to find random ports
  
  for (let i = 0; i < attempts && suggestions.length < maxSuggestions; i++) {
    const range = safeRanges[Math.floor(Math.random() * safeRanges.length)];
    if (range && range[0] !== undefined && range[1] !== undefined) {
      const port = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
      
      if (!usedPortSet.has(port) && !suggestions.includes(port)) {
        suggestions.push(port);
      }
    }
  }

  return suggestions;
}

/**
 * Generate service-specific port suggestions
 * @param serviceType Type of service needing a port
 * @param usedPortSet Set of ports to avoid
 * @param maxSuggestions Maximum suggestions to generate
 * @returns Array of suggested ports
 */
function generateServiceSpecificSuggestions(
  serviceType: string | undefined,
  usedPortSet: Set<number>,
  maxSuggestions: number
): number[] {
  const suggestions: number[] = [];
  
  // If no service type specified, fall back to common ranges
  if (!serviceType) {
    return generateCommonRangeSuggestions(usedPortSet, maxSuggestions);
  }

  // Try service-specific ports first
  const serviceSpecificPorts = SERVICE_PORT_RANGES[serviceType as keyof typeof SERVICE_PORT_RANGES] || [];
  for (const port of serviceSpecificPorts) {
    if (suggestions.length >= maxSuggestions) break;
    if (!usedPortSet.has(port)) {
      suggestions.push(port);
    }
  }

  // If we need more suggestions, fall back to common ranges
  if (suggestions.length < maxSuggestions) {
    const commonSuggestions = generateCommonRangeSuggestions(usedPortSet, maxSuggestions - suggestions.length);
    for (const port of commonSuggestions) {
      if (!suggestions.includes(port)) {
        suggestions.push(port);
      }
    }
  }

  return suggestions;
}

/**
 * Smart suggestion generator that tries multiple strategies
 * @param originalPort Original port that had a conflict
 * @param usedPorts List of currently used ports
 * @param serviceType Optional service type for better suggestions
 * @returns Object with suggestions from different strategies
 */
export function generateSmartPortSuggestions(
  originalPort: number,
  usedPorts: number[] = [],
  serviceType?: string
): {
  incremental: number[];
  commonRanges: number[];
  serviceSpecific: number[];
  recommended: number;
} {
  const incremental = generatePortSuggestions(
    originalPort, 
    usedPorts, 
    3, 
    SuggestionStrategy.INCREMENTAL
  );

  const commonRanges = generatePortSuggestions(
    originalPort, 
    usedPorts, 
    3, 
    SuggestionStrategy.COMMON_RANGES
  );

  const serviceSpecific = generatePortSuggestions(
    originalPort, 
    usedPorts, 
    3, 
    SuggestionStrategy.SERVICE_SPECIFIC,
    serviceType
  );

  // Determine the best recommendation
  let recommended = originalPort + 1;
  if (incremental.length > 0 && incremental[0] !== undefined) {
    recommended = incremental[0];
  } else if (serviceSpecific.length > 0 && serviceSpecific[0] !== undefined) {
    recommended = serviceSpecific[0];
  } else if (commonRanges.length > 0 && commonRanges[0] !== undefined) {
    recommended = commonRanges[0];
  }

  return {
    incremental,
    commonRanges,
    serviceSpecific,
    recommended
  };
}

/**
 * Get user-friendly suggestion text for CLI error messages
 * @param originalPort The original conflicted port
 * @param suggestions Array of suggested alternative ports
 * @param serviceType Optional service type for context
 * @returns Formatted suggestion text
 */
export function formatPortSuggestions(
  _originalPort: number,
  suggestions: number[],
  serviceType?: string
): string {
  if (suggestions.length === 0) {
    return `No alternative ports found for ${serviceType || 'service'} (originally ${_originalPort}).`;
  }

  const serviceText = serviceType ? `${serviceType} ` : '';
  const portList = suggestions.slice(0, 3).join(', ');
  
  if (suggestions.length === 1) {
    return `${serviceText}port ${_originalPort} is in use. Try port ${portList} instead.`;
  } else {
    return `${serviceText}port ${_originalPort} is in use. Try ports: ${portList}`;
  }
}

/**
 * Validate multiple ports at once
 * @param ports Object with named ports to validate
 * @returns Object with validation results for each port
 */
export function validatePorts(ports: Record<string, number>): Record<string, PortValidationResult> {
  const results: Record<string, PortValidationResult> = {};
  
  for (const [name, port] of Object.entries(ports)) {
    results[name] = validatePortRange(port);
  }

  return results;
}

/**
 * Get human-readable error message for port validation failures
 * @param portName Name of the port (e.g., "HTTP Server", "Gmail MCP")
 * @param port The invalid port number
 * @param result Validation result with error details
 * @returns Formatted error message with suggestions
 */
export function getPortErrorMessage(
  portName: string, 
  _port: number, 
  result: PortValidationResult
): string {
  if (result.valid) {
    return '';
  }

  let message = `${portName} port configuration error: ${result.error}`;
  
  if (result.suggestion) {
    message += `\nSuggestion: Try --${portName.toLowerCase().replace(' ', '-')}-port ${result.suggestion}`;
  }

  return message;
}

/**
 * Check if a port is available for binding (not in use)
 * Uses the same approach as httpServer.ts for consistency
 * @param port Port number to check
 * @returns Promise that resolves to true if port is available, false if in use
 */
export function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          // Other errors (permission denied, invalid port, etc.) also mean unavailable
          resolve(false);
        }
      })
      .once('listening', () => {
        tester.close(() => {
          resolve(true);
        });
      })
      .listen(port);
  });
}

/**
 * Check availability of multiple ports concurrently
 * @param ports Array of port numbers to check
 * @returns Promise that resolves to object mapping port to availability
 */
export async function checkPortsAvailable(ports: number[]): Promise<Record<number, boolean>> {
  const results: Record<number, boolean> = {};
  
  // Check all ports concurrently
  const checkPromises = ports.map(async (port) => {
    const available = await checkPortAvailable(port);
    results[port] = available;
    return { port, available };
  });

  await Promise.all(checkPromises);
  return results;
}

/**
 * Find the first available port from a list of candidates
 * @param candidates Array of port numbers to try in order
 * @returns Promise that resolves to first available port, or null if none available
 */
export async function findFirstAvailablePort(candidates: number[]): Promise<number | null> {
  for (const port of candidates) {
    // First check if port is in valid range
    const rangeValidation = validatePortRange(port);
    if (!rangeValidation.valid) {
      continue;
    }

    // Then check if port is available
    const isAvailable = await checkPortAvailable(port);
    if (isAvailable) {
      return port;
    }
  }

  return null;
}

/**
 * Validate port configuration including availability checks
 * @param config Port configuration to validate
 * @param checkAvailability Whether to check if ports are actually available (default: false)
 * @returns Promise that resolves to validation results with availability info
 */
export async function validatePortConfigurationWithAvailability(
  config: PortConfiguration,
  checkAvailability: boolean = false
): Promise<{
  valid: boolean;
  conflicts: PortConflict[];
  unavailablePorts: number[];
  suggestions: Record<number, number[]>;
}> {
  const conflicts = validatePortConfiguration(config);
  let unavailablePorts: number[] = [];
  const suggestions: Record<number, number[]> = {};

  if (checkAvailability) {
    const portsToCheck = [config.httpPort, config.gmailMcpPort].filter(Boolean) as number[];
    const availability = await checkPortsAvailable(portsToCheck);
    
    unavailablePorts = portsToCheck.filter(port => !availability[port]);
    
    // Generate suggestions for unavailable ports
    for (const port of unavailablePorts) {
      suggestions[port] = generatePortSuggestions(port, portsToCheck);
    }
  }

  return {
    valid: conflicts.length === 0 && unavailablePorts.length === 0,
    conflicts,
    unavailablePorts,
    suggestions
  };
}

/**
 * Check if a port configuration has any validation errors
 * @param config Port configuration to check
 * @returns True if configuration is valid, false if there are errors
 */
export function isValidPortConfiguration(config: PortConfiguration): boolean {
  // Validate individual port ranges
  if (config.httpPort && !validatePortRange(config.httpPort).valid) {
    return false;
  }

  if (config.gmailMcpPort && !validatePortRange(config.gmailMcpPort).valid) {
    return false;
  }

  // Check for conflicts
  const conflicts = validatePortConfiguration(config);
  return conflicts.length === 0;
}