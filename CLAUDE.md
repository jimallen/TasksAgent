# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Meeting Transcript Agent
Automated system that monitors Gmail for meeting transcripts, extracts actionable tasks using Claude AI, and creates organized notes in Obsidian with optional daemon service and TUI monitoring.

## Essential Commands

### Development & Testing
```bash
npm run build           # TypeScript compilation (required before running)
npm run typecheck       # Type checking without emitting files
npm run lint            # ESLint with TypeScript rules
npm run lint:fix        # Auto-fix linting issues
npm run format          # Prettier formatting
npm test               # Run Jest tests
npm run test:coverage  # Test coverage report
```

### Running the Application
```bash
npm run start:test     # Test mode - verify all connections
npm run start:once     # Process emails once and exit
npm start              # Classic scheduler mode (9 AM, 1 PM, 5 PM)
npm run daemon         # Daemon with TUI dashboard - includes Gmail MCP (recommended)
npm run daemon:headless # Daemon without UI - includes Gmail MCP (for servers)

# With custom ports (NEW)
npm run daemon -- --http-port 8080 --gmail-mcp-port 9000
npm run daemon:headless -- --http-port 8080

# View configuration
npm run daemon -- --config-dump
npm run daemon -- --help
```

### Gmail MCP Setup
```bash
npx @gongrzhe/server-gmail-autoauth-mcp  # Authenticate Gmail MCP (one-time setup)
```
**Full setup guide**: See [docs/GMAIL_SETUP.md](docs/GMAIL_SETUP.md) for detailed OAuth configuration

**Note**: Gmail MCP is now integrated into the daemon. No separate service needed!

## Architecture Overview

### Unified Daemon Architecture (NEW)
The system now uses a single unified daemon with integrated Gmail MCP:

1. **Unified Daemon** (`src/daemon.ts`) - Main entry point with CLI argument parsing
2. **Gmail MCP Service** (`src/daemon/gmailMcpService.ts`) - Child process manager (configurable port)
3. **HTTP Server** (`src/daemon/httpServer.ts`) - All endpoints (configurable port, default 3002)
4. **Email Processing Pipeline**:
   - **GmailService** (`src/services/gmailService.ts`) - Connects to daemon's Gmail endpoints
   - **Email Parser** (`src/parsers/emailParser.ts`) - Identifies meeting transcripts
   - **Claude AI Extractor** (`src/extractors/claudeTaskExtractor.ts`) - AI task extraction
   - **Obsidian Service** (`src/services/obsidianService.ts`) - Creates notes in vault
5. **State Manager** (`src/database/stateManager.ts`) - SQLite deduplication and stats
6. **TUI Interface** (`src/tui/interface.ts`) - Optional terminal dashboard

### Daemon Service Endpoints
- **Configurable Ports**: HTTP and Gmail MCP ports can be configured via CLI or environment
  - HTTP Server: Default 3002 (--http-port or HTTP_SERVER_PORT)
  - Gmail MCP: Default 3000 (--gmail-mcp-port or GMAIL_MCP_PORT)
- **HTTP API Endpoints**:
  - `/health`, `/status`, `/trigger` - Daemon control endpoints
  - `/gmail/*` - Gmail MCP proxy endpoints (integrated)
- **Single Service**: `npm run daemon` starts everything

### Daemon Service Architecture
- `src/daemon.ts` - Entry point with CLI argument parsing and port configuration
- `src/cli/argumentParser.ts` - Comprehensive CLI parsing with validation
- `src/cli/portValidator.ts` - Port range validation and conflict detection
- `src/config/config.ts` - Priority-based configuration resolution
- `src/daemon/service.ts` - Background service with manual trigger support
- `src/daemon/httpServer.ts` - HTTP API for external control (configurable port)
- `src/daemon/gmailMcpService.ts` - Gmail MCP child process manager (configurable port)
- `src/tui/interface.ts` - blessed-based terminal UI with statistics
- `daemon-stats.db` - Persistent metrics storage

### Key Design Patterns
- **Port Configuration**: Three-tier priority system (CLI > Environment > Default)
- **MCP Protocol**: Gmail integration uses Model Context Protocol server
- **Rate Limiting**: Built-in protection for Gmail API quotas (250 units/sec)
- **Error Recovery**: Comprehensive error handling with retry logic
- **State Management**: SQLite for processed email tracking and deduplication
- **Configurable Platforms**: Plugin settings control which meeting platforms to search
- **Lookback Hours**: Configurable via plugin settings and passed to daemon API

## Critical Configuration

### Port Configuration (NEW)
```bash
# Three ways to configure ports (priority order):

# 1. CLI Arguments (highest priority)
npm run daemon -- --http-port 8080 --gmail-mcp-port 9000

# 2. Environment Variables
HTTP_SERVER_PORT=8080 GMAIL_MCP_PORT=9000 npm run daemon

# 3. Default Values (lowest priority)
# HTTP: 3002, Gmail MCP: 3000

# View active configuration
npm run daemon -- --config-dump
```

