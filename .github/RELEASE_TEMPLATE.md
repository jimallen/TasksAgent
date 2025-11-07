# 🎉 [Release Title]

Version X.X.X brings [brief description of the main feature/change]

## 🚀 New Features

### [Feature Name]
- **Feature highlight** - Description
- **Another highlight** - Description
- **More details** - Specific improvements

## 🐛 Bug Fixes

- Fixed [issue description]
- Resolved [problem description]

## 🔧 Improvements

- Enhanced [component] for better [benefit]
- Optimized [feature] to improve [metric]

## 🧪 Testing

- **X new tests** added
- **Total tests: X** - All passing ✅
- Coverage: [coverage metrics]

## 📦 Installation

### Option 1: One-Line Install (Easiest)

```bash
curl -fsSL https://raw.githubusercontent.com/jimallen/TasksAgent/master/install.sh | bash
```

Works on macOS, Linux, and Windows (Git Bash). The installer will:
- Download the latest release automatically
- Find your Obsidian vaults
- Install the plugin files
- Guide you through setup

### Option 2: Manual Installation

Download the release assets below and place them in your vault's plugin folder:
- `main.js` - Plugin code
- `manifest.json` - Plugin metadata
- `styles.css` - UI styles

**Steps:**
1. Download all three files from the Assets section below
2. Navigate to `<your-vault>/.obsidian/plugins/meeting-tasks/`
3. Copy the downloaded files to that folder
4. Restart Obsidian or reload with `Ctrl/Cmd + R`
5. Enable the plugin in Settings → Community Plugins

### Option 3: Clone and Deploy (For Developers)

```bash
git clone https://github.com/jimallen/TasksAgent.git
cd TasksAgent
npm install
npm run build
npm run deploy
```

The interactive deploy script will find your vaults and install automatically.

## 🔧 Setup

1. **Configure API Keys** in plugin settings:
   - **Claude API**: Get from [Anthropic Console](https://console.anthropic.com/settings/keys)
   - **Google OAuth**: Follow the [OAuth Setup Guide](https://github.com/jimallen/TasksAgent/blob/master/docs/google-oauth-setup.md)

2. **Gmail Labels**: Configure which labels to monitor (e.g., "transcript, action")

3. **Test the plugin**: Use `Cmd/Ctrl + Shift + M` to process emails

## 📝 Full Changelog

See [CHANGELOG.md](https://github.com/jimallen/TasksAgent/blob/master/CHANGELOG.md) for complete details.

## 📚 Documentation

- [Dashboard User Guide](https://github.com/jimallen/TasksAgent/blob/master/docs/DASHBOARD_GUIDE.md)
- [Google OAuth Setup](https://github.com/jimallen/TasksAgent/blob/master/docs/google-oauth-setup.md)
- [System Architecture](https://github.com/jimallen/TasksAgent/blob/master/docs/system-architecture.md)
- [Build & Deployment](https://github.com/jimallen/TasksAgent/blob/master/docs/BUILD_DEPLOYMENT.md)

---

**Need Help?** Check the [documentation](https://github.com/jimallen/TasksAgent) or [open an issue](https://github.com/jimallen/TasksAgent/issues).
