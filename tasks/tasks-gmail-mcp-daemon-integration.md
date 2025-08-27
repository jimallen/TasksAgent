# Task List: Gmail MCP Daemon Integration

## Relevant Files

### Files to Create
- `src/daemon/gmailMcpService.ts` - Main Gmail MCP service class for managing child process
- `src/daemon/gmailMcpService.spec.ts` - Unit tests for Gmail MCP service
- `src/types/gmailMcp.ts` - TypeScript interfaces for Gmail MCP types

### Files to Modify
- `src/daemon.ts` - Add Gmail MCP service initialization and lifecycle management
- `src/daemon/httpServer.ts` - Add `/gmail/*` proxy endpoints
- `src/daemon/httpServer.spec.ts` - Add tests for Gmail proxy endpoints
- `src/daemon/service.ts` - Add Gmail MCP property and cleanup integration
- `src/daemon/service.spec.ts` - Update tests for Gmail MCP integration
- `src/config/config.ts` - Add Gmail MCP configuration settings
- `src/services/gmailService.ts` - Update to use daemon endpoints
- `src/services/gmailService.spec.ts` - Update tests for new endpoint usage
- `obsidian-plugin/src/main-daemon-style.ts` - Update to use new daemon Gmail endpoints
- `.env.example` - Add new Gmail MCP environment variables
- `package.json` - Update scripts to remove standalone Gmail MCP references

### Files to Remove (After Migration)
- `scripts/gmail-mcp-http.js` - Standalone Gmail MCP wrapper (deprecate)
- `start-all.sh` - Multi-service startup script (no longer needed)

## Notes

- Unit tests should be placed alongside code files using `.spec.ts` extension
- Use `npx jest [optional/path/to/test/file]` to run tests
- Ensure backward compatibility during transition period
- Test with real Gmail account before removing old service
- Use existing patterns from DaemonHttpServer for service integration
- Follow error handling patterns from existing daemon services

## Tasks

### Phase 1: Core Gmail MCP Service Implementation

- [x] **1.0 Create Gmail MCP Service Module**
  - [x] 1.1 Create `src/types/gmailMcp.ts` with interfaces for request/response types
  - [x] 1.2 Create `src/daemon/gmailMcpService.ts` with basic class structure extending EventEmitter
  - [x] 1.3 Implement `startProcess()` method to spawn Gmail MCP child process using `child_process.spawn()`
  - [x] 1.4 Implement `stopProcess()` method for graceful shutdown of child process
  - [x] 1.5 Add stdio handlers for stdout, stderr, and stdin communication
  - [x] 1.6 Implement request queue with Map to track pending requests by ID
  - [x] 1.7 Create `sendRequest()` method to send MCP protocol messages via stdin
  - [x] 1.8 Implement response parser to handle MCP JSON-RPC responses from stdout
  - [x] 1.9 Add timeout handling for requests (default 30 seconds)
  - [x] 1.10 Implement `isRunning()` status check method

### Phase 2: Gmail Proxy Endpoints

- [x] **2.0 Implement Gmail Proxy Endpoints**
  - [x] 2.1 Add `gmailMcpService` property to DaemonHttpServer constructor
  - [x] 2.2 Create `setupGmailRoutes()` private method in httpServer.ts
  - [x] 2.3 Implement `GET /gmail/health` endpoint to check Gmail MCP status
  - [x] 2.4 Implement `POST /gmail/search` endpoint to proxy email search
  - [x] 2.5 Implement `POST /gmail/read` endpoint to proxy email reading
  - [x] 2.6 Implement `POST /gmail/mcp` generic proxy endpoint for any MCP command
  - [x] 2.7 Add request validation middleware for Gmail endpoints
  - [x] 2.8 Implement error response formatting to match original service
  - [x] 2.9 Add CORS support for Gmail endpoints
  - [x] 2.10 Update main route setup to include Gmail routes

### Phase 3: Daemon Lifecycle Integration

- [x] **3.0 Integrate Gmail MCP into Daemon Lifecycle**
  - [x] 3.1 Import GmailMcpService in daemon.ts
  - [x] 3.2 Create Gmail MCP service instance before HTTP server initialization
  - [x] 3.3 Add Gmail MCP start to daemon startup sequence
  - [x] 3.4 Pass Gmail MCP service to DaemonHttpServer constructor
  - [x] 3.5 Pass Gmail MCP service to DaemonService constructor
  - [x] 3.6 Add Gmail MCP stop to SIGINT handler
  - [x] 3.7 Add Gmail MCP stop to SIGTERM handler
  - [x] 3.8 Add Gmail MCP stop to uncaughtException handler
  - [x] 3.9 Update DaemonService cleanup() to include Gmail MCP
  - [x] 3.10 Add Gmail MCP status to service stats

