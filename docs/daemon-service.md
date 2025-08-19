# Meeting Transcript Agent - Daemon Service

## Overview
The Meeting Transcript Agent now includes a background daemon service with a Terminal User Interface (TUI) for monitoring and control.

## Features

### Background Service
- Runs continuously in the background
- Scheduled email processing (9 AM, 1 PM, 5 PM)
- Automatic error recovery and retry
- Process management with graceful shutdown
- SQLite database for statistics tracking

### Terminal User Interface (TUI)
- Real-time dashboard with service status
- Live statistics and success rate gauge
- Activity log viewer
- Error monitoring
- Configuration editor
- Manual processing trigger

## Installation

### Quick Start
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the daemon with TUI
npm run daemon

# Or run in headless mode
npm run daemon:headless
```

### Systemd Service (Linux)
For production deployment as a system service:

```bash
# Install the systemd service
sudo npm run daemon:install

# Start the service
sudo systemctl start meeting-transcript-agent@$USER

# Enable auto-start on boot
sudo systemctl enable meeting-transcript-agent@$USER

# Check service status
sudo systemctl status meeting-transcript-agent@$USER

# View logs
sudo journalctl -u meeting-transcript-agent@$USER -f
```

## TUI Controls

| Key | Action |
|-----|--------|
| F1 | Start service |
| F2 | Stop service |
| F3 | Process emails now (manual trigger) |
| F4 | Clear statistics |
| F5 | View application logs |
| F6 | Edit configuration |
| Q | Quit TUI (service continues) |

## TUI Layout

```
┌─────────────────────────────────────────────────────────┐
│ Service Status │ Success Rate │ Next Runs               │
├────────────────┴──────────────┴────────────────────────┤
│ Statistics              │ Recent Errors                 │
│ - Total Runs: 42       │ [No errors]                   │
│ - Successful: 40       │                                │
│ - Failed: 2            │                                │
│ - Emails: 156          │                                │
│ - Tasks: 234           │                                │
│ - Notes: 45            │                                │
├────────────────────────┴─────────────────────────────────┤
│ Activity Log                                             │
│ [12:34:56] Service started successfully                  │
│ [12:35:00] Email processing started...                   │
│ [12:35:15] Processing completed: 7 emails, 12 tasks      │
└───────────────────────────────────────────────────────────┘
[F1]Start [F2]Stop [F3]Process [F4]Clear [F5]Logs [F6]Config [Q]Quit
```

## Configuration

### Environment Variables
Add to `.env` file:
```env
# Schedule (cron format)
SCHEDULE=0 9,13,17 * * *

# Other settings remain the same
GMAIL_HOURS_LOOKBACK=120
OBSIDIAN_VAULT_PATH=/path/to/vault
```

### Runtime Configuration
Press F6 in the TUI to edit configuration on-the-fly. Changes require service restart.

## Statistics

The daemon tracks:
- Total processing runs
- Success/failure rates
- Emails processed
- Tasks extracted
- Notes created
- Recent errors
- Service uptime

Statistics are persisted in `daemon-stats.db` and survive restarts.

## Monitoring

### Health Checks
- Service status: Running, Stopped, Processing, Error
- Next scheduled runs displayed
- Real-time success rate gauge
- Error log with timestamps

### Logs
- Application logs: `logs/app.log`
- Error logs: `logs/error.log`
- Daemon logs: `logs/daemon.log` (when using systemd)

## Troubleshooting

### Service Won't Start
1. Check Gmail authentication: `npx @gongrzhe/server-gmail-autoauth-mcp auth`
2. Verify `.env` configuration
3. Check logs for errors: `tail -f logs/error.log`

### TUI Display Issues
- Ensure terminal supports Unicode
- Resize terminal if layout appears broken
- Try different terminal emulator

### Processing Not Running
1. Check service status in TUI (should show "running")
2. Verify schedule in configuration
3. Try manual processing with F3
4. Check for errors in Recent Errors panel

## Development

### Running in Development
```bash
# Run daemon with TypeScript directly
npm run daemon

# Run in headless mode for testing
npm run daemon:headless
```

### Debugging
```bash
# Enable debug logging
LOG_LEVEL=debug npm run daemon

# Run with Node inspector
node --inspect dist/daemon.js
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Daemon    │────▶│   Service    │────▶│   Email      │
│   Entry     │     │   Manager    │     │   Processor  │
└─────────────┘     └──────────────┘     └──────────────┘
       │                    │                     │
       ▼                    ▼                     ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│     TUI     │────▶│   Stats DB   │     │   Gmail API  │
│  Interface  │     │   SQLite     │     │   Obsidian   │
└─────────────┘     └──────────────┘     └──────────────┘
```

## Security

- OAuth tokens stored securely in `~/.gmail-mcp/`
- Service runs with user permissions
- Systemd service includes security hardening
- No sensitive data in logs
- Configuration isolated from code

## Performance

- Minimal CPU usage when idle
- ~100-200MB memory footprint
- SQLite for efficient statistics
- Rate-limited Gmail API calls
- Async processing with error boundaries