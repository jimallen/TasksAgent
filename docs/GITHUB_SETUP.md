# GitHub Repository Setup Guide

Complete checklist for publishing your repository with optimal discoverability and professional presentation.

## 🚀 Repository Creation

### 1. Create Repository
- **Repository Name:** `obsidian-meeting-tasks`
- **Description:** AI-powered Gmail task extraction with intelligent clustering for Obsidian
- **Visibility:** ✅ Public
- **Initialize:** ❌ Don't initialize with README (you already have one)

### 2. Push Existing Code

```bash
# If not already a git repository
git init

# Add remote (replace jimallen with your GitHub username)
git remote add origin https://github.com/jimallen/obsidian-meeting-tasks.git

# Stage all files
git add .

# Review what will be committed
git status

# Create initial commit
git commit -m "feat: initial public release - AI task extraction plugin for Obsidian

- AI-powered task clustering with persistent storage
- Dynamic label processor architecture
- Claude AI integration for intelligent extraction
- Interactive dashboard with multi-filter support
- Gmail OAuth integration with automatic sync

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to GitHub
git push -u origin master
```

## 📝 Repository Settings

### About Section

Navigate to repository homepage → Click ⚙️ gear icon next to "About"

**Description:**
```
AI-powered Gmail task extraction with intelligent clustering for Obsidian. Automatic meeting note creation, task organization, and visual dashboard with multi-filter support.
```

**Website:** (Optional)
```
https://github.com/jimallen/obsidian-meeting-tasks
```

**Topics:** (12 recommended)
```
obsidian-plugin
obsidian
task-management
ai
claude
gmail
gmail-api
oauth
typescript
productivity
meeting-notes
task-extraction
```

**Checkboxes:**
- ✅ Issues
- ✅ Releases (create your first release)
- ✅ Packages (if publishing to npm)

## 🏷️ Topics Configuration

Add these topics for maximum discoverability:

### Primary Topics (Must Have)
- `obsidian-plugin` - Most important for Obsidian users
- `obsidian` - General Obsidian ecosystem
- `task-management` - Core functionality
- `ai` - AI-powered features

### Technology Topics
- `claude` - Claude AI integration
- `typescript` - Language
- `gmail` - Gmail integration
- `oauth` - Authentication method

### Feature Topics
- `task-extraction` - Key feature
- `meeting-notes` - Use case
- `productivity` - Category
- `gmail-api` - Technical integration

## 📦 Create First Release

### Step 1: Tag Current Version

```bash
# Create annotated tag matching manifest.json version
git tag -a v3.2.0 -m "v3.2.0 - AI Task Clustering & Enhanced Dashboard

Features:
- AI-powered task clustering with persistent storage
- Dynamic label processor architecture
- Enhanced dashboard with multi-filter support
- Smart vs Force re-clustering modes
- Editable cluster titles
- Comprehensive documentation

See CHANGELOG for full details."

# Push tag to GitHub
git push origin v3.2.0
```

### Step 2: Create Release on GitHub

1. Navigate to: `https://github.com/jimallen/obsidian-meeting-tasks/releases/new`
2. **Choose tag:** `v3.2.0`
3. **Release title:** `v3.2.0 - AI Task Clustering & Enhanced Dashboard`

**Description:**
```markdown
## 🎉 First Public Release!

This release brings powerful AI-driven task management to Obsidian with automatic clustering and intelligent extraction from Gmail.

### ✨ Key Features

- **🧩 AI Task Clustering** - Automatically groups similar/related tasks
- **📊 Visual Dashboard** - Interactive task management with filters
- **🤖 Claude AI Integration** - Intelligent task extraction
- **⚡ Dynamic Label Processing** - Unlimited email type support
- **📁 Smart Organization** - Automatic folder structure

### 📦 Installation

**One-line install (easiest):**
\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/jimallen/obsidian-meeting-tasks/master/install.sh | bash
\`\`\`

**OR download manually:**
1. Download `main.js`, `manifest.json`, and `styles.css` from the assets below
2. Create folder: `<vault>/.obsidian/plugins/meeting-tasks/`
3. Copy files to that folder
4. Enable plugin in Obsidian settings

**OR** use the [interactive deployment script](https://github.com/jimallen/obsidian-meeting-tasks#installation):
\`\`\`bash
git clone https://github.com/jimallen/obsidian-meeting-tasks.git
cd obsidian-meeting-tasks
npm install
npm run deploy
\`\`\`

### 📚 Getting Started

1. [Google OAuth Setup](https://github.com/jimallen/obsidian-meeting-tasks/blob/master/docs/google-oauth-setup.md) - Required for Gmail integration
2. Configure plugin settings with your API keys
3. Run "Process meeting emails" command

### 🔗 Links

- [Full Documentation](https://github.com/jimallen/obsidian-meeting-tasks#readme)
- [Example Outputs](https://github.com/jimallen/obsidian-meeting-tasks/tree/master/examples)
- [System Architecture](https://github.com/jimallen/obsidian-meeting-tasks/blob/master/docs/system-architecture.md)

### 🐛 Found an Issue?

[Report it here](https://github.com/jimallen/obsidian-meeting-tasks/issues)
```

