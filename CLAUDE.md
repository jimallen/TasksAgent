# CLAUDE.md - AI Assistant Context

## Project Overview
**Meeting Transcript Agent** - An automated system that monitors Gmail for meeting transcripts, extracts actionable tasks using Claude AI, and creates organized notes in Obsidian.

## Current Status
- ✅ **Production Ready** - All core features implemented and tested
- ✅ **Gmail Integration** - Connected via Gmail MCP with OAuth authentication
- ✅ **AI Task Extraction** - Claude API integration for intelligent task extraction
- ✅ **Obsidian Integration** - Creates structured meeting notes with tasks
- ✅ **Error Handling** - Comprehensive error handling and logging

## Quick Commands
```bash
# Test the system
npm run start:test

# Process emails once
npm run start:once

# Run with scheduler
npm start

# Check logs
tail -f logs/app.log
tail -f logs/error.log
```

## Key Files to Know
- `src/index.ts` - Main entry point and orchestration
- `src/services/gmailService.ts` - Gmail MCP integration
- `src/extractors/claudeTaskExtractor.ts` - Claude AI task extraction
- `src/parsers/emailParser.ts` - Email pattern recognition
- `src/services/obsidianService.ts` - Obsidian note creation
- `.env` - Configuration (DO NOT commit)

## Common Issues & Solutions

### Gmail Not Finding Emails
- Check patterns in `src/parsers/emailParser.ts`
- Verify search window in `.env` (GMAIL_HOURS_LOOKBACK=120 for 5 days)
- Current patterns: "Notes:", "Recording of", "Transcript for", "Meeting notes"
- Gmail MCP tools: `search_emails`, `read_email` (not `gmail_*` prefixed)

### Tasks Not Extracting
- Verify ANTHROPIC_API_KEY in `.env`
- Check Claude API limits
- Review transcript format in logs

### Notifications Failing
- Desktop: Uses `notify-send` on Linux (fixed hint syntax issue)
- Disable Slack if webhook not configured (removed from default channels)
- Check NOTIFICATION_CHANNELS in `.env` (default: console,desktop)

## Testing Checklist
When making changes, test:
1. [ ] Gmail connection: `npx @gongrzhe/server-gmail-autoauth-mcp auth`
2. [ ] TypeScript builds: `npm run build`
3. [ ] Test mode works: `npm run start:test`
4. [ ] Email search works: `npm run start:once`
5. [ ] No errors in logs: `cat logs/error.log`

## Architecture Notes
- **Gmail MCP**: External server process for Gmail OAuth
- **Processing Flow**: Gmail → Parser → AI → Obsidian → Notifications
- **State Management**: SQLite for deduplication
- **Scheduling**: Cron-based (9 AM, 1 PM, 5 PM)

## Environment Variables
Critical settings in `.env`:
- `ANTHROPIC_API_KEY` - Required for task extraction
- `OBSIDIAN_VAULT_PATH` - Where to create notes
- `GMAIL_HOURS_LOOKBACK` - How far back to search (default: 120 hours)
- `NOTIFICATION_CHANNELS` - Where to send notifications

## Development Workflow
1. Make changes
2. Run `npm run build`
3. Test with `npm run start:test`
4. Check logs for errors
5. Run full test with `npm run start:once`

## Known Limitations
- Gmail MCP must be authenticated before use
- Requires active internet for AI processing
- Limited to text-based transcript formats
- Desktop notifications require system support

## Future Enhancements
- [ ] Support for more meeting platforms
- [ ] Local AI option for privacy
- [ ] Web UI for configuration
- [ ] Real-time email monitoring
- [ ] Custom task extraction rules

## Debugging Tips
- Enable debug logs: `LOG_LEVEL=debug npm start`
- Check Gmail MCP: `npx @gongrzhe/server-gmail-autoauth-mcp`
- Verify OAuth: Check `~/.gmail-mcp/credentials.json`
- Test AI extraction: See `src/extractors/claudeTaskExtractor.test.ts`

## Performance Notes
- Processes up to 50 emails per run
- 5-day lookback window by default
- ~2-5 seconds per transcript for AI processing
- Minimal memory usage (~100-200MB)

## Security Considerations
- OAuth tokens in `~/.gmail-mcp/` (user-only permissions)
- API keys in `.env` (never commit)
- No transcript content cached
- All logs sanitized for sensitive data