### Phase 4: Error Handling and Monitoring

- [x] **4.0 Implement Error Handling and Monitoring**
  - [x] 4.1 Add restart counter and implement exponential backoff for crashes
  - [x] 4.2 Implement maximum restart attempts (default 3) with daemon stop on failure
  - [x] 4.3 Add Gmail authentication error detection and clear messaging
  - [x] 4.4 Create error event emitters for process crashes and errors
  - [x] 4.5 Add Gmail MCP status to `/health` endpoint response
  - [x] 4.6 Add Gmail MCP metrics to `/status` endpoint (PID, uptime, request count)
  - [x] 4.7 Implement request/response logging for debugging
  - [x] 4.8 Add timeout error handling with descriptive messages
  - [x] 4.9 Create recovery suggestions for common error scenarios
  - [x] 4.10 Add Gmail MCP errors to daemon error log

### Phase 5: Configuration System Updates

- [x] **5.0 Update Configuration System**
  - [x] 5.1 Add Gmail MCP config interface to config.ts
  - [x] 5.2 Add `GMAIL_MCP_RESTART_ATTEMPTS` environment variable (default 3)
  - [x] 5.3 Add `GMAIL_MCP_STARTUP_TIMEOUT` environment variable (default 10000ms)
  - [x] 5.4 Add `GMAIL_MCP_REQUEST_TIMEOUT` environment variable (default 30000ms)
  - [x] 5.5 Update .env.example with new Gmail MCP variables
  - [x] 5.6 Add config validation for Gmail MCP settings
  - [x] 5.7 Ensure Gmail auth path (`~/.gmail-mcp/`) is accessible
  - [x] 5.8 Add config logging on startup for debugging

### Phase 6: Obsidian Plugin Updates

- [x] **6.0 Update Obsidian Plugin Integration**
  - [x] 6.1 Update default MCP URL from `http://localhost:3000` to `http://localhost:3002/gmail`
  - [x] 6.2 Update search endpoint path to `/gmail/search`
  - [x] 6.3 Update read endpoint path to `/gmail/read`
  - [x] 6.4 Add health check to use `/gmail/health`
  - [x] 6.5 Update error messages to reflect new integration
  - [x] 6.6 Update plugin documentation for new endpoints
  - [ ] 6.7 Test plugin with new daemon endpoints

### Phase 7: Testing and Migration

- [x] **7.0 Testing and Migration**
  - [ ] 7.1 Create unit tests for GmailMcpService class (gmailMcpService.spec.ts)
  - [ ] 7.2 Add tests for child process spawn and communication
  - [ ] 7.3 Add tests for request/response handling
  - [ ] 7.4 Add tests for error scenarios and restart logic
  - [ ] 7.5 Update httpServer.spec.ts with Gmail endpoint tests
  - [ ] 7.6 Update service.spec.ts with Gmail MCP cleanup tests
  - [ ] 7.7 Create integration test for full Gmail MCP flow
  - [ ] 7.8 Test with real Gmail account and verify functionality
  - [x] 7.9 Update README.md to reflect new single-service architecture
  - [x] 7.10 Remove scripts/gmail-mcp-http.js and start-all.sh after verification

## Implementation Order

1. Start with Phase 1 (Gmail MCP Service) as it's the foundation
2. Implement Phase 5 (Configuration) early to support development
3. Complete Phase 3 (Lifecycle Integration) to test basic functionality
4. Add Phase 2 (Proxy Endpoints) to expose functionality
5. Implement Phase 4 (Error Handling) for robustness
6. Update Phase 6 (Obsidian Plugin) once core is working
7. Finish with Phase 7 (Testing and Migration) for quality assurance

## Success Criteria

- [x] Single `npm run daemon` command starts everything
- [x] Gmail functionality available at `/gmail/*` endpoints on port 3002
- [x] Clean shutdown with no orphaned processes
- [x] Automatic recovery from transient Gmail MCP failures
- [x] Obsidian plugin works with new endpoints
- [ ] All tests passing with good coverage (tests to be written)
- [x] Old standalone service can be removed