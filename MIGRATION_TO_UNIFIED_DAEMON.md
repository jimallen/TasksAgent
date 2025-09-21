# Migration Guide: Obsidian Plugin to Unified Daemon

## Overview
The Obsidian Meeting Tasks plugin now works with the unified daemon service that includes integrated Gmail MCP. No more separate services!

## What Changed

### Before (Old Architecture)
- **Two separate services:**
  - Gmail MCP HTTP wrapper on port 3001
  - Main daemon on port 3002
- **Plugin connected to:** `http://localhost:3001`
- **Startup command:** `npm run gmail-mcp-http`

### After (New Architecture)
- **Single unified daemon on port 3002**
  - Includes Gmail MCP as managed child process
  - All endpoints under `/gmail/*` path
- **Plugin connects to:** `http://localhost:3002/gmail`
- **Startup command:** `npm run daemon`

## Migration Steps

### 1. Stop Old Services
```bash
# Stop any running services
pkill -f "gmail-mcp-http"
pkill -f "daemon"
```

### 2. Update Plugin Settings (if needed)
The plugin should already be updated, but verify:
- Open Obsidian Settings → Meeting Tasks
- Check that MCP Server URL is: `http://localhost:3002/gmail`
- If not, update it and save

### 3. Start New Unified Daemon
```bash
# From the main project directory
cd /path/to/TasksAgent

# Start the unified daemon
npm run daemon          # With TUI interface
# OR
npm run daemon:headless # Without UI (for servers)
```

### 4. Verify Connection
In Obsidian:
1. Click the Meeting Tasks ribbon icon
2. Choose "Process meeting emails from Gmail"
3. Should see success notification

Or test via command line:
```bash
# Test health
curl http://localhost:3002/gmail/health

# Should return:
# {"status":"healthy","running":true,"pid":...}
```

## Endpoint Mappings

| Old Endpoint | New Endpoint | Notes |
|-------------|--------------|-------|
| `http://localhost:3001/health` | `http://localhost:3002/gmail/health` | Health check |
| `http://localhost:3001/search` | `http://localhost:3002/gmail/search` | Search emails |
| `http://localhost:3001/read` | `http://localhost:3002/gmail/read` | Read email |
| N/A | `http://localhost:3002/trigger` | Trigger processing |
| N/A | `http://localhost:3002/status` | Daemon status |

## Benefits of New Architecture

1. **Simpler Operations**
   - Single `npm run daemon` starts everything
   - No need to manage multiple services

2. **Better Reliability**
   - Automatic Gmail MCP restart on crashes
   - Integrated health monitoring
   - Unified logging

3. **Enhanced Features**
   - Real-time TUI dashboard
   - Better error messages
   - Comprehensive statistics

## Troubleshooting

### Plugin Can't Connect
```bash
# Check daemon is running
ps aux | grep daemon

# Check Gmail MCP is healthy
curl http://localhost:3002/gmail/health

# Check main health
curl http://localhost:3002/health
```

### Gmail Authentication Issues
```bash
# If you see authentication errors, re-authenticate:
npx @gongrzhe/server-gmail-autoauth-mcp

# Then restart daemon
npm run daemon
```

### Port Already in Use
```bash
# Find what's using port 3002
lsof -i :3002

# Kill the process
kill -9 <PID>

# Restart daemon
npm run daemon
```

## Rollback (if needed)
If you need to go back to the old architecture:
1. Update plugin settings to `http://localhost:3001`
2. Start the old Gmail MCP wrapper (if script still exists)
3. Note: The old `gmail-mcp-http` script has been removed from the project

## Summary
The plugin is **already compatible** with the new unified daemon! Just:
1. Start daemon with `npm run daemon`
2. Use Obsidian normally
3. Everything works automatically

No code changes needed in the plugin - it's already updated!