### Required Environment Variables (.env)
```bash
OBSIDIAN_VAULT_PATH=/absolute/path/to/vault  # Required
ANTHROPIC_API_KEY=sk-ant-api03-xxx          # Recommended for AI extraction
GMAIL_HOURS_LOOKBACK=120                    # Default: 120 hours (5 days)

# Optional port configuration
HTTP_SERVER_PORT=3002                       # HTTP API server port
GMAIL_MCP_PORT=3000                         # Gmail MCP service port
```

### Gmail MCP Authentication
OAuth credentials must be in one of:
- `~/.gmail-mcp/gcp-oauth.keys.json` (preferred)
- `./gcp-oauth.keys.json` (project root)

## Common Development Tasks

### Adding New Email Patterns
Edit `src/parsers/emailParser.ts`:
- Current patterns: "Notes:", "Recording of", "Transcript for", "Meeting notes"
- Pattern matching is case-insensitive

### Modifying Task Extraction
Edit `src/extractors/claudeTaskExtractor.ts`:
- Uses Claude 3 Haiku model by default
- Structured prompt for consistent task formatting

### Updating Notification Channels
Edit `src/services/notificationService.ts`:
- Supported: console, desktop, obsidian, slack
- Desktop uses `notify-send` on Linux (fixed hint syntax)

### Database Schema Changes
Edit `src/database/schema.sql`:
- Run migrations manually after changes
- State tracking in `data/state.db`

## Testing Workflow
1. Verify Gmail connection: `npm run start:test`
2. Check TypeScript: `npm run typecheck`
3. Run linter: `npm run lint`
4. Execute tests: `npm test`
5. Test email processing: `npm run start:once`

## Recent Updates (2025-08-27)

### Obsidian Plugin Enhancements
- **Multi-Name Task Filtering**: Support comma-separated names in "My Tasks" filter
  - Configuration: `dashboardMyName: "name1, name2, the group"`
  - Shows tasks assigned to any specified name
- **Smooth Task Completion**: Tasks fade out without page refresh
  - 0.3s animation preserves scroll position
  - Empty cards/sections auto-remove
- **Security Improvements**: 
  - `obsidian-plugin/data.json` now gitignored
  - `data.json.example` template provided
  - Removed hardcoded defaults from `taskFilter.ts`

### CEL Board Meeting Processing Fix
- Issue: Empty meeting notes despite email content
- Solution: Clear database entry and reprocess
- Result: Successfully extracted 10 tasks with 85% confidence

## Troubleshooting Guide

### Gmail Not Finding Emails
- Check lookback hours in Obsidian plugin settings (passed to daemon)
- Verify enabled meeting platforms in plugin settings
- Verify patterns in `src/parsers/emailParser.ts`
- Gmail MCP tools: `search_emails`, `read_email` (not `gmail_*` prefixed)
- Ensure Gmail MCP HTTP server is running on port 3000

### Claude API Issues
- Verify `ANTHROPIC_API_KEY` in .env
- Check rate limits (default: 3 retries with exponential backoff)
- Model defaults to `claude-3-haiku-20240307`

### Desktop Notifications Failing
- Linux: Install `libnotify-bin` package
- Check `NOTIFICATION_CHANNELS` in .env
- Slack webhook must be configured if enabled

### Daemon Service Issues
- TUI requires terminal with color support
- Headless mode for non-interactive environments (`--headless` flag)
- Statistics persist in `daemon-stats.db`
- HTTP API runs on port 3002 for external control
- Manual trigger only mode (`--manual-only` flag)

## Performance Considerations
- Processes up to 50 emails per run (configurable)
- ~2-5 seconds per transcript for AI processing
- Rate limiting: 250 Gmail API units/second
- Memory usage: ~100-200MB typical
- SQLite handles 100K+ records efficiently

## Security Notes
- OAuth tokens: `~/.gmail-mcp/` (user-only permissions)
- API keys in `.env` (never commit)
- No transcript content cached in logs
- Sensitive data sanitized in error messages

## TypeScript Configuration
- Strict mode enabled with all checks
- Target: ES2020, Module: CommonJS
- Source maps enabled for debugging
- Declaration files generated

## Obsidian Plugin
The repository includes a companion Obsidian plugin in `obsidian-plugin/` directory:

### Plugin Features
- Visual task dashboard with priority sections
- Configurable meeting platforms (Google Meet, Zoom, Teams, Generic)
- Configurable lookback hours (how far back to search)
- HTTP communication with daemon service
- Settings UI for API keys and configuration
- "My Tasks" filtering with configurable user name

### Plugin Setup
```bash
cd obsidian-plugin
npm install
npm run build           # Build from main-daemon-style.ts
node build.js           # Alternative build method
# Copy to vault: cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/meeting-tasks/
```

**Full documentation**: See [obsidian-plugin/README.md](obsidian-plugin/README.md) and [obsidian-plugin/CLAUDE.md](obsidian-plugin/CLAUDE.md)
- use @.agent.rules.md as the authority on how to structure and write code.