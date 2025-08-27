# Task List: Daemon HTTP Server Lifecycle Management

## Relevant Files

### Files to Modify
- `src/daemon.ts` - Main daemon entry point that needs HTTP server lifecycle integration
- `src/daemon.spec.ts` - Unit tests for daemon.ts lifecycle management
- `src/daemon/httpServer.ts` - HTTP server class needing graceful shutdown enhancements
- `src/daemon/httpServer.spec.ts` - Unit tests for HTTP server shutdown scenarios
- `src/daemon/service.ts` - Daemon service requiring HTTP server cleanup integration
- `src/daemon/service.spec.ts` - Unit tests for service cleanup with HTTP server

### Files to Reference
- `src/tui/interface.ts` - TUI interface that may need HTTP server status display
- `src/utils/logger.ts` - Logger for consistent error messaging
- `start-all.sh` - Existing script for backward compatibility testing

## Notes

- Unit tests should be placed alongside code files using `.spec.ts` extension
- Use `npx jest [optional/path/to/test/file]` to run tests
- Test both headless and TUI modes for complete coverage
- Ensure backward compatibility with existing start-all.sh script
- Use async/await consistently for all shutdown operations
- Add appropriate logging at each lifecycle stage

## Tasks

### Phase 1: Core Implementation

- [x] **1.0 Refactor daemon.ts for HTTP server lifecycle management**
  - [x] 1.1 Move httpServer variable to module scope (outside startDaemon function)
  - [x] 1.2 Add `await httpServer.stop()` to SIGINT handler before `service.stop()`
  - [x] 1.3 Add `await httpServer.stop()` to SIGTERM handler before `service.stop()`
  - [x] 1.4 Add try-catch around `httpServer.start()` with error logging
  - [x] 1.5 Add httpServer stop to uncaughtException handler in TUI mode
  - [x] 1.6 Pass httpServer reference to DaemonService constructor

### Phase 2: HTTP Server Enhancements

- [x] **2.0 Enhance DaemonHttpServer with graceful shutdown capabilities**
  - [x] 2.1 Add private `isRunning` boolean property to track server state
  - [x] 2.2 Create `isRunning()` public method to check server status
  - [x] 2.3 Add connection tracking Set to monitor active connections
  - [x] 2.4 Enhance `stop()` method to close all tracked connections
  - [x] 2.5 Add 5-second timeout to force close if connections don't close
  - [x] 2.6 Add error handling in `start()` for port already in use (EADDRINUSE)
  - [x] 2.7 Log clear error message with port number when startup fails

### Phase 3: Service Integration

- [ ] **3.0 Integrate HTTP server into DaemonService cleanup**
  - [ ] 3.1 Add optional `httpServer?: DaemonHttpServer` property to DaemonService
  - [ ] 3.2 Update constructor to accept optional httpServer parameter
  - [ ] 3.3 Add `if (this.httpServer) await this.httpServer.stop()` in cleanup() method
  - [ ] 3.4 Include HTTP server running status in getStats() response
  - [ ] 3.5 Add HTTP server port info to stats when server is provided

### Phase 4: Status and Monitoring

- [ ] **4.0 Add HTTP server status monitoring**
  - [ ] 4.1 Add `httpServerRunning` boolean to ServiceStats interface
  - [ ] 4.2 Update `/health` endpoint to include HTTP server status
  - [ ] 4.3 Add `httpServerPort` to stats when server is running
  - [ ] 4.4 Log HTTP server status changes (started, stopping, stopped)
  - [ ] 4.5 Add startup time tracking for HTTP server

### Phase 5: Error Handling

- [ ] **5.0 Implement error handling and port conflict detection**
  - [ ] 5.1 Create handlePortConflict() function to check if port is in use
  - [ ] 5.2 Add retry logic with different port if 3002 is occupied
  - [ ] 5.3 Log suggestion to kill existing process when port conflict detected
  - [ ] 5.4 Implement graceful degradation - daemon continues if HTTP fails
  - [ ] 5.5 Add environment variable HTTP_SERVER_PORT for port override
  - [ ] 5.6 Ensure all errors are logged with context and recovery suggestions

### Phase 6: Testing

- [ ] **6.0 Create comprehensive tests for lifecycle management**
  - [ ] 6.1 Write unit test for daemon.ts SIGINT handler with HTTP server stop
  - [ ] 6.2 Write unit test for daemon.ts SIGTERM handler with HTTP server stop
  - [ ] 6.3 Write unit test for httpServer.stop() with active connections
  - [ ] 6.4 Write unit test for httpServer.stop() timeout scenario
  - [ ] 6.5 Write integration test for full daemon start/stop cycle
  - [ ] 6.6 Write test for port conflict handling and error messages
  - [ ] 6.7 Write test for service.cleanup() with HTTP server
  - [ ] 6.8 Manual test: Start daemon, Ctrl+C, verify port 3002 is free
  - [ ] 6.9 Manual test: Kill -9 daemon, start again, verify recovery
  - [ ] 6.10 Manual test: Verify start-all.sh still works correctly

## Implementation Order

1. Start with Task 1.0 (daemon.ts refactoring) as it's the foundation
2. Implement Task 2.0 (HTTP server enhancements) for graceful shutdown
3. Complete Task 3.0 (service integration) to unify lifecycle
4. Add Task 4.0 (monitoring) for visibility
5. Implement Task 5.0 (error handling) for robustness
6. Finish with Task 6.0 (testing) to ensure reliability

## Success Criteria

- [ ] Running `npm run daemon` starts both daemon and HTTP server
- [ ] Pressing Ctrl+C stops both daemon and HTTP server cleanly
- [ ] Port 3002 is immediately available after daemon stops
- [ ] No orphaned node processes after daemon shutdown
- [ ] Clear error messages when port conflicts occur
- [ ] All tests pass with 100% coverage of new code
- [ ] Backward compatibility maintained with start-all.sh