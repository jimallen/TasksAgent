# Meeting Transcript Task Extraction Agent

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)
[![Claude AI](https://img.shields.io/badge/Claude-AI-orange)](https://claude.ai/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

An automated agent that monitors Gmail for meeting transcripts, extracts actionable tasks using AI, and organizes them in your Obsidian vault.

## 📚 Documentation

- [System Architecture](docs/system-architecture.md) - Detailed system design and components
- [API Reference](docs/api-reference.md) - Complete API documentation
- [AI Context](CLAUDE.md) - Information for AI assistants
- [Configuration Guide](#configuration) - Environment setup
- [Troubleshooting](#troubleshooting) - Common issues and solutions

## ✨ Features

- 📧 **Automatic Gmail Monitoring**: Checks for new meeting transcripts 3 times daily (9 AM, 1 PM, 5 PM)
- 🤖 **AI-Powered Task Extraction**: Uses Claude AI to intelligently extract tasks, action items, and key decisions
- 📝 **Obsidian Integration**: Creates structured meeting notes in your Obsidian vault with proper formatting
- 🔍 **Smart Deduplication**: Prevents duplicate task creation using SQLite database
- 📊 **Multi-format Support**: Handles PDF, DOCX, TXT, HTML, VTT, and SRT transcript formats
- 🔔 **Cross-platform Notifications**: Desktop notifications on Mac, Linux, and Windows
- ⚡ **Rate Limiting**: Respects Gmail API quotas with intelligent rate limiting
- 🎯 **Priority Management**: Categorizes tasks by priority and assigns due dates

## 📋 Prerequisites

- Node.js 18+ and npm
- Gmail account with API access
- Obsidian vault
- Claude API key (optional, for enhanced AI extraction)
- Linux: `libnotify-bin` package for desktop notifications
- Mac: Works out of the box with native notifications

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/meeting-transcript-agent.git
cd meeting-transcript-agent
npm install
```

### 2. Configure Environment

Copy the example configuration:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# ==================== REQUIRED ====================
OBSIDIAN_VAULT_PATH=/path/to/your/obsidian/vault

# ==================== RECOMMENDED ====================
# Claude AI for intelligent task extraction
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx...

# ==================== OPTIONAL ====================
# Gmail search window (default: 120 hours / 5 days)
GMAIL_HOURS_LOOKBACK=120

# Notification channels
NOTIFICATION_CHANNELS=console,desktop

# Timezone for scheduling
TZ=America/New_York
```

### 3. Setup Gmail MCP Server

The agent uses the Gmail MCP (Model Context Protocol) server for Gmail integration. You'll need to set up Google Cloud OAuth credentials first.

#### Step 1: Create Google Cloud OAuth Credentials

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**

2. **Create a new project** (or use existing):
   - Click "Select a project" → "New Project"
   - Name: "Meeting Transcript Agent"
   - Click "Create"

3. **Enable Gmail API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Gmail API"
   - Click on it and press "Enable"

4. **Create OAuth 2.0 Credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   
5. **Configure OAuth Consent Screen** (if prompted):
   - Click "Configure Consent Screen"
   - Choose "External" (or "Internal" for Google Workspace)
   - Fill in required fields:
     - App name: "Meeting Transcript Agent"
     - User support email: your email
     - Developer contact: your email
   - Click "Save and Continue"
   - Add scopes → "Add or Remove Scopes"
   - Search and add: `https://www.googleapis.com/auth/gmail.readonly`
   - Save and Continue
   - Add test users → Add your email address
   - Save and Continue

6. **Create Desktop OAuth Client**:
   - Back in "Credentials", click "Create Credentials" → "OAuth client ID"
   - Application type: "Desktop app"
   - Name: "Meeting Transcript Agent"
   - Click "Create"
   - Click "Download JSON" to download the credentials

#### Step 2: Install OAuth Credentials

```bash
# Create Gmail MCP directory
mkdir -p ~/.gmail-mcp

# Copy and rename the downloaded credentials file
cp ~/Downloads/client_secret_*.json ~/.gmail-mcp/gcp-oauth.keys.json

# Alternative: Place in current directory
cp ~/Downloads/client_secret_*.json ./gcp-oauth.keys.json
```

#### Step 3: Authenticate with Gmail

Now run the Gmail MCP server to complete authentication:

```bash
# This will now work with your OAuth credentials
npx @gongrzhe/server-gmail-autoauth-mcp
```

This will:
1. Open a browser window for Google sign-in
2. Ask you to authorize the app
3. Save the refresh token in `~/.gmail-mcp/`
4. Start the MCP server on port 3000

#### Step 4: Verify Connection

```bash
# Test the agent's Gmail connection
npm run start:test
```

You should see: `✓ Gmail service connected`

#### Troubleshooting Gmail Setup

**"OAuth keys file not found" Error:**
```bash
# Make sure the file exists and is named correctly
ls -la ~/.gmail-mcp/gcp-oauth.keys.json

# Or place in current directory
ls -la ./gcp-oauth.keys.json
```

**"Insufficient Permission" Error:**
```bash
# Reset and re-authenticate
rm -rf ~/.gmail-mcp/token.json
npx @gongrzhe/server-gmail-autoauth-mcp
```

**"Quota Exceeded" Error:**
- Gmail API limits: 250 units/second, 1B units/day
- The agent handles rate limiting automatically
- Reduce `GMAIL_HOURS_LOOKBACK` if needed

**Authentication Loop:**
```bash
# Clear all Gmail MCP data
rm -rf ~/.gmail-mcp
mkdir -p ~/.gmail-mcp
# Re-copy your OAuth credentials and start over
```

**Port Already in Use:**
```bash
# Find and kill existing process
lsof -i :3000
kill -9 <PID>
```

**"Redirect URI mismatch" Error:**
- Make sure you selected "Desktop app" when creating OAuth client
- Not "Web application" or other types

### 4. Initialize the Agent

```bash
# Run initial setup and test
npm run start:test

# Start the agent
npm start
```

## Usage

### Running Modes

```bash
# Start with scheduled processing (default)
npm start

# Run once and exit
npm run start:once

# Test mode - verify all connections
npm run start:test

# Development mode with auto-reload
npm run dev
```

### Manual Processing

You can trigger processing manually while the agent is running:

```bash
# In another terminal
curl http://localhost:3000/trigger
```

## Project Structure

```
meeting-transcript-agent/
├── src/
│   ├── index.ts                 # Main application entry
│   ├── config/                  # Configuration management
│   ├── services/                # Core services
│   │   ├── gmailService.ts      # Gmail integration
│   │   ├── obsidianService.ts   # Obsidian vault management
│   │   └── notificationService.ts # Multi-channel notifications
│   ├── parsers/                 # Email and transcript parsing
│   │   ├── emailParser.ts       # Email pattern detection
│   │   └── transcriptParser.ts  # Multi-format transcript parsing
│   ├── extractors/              # Task extraction
│   │   └── claudeTaskExtractor.ts # AI-powered task extraction
│   ├── database/                # State management
│   │   ├── schema.sql           # SQLite schema
│   │   └── stateManager.ts      # Database operations
│   ├── scheduler/               # Cron scheduling
│   │   └── cronScheduler.ts     # Job scheduling and management
│   └── utils/                   # Utilities
│       ├── logger.ts            # Winston logging
│       ├── errorHandler.ts      # Error handling
│       └── rateLimiter.ts       # API rate limiting
├── test-data/                   # Sample transcripts for testing
├── data/                        # Runtime data (auto-created)
│   ├── state.db                # SQLite database
│   └── temp/                   # Temporary files
└── logs/                        # Application logs (auto-created)
```

## Configuration

### Obsidian Vault Structure

The agent creates the following structure in your vault:

```
ObsidianVault/
├── Meetings/
│   ├── 2024/
│   │   ├── 01/
│   │   │   ├── 2024-01-15 - Q1 Planning.md
│   │   │   └── 2024-01-20 - Team Sync.md
│   │   └── 02/
│   └── Archive/
├── Daily Notes/
│   └── 2024-01-15.md  # Linked to meetings
└── Templates/
    └── Meeting Template.md
```

### Meeting Note Format

Each meeting note includes:

- **Frontmatter**: Metadata including date, participants, tags
- **Summary**: AI-generated meeting summary
- **Participants**: Linked list of attendees
- **Key Decisions**: Important decisions made
- **Tasks**: Checkbox format with priorities and assignees
- **Next Steps**: Follow-up actions

Example:

```markdown
---
title: Q1 Planning Meeting
date: 2024-01-15
participants:
  - Alice Johnson
  - Bob Smith
tags:
  - meeting
  - planning
  - high-priority
---

# Q1 Planning Meeting

## Meeting Summary
Discussed Q1 objectives and resource allocation...

## Tasks
### Engineering
- [ ] 🔴 Complete API integration @[[Bob]] 📅 2024-01-20
- [ ] 🟡 Review architecture proposal

### Product
- [ ] 🟢 Update roadmap documentation
```

## Scheduling

Default schedule runs 3 times daily:
- 9:00 AM - Morning check
- 1:00 PM - Afternoon check  
- 5:00 PM - Evening check

Customize with cron expressions in `.env`:

```env
CUSTOM_SCHEDULE=0 */4 * * *  # Every 4 hours
```

## Notifications

### Supported Channels

- **Console**: Terminal output (always enabled)
- **Desktop**: Native OS notifications
  - Mac: Notification Center
  - Linux: notify-send
  - Windows: Toast notifications
- **Obsidian**: Opens notes directly in Obsidian
- **Slack**: Webhook integration
- **Email**: SMTP integration (requires additional config)

### Priority Levels

- 🔴 **High/Urgent**: Tasks due within 24 hours
- 🟡 **Medium**: Standard priority tasks
- 🟢 **Low**: Non-urgent tasks

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch

# Test with sample transcripts
npm run test:samples
```

## Troubleshooting

### Common Issues

#### Gmail Authentication Failed

```bash
# Re-authenticate Gmail MCP
npx @gongrzhe/server-gmail-autoauth-mcp --reset
```

#### Obsidian Vault Not Found

Ensure the path in `.env` is absolute:

```env
# Correct
OBSIDIAN_VAULT_PATH=/Users/username/Documents/ObsidianVault

# Incorrect
OBSIDIAN_VAULT_PATH=~/ObsidianVault
```

#### No Desktop Notifications on Linux

Install libnotify:

```bash
# Ubuntu/Debian
sudo apt-get install libnotify-bin

# Fedora
sudo dnf install libnotify

# Arch
sudo pacman -S libnotify
```

#### Rate Limiting Errors

The agent automatically handles rate limiting, but you can adjust:

```typescript
// In src/config/config.ts
gmail: {
  hoursToLookBack: '12',  // Reduce time window
  maxResults: 20           // Limit results per check
}
```

### Debug Mode

Enable detailed logging:

```env
LOG_LEVEL=debug
```

View logs:

```bash
tail -f logs/app.log
```

## API Documentation

### Core Services

#### GmailService
- `connect()`: Establish Gmail MCP connection
- `fetchRecentEmails(hours)`: Get emails from past N hours
- `downloadAttachment(messageId, attachmentId)`: Download file attachments

#### ObsidianService
- `initialize()`: Setup vault structure
- `createMeetingNote(extraction, emailId)`: Create formatted note
- `linkToDailyNote(notePath, date)`: Link to daily notes

#### TaskExtractor
- `extractTasks(transcript)`: AI-powered task extraction
- `formatTasksForObsidian(tasks)`: Format for checkbox display

#### StateManager
- `isEmailProcessed(emailId)`: Check processing status
- `saveTasks(emailId, tasks)`: Store extracted tasks
- `findSimilarTasks(task)`: Deduplication check

## 📊 Performance

- **Processing Speed**: ~50 emails/minute
- **Task Extraction**: ~10 tasks/transcript
- **Database**: SQLite handles 100K+ records efficiently
- **Rate Limiting**: 250 Gmail API units/second
- **Memory Usage**: ~100-200MB typical
- **AI Processing**: 2-5 seconds per transcript

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/meeting-transcript-agent/issues)
- **Documentation**: [docs/](docs/) directory
- **AI Context**: [CLAUDE.md](CLAUDE.md)
- **Architecture**: [System Design](docs/system-architecture.md)

## 🗺️ Roadmap

- [ ] Microsoft Teams integration
- [ ] Slack transcript support  
- [ ] Web dashboard
- [ ] Mobile app
- [ ] Multi-user support
- [ ] Custom AI models
- [ ] Webhook integrations

## 🙏 Acknowledgments

- [Gmail MCP Server](https://github.com/GongRzhe/Gmail-MCP-Server) by @gongrzhe
- [Claude AI](https://claude.ai) by Anthropic
- [Obsidian](https://obsidian.md) community
- [MCP Protocol](https://modelcontextprotocol.io) by Anthropic

## 🔒 Security

- OAuth tokens stored in `~/.gmail-mcp/` with user-only permissions
- API keys in `.env` (never committed to git)
- No transcript content cached or logged
- All sensitive data sanitized in logs

## 📖 Additional Resources

- [System Architecture](docs/system-architecture.md)
- [API Documentation](docs/api-reference.md)
- [Claude Context](CLAUDE.md)
- [Gmail MCP Setup Guide](#setup-gmail-mcp-server)
- [Obsidian Integration](#obsidian-vault-structure)

---

**Built with ❤️ for productivity enthusiasts**