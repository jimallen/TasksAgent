# PRD: Configurable Ports via Startup Parameters

## Introduction/Overview
The Meeting Transcript Agent currently uses hardcoded port numbers for its various services - port 3002 for the unified daemon HTTP server and implicit port 3000 for Gmail MCP service. While some basic port configuration exists via environment variables (`HTTP_SERVER_PORT`), there is no comprehensive command-line parameter system for configuring all ports at startup. This feature will implement a complete command-line argument parsing system that allows users to configure all network ports through startup parameters, providing greater flexibility for deployment scenarios, development environments, and avoiding port conflicts.

## Current State Analysis
**Existing Port Usage:**
- **Main HTTP Server**: Port 3002 (hardcoded in `src/daemon.ts:91`)
- **Gmail MCP Service**: Port 3000 (internal child process, not directly configurable)
- **Obsidian Plugin Connections**: Configured to `http://localhost:3002/gmail`

**Current Configuration Methods:**
- `HTTP_SERVER_PORT` environment variable (partially implemented in `httpServer.ts`)
- Port conflict detection with automatic alternative port selection (+1 increment)
- Basic argument parsing using `process.argv.slice(2)` for `--headless`, `--help` flags only

**Limitations:**
- No Gmail MCP port configuration
- No WebSocket port configuration (if implemented in future)
- Limited command-line interface - only supports basic mode flags
- Environment variables are inconvenient for dynamic deployment scenarios
- No validation or help text for port parameters

## Goals
1. **Complete Port Configuration**: Make all network ports configurable via startup parameters
2. **Comprehensive CLI Interface**: Implement robust command-line argument parsing with help, validation, and error handling  
3. **Backward Compatibility**: Maintain existing environment variable support alongside new CLI options
4. **Developer Experience**: Provide clear help text, validation, and sensible defaults
5. **Deployment Flexibility**: Enable easy port configuration for Docker, systemd, and multi-instance deployments

## User Stories
1. **As a DevOps Engineer**, I want to specify custom ports via command line so that I can deploy multiple instances without port conflicts
2. **As a Developer**, I want to run the daemon on different ports during development so that I can test multiple configurations simultaneously
3. **As a System Administrator**, I want to configure ports through startup scripts so that the service integrates with our existing port management
4. **As a Docker User**, I want to pass port configurations as arguments so that I can avoid modifying environment files
5. **As a Troubleshooter**, I want clear help text and validation messages so that I can quickly resolve port configuration issues

## Functional Requirements

### 1. Command Line Argument Parsing
- **F1.1**: Parse `--http-port <port>` parameter for main HTTP server port
- **F1.2**: Parse `--gmail-mcp-port <port>` parameter for Gmail MCP child process port  
- **F1.3**: Parse `--help` to display comprehensive usage information including port options
- **F1.4**: Parse `--version` to display version information
- **F1.5**: Support both `--port=3000` and `--port 3000` syntax formats
- **F1.6**: Maintain existing `--headless` and `--help` flag compatibility

### 2. Port Validation and Error Handling  
- **F2.1**: Validate port numbers are integers between 1024-65535
- **F2.2**: Check for port availability before service startup
- **F2.3**: Display clear error messages for invalid port configurations
- **F2.4**: Prevent duplicate port assignments across services
- **F2.5**: Provide suggestions for alternative ports on conflicts

### 3. Configuration Priority System
- **F3.1**: Command line arguments override environment variables  
- **F3.2**: Environment variables override default values
- **F3.3**: Display active configuration values in startup logs
- **F3.4**: Support `--config-dump` to show all resolved configuration values

### 4. Gmail MCP Integration
- **F4.1**: Pass configured Gmail MCP port to child process via environment
- **F4.2**: Update Gmail MCP service initialization with custom port
- **F4.3**: Update Obsidian plugin default endpoints to use configured ports
- **F4.4**: Maintain Gmail MCP health check endpoints with dynamic ports

## Integration Requirements

### Components to Modify
1. **`src/daemon.ts`** (Main Entry Point)
   - Replace basic `process.argv` parsing with comprehensive CLI parser
   - Add argument validation and help text generation
   - Pass parsed configuration to service constructors

2. **`src/daemon/httpServer.ts`** (HTTP Server)
   - Update constructor to accept port from configuration object
   - Enhance port validation and conflict detection
   - Update error messages to reference CLI parameters

3. **`src/daemon/gmailMcpService.ts`** (Gmail MCP Service)  
   - Accept port configuration for child process
   - Pass port to Gmail MCP service via environment variables
   - Update health check endpoints with dynamic port

