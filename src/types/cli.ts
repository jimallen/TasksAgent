/**
 * TypeScript interfaces for CLI configuration and port settings
 */

/**
 * Port configuration for all services
 */
export interface PortConfiguration {
  httpPort?: number;
  gmailMcpPort?: number;
}

/**
 * Command line arguments structure
 */
export interface CLIArguments {
  httpPort?: number;
  gmailMcpPort?: number;
  help?: boolean;
  version?: boolean;
  headless?: boolean;
  configDump?: boolean;
}

/**
 * Configuration priority levels for resolution
 */
export enum ConfigPriority {
  DEFAULT = 0,
  ENVIRONMENT = 1,
  CLI_ARGUMENT = 2
}

/**
 * Configuration source with priority
 */
export interface ConfigSource {
  value: any;
  priority: ConfigPriority;
  source: string;
}

/**
 * Resolved configuration with all sources merged
 */
export interface ResolvedConfiguration {
  ports: PortConfiguration;
  mode: {
    headless: boolean;
    help: boolean;
    version: boolean;
    configDump: boolean;
  };
  sources: {
    httpPort: ConfigSource;
    gmailMcpPort?: ConfigSource;
  };
}

/**
 * Port validation result
 */
export interface PortValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: number;
}

/**
 * Port conflict information
 */
export interface PortConflict {
  port: number;
  services: string[];
  suggestions: number[];
}

/**
 * CLI parsing result
 */
export interface CLIParseResult {
  arguments: CLIArguments;
  errors: string[];
  warnings: string[];
}

/**
 * Help section structure for organized help text
 */
export interface HelpSection {
  title: string;
  description: string;
  examples?: string[];
}

/**
 * Complete help information
 */
export interface HelpInfo {
  usage: string;
  description: string;
  sections: HelpSection[];
}