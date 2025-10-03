# Obsidian Meeting Tasks Plugin

> Automatically extract actionable tasks from Gmail meeting transcripts using Claude AI and create organized meeting notes in Obsidian.

![Version](https://img.shields.io/badge/version-3.1.0-blue)
![Obsidian](https://img.shields.io/badge/Obsidian-v0.15.0+-purple)
![License](https://img.shields.io/badge/license-MIT-green)

## 🌟 Features

- **🧩 AI Task Clustering** - Automatically groups similar/related tasks with persistent storage
- **⚡ Dynamic Label Processing** - Add unlimited email types via configuration
- **🤖 AI Task Extraction** - Claude intelligently extracts tasks, assignees, and priorities
- **📊 Visual Dashboard** - Interactive task management with cluster view and filtering
- **📁 Smart Organization** - Automatic folder structure (TaskAgent/Label/YYYY/MM/)
- **♻️ Email Reprocessing** - Update notes with improved extraction logic

## 📚 Documentation

- [Google OAuth Setup Guide](./docs/google-oauth-setup.md) - **Start here!** Step-by-step Google Cloud setup
- [System Architecture](./docs/system-architecture.md) - Technical architecture and diagrams
- [Build & Deployment Guide](./docs/BUILD_DEPLOYMENT.md) - Development and deployment instructions
- [CLAUDE.md](./CLAUDE.md) - AI assistant instructions for contributors

## 🚀 Quick Start

### Installation

#### Option 1: Interactive Deployment (Recommended)
```bash
npm install
npm run deploy
```
The interactive script will find your Obsidian vaults and install the plugin automatically.

#### Option 2: Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css`
2. Create folder: `<vault>/.obsidian/plugins/meeting-tasks/`
3. Copy the files to that folder
4. Enable plugin in Obsidian settings

### Configuration

1. **Google OAuth Setup**
   - Follow the [Google OAuth Setup Guide](./docs/google-oauth-setup.md) for detailed instructions
   - Quick summary: Create project → Enable Gmail API → Configure OAuth → Get credentials
   - Copy Client ID and Secret to plugin settings

2. **Claude AI Setup** (Optional)
   - Get API key from [Anthropic](https://console.anthropic.com/)
   - Add to plugin settings
   - Choose model (Haiku, Sonnet, or Opus)

3. **Plugin Settings**
   - Set lookback time (e.g., "3d" for 3 days)
   - Configure Gmail labels (e.g., "transcript, action")
   - Configure label processors (maps labels to folders and extraction types)
   - Set base notes folder (default: "TaskAgent")

## 💡 Usage

### Process Emails
- **Command Palette**: `Cmd/Ctrl + P` → "📧 Process meeting emails"
- **Keyboard Shortcut**: `Cmd/Ctrl + Shift + M`
- **Ribbon Icon**: Click the mail icon
- **Reprocess**: Click "🔄 Reprocess this email" link at bottom of any meeting note

### Task Dashboard
- **Cluster view**: See grouped related tasks with AI-powered suggestions
- **Auto-clustering**: Tasks are automatically clustered during email import
- **Manual control**: Re-cluster or show all tasks via button toggle
- View all tasks from meeting notes
- Filter by priority, date, or assignee (filters work in clustered view)
- Toggle "My Tasks" view
- Click to complete tasks
- Edit task details inline

See [System Architecture](./docs/system-architecture.md) for detailed architecture diagrams.

## 🔧 Development

```bash
npm install        # Install dependencies
npm run dev        # Development build
npm run build      # Production build
npm run deploy     # Deploy to vault
```

See [Build & Deployment Guide](./docs/BUILD_DEPLOYMENT.md) for details.

## ✨ What's New in v3.1

### AI-Powered Task Clustering
- **Automatic clustering**: Runs in parallel during email import
- **Smart grouping**: Identifies duplicates, similar tasks, and related projects
- **Persistent storage**: Cluster IDs saved in task lines (`🧩 cluster:abc123`)
- **Auto-restore**: Dashboard automatically rebuilds clusters from saved IDs
- **Combination suggestions**: Claude recommends merging tasks with confidence scores
- **Full filter support**: All filters work seamlessly in clustered view

### v3.0 Features
- Dynamic label processor architecture - add email types via configuration
- Dual extraction modes for meetings vs action items
- Single base folder with label subfolders
- Vault-based caching scales to 100K+ emails

## 🐛 Troubleshooting

- **Authentication fails**: Verify OAuth credentials, ensure Gmail API is enabled
- **Tasks not extracting**: Check Anthropic API key and usage limits
- **Changes not showing**: Reload Obsidian (`Cmd/Ctrl + R`)

## 📄 License

MIT License