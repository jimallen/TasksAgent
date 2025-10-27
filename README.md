# Obsidian Meeting Tasks Plugin

> Automatically extract actionable tasks from Gmail meeting transcripts using Claude AI and create organized meeting notes in Obsidian.

![Version](https://img.shields.io/badge/version-3.2.2-blue)
![Obsidian](https://img.shields.io/badge/Obsidian-v0.15.0+-purple)
![License](https://img.shields.io/badge/license-MIT-green)

**Requirements:** Anthropic Claude API key + Google OAuth credentials (free tiers available)

## 🌟 Features

- **🧩 AI Task Clustering** - Automatically groups similar/related tasks with persistent storage
- **⚡ Dynamic Label Processing** - Add unlimited email types via configuration
- **🤖 AI Task Extraction** - Claude intelligently extracts tasks, assignees, and priorities
- **📊 Visual Dashboard** - Interactive task management with cluster view and filtering
- **📁 Smart Organization** - Automatic folder structure (TaskAgent/Label/YYYY/MM/)
- **♻️ Email Reprocessing** - Update notes with improved extraction logic

### How Label Processing Works

The plugin monitors **Gmail labels** you configure and processes emails differently based on type:

- **`transcript` label** → Meeting transcripts with conversation-style extraction
- **`action` label** → Action item emails with task-focused extraction
- **Add your own labels** → Configure any Gmail label to create custom workflows

**Example:** Apply the `action` label to an email in Gmail, and the plugin will:
1. Detect the label during next sync
2. Extract action items using specialized prompts
3. Create a note in `TaskAgent/Action/YYYY/MM/`
4. Add tasks to your dashboard

No code changes needed - just configure labels in plugin settings!

## 📚 Documentation

- [Google OAuth Setup Guide](./docs/google-oauth-setup.md) - **Start here!** Step-by-step Google Cloud setup
- [System Architecture](./docs/system-architecture.md) - Technical architecture and diagrams
- [Build & Deployment Guide](./docs/BUILD_DEPLOYMENT.md) - Development and deployment instructions
- [Example Outputs](./examples/) - Sample meeting notes, clusters, and task formats
- [CLAUDE.md](./CLAUDE.md) - AI assistant instructions for contributors

## 📋 Example Output

### Meeting Note with Extracted Tasks

```markdown
---
title: Q1 Planning Meeting - Product Team
emailId: 19960e976514fa1d
label: transcript
gmailUrl: https://mail.google.com/mail/u/0/#inbox/19960e976514fa1d
---

# Q1 Planning Meeting - Product Team

**Email:** [View in Gmail](https://mail.google.com/...)
**Date:** 2025-01-15

## Action Items

### 🔴 High Priority
- [ ] Review PRD for new dashboard features [[@Sarah]] 📅 2025-01-20 🔴 ⚠️ 92% #product
  - Context: Need feedback before dev kickoff next week
  > "Sarah, can you review the PRD by Friday?"

- [ ] Update API rate limits in production [[@Dev Team]] 📅 2025-01-18 🔴 🧩 cluster:api-work ⚠️ 88% #backend
  - Context: Current limits causing issues for enterprise customers

### 🟡 Medium Priority
- [ ] Document new clustering algorithm [[@Jim]] 📅 2025-01-25 🟡 🧩 cluster:docs ⚠️ 85% #documentation

- [ ] Schedule user interview sessions [[@UX Team]] 📅 2025-01-22 🟡 ⚠️ 78% #research
  - Context: Need 5 participants for dashboard usability study

## Next Steps
- Follow up on API performance metrics
- Review clustering feedback from beta users
```

### Dashboard - Clustered View

When you open the dashboard, AI automatically groups related tasks:

**📦 Cluster: API Performance & Scalability**
- Update API rate limits in production [[@Dev Team]]
- Monitor API response times [[@DevOps]]
- Implement caching layer [[@Backend Team]]

💡 *Claude suggests: These tasks are related to API infrastructure - consider combining into a single epic for coordinated deployment.*

**📦 Cluster: Q1 Documentation**
- Document new clustering algorithm [[@Jim]]
- Update README with v3.2 features [[@Jim]]
- Create video tutorial [[@Marketing]]

**📦 Cluster: User Research Initiative**
- Schedule user interview sessions [[@UX Team]]
- Prepare interview scripts [[@Sarah]]
- Recruit beta testers [[@Product]]

### Key Features Demonstrated

✅ **Smart Task Extraction** - Pulls assignees, dates, priorities from natural language
✅ **Cluster IDs** - Tasks tagged with `🧩 cluster:id` for persistent grouping
✅ **Confidence Scores** - `⚠️ 92%` shows AI extraction confidence
✅ **Context Preservation** - Keeps quotes and additional details
✅ **Gmail Integration** - Direct links back to source emails

## 🚀 Quick Start

### Installation

#### Option 1: One-Line Install (Easiest)
```bash
curl -fsSL https://raw.githubusercontent.com/jimallen/obsidian-meeting-tasks/master/install.sh | bash
```
Downloads and installs the plugin automatically. Works on macOS, Linux, and Windows (Git Bash).

#### Option 2: Clone and Deploy (For Developers)
```bash
git clone https://github.com/jimallen/obsidian-meeting-tasks.git
cd obsidian-meeting-tasks
npm install
npm run deploy
```
The interactive script will find your Obsidian vaults and install the plugin automatically.

#### Option 3: Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from [latest release](https://github.com/jimallen/obsidian-meeting-tasks/releases/latest)
2. Create folder: `<vault>/.obsidian/plugins/meeting-tasks/`
3. Copy the files to that folder
4. Enable plugin in Obsidian settings

### Configuration

**⚠️ Required API Keys:**
- **Anthropic Claude API** - For AI-powered task extraction
- **Google OAuth credentials** - For Gmail integration

1. **Claude AI Setup** (Required)
   - Get API key from [Anthropic Console](https://console.anthropic.com/) → [API Keys](https://console.anthropic.com/settings/keys)
   - Add to plugin settings: Settings → Community Plugins → Meeting Tasks
   - Choose model: `claude-sonnet-4` (recommended) or `claude-3-5-haiku` (faster/cheaper)
   - Free tier available, pay-as-you-go pricing

2. **Google OAuth Setup** (Required)
   - Follow the [Google OAuth Setup Guide](./docs/google-oauth-setup.md) for detailed instructions
   - Quick summary: Create project → Enable Gmail API → Configure OAuth → Get credentials
   - Copy Client ID and Secret to plugin settings

3. **Plugin Settings**
   - Set lookback time (e.g., "3d" for 3 days)
   - Configure Gmail labels (e.g., "transcript, action")
   - Configure label processors (maps labels to folders and extraction types)
   - Set base notes folder (default: "TaskAgent")

**Adding Custom Labels:**

Want to process different types of emails? Just add more labels!

1. In Gmail: Create a label (e.g., "standup", "reports")
2. Apply that label to emails you want processed
3. In plugin settings: Add the label to your configuration
4. Configure the folder name and extraction type (meeting or actionitem)

**Example configuration:**
```
Labels: transcript, action, standup
Processors:
- transcript → Transcript folder (meeting extraction)
- action → Action folder (action item extraction)
- standup → Standup folder (meeting extraction)
```

**Configuration Reference:**
- See [`data.json.example`](./data.json.example) for complete configuration structure
- All settings are managed through Obsidian's plugin settings UI
- The plugin creates `data.json` automatically with your credentials

## 💡 Usage

### Process Emails
- **Command Palette**: `Cmd/Ctrl + P` → "📧 Process meeting emails"
- **Keyboard Shortcut**: `Cmd/Ctrl + Shift + M`
- **Ribbon Icon**: Click the mail icon
- **Reprocess**: Click "🔄 Reprocess this email" link at bottom of any meeting note

### Task Dashboard
- **Instant view toggle**: Switch between task list and clustered view (no API calls)
- **Multi-filter support**: Select multiple filters simultaneously (High + Past Due, etc.)
- **Simplified filters**: 🔴 High, 🟡 Medium, ⏰ Past Due, 📅 This Week, 👥 Delegated, ✅ Done
- **Filter persistence**: Active filters maintained when switching views
- **My Tasks only**: Always shows only your assigned tasks (except delegated view)
- **Auto-clustering**: Tasks are automatically clustered during email import
- **Cluster view**: See grouped related tasks with AI-powered suggestions
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

## 🛠️ Development Methodology

This repository showcases not just the plugin code, but also the **AI-assisted development workflow** used to build it.

### BMAD Framework (`bmad/`)
The [BMAD (Better Method for Agile Development)](./bmad/README.md) framework orchestrates AI agents through structured workflows for the entire software development lifecycle. This directory contains:
- Specialized AI agents (PM, Architect, Developer, QA, etc.)
- Structured workflows for analysis, planning, and implementation
- Development methodology with scale-adaptive documentation

**Note:** BMAD is development-time tooling only and is NOT deployed with the plugin.

### Claude Code Configuration (`.claude/`)
Custom [Claude Code](https://claude.com/claude-code) configurations including:
- Custom slash commands for rapid development
- Agent configurations for specialized tasks
- BMAD framework integration commands

See [`.claude/README.md`](./.claude/README.md) for details.

### Why Include These?
Including development tooling demonstrates:
- Systematic approach to software development
- Professional AI-assisted workflows
- Documentation-first thinking
- Modern development practices

## ✨ What's New in v3.1+

### AI-Powered Task Clustering
- **Automatic clustering**: Runs in parallel during email import
- **Smart grouping**: Identifies duplicates, similar tasks, and related projects using **source email context**
- **Persistent storage**: Cluster IDs saved in task lines (`🧩 cluster:abc123`)
- **Auto-restore**: Dashboard automatically rebuilds clusters from saved IDs (shows normal view by default)
- **Instant toggle**: Switch between views without re-clustering
- **JSON auto-repair**: Automatically fixes truncated Claude responses
- **Combination suggestions**: Claude recommends merging tasks with confidence scores
- **Editable cluster titles**: Customize cluster names with modal editor (persisted separately)
- **Smart vs Force re-clustering**: Choose between incremental or complete re-analysis via dropdown
- **Progress notifications**: Real-time status updates during clustering process

### Enhanced Dashboard UI
- **Multi-filter support**: Select multiple filters (OR logic) - e.g., High + Past Due
- **Simplified filters**: 6 essential filters with emojis for clarity
- **Filter persistence**: Active filters maintained across view toggles
- **My Tasks only**: Removed toggle - always shows your tasks (except delegated view)
- **Instant view switching**: No API calls when toggling between list and cluster views
- **Unified task layout**: Both clustered and normal views use same card-based layout grouped by assignee
- **Split button UI**: Single re-cluster button with dropdown for smart/force modes

### v3.0 Features
- Dynamic label processor architecture - add email types via configuration
- Dual extraction modes for meetings vs action items
- Single base folder with label subfolders
- Vault-based caching scales to 100K+ emails

## 🐛 Troubleshooting

- **Authentication fails**: Verify OAuth credentials, ensure Gmail API is enabled
- **Tasks not extracting**: Check Anthropic API key and usage limits
- **Changes not showing**: Reload Obsidian (`Cmd/Ctrl + R`)

## 🧪 Testing

### Current Approach
This project currently uses **manual testing** with a structured validation workflow:

**Manual Test Process:**
1. **Build**: `npm run build` - Verify TypeScript compilation
2. **Deploy**: `npm run deploy` - Install to test vault
3. **OAuth Flow**: Test Gmail authentication and token refresh
4. **Email Processing**:
   - Process emails from both label types (transcript, action)
   - Verify task extraction accuracy
   - Test pagination for large email batches
5. **Dashboard Features**:
   - Test all filter combinations
   - Verify clustering functionality (smart and force modes)
   - Validate inline task editing
   - Test cluster title customization
6. **Edge Cases**:
   - Empty email results
   - Malformed email content
   - API rate limits and error handling
   - Token expiration scenarios

**Console Verification:** All testing includes monitoring browser DevTools (`Ctrl+Shift+I`) for errors and warnings.

### Future Roadmap
Automated test suite planned for future releases:
- Unit tests for core extraction logic
- Integration tests for Gmail/Claude API interactions
- E2E tests for dashboard interactions
- CI/CD pipeline with automated quality gates

**Why Manual Testing?** For a portfolio project focused on rapid iteration and AI-assisted development, manual testing provided faster feedback cycles during initial development. The BMAD methodology used here emphasizes working software over comprehensive test automation in early phases.

## 📄 License

MIT License