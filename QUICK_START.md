# Quick Start Guide for Developers

## 🚀 Get Started in 5 Minutes

**Prerequisites:**
- Python 3.10+ installed
- Google Workspace MCP installed (see [main project setup](../docs/GMAIL_SETUP.md))
- OAuth credentials in `~/.celebrate-oracle/credentials.json`

### 1. Initial Setup
```bash
# Clone and navigate to plugin directory
cd /path/to/TasksAgent/obsidian-plugin

# Install dependencies
npm install
```

### 2. Quick Build
```bash
# For testing (fastest)
node esbuild.config.js production

# For debugging (with source maps)
node esbuild.config.js development
```

### 3. Deploy to Obsidian
```bash
# Copy to your vault (adjust path as needed)
cp main.js manifest.json styles.css ~/.obsidian/plugins/meeting-tasks/

# Restart Obsidian or press Ctrl+R / Cmd+R
```

## 📝 Common Development Tasks

### Making Changes
1. Edit TypeScript files in `src/`
2. Edit styles in `styles.css`
3. Build: `node esbuild.config.js production`
4. Deploy and test

### Type Checking
```bash
# Always run before committing
npm run typecheck
```

### Testing a Feature
```bash
# Development build with logging
node esbuild.config.js development

# Deploy and watch console
# Ctrl+Shift+I in Obsidian for DevTools
```

## 🔧 Available NPM Scripts

| Command | Description | When to Use |
|---------|-------------|------------|
| `npm run dev` | Development build | Quick testing |
| `npm run build` | Production build with type checking | Before release |
| `npm run build:release` | Full release build | Publishing |
| `npm run lint` | TypeScript checking | Before commits |
| `npm run clean` | Remove build artifacts | Fresh start |

## 📁 Key Files

| File | Purpose | Edit When |
|------|---------|-----------| 
| `src/main-daemon-style.ts` | Main plugin logic | Adding features |
| `src/taskDashboard.ts` | Dashboard view | UI changes |
| `src/claudeExtractor.ts` | AI extraction | Task parsing |
| `styles.css` | All styling | Visual changes |
| `manifest.json` | Plugin metadata | Version updates |

## 🐛 Quick Debugging

### Plugin Not Loading
```bash
# Check manifest.json is valid JSON
cat manifest.json | jq .

# Ensure all files are present
ls main.js manifest.json styles.css

# Check Obsidian console for errors
# Ctrl+Shift+I → Console tab
```

### Styles Not Working
```bash
# Rebuild and ensure styles.css is copied
node esbuild.config.js production
cp styles.css ~/.obsidian/plugins/meeting-tasks/

# Force refresh Obsidian
# Ctrl+R / Cmd+R
```

### TypeScript Errors
```bash
# See detailed errors
npm run typecheck

# Common fix: reinstall types
npm install --save-dev @types/node obsidian
```

## 🚢 Release Checklist

1. **Update Version**
   - Edit `manifest.json` → `version`
   - Edit `package.json` → `version`

2. **Test & Build**
   ```bash
   npm run typecheck
   npm run build:release
   ```

3. **Create Package**
   ```bash
   mkdir -p dist
   cp main.js manifest.json styles.css dist/
   cd dist && zip -r ../meeting-tasks-v1.0.0.zip *
   ```

4. **Test in Clean Vault**
   - Create new vault
   - Install from zip
   - Verify all features work

## 📚 Need More Help?

- **Full Build Guide**: [BUILD_DEPLOYMENT.md](./docs/BUILD_DEPLOYMENT.md)
- **Architecture**: [system-architecture.md](./docs/system-architecture.md)
- **Project Guide**: [CLAUDE.md](./CLAUDE.md)
- **Main README**: [README.md](./README.md)

## 💡 Pro Tips

1. **Hot Reload**: Use `Ctrl+R` in Obsidian instead of restarting
2. **Console Logging**: Add `console.log()` statements, they show in DevTools
3. **Source Maps**: Use development build for better error traces
4. **CSS Variables**: Use Obsidian's CSS variables for theme compatibility
5. **Type Safety**: Always define types for better IntelliSense