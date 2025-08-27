# Unified Daemon Architecture

## Overview

The TasksAgent daemon now provides a single, unified service that includes all functionality:
- Email processing and task extraction
- Gmail MCP integration (as managed child process)
- HTTP API for external control
- Terminal UI for monitoring
- Obsidian plugin support

## Single Service Architecture

### Daemon HTTP Server (Port 3002)

**Purpose:** Unified HTTP API for all daemon functionality including Gmail MCP

**Location:** `/src/daemon/httpServer.ts`

**Endpoints:**

#### Daemon Control Endpoints
- `GET /health` - Health check with Gmail MCP status
- `GET /status` - Detailed daemon statistics
- `POST /trigger` - Trigger email processing manually
- `POST /start` - Start daemon service
- `POST /stop` - Stop daemon service  
- `POST /reset` - Reset processed data

#### Gmail MCP Proxy Endpoints (Integrated)
- `GET /gmail/health` - Gmail MCP service health
- `GET /gmail/status` - Gmail MCP detailed status
- `POST /gmail/search` - Search Gmail emails
- `POST /gmail/read` - Read email by ID
- `POST /gmail/mcp` - Generic MCP command proxy

### Gmail MCP Integration

**Location:** `/src/daemon/gmailMcpService.ts`

The Gmail MCP service is now a managed child process within the daemon:

```typescript
// Daemon starts Gmail MCP automatically
gmailMcpService = new GmailMcpService({
  restartAttempts: 3,
  startupTimeout: 10000,
  requestTimeout: 30000
});
await gmailMcpService.start();
```

**Features:**
- Automatic process lifecycle management
- Crash recovery with exponential backoff
- Request/response queue with timeouts
- Error detection and recovery suggestions
- Graceful shutdown on daemon stop

## Starting the Service

```bash
# Single command starts everything
npm run daemon         # With TUI
npm run daemon:headless # Without TUI

# The daemon automatically:
# 1. Starts Gmail MCP child process
# 2. Initializes HTTP server on port 3002
# 3. Sets up all proxy endpoints
# 4. Manages lifecycle and restarts
```

## Service Communication Flow

```
┌─────────────────────────────────────────┐
│         Obsidian Plugin                 │
│   (or other HTTP clients)               │
└────────────┬────────────────────────────┘
             │ HTTP Requests
             ▼
┌─────────────────────────────────────────┐
│     Daemon HTTP Server (Port 3002)      │
│                                          │
│  ┌────────────────┐  ┌────────────────┐│
│  │ Daemon Control │  │  Gmail Proxy   ││
│  │   Endpoints    │  │   Endpoints    ││
│  └────────┬───────┘  └────────┬───────┘│
│           │                    │         │
│  ┌────────▼───────┐  ┌────────▼───────┐│
│  │ DaemonService  │  │ GmailMcpService││
│  │                │  │  (Child Process)││
│  └────────────────┘  └────────────────┘│
└─────────────────────────────────────────┘
```

## Benefits of Unified Architecture

1. **Simplified Operations**
   - Single `npm run daemon` command
   - No need to manage multiple services
   - Unified logging and monitoring

2. **Better Resource Management**
   - Single process tree
   - Coordinated shutdown
   - No orphaned processes

3. **Enhanced Reliability**
   - Automatic Gmail MCP restarts
   - Integrated health monitoring
   - Centralized error handling

4. **Easier Configuration**
   - Single configuration source
   - Environment variables for all settings
   - No port conflicts between services

## Configuration

All configuration via environment variables:

```env
# Gmail MCP Configuration
GMAIL_MCP_RESTART_ATTEMPTS=3      # Max restart attempts
GMAIL_MCP_STARTUP_TIMEOUT=10000   # Startup timeout (ms)
GMAIL_MCP_REQUEST_TIMEOUT=30000   # Request timeout (ms)

# HTTP Server Configuration  
HTTP_SERVER_PORT=3002              # Daemon HTTP port
```

## Migration from Old Architecture

### Old (Deprecated)
- Two separate services on ports 3000 and 3002
- Manual startup with `./start-all.sh`
- Separate Gmail MCP HTTP wrapper

### New (Current)
- Single unified service on port 3002
- Automatic startup with `npm run daemon`
- Integrated Gmail MCP as child process

### Obsidian Plugin Update
The plugin has been updated to use the new endpoints:
- Old: `http://localhost:3000`
- New: `http://localhost:3002/gmail`

## Monitoring and Debugging

### Health Check
```bash
curl http://localhost:3002/health
```

Returns:
```json
{
  "status": "ok",
  "daemon": "running",
  "gmailMcp": {
    "running": true,
    "pid": 12345,
    "requestCount": 42
  }
}
```

### Gmail MCP Status
```bash
curl http://localhost:3002/gmail/status
```

### Logs
The daemon provides unified logging for all components:
- Daemon operations
- Gmail MCP lifecycle
- HTTP requests
- Error tracking

## Error Handling

### Gmail MCP Failures
- Automatic restart with exponential backoff
- Maximum 3 restart attempts by default
- Clear error messages with recovery suggestions

### Authentication Issues
```
Gmail authentication failed. To fix:
1. Run: npx @gongrzhe/server-gmail-autoauth-mcp
2. Follow the OAuth flow in your browser
3. Restart the daemon after authentication
```

### Process Crashes
The daemon detects and handles:
- Gmail MCP crashes (auto-restart)
- Network failures (retry logic)
- Authentication errors (user guidance)
- Resource exhaustion (graceful degradation)

## Future Enhancements

- WebSocket support for real-time updates
- Multiple Gmail account support
- Plugin system for additional MCP services
- Distributed daemon clustering