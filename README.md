# Obsidian Meeting Tasks Plugin (Direct Gmail API)

Automatically fetch meeting transcripts from Gmail, extract actionable tasks using Claude AI, and create organized meeting notes in Obsidian - all without requiring a separate daemon process.

## Features

- **Direct Gmail Integration**: Connect directly to Gmail API without external services
- **OAuth 2.0 Authentication**: Secure authentication with your Google account
- **AI Task Extraction**: Uses Claude AI to intelligently extract tasks from meeting transcripts
- **Task Dashboard**: Visual dashboard with priority-based task organization
- **No Daemon Required**: Everything runs within Obsidian - no separate processes

## Setup Guide

### 1. Install the Plugin

1. Download the plugin files (`main.js`, `manifest.json`, `styles.css`)
2. Place them in your vault's `.obsidian/plugins/meeting-tasks/` folder
3. Enable the plugin in Obsidian settings

### 2. Configure Google OAuth

You'll need to create your own Google Cloud project to use Gmail API:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Gmail API:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Desktop app" as application type
   - Download the credentials JSON
5. Copy the Client ID and Client Secret to plugin settings

### 3. Configure Plugin Settings

Open plugin settings in Obsidian:

1. **Google OAuth Settings**:
   - Paste your Client ID
   - Paste your Client Secret
   - Click "Authenticate" to connect to Gmail

2. **Claude AI Settings** (optional):
   - Add your Anthropic API key for AI task extraction
   - Choose preferred Claude model

3. **Email Processing**:
   - Set lookback hours (how far back to search)
   - Configure Gmail labels to filter (default: "transcript")

4. **Organization**:
   - Set notes folder location
   - Configure dashboard preferences

## Usage

### Processing Emails

- **Command Palette**: `Cmd/Ctrl + P` → "📧 Process meeting emails now"
- **Keyboard Shortcut**: `Cmd/Ctrl + Shift + M`
- **Ribbon Icon**: Click the mail icon in the left sidebar
- **Settings**: Use "Process" button in plugin settings

### Task Dashboard

- **Open Dashboard**: Click dashboard icon or use command palette
- **Filter Tasks**: Use priority, date, and assignee filters
- **My Tasks View**: Toggle to show only tasks assigned to you
- **Edit Tasks**: Click edit button on any task to modify

## Authentication Flow

1. Click "Authenticate" in settings
2. Browser opens Google authorization page
3. Sign in and grant permissions
4. Copy the authorization code
5. Paste code in Obsidian modal
6. Plugin saves refresh token for future use

## Features

### Direct Gmail API
- No external services or daemons needed
- OAuth 2.0 with refresh token support
- Automatic token refresh when expired
- Rate limiting and error handling

### Task Extraction
- Powered by Claude AI (3.5 Haiku, Sonnet 4, or Opus 4.1)
- Extracts tasks with assignees and priorities
- Identifies key decisions and next steps
- Confidence scoring for extracted information

### Meeting Notes
- Organized by date and subject
- Includes participants, decisions, and action items
- Tasks formatted with Obsidian checkbox syntax
- Supports custom metadata and tags

## Troubleshooting

### Gmail Not Connecting
- Ensure OAuth credentials are correct
- Check that Gmail API is enabled in Google Cloud Console
- Try re-authenticating if token expired

### Tasks Not Extracting
- Verify Anthropic API key is set
- Check Claude API usage limits
- Meeting notes will still be created without AI extraction

### Authentication Issues
- Make sure redirect URI is set to `urn:ietf:wg:oauth:2.0:oob`
- Clear authentication and re-authenticate if needed
- Check Google Cloud Console for any API restrictions

## Privacy & Security

- OAuth tokens stored locally in Obsidian vault settings
- No data sent to external servers except Gmail and Claude APIs
- All processing happens locally within Obsidian
- Credentials never leave your device

## Requirements

- Obsidian v0.15.0 or higher
- Google account with Gmail access
- Google Cloud project with Gmail API enabled
- (Optional) Anthropic API key for AI features

## Support

For issues or questions:
- Check the troubleshooting section above
- Review Google Cloud Console for API errors
- Ensure all credentials are properly configured

## License

MIT