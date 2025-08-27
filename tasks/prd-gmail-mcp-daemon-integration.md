# Product Requirements Document: Gmail MCP Daemon Integration

## Introduction/Overview

Currently, the TasksAgent system requires two separate services to function: the daemon (port 3002) for email processing and task extraction, and the Gmail MCP HTTP wrapper (port 3000) for Gmail API access. This creates deployment complexity, process management overhead, and potential synchronization issues. This feature will integrate the Gmail MCP functionality directly into the daemon as a managed module, creating a single, unified service that handles both Gmail access and email processing.

## Current State Analysis

### Existing Architecture
- **Two Separate Services**:
  - Gmail MCP HTTP wrapper (`scripts/gmail-mcp-http.js`) - Standalone Express server on port 3000
  - Daemon with HTTP API (`src/daemon.ts`) - Main service with integrated HTTP server on port 3002
- **Process Management**: Requires `start-all.sh` script or manual startup of both services
- **Communication**: Daemon doesn't directly manage Gmail MCP; relies on external service availability
- **Dependencies**: Obsidian plugin hardcoded to use `http://localhost:3000` for Gmail operations

### Pain Points
1. Complex deployment - users must manage two services
2. No unified lifecycle management - services can get out of sync
3. Port conflicts - two ports increase chance of conflicts
4. Error handling gaps - daemon doesn't know if Gmail MCP fails
5. Configuration split across multiple places

## Goals

1. **Unified Service**: Single daemon process that manages both email processing and Gmail API access
2. **Simplified Deployment**: One command starts everything needed
3. **Integrated Lifecycle**: Gmail MCP starts/stops with daemon automatically
4. **Better Error Handling**: Daemon aware of Gmail MCP status and failures
5. **Consolidated Configuration**: All settings in one place
6. **Backward Compatibility**: Smooth migration path for existing users

## User Stories

1. **As a developer**, I want to run a single command to start all TasksAgent functionality, so that I don't need to manage multiple processes.

2. **As a system administrator**, I want the daemon to manage all its dependencies internally, so that I can deploy it as a single systemd/launchd service.

3. **As an Obsidian plugin user**, I want the Gmail functionality to be available whenever the daemon is running, so that email processing always works.

4. **As a developer**, I want clear error messages when Gmail MCP fails, so that I can quickly diagnose and fix issues.

## Functional Requirements

### Core Requirements

1. **FR1: Gmail MCP Module Integration**
   - Create new `GmailMcpService` class in `src/daemon/gmailMcpService.ts`
   - Manage Gmail MCP child process lifecycle within the module
   - Handle stdio communication with MCP process
   - Implement request/response queue management

2. **FR2: Proxy Endpoints in Daemon HTTP Server**
   - Add `/gmail/*` endpoints to daemon's HTTP server (port 3002)
   - Proxy requests to internal Gmail MCP module:
     - `GET /gmail/health` - Check Gmail MCP status
     - `POST /gmail/search` - Search emails
     - `POST /gmail/read` - Read email content
     - `POST /gmail/mcp` - Generic MCP command proxy
   - Maintain response format compatibility

3. **FR3: Lifecycle Management**
   - Gmail MCP starts automatically when daemon starts
   - Gmail MCP stops cleanly when daemon stops
   - Handle Gmail MCP process crashes with automatic restart (max 3 attempts)
   - Include Gmail MCP status in daemon health checks

4. **FR4: Error Handling**
   - Throw error and stop daemon if Gmail MCP fails to start after retries
   - Log clear error messages for Gmail authentication issues
   - Provide diagnostic information for common problems
   - Include Gmail MCP errors in daemon error reporting

5. **FR5: Configuration Integration**
   - Add Gmail MCP settings to daemon configuration:
     - `GMAIL_MCP_RESTART_ATTEMPTS` (default: 3)
     - `GMAIL_MCP_STARTUP_TIMEOUT` (default: 10000ms)
     - `GMAIL_MCP_REQUEST_TIMEOUT` (default: 30000ms)
   - Use existing Gmail authentication from `~/.gmail-mcp/`

6. **FR6: Status Monitoring**
   - Include Gmail MCP status in `/health` endpoint
   - Add Gmail MCP metrics to `/status` endpoint:
     - Process PID
     - Uptime
     - Request count
     - Error count
     - Last error message

## Integration Requirements

### Components to Modify

1. **`src/daemon.ts`**:
   - Import and initialize `GmailMcpService`
   - Pass Gmail MCP service to both `DaemonService` and `DaemonHttpServer`
   - Include Gmail MCP in shutdown sequence

2. **`src/daemon/httpServer.ts`**:
   - Add `/gmail/*` proxy endpoints
   - Include Gmail MCP status in health endpoint
   - Handle Gmail MCP service reference

3. **`src/daemon/service.ts`**:
   - Add optional `gmailMcp` property
   - Include Gmail MCP in cleanup process
   - Add Gmail MCP status to stats