4. **Attach assets:** Upload `main.js`, `manifest.json`, `styles.css` from your build
5. Click **Publish release**

## ⚙️ Repository Configuration

### Enable Issues
Settings → Features → ✅ Issues

Create issue templates (optional):

`.github/ISSUE_TEMPLATE/bug_report.md`
`.github/ISSUE_TEMPLATE/feature_request.md`

### Add License Badge to README
Already done! ✅ (MIT License badge in README)

### Configure Branch Protection (Optional)
Settings → Branches → Add rule for `master`:
- ✅ Require pull request reviews
- ✅ Require status checks to pass (if you add CI/CD)

## 🎯 Social Media Card

GitHub automatically generates a social preview card, but you can customize it:

Settings → General → Social Preview → Upload image

**Recommended dimensions:** 1280×640 pixels

Create a simple card showing:
- Plugin name
- Key feature (AI Task Clustering)
- Obsidian logo
- Your name

**Tools:**
- [Canva](https://www.canva.com/) - Free design tool
- [Figma](https://www.figma.com/) - Professional design

## 📊 Add Shields/Badges (Optional)

Add to README below title for professional look:

```markdown
![GitHub release](https://img.shields.io/github/v/release/jimallen/obsidian-meeting-tasks)
![GitHub downloads](https://img.shields.io/github/downloads/jimallen/obsidian-meeting-tasks/total)
![GitHub stars](https://img.shields.io/github/stars/jimallen/obsidian-meeting-tasks)
![License](https://img.shields.io/badge/license-MIT-green)
```

## 🌟 Promotion Strategies

### Obsidian Community
1. Share in [Obsidian Forum](https://forum.obsidian.md/) under "Share & showcase"
2. Post in [Obsidian Discord](https://discord.gg/obsidianmd) #plugin-dev channel
3. Consider submitting to [Obsidian Plugin Directory](https://github.com/obsidianmd/obsidian-releases)

### Reddit
- r/ObsidianMD
- r/productivity
- r/ChatGPT (AI angle)

### Twitter/LinkedIn
Share with hashtags:
- #Obsidian
- #ProductivityTools
- #AI
- #ClaudeAI

## ✅ Final Checklist

Before going public, verify:

- [ ] ✅ Repository is public
- [ ] ✅ README.md is complete with examples
- [ ] ✅ License file present (MIT)
- [ ] ✅ .gitignore excludes sensitive data
- [ ] ✅ No credentials in git history
- [ ] ✅ Author attribution correct
- [ ] ✅ Topics added for discoverability
- [ ] ✅ About section filled out
- [ ] ✅ First release created (v3.2.0)
- [ ] ✅ Issues enabled
- [ ] 📸 Screenshots captured (when ready)
- [ ] 🎨 Social preview image (optional)

## 🚦 Post-Launch

### Monitor
- GitHub Issues for bug reports
- Stars/forks for interest level
- Traffic analytics (Settings → Insights → Traffic)

### Maintain
- Respond to issues promptly
- Consider adding CONTRIBUTING.md
- Tag future releases consistently
- Update CHANGELOG.md

### Grow
- Write blog post about building it
- Create demo video
- Engage with users who star the repo
- Consider adding to Product Hunt

---

**Congratulations! Your repository is ready for open source! 🎉**
