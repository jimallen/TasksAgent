# Obsidian Meeting Tasks Plugin

Automatically import meeting tasks and notes from the TasksAgent service into your Obsidian vault.

## Features

- 🔄 **Automatic Task Import**: Seamlessly import meeting tasks from Gmail transcripts
- 🚀 **Real-time Updates**: WebSocket connection for instant notifications
- 📝 **Smart Note Creation**: Organized meeting notes with extracted tasks, decisions, and action items
- 🎨 **Templater Integration**: Full support for custom templates with Templater plugin
- 🔔 **Notifications**: Get notified when new meeting tasks are available
- 📊 **Task Prioritization**: Automatic priority assignment (High 🔴, Medium 🟡, Low 🟢)
- 🔗 **Auto-linking**: Links to participants and daily notes

## Prerequisites

- Obsidian v1.0.0 or higher
- [TasksAgent service](https://github.com/yourusername/TasksAgent) running locally
- Anthropic API key for Claude AI
- (Optional) Templater plugin for advanced templates

## Installation

### From Obsidian Community Plugins (Coming Soon)
1. Open Settings → Community Plugins
2. Search for "Meeting Tasks"
3. Click Install and Enable

### Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/yourusername/obsidian-meeting-tasks/releases)
2. Extract the files to your vault's `.obsidian/plugins/obsidian-meeting-tasks/` folder
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

### Development Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/obsidian-meeting-tasks.git
cd obsidian-meeting-tasks

# Install dependencies
npm install

# Run in development mode (with file watching)
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Configuration

### Initial Setup

1. **Start TasksAgent Service**
   ```bash
   # In your TasksAgent directory
   npm start
   ```

2. **Configure Plugin Settings**
   - Open Settings → Meeting Tasks
   - Enter your service URL (default: `http://localhost:3000`)
   - Add your Anthropic API key
   - Configure target folder for meeting notes
   - Test the connection

### Settings Overview

#### Service Connection
- **Service URL**: URL of your TasksAgent service
- **WebSocket URL**: WebSocket endpoint for real-time updates
- **Connection Test**: Verify service connectivity

#### AI Settings
- **Anthropic API Key**: Your personal Claude API key
- **Model Selection**: Choose Claude model (default: claude-3-haiku)

#### Obsidian Integration
- **Target Folder**: Where meeting notes will be created
- **Template Settings**: Configure Templater integration
- **Note Naming**: Customize note naming convention

#### Automation
- **Auto-check**: Enable periodic checking for new tasks
- **Check Interval**: How often to check (in minutes)
- **Quiet Hours**: Disable checks during specified hours

## Usage

### Manual Task Checking
1. Click the Meeting Tasks icon in the ribbon, or
2. Use Command Palette: `Check for new meeting tasks`

### Automatic Processing
When enabled, the plugin will:
1. Periodically check for new meeting transcripts
2. Extract tasks using Claude AI
3. Create formatted notes in your vault
4. Notify you of new tasks

### Template Variables

If using Templater, these variables are available:
- `{{title}}` - Meeting title
- `{{date}}` - Meeting date
- `{{participants}}` - Array of participant names
- `{{tasks}}` - Extracted task objects
- `{{summary}}` - AI-generated summary
- `{{keyDecisions}}` - Key decisions made
- `{{nextSteps}}` - Next steps identified
- `{{confidence}}` - AI confidence score

## Commands

| Command | Description |
|---------|-------------|
| Check for new meeting tasks | Manually trigger task checking |
| Open Meeting Tasks settings | Open plugin configuration |
| View processing history | Show recent processing results |
| Force reprocess last meeting | Reprocess the most recent meeting |

## Troubleshooting

### Connection Issues
- Verify TasksAgent service is running
- Check service URL in settings
- Ensure firewall allows local connections

### No Tasks Found
- Verify Gmail patterns in TasksAgent configuration
- Check lookback window (default: 120 hours)
- Ensure emails contain recognized transcript patterns

### API Errors
- Verify Anthropic API key is valid
- Check API rate limits
- Review error logs in Developer Console

## Development

### Project Structure
```
obsidian-meeting-tasks/
├── src/
│   ├── main.ts           # Plugin entry point
│   ├── settings.ts       # Settings management
│   ├── api/             # Service communication
│   ├── services/        # Business logic
│   ├── ui/              # UI components
│   └── utils/           # Helper functions
├── manifest.json        # Plugin metadata
├── package.json         # Dependencies
└── README.md           # Documentation
```

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Building for Release
```bash
# Clean, build, and test
npm run release

# This will:
# 1. Clean previous builds
# 2. Type-check with TypeScript
# 3. Bundle with esbuild
# 4. Run all tests
```

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - See [LICENSE](LICENSE) file for details

## Support

- 🐛 [Report Issues](https://github.com/yourusername/obsidian-meeting-tasks/issues)
- 💬 [Discussions](https://github.com/yourusername/obsidian-meeting-tasks/discussions)
- 📖 [Documentation](https://github.com/yourusername/obsidian-meeting-tasks/wiki)

## Acknowledgments

- Built for [Obsidian](https://obsidian.md)
- Powered by [Claude AI](https://anthropic.com)
- Integrates with [TasksAgent](https://github.com/yourusername/TasksAgent)

---

Made with ❤️ by the TasksAgent Team