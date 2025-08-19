# Changelog

All notable changes to the Meeting Transcript Agent project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-08-19

### Added
- Initial implementation of Meeting Transcript Agent
- Gmail integration via MCP (Model Context Protocol) with OAuth authentication
- AI-powered task extraction using LLM API
- Support for multiple transcript formats (PDF, TXT, VTT, HTML, DOCX)
- Obsidian vault integration for automated note creation
- Multi-channel notification system (console, desktop, Slack, Obsidian)
- SQLite database for state management and deduplication
- Cron-based scheduling (9 AM, 1 PM, 5 PM daily)
- Rate limiting for Gmail API calls
- Comprehensive error handling and logging
- Docker support for containerized deployment
- Full TypeScript implementation with strict mode
- Test suite with Jest
- Complete documentation suite:
  - System architecture with mermaid diagrams
  - API reference documentation
  - Quick reference guide
  - CLAUDE.md for AI assistant context

### Fixed
- Gmail MCP tool names (changed from `gmail_*` to standard names like `search_emails`, `read_email`)
- Desktop notification hint syntax for Linux (`notify-send`)
- Empty Gmail search result handling
- Date range queries for Gmail searches (fixed same-day boundary issue)
- TypeScript compilation errors with strict mode
- Email parser patterns to support Google Gemini "Notes:" format
- Attachment requirement removed for note-style emails

### Security
- Proper `.gitignore` configuration to exclude sensitive files
- No API keys or credentials in repository
- OAuth tokens stored securely in `~/.gmail-mcp/`
- Database files excluded from version control
- All sensitive data sanitized in logs

### Configuration
- Default lookback window set to 120 hours (5 days)
- Slack notifications disabled by default (requires webhook configuration)
- Environment variable structure reorganized (REQUIRED, RECOMMENDED, OPTIONAL)
- Removed unnecessary Gmail OAuth fields from `.env`

### Documentation
- Created comprehensive README with badges and proper formatting
- Added system architecture documentation with 6 mermaid diagrams
- Created API reference for all services and interfaces
- Added quick reference guide for common tasks
- Created CLAUDE.md for AI assistant context
- Updated Gmail MCP setup instructions

## [Unreleased]

### Planned
- Microsoft Teams integration
- Slack transcript support
- Web dashboard interface
- Mobile application
- Multi-user support
- Custom AI model support
- Real-time email monitoring
- Webhook integrations