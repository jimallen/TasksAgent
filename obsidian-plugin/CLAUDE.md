# CLAUDE.md - Obsidian Meeting Tasks Plugin

## Project Overview
**Obsidian Meeting Tasks Plugin** - A comprehensive Obsidian plugin that automatically fetches meeting emails from Gmail, extracts actionable tasks using Claude AI, and creates structured meeting notes with a visual task dashboard.

## Current Status
- ✅ **Production Ready** - Plugin fully functional with all features implemented
- ✅ **Gmail Integration** - Connected via Gmail MCP HTTP wrapper
- ✅ **Claude 4 Support** - Supports Claude 3.5 Haiku, Sonnet 4, and Opus 4.1
- ✅ **Task Dashboard** - Visual task management with filtering and statistics
- ✅ **Distribution Ready** - Generic, configurable for any user
- ✅ **TypeScript Compliant** - Full TypeScript type checking enabled
- ✅ **Documentation Complete** - Architecture diagrams and comprehensive docs

## 📐 Architecture
See [System Architecture Documentation](./docs/system-architecture.md) for detailed diagrams and component descriptions.

## Quick Start

### For Users
1. Install plugin in Obsidian
2. Start Gmail MCP server: `npm run gmail-mcp-http`
3. Configure settings (API keys, folders)
4. Click ribbon icon or use command palette to process emails

### For Developers
```bash
# Install dependencies
npm install

# Build plugin
npm run build
node esbuild.config.js production

# Deploy to vault
cp main.js "/path/to/vault/.obsidian/plugins/meeting-tasks/main.js"

# Start Gmail MCP HTTP wrapper (required)
npm run gmail-mcp-http
```

## Key Files

### Core Plugin Files
- `src/main-daemon-style.ts` - Main plugin entry point
- `src/claudeExtractor.ts` - Claude AI task extraction logic
- `src/taskDashboard.ts` - Task dashboard view component
- `src/main-daemon-style.ts` - Settings and plugin lifecycle

### Configuration Files
- `manifest.json` - Plugin metadata
- `esbuild.config.js` - Build configuration
- `styles.css` - Main plugin styles
- `styles/dashboard.css` - Dashboard-specific styles

### Scripts
- `scripts/start-gmail-mcp-http.js` - HTTP wrapper for Gmail MCP

## Features

### Task Extraction
- **Intelligent AI Processing**: Uses Claude 4 models for accurate task extraction
- **Comprehensive Extraction**: 
  - Tasks with assignees and priorities
  - Meeting participants
  - Key decisions
  - Next steps
  - Confidence scores
- **Fallback Mode**: Basic extraction if Claude API unavailable

### Task Dashboard
- **Visual Organization**:
  - Priority-based sections (High/Medium/Low)
  - Assignee-based task cards
  - Statistics overview
- **Interactive Features**:
  - Click to complete tasks
  - Filter by priority, date, assignee
  - Collapsible sections
- **Personalization**:
  - "My Tasks" filtering
  - Configurable user name
  - Optional task filtering

### Gmail Integration
- **MCP Protocol**: Uses Gmail MCP server for OAuth authentication
- **HTTP Wrapper**: Bridge for Obsidian's browser environment
- **Smart Search**: 
  - Multiple search patterns
  - Date-based lookback
  - Deduplication

## Configuration

### Plugin Settings
```typescript
{
  // Email Processing
  lookbackHours: 120,              // How far back to search
  mcpServerUrl: "http://localhost:3001",
  
  // Claude AI
  anthropicApiKey: "sk-ant-...",   // Your API key
  claudeModel: "claude-3-5-haiku-20241022",
  
  // Organization  
  notesFolder: "Meetings",          // Where to store notes
  
  // Dashboard
  dashboardShowOnlyMyTasks: false,  // Filter to personal tasks
  dashboardMyName: "",              // Your name for filtering
}
```

### Available Claude Models
- `claude-3-5-haiku-20241022` - Fast & economical (default)
- `claude-sonnet-4-20250514` - Balanced performance (Claude 4)
- `claude-opus-4-1-20250805` - Most capable (Claude 4)

## Common Issues & Solutions

### Gmail MCP Not Connecting
```bash
# Start the HTTP wrapper
npm run gmail-mcp-http

# Check if running
curl http://localhost:3001/health
```

### Tasks Not Extracting
- Verify Anthropic API key in settings
- Check Claude API usage/limits
- Try different Claude model
- Check console for errors

### Dashboard Not Loading
- Ensure Meetings folder exists
- Check for valid task format in notes
- Reload Obsidian (Cmd/Ctrl + R)

## Task Format

### In Meeting Notes
```markdown
### 🔴 High Priority
- [ ] Task description [[@Assignee]] 📅 2024-12-29 ⚠️ 85% #category
  - Context: Why this task exists
  > "Original quote from meeting"
```

### Task Components
- `- [ ]` - Checkbox (required)
- `[[@Assignee]]` - Task owner
- `📅 YYYY-MM-DD` - Due date
- `⚠️ XX%` - Confidence score (if < 70%)
- `#category` - Task category
- Context and quotes - Additional information

## Development Workflow

### Building the Plugin
```bash
# TypeScript check (required - no errors)
npm run typecheck

# Build with esbuild
node esbuild.config.js production

# Deploy to vault
cp main.js "/path/to/vault/.obsidian/plugins/meeting-tasks/"
```

### Testing
1. **Gmail Connection**: Check MCP server health endpoint
2. **Email Search**: Use "Process emails" command
3. **Task Extraction**: Review created meeting notes
4. **Dashboard**: Open via ribbon icon or command palette

## Performance Notes
- Processes up to 50 emails per run
- Truncates transcripts to 15,000 chars for Claude
- Caches processed email IDs to avoid duplicates
- Dashboard loads tasks on demand
- Minimal memory footprint (~50MB)

## Security Considerations
- **API Keys**: Stored locally in vault's `.obsidian` folder
- **OAuth Tokens**: Managed by Gmail MCP in `~/.gmail-mcp/`
- **No Cloud Storage**: All processing happens locally
- **Network**: MCP server on localhost only

## Distribution
- Plugin is generic - no hardcoded personal data
- Default settings work for any user
- Configurable dashboard filtering
- Ready for Obsidian Community Plugins

## Future Enhancements
- [ ] Real-time email monitoring
- [ ] Support for more meeting platforms
- [ ] Bulk task operations
- [ ] Task synchronization with external systems
- [ ] Advanced analytics
- [ ] Custom templates

## Debugging Tips
- Enable console: Ctrl+Shift+I (Dev Tools)
- Check plugin settings for API connection status
- Review created notes for extraction quality
- Use fallback mode to test without Claude API
- Check localhost:3001 for Gmail MCP status