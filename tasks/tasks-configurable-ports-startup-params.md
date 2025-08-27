# Tasks: Configurable Ports via Startup Parameters

Generated from: `prd-configurable-ports-startup-params.md`

## Relevant Files

### New Files to Create
- `src/cli/argumentParser.ts` - Core CLI argument parsing with validation and help generation
- `src/cli/argumentParser.spec.ts` - Unit tests for CLI argument parsing functionality  
- `src/cli/portValidator.ts` - Port validation utilities and conflict detection
- `src/cli/portValidator.spec.ts` - Unit tests for port validation logic
- `src/types/cli.ts` - TypeScript interfaces for CLI configuration and port settings

### Existing Files to Modify
- `src/daemon.ts` - Replace basic argv parsing with comprehensive CLI parser integration
- `src/daemon/httpServer.ts` - Update constructor to accept configuration object, enhance port validation
- `src/daemon/httpServer.spec.ts` - Add tests for new configuration-based constructor and port validation
- `src/daemon/gmailMcpService.ts` - Add port configuration support for child process environment
- `src/daemon/gmailMcpService.spec.ts` - Add tests for port configuration and environment passing
- `src/config/config.ts` - Add port configuration interfaces and priority resolution system
- `src/config/config.spec.ts` - Add tests for port configuration priority and validation
- `package.json` - Update scripts to document new CLI parameters in comments

### Integration Test Files
- `src/daemon/integration.spec.ts` - End-to-end tests for daemon startup with various port configurations
- `src/cli/integration.spec.ts` - Integration tests for CLI argument parsing with service startup

## Notes

- Unit tests should be placed alongside code files using `.spec.ts` suffix
- Use `npx jest [optional/path/to/test/file]` to run specific tests  
- Use `npm run test` to run all tests
- Follow existing TypeScript patterns with strict typing
- Maintain backward compatibility with existing environment variables
- All port validation should use range 1024-65535 for security

## Tasks

- [x] **1.0 Create CLI Infrastructure and Type Definitions**
  - [x] 1.1 Create `src/types/cli.ts` with PortConfiguration, CLIArguments, and ConfigPriority interfaces
  - [x] 1.2 Create `src/cli/portValidator.ts` with port range validation (1024-65535)
  - [x] 1.3 Add port availability checking function using net.createServer approach (similar to httpServer.ts)
  - [x] 1.4 Add port conflict detection to prevent duplicate assignments across services
  - [x] 1.5 Add port suggestion utility for recommending alternatives when conflicts occur
  - [x] 1.6 Create `src/cli/portValidator.spec.ts` with comprehensive test cases for all validation scenarios

- [x] **2.0 Implement Comprehensive CLI Argument Parsing System**
  - [x] 2.1 Create `src/cli/argumentParser.ts` with support for --http-port, --gmail-mcp-port parameters
  - [x] 2.2 Add support for both --port=3000 and --port 3000 syntax formats
  - [x] 2.3 Implement --help flag with comprehensive usage information and port examples
  - [x] 2.4 Add --version flag support reading from package.json version
  - [x] 2.5 Implement --config-dump flag to display all resolved configuration values
  - [x] 2.6 Add error handling with clear messages for invalid arguments and suggestions
  - [x] 2.7 Maintain compatibility with existing --headless and --help flags
  - [x] 2.8 Create `src/cli/argumentParser.spec.ts` with tests for all argument parsing scenarios

- [x] **3.0 Enhance Configuration Management with Port Priority System**
  - [x] 3.1 Update `src/config/config.ts` to add port configuration section with default values
  - [x] 3.2 Implement configuration priority system: CLI args → Environment vars → Defaults
  - [x] 3.3 Add configuration resolution function that merges all sources with proper precedence
  - [x] 3.4 Add validateConfiguration function to ensure no port conflicts and valid ranges
  - [x] 3.5 Add getActiveConfiguration function for --config-dump feature
  - [x] 3.6 Add GMAIL_MCP_PORT environment variable support alongside existing HTTP_SERVER_PORT
  - [x] 3.7 Update `src/config/config.spec.ts` with tests for priority resolution and validation

- [ ] **4.0 Update Service Constructors and Port Configuration**
  - [x] 4.1 Update `src/daemon/httpServer.ts` constructor to accept PortConfiguration object
  - [x] 4.2 Remove hardcoded port defaults and use configuration object throughout httpServer.ts
  - [x] 4.3 Update port conflict error messages to reference CLI parameters instead of just environment variables
  - [x] 4.4 Enhance alternative port selection to use configured ranges and validation
  - [x] 4.5 Update `src/daemon/httpServer.spec.ts` with tests for configuration-based constructor
  - [x] 4.6 Add tests for new error messages mentioning CLI parameters and configuration options

- [ ] **5.0 Integrate Gmail MCP Port Configuration**
  - [x] 5.1 Update `src/daemon/gmailMcpService.ts` to accept port configuration in constructor
  - [x] 5.2 Add environment variable passing to Gmail MCP child process with configured port
  - [x] 5.3 Update Gmail MCP health check endpoints to use dynamically configured port
  - [x] 5.4 Handle Gmail MCP port conflicts and provide clear error messages with CLI parameter guidance
  - [x] 5.5 Update `src/daemon/gmailMcpService.spec.ts` with tests for port configuration and environment passing
  - [x] 5.6 Add integration tests for Gmail MCP service startup with custom ports

- [ ] **6.0 Add Comprehensive Testing Suite for CLI and Port Configuration**
  - [x] 6.1 Create `src/daemon/integration.spec.ts` for end-to-end daemon startup tests with various port configurations
  - [x] 6.2 Add tests for successful daemon startup with custom HTTP and Gmail MCP ports
  - [x] 6.3 Add tests for port conflict scenarios and error handling with multiple services
  - [x] 6.4 Add tests for configuration priority resolution with CLI args overriding environment variables
  - [x] 6.5 Create `src/cli/integration.spec.ts` for CLI parsing integration with actual service startup
  - [x] 6.6 Add tests for --config-dump functionality showing resolved configuration values
  - [x] 6.7 Add tests for help text generation and error message clarity

- [x] **7.0 Update Documentation and Help System**
  - [x] 7.1 Update `src/daemon.ts` to integrate argumentParser and pass configuration to services
  - [x] 7.2 Replace basic process.argv parsing with comprehensive CLI parser in daemon.ts
  - [x] 7.3 Add startup logging to display active port configuration for debugging
  - [x] 7.4 Update showHelp() function in daemon.ts to include new port configuration options
  - [x] 7.5 Add examples in help text for common port configuration scenarios (development, production, Docker)
  - [x] 7.6 Update `package.json` scripts section comments to document new CLI parameter usage
  - [x] 7.7 Add error recovery suggestions that reference both CLI parameters and environment variables