4. **`src/services/gmailService.ts`**:
   - Update to use new daemon endpoints when available
   - Fallback to direct MCP client for backward compatibility

### New Components Needed

1. **`src/daemon/gmailMcpService.ts`**:
   - Main Gmail MCP service class
   - Child process management
   - Request/response handling
   - Error handling and retries

2. **`src/daemon/gmailMcpService.spec.ts`**:
   - Unit tests for Gmail MCP service
   - Mock child process scenarios
   - Test error handling

### API Changes Required

- **Deprecate**: Port 3000 endpoints (maintain for transition period)
- **Add**: `/gmail/*` endpoints on port 3002
- **Update**: Health and status endpoints to include Gmail MCP info

### Obsidian Plugin Updates

1. Update `obsidian-plugin/src/main-daemon-style.ts`:
   - Change default MCP URL from `http://localhost:3000` to `http://localhost:3002/gmail`
   - Update endpoint paths to use `/gmail/` prefix
   - Add fallback for old URL during transition

## Non-Goals (Out of Scope)

1. **Will NOT** modify the Gmail MCP npm package itself
2. **Will NOT** change Gmail authentication mechanism
3. **Will NOT** add new Gmail functionality
4. **Will NOT** support multiple Gmail accounts
5. **Will NOT** create a separate Gmail configuration UI
6. **Will NOT** maintain long-term backward compatibility with port 3000

## Design Considerations

### Architecture Design
```
Daemon Process (port 3002)
├── DaemonService (email processing)
├── DaemonHttpServer (HTTP API)
│   └── /gmail/* endpoints (proxy)
└── GmailMcpService (Gmail MCP manager)
    └── Child Process: gmail-mcp (stdio)
```

### Process Management
- Use Node.js `child_process.spawn()` for Gmail MCP
- Implement exponential backoff for restart attempts
- Buffer stdio communication to prevent data loss
- Use event emitters for process state changes

### Error Recovery
1. Gmail MCP crash: Automatic restart with backoff
2. Authentication failure: Clear error message with fix instructions
3. Network issues: Timeout and retry with appropriate errors
4. Daemon shutdown: Graceful Gmail MCP termination

## Technical Considerations

### Performance Implications
- Single process reduces memory overhead (~50MB saved)
- Fewer network hops (internal function calls vs HTTP)
- Shared event loop may affect responsiveness under load
- Consider worker threads if performance issues arise

### Security Considerations
- Gmail OAuth tokens remain in `~/.gmail-mcp/`
- No credentials in daemon configuration
- Maintain localhost-only binding
- Validate all proxied requests

### Testing Strategy
1. **Unit Tests**:
   - Mock child process spawn/communication
   - Test error scenarios and retries
   - Verify request/response handling

2. **Integration Tests**:
   - Full daemon startup with Gmail MCP
   - Test all Gmail endpoints
   - Verify graceful shutdown

3. **Manual Testing**:
   - Test with real Gmail account
   - Verify Obsidian plugin compatibility
   - Test error scenarios (auth failure, network issues)

### Migration Plan
1. **Phase 1**: Implement Gmail MCP service in daemon
2. **Phase 2**: Add proxy endpoints to daemon
3. **Phase 3**: Update Obsidian plugin with fallback
4. **Phase 4**: Update documentation
5. **Phase 5**: Deprecate standalone Gmail MCP wrapper
6. **Phase 6**: Remove old wrapper after transition period

## Success Metrics

1. **Single Command Startup**: `npm run daemon` starts everything
2. **Zero Orphan Processes**: Clean shutdown every time
3. **Error Recovery Rate**: >90% automatic recovery from transient failures
4. **Performance**: <100ms overhead for Gmail operations
5. **Compatibility**: Obsidian plugin works without user intervention

## Open Questions

1. ~~Should we keep Gmail MCP on a separate port for backward compatibility?~~ → No, consolidate on port 3002
2. ~~How long should we maintain the deprecated port 3000 service?~~ → Clean cutover
3. Should we add Gmail-specific configuration to the TUI interface?
4. Should we implement request caching for frequently accessed emails?
5. Should we add Gmail quota monitoring to prevent rate limit issues?

## Implementation Priority

1. **High Priority**:
   - Core Gmail MCP service module
   - Basic proxy endpoints
   - Lifecycle management
   - Error handling

2. **Medium Priority**:
   - Enhanced status monitoring
   - Obsidian plugin updates
   - Comprehensive testing

3. **Low Priority**:
   - Request caching
   - Quota monitoring
   - TUI enhancements

## Next Steps

1. Create `src/daemon/gmailMcpService.ts` with basic process management
2. Implement proxy endpoints in daemon HTTP server
3. Update daemon lifecycle to include Gmail MCP
4. Test with real Gmail account
5. Update Obsidian plugin
6. Update documentation
7. Remove standalone wrapper

This integration will significantly simplify the TasksAgent deployment and management while maintaining all existing functionality and improving error handling and monitoring capabilities.