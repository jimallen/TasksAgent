# Meeting Tasks Plugin for Obsidian

Automatically import meeting tasks and notes from email transcripts using AI-powered extraction. This plugin connects to your local Gmail MCP server to process meeting transcripts and create structured notes with actionable tasks in Obsidian.

🚀 **[Quick Start Guide](./QUICK_START.md)** - Get started in 5 minutes

📐 **[View System Architecture Diagram](./docs/system-architecture.md)** - Detailed technical documentation with architecture diagrams

🔨 **[Build & Deployment Guide](./docs/BUILD_DEPLOYMENT.md)** - Comprehensive build and deployment instructions

## Features

- 🤖 **AI-Powered Task Extraction**: Uses Claude AI to intelligently extract tasks, decisions, and action items from meeting transcripts
- 📧 **Gmail Integration**: Automatically finds and processes meeting emails via the TasksAgent service
- 📝 **Smart Note Creation**: Creates well-structured meeting notes with participants, tasks, decisions, and next steps
- 👥 **Multi-Name Task Filtering** (NEW): Support comma-separated names for "My Tasks" (e.g., "Alice, team, the group")
- ✨ **Smooth Task Completion** (NEW): Fade-out animation preserves scroll position when completing tasks
- 🔄 **Real-time Updates**: WebSocket support for instant notifications when new meetings are processed
- 🎨 **Templater Integration**: Full support for custom templates using the Templater plugin
- ⏰ **Automatic Scheduling**: Configure automatic checks at custom intervals with quiet hours support
- 💾 **Offline Support**: Built-in caching for offline access to processed meetings
- 🔔 **Rich Notifications**: Desktop notifications, sound alerts, and status bar updates

## Prerequisites

1. **TasksAgent Service**: You must have the TasksAgent service running locally. See [TasksAgent README](../README.md) for setup instructions.
2. **Anthropic API Key**: You'll need your own Claude API key from [Anthropic](https://console.anthropic.com/).
3. **Gmail Setup**: Gmail must be configured in the TasksAgent service with proper authentication.

## Installation

### From Release

