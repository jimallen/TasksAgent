# HTTP Server Architecture Documentation

## Overview
The TasksAgent system uses two separate HTTP servers running on different ports. This document explains why both are necessary and cannot be combined.

## The Two HTTP Servers

### 1. Gmail MCP HTTP Server (Port 3000)
**Purpose:** Provides an HTTP bridge to the stdio-based Gmail MCP tool

**Location:** `/scripts/gmail-mcp-http.js`

**Why it exists:**
- The Gmail MCP package (`@gongrzhe/server-gmail-autoauth-mcp`) is a third-party tool that only communicates via stdio (stdin/stdout)
- Obsidian plugins run in a browser-like environment and cannot:
  - Spawn child processes
  - Access stdio streams
  - Execute Node.js system calls
- This HTTP wrapper acts as a bridge, translating HTTP requests from the Obsidian plugin into stdio commands for the Gmail MCP

**Key responsibilities:**
- Spawns and manages the Gmail MCP process
- Translates HTTP requests to MCP protocol messages
- Parses MCP text responses back to JSON
- Handles OAuth authentication (tokens stored in `~/.gmail-mcp/`)

### 2. Daemon HTTP Server (Port 3002)
**Purpose:** Provides control API for the TasksAgent daemon service

**Location:** `/src/daemon/httpServer.ts`

**Why it exists:**
- Controls the daemon service (start/stop/status)
- Triggers email processing with parameters (lookback hours, meeting platforms)
- Provides statistics and monitoring
- Handles reset operations

**Key responsibilities:**
- Process email triggers from Obsidian plugin
- Service lifecycle management
- Statistics and status reporting
- Data reset operations

## Why Can't They Be Combined?

### Technical Constraints
1. **Different Owners**: Gmail MCP is an external NPM package we don't control
2. **Different Protocols**: Gmail MCP uses stdio; daemon uses HTTP natively
3. **Different Lifecycles**: Gmail MCP must run continuously; daemon can start/stop
4. **Security Isolation**: Gmail OAuth tokens are managed separately by Gmail MCP

### Architectural Benefits of Separation
1. **Fault Isolation**: Gmail MCP crash doesn't affect daemon
2. **Independent Scaling**: Can restart one without affecting the other
3. **Clear Responsibilities**: Each server has a single, well-defined purpose
4. **Deployment Flexibility**: Can run on different machines if needed

## Alternative Approaches Considered

### Option 1: Direct Gmail API in Daemon
**Pros:**
- Eliminate Gmail MCP HTTP server
- Single service to manage
- Direct control over Gmail integration

**Cons:**
- Must reimplement OAuth flow
- Lose Gmail MCP's token management
- More complex Gmail API handling
- Breaking change for existing users

### Option 2: Proxy Through Daemon
**Pros:**
- Single port for external access
- Daemon could forward Gmail requests

**Cons:**
- Adds complexity to daemon
- Couples unrelated concerns
- Makes debugging harder
- No real benefit

## Current Architecture Decision
We maintain two separate HTTP servers because:
1. **Simplicity**: Each server has one clear responsibility
2. **Reliability**: Failure isolation between services
3. **Compatibility**: Works with existing Gmail MCP package
4. **Maintainability**: Easier to debug and update independently

## Port Configuration
- **Port 3000**: Gmail MCP HTTP Server (hardcoded in plugin)
- **Port 3002**: Daemon HTTP Server (configurable in daemon)

## Starting Both Services
```bash
# Start both services with one command
./start-all.sh

# Or start individually
npm run gmail-mcp-http &  # Port 3000
npm run daemon:headless &  # Port 3002
```

## Future Considerations
If Gmail MCP ever provides native HTTP support, we could eliminate the wrapper. Until then, both servers are necessary for the system to function properly.