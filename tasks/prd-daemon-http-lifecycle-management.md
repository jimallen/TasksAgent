# Product Requirements Document: Daemon HTTP Server Lifecycle Management

## Introduction/Overview

The TasksAgent daemon currently starts an HTTP API server on port 3002 to provide external access to email processing and statistics. However, the HTTP server lifecycle is not properly managed by the daemon - it starts with the daemon but doesn't stop when the daemon stops, leading to orphaned server processes and port conflicts. This feature will integrate proper HTTP server lifecycle management into the daemon, ensuring the API starts and stops cleanly with the daemon process.

## Current State Analysis

### Existing Architecture
- **DaemonService** (`/src/daemon/service.ts`): Core daemon that processes emails on schedule
- **DaemonHttpServer** (`/src/daemon/httpServer.ts`): Express HTTP server providing REST API on port 3002
- **Main Daemon** (`/src/daemon.ts`): Entry point that creates both services but only manages the DaemonService lifecycle

### Current Issues
1. HTTP server starts with `await httpServer.start()` but is never stopped
2. SIGINT/SIGTERM handlers only call `service.stop()`, not `httpServer.stop()`
3. TUI mode doesn't handle HTTP server shutdown
4. Orphaned HTTP servers block port 3002 on subsequent runs
5. No graceful shutdown of active HTTP connections

### Existing API Endpoints (Working Well)
- `GET /health` - Health check and basic stats
- `POST /trigger` - Trigger email processing
- `GET /status` - Get detailed daemon status  
- `POST /start` - Start daemon processing
- `POST /stop` - Stop daemon processing
- `POST /reset` - Reset processed emails data

## Goals

1. **Automatic Lifecycle Management**: HTTP server starts and stops automatically with daemon lifecycle
2. **Graceful Shutdown**: Properly close HTTP connections and release port on daemon stop
3. **Single Process**: Eliminate need for separate process management scripts
4. **Port Management**: Prevent port conflicts from orphaned servers
5. **Error Recovery**: Handle server start failures gracefully

## User Stories

1. **As a developer**, I want to run `npm run daemon` and have both the daemon service and HTTP API start together, so that I don't need to manage multiple processes.

2. **As a developer**, I want the HTTP server to stop cleanly when I stop the daemon (Ctrl+C), so that the port is released for the next run.

3. **As a system administrator**, I want the daemon to manage all its components as a single unit, so that I can easily start/stop/restart the entire service.

4. **As a plugin user**, I want the daemon API to be available whenever the daemon is running, so that my Obsidian plugin can always communicate with it.

## Functional Requirements

1. **FR1**: HTTP server MUST start automatically when daemon starts (both headless and TUI modes)
2. **FR2**: HTTP server MUST stop automatically when daemon stops (SIGINT, SIGTERM, or programmatic stop)
3. **FR3**: HTTP server stop MUST be graceful, closing all connections before process exit
4. **FR4**: Port conflicts MUST be detected and reported clearly on startup
5. **FR5**: HTTP server failures MUST not crash the daemon (graceful degradation)
6. **FR6**: TUI interface MUST properly manage HTTP server lifecycle
7. **FR7**: Cleanup handlers MUST include HTTP server shutdown
8. **FR8**: HTTP server status MUST be included in daemon status/health checks

## Integration Requirements

### Components to Modify

1. **`/src/daemon.ts`**:
   - Store `httpServer` reference at module scope
   - Add `httpServer.stop()` to all shutdown handlers (SIGINT, SIGTERM, uncaughtException)
   - Handle HTTP server in TUI mode cleanup
   - Add try-catch around `httpServer.start()` with fallback behavior

2. **`/src/daemon/service.ts`**:
   - Add optional `httpServer` property
   - Include HTTP server status in `getStats()` method
   - Call `httpServer.stop()` in `cleanup()` method if server reference exists

3. **`/src/daemon/httpServer.ts`**:
   - Enhance `stop()` method to handle edge cases
   - Add connection tracking for graceful shutdown
   - Add `isRunning()` status method
   - Improve error handling in `start()` method

### New Components Needed

None - this feature only requires modifications to existing components.

### API Changes Required

No API endpoint changes required. The existing endpoints work well and don't need modification.

### Database Schema Changes

None required.

## Non-Goals (Out of Scope)

1. **Will NOT** add new API endpoints or modify existing endpoint functionality
2. **Will NOT** change the port configuration (remains 3002)
3. **Will NOT** add authentication or multi-user support
4. **Will NOT** separate HTTP server into its own process
5. **Will NOT** add WebSocket support or real-time updates
6. **Will NOT** modify the start-all.sh script (it should continue to work as fallback)

## Design Considerations

### Graceful Shutdown Sequence
1. Receive shutdown signal
2. Stop accepting new HTTP connections
3. Wait for active requests to complete (with timeout)
4. Close HTTP server
5. Stop daemon service
6. Clean up resources
7. Exit process

### Error Handling
- Port already in use: Log clear error and suggest killing existing process
- HTTP server start failure: Continue daemon operation without API
- Timeout on shutdown: Force close after grace period (5 seconds)

### Backward Compatibility
- Existing `start-all.sh` script should continue to work
- Obsidian plugin should handle both integrated and separate API scenarios
- Environment variables and configuration remain unchanged

## Technical Considerations

### Performance Implications
- Minimal impact - HTTP server already starts with daemon
- Shutdown may take 1-5 seconds for graceful connection closing
- No additional memory or CPU overhead

### Security Considerations
- No changes to security model
- Local-only binding (localhost:3002) remains
- No authentication changes

### Testing Strategy
1. **Unit Tests**: Mock HTTP server lifecycle methods
2. **Integration Tests**: Test full daemon start/stop cycle
3. **Manual Testing**:
   - Start daemon, verify API accessible
   - Stop daemon with Ctrl+C, verify port released
   - Kill daemon process, verify cleanup
   - Test with active HTTP connections during shutdown

## Success Metrics

1. **Zero orphaned processes** after daemon stop
2. **100% successful port release** on shutdown
3. **< 5 second shutdown time** in normal conditions
4. **No regression** in existing functionality
5. **Single command** (`npm run daemon`) starts everything

## Open Questions

1. Should we add a configuration option to disable the HTTP server if needed?
2. Should the grace period for shutdown be configurable (currently suggesting 5 seconds)?
3. Should HTTP server errors be logged to a separate log file?
4. Should we add a `/shutdown` endpoint to trigger graceful shutdown via HTTP?

## Implementation Notes

The implementation should be straightforward as the HTTP server already has `start()` and `stop()` methods. The main work is:
1. Storing the httpServer reference where shutdown handlers can access it
2. Adding `await httpServer.stop()` to all shutdown paths
3. Ensuring proper error handling around server operations
4. Testing various shutdown scenarios

This is a high-impact, low-complexity improvement that will significantly improve the developer experience and system reliability.