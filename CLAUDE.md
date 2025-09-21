# CLAUDE.md - Obsidian Meeting Tasks Plugin

## Project Overview
**Obsidian Meeting Tasks Plugin** - A standalone Obsidian plugin that directly fetches meeting emails from Gmail using OAuth, extracts actionable tasks using Claude AI, and creates structured meeting notes organized by year/month with a visual task dashboard. No external daemon required.

## Current Status
- ✅ **Production Ready** - Plugin fully functional with all features implemented
- ✅ **Standalone Operation** - Direct Gmail OAuth integration, no daemon required
- ✅ **Claude 4 Support** - Supports Claude 3.5 Haiku, Sonnet 4, and Opus 4.1
- ✅ **Task Dashboard** - Visual task management with filtering and statistics
- ✅ **Organized Notes** - Meeting notes in Meetings/year/month/ folder structure
- ✅ **Flexible Time Formats** - Lookback time supports hours, days, weeks, months (6h, 3d, 2w, 1M)
- ✅ **Email Reprocessing** - Ability to reprocess specific emails by ID
- ✅ **TypeScript Compliant** - Full TypeScript type checking enabled
- ✅ **UI Enhancements** - Edit buttons, proper flexbox layout, theme-aware styling
- ✅ **Priority Support** - Both custom emojis and Obsidian's built-in syntax

## 📐 Documentation

- **[Build & Deployment Guide](./docs/BUILD_DEPLOYMENT.md)** - Comprehensive build instructions

## Quick Start

### For Users
1. Install plugin in Obsidian
2. Configure settings:
   - Add your Anthropic API key for Claude AI
   - Set up Google OAuth credentials (Client ID and Secret)
   - Configure lookback time (e.g., "3d" for 3 days, "1M" for 1 month)
   - Set notes folder (default: "Meetings")
3. Authenticate with Gmail (one-time setup)
4. Process emails via:
   - Command Palette: `Cmd/Ctrl + P` → "📧 Process meeting emails now"
   - Keyboard Shortcut: `Cmd/Ctrl + Shift + M`
   - Ribbon Icon: Click the refresh icon
   - Quick Process: "⚡ Quick process (last 24 hours)" for recent emails

### For Developers
```bash
# Install dependencies
npm install

# Build plugin
npm run build
node esbuild.config.js production

# Deploy to vault
cp main.js manifest.json styles.css "/path/to/vault/.obsidian/plugins/meeting-tasks/"

# Reload Obsidian or use Ctrl/Cmd+R
```

## Key Files

### Core Plugin Files
- `src/main.ts` - Main plugin entry point with Gmail OAuth integration
- `src/claudeExtractor.ts` - Claude AI task extraction logic
- `src/taskDashboard.ts` - Task dashboard view component
- `src/gmailService.ts` - Direct Gmail API integration with OAuth

### Configuration Files
- `manifest.json` - Plugin metadata
- `esbuild.config.js` - Build configuration
- `styles.css` - Main plugin styles and dashboard styling
- `data.json` - Plugin settings and processed email tracking

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
- **Direct OAuth**: Built-in Gmail OAuth authentication
- **No External Dependencies**: Plugin handles all Gmail API calls directly
- **Smart Search**:
  - Multiple search patterns
  - Flexible date-based lookback (hours, days, weeks, months)
  - Deduplication of processed emails
- **Email Reprocessing**: Can reprocess specific emails by ID
- **Note Organization**: Creates year/month folder structure automatically

## Configuration

### Plugin Settings
```typescript
{
  // Email Processing
  lookbackTime: "1M",               // Flexible time format: 6h, 3d, 2w, 1M (default: 1 month)
  gmailLabels: "transcript",       // Gmail label to filter (default: 'transcript')

  // Claude AI
  anthropicApiKey: "sk-ant-...",   // Your API key
  claudeModel: "claude-3-5-haiku-20241022",  // Default model

  // Organization
  notesFolder: "Meetings",          // Where to store notes (creates year/month subdirectories)

  // Dashboard
  dashboardShowOnlyMyTasks: true,   // Filter to personal tasks
  dashboardMyName: "Jim Allen, the group",  // Your name(s) for filtering

  // Google OAuth (direct integration)
  googleClientId: "...",            // Your OAuth client ID
  googleClientSecret: "...",        // Your OAuth client secret
```