1. Download the latest `meeting-tasks-X.X.X.zip` from the [Releases](https://github.com/yourusername/TasksAgent/releases) page
2. Extract the zip file into your vault's `.obsidian/plugins/meeting-tasks/` folder
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/TasksAgent.git
cd TasksAgent/obsidian-plugin

# Install dependencies
npm install

# Build the plugin
npm run build:release

# Copy to your vault
cp dist/* /path/to/vault/.obsidian/plugins/meeting-tasks/
```

## Configuration

### Basic Setup

1. Open Settings → Meeting Tasks
2. Configure the following required settings:

#### Service Connection
- **Service URL**: URL of your TasksAgent service (default: `http://localhost:3000`)
- **WebSocket URL**: WebSocket endpoint (default: `ws://localhost:3000`)

#### AI Settings
- **Anthropic API Key**: Your Claude API key (required)
- **Claude Model**: Model to use (default: `claude-3-haiku-20240307`)

#### Obsidian Integration
- **Target Folder**: Where to create meeting notes (default: `Meetings`)
- **Note Name Pattern**: How to name notes (default: `{{date}} - {{title}}`)

### Advanced Features

#### Automatic Checking
Enable automatic checking to process emails on a schedule:
- Set check interval (in minutes)
- Configure quiet hours to pause during specific times
- Select active days of the week

#### Templater Integration
If you have the Templater plugin installed:
1. Enable "Use Templater" in settings
2. Set your template path
3. Available variables in templates:
   - `{{title}}` - Meeting title
   - `{{date}}` - Meeting date
   - `{{participants}}` - List of participants
   - `{{tasks}}` - Extracted tasks
   - `{{summary}}` - Meeting summary
   - `{{keyDecisions}}` - Key decisions made
   - `{{nextSteps}}` - Next steps

#### WebSocket Real-time Updates
Enable WebSocket for instant notifications when the TasksAgent service processes new meetings.

## Usage

### Manual Check
- Click the ribbon icon (📋) in the left sidebar
- Use Command Palette: "Check for new meeting tasks"
- Keyboard shortcut: `Ctrl/Cmd + M`

### Processing Workflow
1. The plugin queries the TasksAgent service for new emails
2. Service searches Gmail for meeting transcripts
3. Claude AI extracts tasks and meeting information
4. Plugin creates formatted notes in your vault
5. Desktop notification shows summary of new tasks

### Task Organization
Tasks are automatically organized by priority:
- 🔴 **High Priority**: Urgent action items
- 🟡 **Medium Priority**: Standard tasks
- 🟢 **Low Priority**: Optional or future items

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Check for new meeting tasks | `Ctrl/Cmd + M` | Manually check for new meetings |
| Force check (ignore cache) | `Ctrl/Cmd + Shift + M` | Force refresh, bypassing cache |
| Show statistics | `Ctrl/Cmd + Alt + M` | View processing statistics |
| Process selected email ID | - | Process a specific email by ID |
| Toggle automatic checking | - | Enable/disable auto-check |
| Show processing history | - | View recent processing history |

## Note Format

Meeting notes are created with the following structure:

```markdown
---
title: "Team Standup"
date: 2024-01-15
participants:
  - Alice
  - Bob
  - Charlie
tags:
  - meeting
  - tasks
---

# Team Standup

## 📋 Executive Summary
Brief overview of the meeting...

## 👥 Participants
- [[Alice]]
- [[Bob]]
- [[Charlie]]

## ✅ Action Items & Tasks

### High Priority 🔴
- [ ] Critical task 1
  - Assigned to: [[Alice]]
  - Due: 2024-01-20

### Medium Priority 🟡
- [ ] Standard task 1
  - Assigned to: [[Bob]]

### Low Priority 🟢
- [ ] Optional task 1
  - Assigned to: [[Charlie]]

## 🎯 Key Decisions
- Decision 1
- Decision 2

## 🚀 Next Steps
1. Next step 1
2. Next step 2
```

## Troubleshooting

### Plugin won't connect to service
1. Verify TasksAgent service is running: `npm start` in the TasksAgent directory
2. Check service URL in settings (default: `http://localhost:3000`)
3. Test connection using the "Test Connection" button in settings

### No emails found
1. Verify Gmail is authenticated in TasksAgent
2. Check email patterns in settings match your meeting email subjects
3. Adjust lookback hours to search further back
4. Check TasksAgent logs for Gmail errors

### Tasks not being extracted
1. Verify your Anthropic API key is valid
2. Check API key has sufficient credits
3. Review Claude model selection in settings
4. Check error logs in Obsidian Developer Console (`Ctrl/Cmd + Shift + I`)

### Duplicate notes being created
The plugin checks for duplicates by:
- Matching note filenames
- Checking email IDs in frontmatter
- Comparing meeting dates and titles

If duplicates still occur, enable "Debug Mode" in advanced settings for detailed logging.

### WebSocket disconnections
1. Check WebSocket URL matches your service configuration
2. Review firewall settings for WebSocket connections
3. Check "Advanced Settings" for reconnection configuration

## Performance

- Processes up to 50 emails per check (configurable)
- 5-day default lookback window
- ~2-5 seconds per transcript for AI processing
- Minimal memory usage (~50-100MB)
- Automatic cache cleanup after 1 hour (configurable)

## Privacy & Security

- **Local Processing**: All processing happens on your local machine
- **No Cloud Storage**: Meeting data never leaves your system
- **API Keys**: Stored locally in Obsidian's vault configuration
- **Transcript Caching**: Optional, can be disabled in settings
- **Gmail Access**: Via OAuth2 through the TasksAgent service

## Development

### Building from Source
```bash
npm install
npm run build:dev  # Development build
npm run build:release  # Production build with minification
```

### Running Tests
```bash
npm test
npm run test:coverage
```

### Debug Mode
Enable "Debug Mode" in Advanced Settings to:
- See detailed console logging
- Access stack traces in error modals
- Monitor WebSocket traffic
- Track performance metrics

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/TasksAgent/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/TasksAgent/discussions)
- **Wiki**: [Plugin Wiki](https://github.com/yourusername/TasksAgent/wiki)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

- Built with [Obsidian Plugin API](https://github.com/obsidianmd/obsidian-api)
- AI extraction powered by [Claude](https://www.anthropic.com/claude)
- Gmail integration via [Gmail MCP](https://github.com/gongrzhe/server-gmail-autoauth-mcp)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and release notes.

---

Made with ❤️ for the Obsidian community