4. **`src/config/config.ts`** (Configuration Management)
   - Add port configuration interface
   - Implement configuration priority resolution
   - Add validation utilities

### New Components Needed
1. **`src/cli/argumentParser.ts`** - Comprehensive CLI argument parsing
2. **`src/cli/portValidator.ts`** - Port validation and conflict detection utilities
3. **`src/types/cli.ts`** - TypeScript interfaces for CLI configuration

### API Changes Required
- **Constructor Updates**: All service constructors to accept configuration objects instead of hardcoded ports
- **Environment Variables**: New `GMAIL_MCP_PORT` variable for Gmail MCP service
- **Configuration Interface**: New `PortConfiguration` type with all configurable ports

### Database Schema Changes
None required - this is purely a configuration and startup change.

## Non-Goals (Out of Scope)
1. **Will NOT** change network protocols (HTTP, WebSocket) - only ports
2. **Will NOT** implement dynamic port reconfiguration - only startup-time configuration
3. **Will NOT** add authentication or security features - focused purely on port configuration
4. **Will NOT** modify core business logic - only service initialization and networking
5. **Will NOT** change existing API endpoints - only the ports they run on
6. **Will NOT** implement service discovery - manual port configuration only

## Design Considerations

### Command Line Interface Design
```bash
# Basic usage with port configuration
npm run daemon --http-port 8080 --gmail-mcp-port 8081

# Headless mode with custom ports  
npm run daemon:headless --http-port 3333

# Show help with all port options
npm run daemon --help

# Display current configuration
npm run daemon --config-dump --headless
```

### Configuration Priority
1. **Command Line Arguments** (highest priority)
2. **Environment Variables** 
3. **Default Values** (lowest priority)

### Error Handling Strategy
- Fail fast on invalid port configurations
- Provide actionable error messages with suggested fixes
- Log all configuration decisions for debugging
- Graceful degradation when optional services can't bind to ports

## Technical Considerations

### Existing Constraints and Dependencies
- **Gmail MCP Child Process**: Must pass port configuration via environment to child process
- **Obsidian Plugin**: Hardcoded endpoint URLs need to remain backward compatible
- **Docker Integration**: Must work with Docker port mapping and environment passing
- **systemd Service**: Must integrate with existing service definition and Environment= directives

### Performance Implications
- Minimal startup time impact (< 50ms for argument parsing)
- No runtime performance impact - configuration is startup-time only
- Memory usage increase < 1MB for CLI parsing dependencies

### Security Considerations  
- Port range validation to prevent binding to system ports (< 1024)
- Input sanitization for all port parameters
- No sensitive information in CLI arguments (ports are not secrets)
- Logging must not expose internal network configuration details

### Testing Strategy
- **Unit Tests**: CLI argument parsing, port validation, configuration priority
- **Integration Tests**: Service startup with various port combinations
- **E2E Tests**: Full daemon startup with custom ports, health check validation
- **Error Tests**: Invalid port scenarios, port conflict handling

## Success Metrics
1. **Configuration Flexibility**: All network ports configurable via CLI parameters
2. **Error Handling**: Clear, actionable error messages for 100% of invalid configurations  
3. **Backward Compatibility**: 100% compatibility with existing environment variable configuration
4. **Developer Experience**: Help text covers all configuration options with examples
5. **Deployment Success**: Zero port conflicts in multi-instance deployment scenarios

## Open Questions
1. **Gmail MCP Port Configuration**: How should we handle Gmail MCP port configuration when the MCP server is a separate npm package with its own port binding?
   - **Option A**: Pass port via environment variable to child process
   - **Option B**: Fork the Gmail MCP package to accept port parameter
   - **Recommendation**: Option A - less invasive, maintains compatibility

2. **Obsidian Plugin Endpoint Updates**: Should the plugin automatically detect daemon port changes?
   - **Option A**: Plugin remains manually configurable
   - **Option B**: Add service discovery mechanism
   - **Recommendation**: Option A - keep within scope

3. **Port Range Defaults**: What should be the default port ranges for different deployment scenarios?
   - **Development**: 3000-3099 range
   - **Production**: 8000-8099 range  
   - **Docker**: 30000+ range
   - **Recommendation**: Keep existing defaults, document recommended ranges

4. **Configuration File Support**: Should we also support configuration files alongside CLI arguments?
   - **Future Enhancement**: Yes, but out of scope for this PRD
   - **Current Scope**: CLI arguments and environment variables only

5. **Service Registration**: Should ports be registered in a central registry for multi-instance deployments?
   - **Future Enhancement**: Yes, but requires service discovery architecture
   - **Current Scope**: Manual port management only