### Time Format Support
The lookback time now supports flexible formats:
- **Hours**: `6h`, `12h`, `24h`
- **Days**: `1d`, `3d`, `7d`
- **Weeks**: `1w`, `2w`, `4w`
- **Months**: `1M`, `3M`, `6M`

Examples: `"3d"` = 3 days, `"2w"` = 2 weeks, `"1M"` = 1 month

### Available Claude Models
- `claude-3-5-haiku-20241022` - Fast & economical (default)
- `claude-sonnet-4-20250514` - Balanced performance (Claude 4)
- `claude-opus-4-1-20250805` - Most capable (Claude 4)

### Meeting Note Organization
Meeting notes are automatically organized in a year/month folder structure:
```
Meetings/
├── 2025/
│   ├── 01/
│   │   ├── 2025-01-15-Notes-Team-Standup.md
│   │   └── 2025-01-20-Notes-Project-Review.md
│   └── 02/
│       └── 2025-02-01-Notes-Planning-Session.md
```

## Common Issues & Solutions

### Gmail Authentication
- Ensure Google OAuth credentials are configured in settings
- Complete the one-time authentication flow
- Token is stored locally in plugin data
- If authentication fails, try clearing token and re-authenticating

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
1. **Gmail Connection**: Check authentication status in settings
2. **Email Search**: Use "Process emails" command
3. **Task Extraction**: Review created meeting notes in year/month folders
4. **Dashboard**: Open via ribbon icon or command palette
5. **Email Reprocessing**: Use `reprocessEmailById()` function for specific emails

## Performance Notes
- Processes up to 100 emails per run
- Parallel processing in batches of 3-5 for optimal speed
- Truncates transcripts to 15,000 chars for Claude
- Caches processed email IDs to avoid duplicates
- Frontmatter-based tracking with vault-wide scanning
- Dashboard loads tasks on demand
- Minimal memory footprint (~50MB)

## Security Considerations
- **API Keys**: Stored locally in vault's `.obsidian` folder
- **OAuth Tokens**: Stored in plugin's data.json, never transmitted
- **No Cloud Storage**: All processing happens locally
- **Network**: Direct Gmail API calls, no intermediary servers

## Distribution
- Plugin is generic - no hardcoded personal data
- Default settings work for any user
- Configurable dashboard filtering
- Ready for Obsidian Community Plugins

## Recent Changes

### Performance & Cache Improvements (2025-09-21)
- **Increased Email Limit**: Max emails increased from 50 to 100 per processing run
- **Cache Synchronization**: Rename event handler now properly syncs cache when files are moved:
  - Files moved OUT of Meetings folder: emailId removed from cache
  - Files moved INTO Meetings folder: emailId added to cache (if exists)
  - Graceful handling of notes without emailId field
- **Parallel Processing**: Emails processed in parallel batches for 3x faster performance
- **Duplicate Prevention**: Frontmatter-based tracking prevents reprocessing of existing notes
- **Event Handlers**: Delete/rename events maintain cache consistency

### Standalone Plugin Architecture (2025-09-21)
- **Direct Gmail Integration**: Plugin now operates independently without daemon
- **OAuth Authentication**: Built-in Gmail OAuth flow within plugin
- **Folder Organization**: Meeting notes automatically organized in year/month structure
- **Flexible Time Formats**: Lookback time supports 6h, 3d, 2w, 1M formats
- **Email Reprocessing**: Added ability to reprocess specific emails by ID
- **Claude AI Integration**: Direct API calls from plugin, no proxy needed

### Command Palette Enhancements (2025-09-02)
- **New Commands**: Added user-friendly commands with emoji icons for better visibility
- **Keyboard Shortcut**: `Cmd/Ctrl + Shift + M` for quick email processing
- **Quick Process**: New 24-hour quick process command for recent emails only
- **Improved Feedback**: Better progress notifications with email counts and pluralization
- **Status Updates**: Real-time status bar updates during processing


### Filter Button Count Badges (2025-08-29)
- Added real-time count badges to all filter buttons
- Badges show total count regardless of active filter
- Counts update with 150ms debouncing for performance
- Zero counts hide badges automatically
- Color-coded badges match filter types
- Support for "Past Due" filter with overdue task counting

### Dashboard UI Simplification (2025-08-29)
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
