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
- ✅ **UI Enhancements** - Edit buttons, proper flexbox layout, theme-aware styling
- ✅ **Priority Support** - Both custom emojis and Obsidian's built-in syntax

## 📐 Documentation

- **[Quick Start Guide](./QUICK_START.md)** - Get started in 5 minutes
- **[Build & Deployment Guide](./docs/BUILD_DEPLOYMENT.md)** - Comprehensive build instructions
- **[System Architecture](./docs/system-architecture.md)** - Technical architecture and diagrams
- **[HTTP Server Architecture](../docs/ARCHITECTURE_HTTP_SERVERS.md)** - Parent project architecture

## Quick Start

### For Users
1. Install plugin in Obsidian
2. Start unified daemon: `npm run daemon` (includes Gmail MCP)
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

# Start unified daemon (includes Gmail MCP)
npm run daemon
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
- Daemon now includes Gmail MCP - no separate wrapper needed

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
  - Statistics overview (Total, Completed, High Priority, Overdue)
- **Interactive Features**:
  - Click to complete tasks
  - Filter by priority, date, assignee
  - Collapsible sections
  - In-line task editing (priority and assignee)
  - Toggle between "My Tasks" and "All Tasks" views
- **UI Improvements** (Recent):
  - Edit button in top-left corner of each task
  - Proper flexbox layout for maintainability
  - Theme-aware styling with CSS variables
  - High-contrast metadata tags
  - Support for Obsidian's built-in priority indicators (⏫ ⏬ 🔼 🔽)
- **Personalization**:
  - "My Tasks" filtering with dashboard toggle
  - Configurable user name for task filtering
  - Scans entire vault for tasks (not just Meetings folder)

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
  mcpServerUrl: "http://localhost:3002/gmail",  // Unified daemon endpoint
  
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
# Start the unified daemon (includes Gmail MCP)
npm run daemon

# Check if running
curl http://localhost:3002/gmail/health
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

### Quick Build & Deploy
```bash
# Production build (recommended)
node esbuild.config.js production

# Development build (with source maps)
node esbuild.config.js development

# Type checking (run before commits)
npm run typecheck
```

### Deployment Options

#### Option 1: Direct Copy
```bash
# Build first
node esbuild.config.js production

# Copy to vault
cp main.js manifest.json styles.css "/path/to/vault/.obsidian/plugins/meeting-tasks/"

# Restart Obsidian or use Ctrl/Cmd+R to reload
```

#### Option 2: Build Script
```bash
# Use the custom build script (includes validation)
node build.js

# This automatically:
# - Validates required files
# - Runs TypeScript checking
# - Builds with esbuild
# - Reports any issues
```

📚 **Full documentation**: See [Build & Deployment Guide](./docs/BUILD_DEPLOYMENT.md)

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

## Recent Changes (Latest Session - 2025-08-29)

### Filter Button Count Badges
- Added real-time count badges to all filter buttons
- Badges show total count regardless of active filter
- Counts update with 150ms debouncing for performance
- Zero counts hide badges automatically
- Color-coded badges match filter types
- Support for "Past Due" filter with overdue task counting

### Dashboard UI Simplification
- **Removed redundant stats cards** at top of dashboard
- Metrics now integrated directly into filter buttons
- Cleaner interface with less visual redundancy
- Improved information density

### Dashboard UI Improvements
- Fixed edit button placement - now in top-left corner of each task item
- Removed inline styles for better maintainability
- Implemented proper flexbox layout structure
- Fixed button contrast issues with theme-aware CSS variables
- Enhanced metadata tag visibility with high-contrast colors
- Added support for Obsidian's built-in priority syntax

### Task Loading Enhancements
- Extended task scanning to entire vault (not limited to Meetings folder)
- Added support for daily notes and all markdown files
- Improved "My Tasks" filtering logic
- Added toggle button for My Tasks/All Tasks views
- Support for comma-separated names in "My Tasks" filter

### Code Quality & Testing
- Removed debug borders and unnecessary styles
- Consolidated CSS files (dashboard.css merged into styles.css)
- Improved DOM structure for better performance
- Enhanced TypeScript typing throughout
- Fixed all TypeScript compilation errors in test suite
- Updated test mocks for GmailMcpService integration

## Future Enhancements
- [ ] Real-time email monitoring
- [ ] Support for more meeting platforms
- [ ] Bulk task operations
- [ ] Task synchronization with external systems
- [ ] Advanced analytics
- [ ] Custom templates
- [ ] Drag-and-drop task reordering
- [ ] Task dependencies and subtasks

## Debugging Tips
- Enable console: Ctrl+Shift+I (Dev Tools)
- Check plugin settings for API connection status
- Review created notes for extraction quality
- Use fallback mode to test without Claude API
- Check localhost:3002/gmail/health for Gmail MCP status