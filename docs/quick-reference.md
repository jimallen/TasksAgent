# Quick Reference Guide

## Essential Commands

```bash
# First-time setup
npm install
cp .env.example .env
npx @gongrzhe/server-gmail-autoauth-mcp auth

# Daily usage
npm start              # Run with scheduler
npm run start:once     # Process emails once
npm run start:test     # Test connections

# Development
npm run build          # Compile TypeScript
npm test              # Run tests
npm run lint          # Check code style

# Debugging
tail -f logs/app.log   # Watch application logs
tail -f logs/error.log # Watch error logs
LOG_LEVEL=debug npm start # Enable debug logging
```

## Configuration Checklist

### Required
- [ ] `OBSIDIAN_VAULT_PATH` - Set to your vault location
- [ ] Gmail OAuth - Run `npx @gongrzhe/server-gmail-autoauth-mcp auth`

### Recommended
- [ ] `ANTHROPIC_API_KEY` - For AI task extraction
- [ ] `GMAIL_HOURS_LOOKBACK` - Set to 120 (5 days)
- [ ] `TZ` - Set to your timezone

### Optional
- [ ] `NOTIFICATION_CHANNELS` - Choose notification methods
- [ ] `SLACK_WEBHOOK_URL` - For Slack notifications
- [ ] `CUSTOM_SCHEDULE` - Override default schedule

## File Structure

```
TasksAgent/
├── src/
│   ├── index.ts              # Main entry point
│   ├── services/
│   │   ├── gmailService.ts   # Gmail MCP integration
│   │   ├── obsidianService.ts # Obsidian note creation
│   │   └── notificationService.ts # Multi-channel notifications
│   ├── extractors/
│   │   └── claudeTaskExtractor.ts # AI task extraction
│   ├── parsers/
│   │   ├── emailParser.ts    # Email pattern detection
│   │   └── transcriptParser.ts # Transcript content parsing
│   └── database/
│       └── stateManager.ts   # SQLite state management
├── docs/
│   ├── system-architecture.md # System design
│   ├── api-reference.md      # API documentation
│   └── quick-reference.md    # This file
├── logs/
│   ├── app.log               # Application logs
│   └── error.log             # Error logs
├── data/
│   └── state.db              # SQLite database
├── .env                      # Your configuration
├── .env.example              # Configuration template
├── CLAUDE.md                 # AI assistant context
└── README.md                 # Main documentation
```

## Common Patterns

### Meeting Email Patterns
- Subject: `Notes: *` (Gemini)
- Subject: `Recording of *` (Google Meet)
- Subject: `Transcript for *` (Google Meet)
- Subject: `Meeting notes` (Generic)
- From: `gemini-notes@google.com`
- From: `*@meet.google.com`

### Task Priority Mapping
- **High**: Due today, urgent, ASAP, critical
- **Medium**: This week, soon, important
- **Low**: Eventually, when possible, nice to have

### Obsidian Note Structure
```markdown
---
title: Meeting Title
date: 2025-08-19
participants:
  - Person 1
  - Person 2
tags:
  - meeting
  - high-priority
---

# Meeting Title

## Summary
AI-generated summary...

## Tasks
- [ ] High priority task @assignee
- [ ] Medium priority task
- [ ] Low priority task

## Key Decisions
- Decision 1
- Decision 2

## Next Steps
- Step 1
- Step 2
```

## Troubleshooting Quick Fixes

### Gmail not finding emails
```bash
# Check authentication
npx @gongrzhe/server-gmail-autoauth-mcp auth

# Test search directly
node test-gmail-mcp.js

# Increase lookback window
echo "GMAIL_HOURS_LOOKBACK=240" >> .env
```

### Tasks not extracting
```bash
# Verify API key
echo $ANTHROPIC_API_KEY

# Test AI extraction
npm run test:extractor

# Check logs for AI errors
grep "claude" logs/error.log
```

### Notifications not working
```bash
# Linux: Install notify-send
sudo apt-get install libnotify-bin

# Disable problematic channels
sed -i 's/NOTIFICATION_CHANNELS=.*/NOTIFICATION_CHANNELS=console/' .env

# Test notifications
npm run test:notify
```

### Build errors
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build

# Check TypeScript errors
npx tsc --noEmit
```

## Environment Variables

### Gmail
- `GMAIL_HOURS_LOOKBACK` - How far back to search (default: 24)
- `GMAIL_MAX_RESULTS` - Max emails per check (default: 50)
- `GMAIL_CHECK_INTERVAL_HOURS` - Hours between checks (default: 8)
- `GMAIL_SENDER_DOMAINS` - Comma-separated domains
- `GMAIL_SUBJECT_PATTERNS` - Comma-separated patterns

### Obsidian
- `OBSIDIAN_VAULT_PATH` - **Required** vault location
- `OBSIDIAN_MEETINGS_FOLDER` - Subfolder for meetings (default: Meetings)
- `OBSIDIAN_TASK_TAG` - Tag for tasks (default: #meeting-task)

### AI
- `ANTHROPIC_API_KEY` - Claude API key
- `AI_MODEL` - Model to use (default: claude-3-haiku)
- `AI_TEMPERATURE` - Creativity (0-1, default: 0.3)
- `AI_MAX_TOKENS` - Response limit (default: 4096)

### Notifications
- `NOTIFICATION_CHANNELS` - Comma-separated: console,desktop,slack,obsidian
- `SLACK_WEBHOOK_URL` - Slack incoming webhook
- `ENABLE_NOTIFICATIONS` - true/false (default: true)

### Scheduling
- `TZ` - Timezone (default: America/New_York)
- `SCHEDULE_TIMES` - Comma-separated times (default: 09:00,13:00,17:00)
- `RUN_ON_START` - Process on startup (default: true)
- `CUSTOM_SCHEDULE` - Cron expression override

## Performance Tuning

### For high volume
```env
GMAIL_MAX_RESULTS=100
MAX_CONCURRENT_TRANSCRIPTS=5
TRANSCRIPT_TIMEOUT_MS=60000
```

### For low resource usage
```env
GMAIL_MAX_RESULTS=10
MAX_CONCURRENT_TRANSCRIPTS=1
NOTIFICATION_CHANNELS=console
```

### For debugging
```env
LOG_LEVEL=debug
ERROR_NOTIFICATION=true
CLEANUP_TEMP_FILES=false
```

## Security Best Practices

1. **Never commit `.env` file**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Secure OAuth tokens**
   ```bash
   chmod 600 ~/.gmail-mcp/credentials.json
   ```

3. **Rotate API keys regularly**
   ```bash
   # Generate new Claude API key monthly
   ```

4. **Use read-only Gmail scope**
   - Only request `gmail.readonly` permission

5. **Sanitize logs**
   - Never log full email content
   - Mask sensitive data in logs

## Quick Health Check

```bash
# Check all systems
npm run health-check

# Manual checks
echo "Gmail:" && npx @gongrzhe/server-gmail-autoauth-mcp list | head -1
echo "Claude:" && curl -H "x-api-key: $ANTHROPIC_API_KEY" https://api.anthropic.com/v1/models
echo "Obsidian:" && ls -la "$OBSIDIAN_VAULT_PATH"
echo "Database:" && sqlite3 data/state.db "SELECT COUNT(*) FROM processed_emails;"
```