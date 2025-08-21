# Development Guide - Obsidian Meeting Tasks Plugin

## Local Development Setup

### Prerequisites

- Node.js 16+ and npm
- Obsidian installed locally
- A test vault for development
- Git for version control

### Initial Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/TasksAgent.git
cd TasksAgent/obsidian-plugin
```

2. **Install dependencies**
```bash
npm install
```

3. **Create a test vault** (if you don't have one)
```bash
# Create a new vault for testing
mkdir -p ~/ObsidianTestVault/.obsidian/plugins/meeting-tasks
```

## Development Workflow

### Method 1: Direct Development in Vault (Recommended)

1. **Link the plugin to your test vault**
```bash
# Option A: Symbolic link (Linux/Mac)
ln -s $(pwd) ~/ObsidianTestVault/.obsidian/plugins/meeting-tasks

# Option B: On Windows (run as Administrator)
mklink /D "C:\Users\YourName\ObsidianTestVault\.obsidian\plugins\meeting-tasks" "%CD%"
```

2. **Build in development mode**
```bash
npm run dev
# This watches for changes and auto-rebuilds
```

3. **Enable the plugin in Obsidian**
   - Open your test vault in Obsidian
   - Go to Settings → Community Plugins
   - Turn off "Safe Mode"
   - Find "Meeting Tasks" in the list
   - Enable the plugin

4. **Reload plugin after changes**
   - Press `Ctrl+R` (or `Cmd+R` on Mac) in Obsidian to reload
   - Or use the "Reload app without saving" command

### Method 2: Manual Copy for Testing

1. **Build the plugin**
```bash
npm run build:dev
```

2. **Copy files to vault**
```bash
# Linux/Mac
cp main.js manifest.json styles.css ~/ObsidianTestVault/.obsidian/plugins/meeting-tasks/

# Windows
copy main.js manifest.json styles.css C:\Users\YourName\ObsidianTestVault\.obsidian\plugins\meeting-tasks\
```

3. **Reload Obsidian** (`Ctrl+R` / `Cmd+R`)

### Method 3: Using the Build Script

1. **Set your vault path**
```bash
export OBSIDIAN_VAULT_PATH=~/ObsidianTestVault
```

2. **Build and deploy**
```bash
# Build and copy to vault
npm run build:dev
cp dist/* $OBSIDIAN_VAULT_PATH/.obsidian/plugins/meeting-tasks/
```

## Hot Reload Setup

For faster development with automatic reloading:

1. **Install the Hot Reload plugin** in Obsidian
   - Search for "Hot Reload" in Community Plugins
   - Install and enable it

2. **Configure esbuild for watch mode**
```bash
# The dev script already includes watch mode
npm run dev
```

3. **The plugin will auto-reload** when you save changes

## Development Commands

```bash
# Start development build with watch mode
npm run dev

# Build for development (one-time)
npm run build:dev

# Build for production
npm run build:release

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Check TypeScript types
npm run lint

# Clean build artifacts
npm run clean
```

## Testing the Plugin

### 1. Setup TasksAgent Service

```bash
# In the main TasksAgent directory
cd ~/Code/TasksAgent
npm install
npm start
```

### 2. Configure Plugin Settings

1. Open Settings → Meeting Tasks
2. Set minimal configuration:
   ```
   Service URL: http://localhost:3000
   WebSocket URL: ws://localhost:3000
   Anthropic API Key: [your-key]
   Target Folder: TestMeetings
   ```

### 3. Create Test Data

Create a test meeting email in Gmail or use the test command:

```javascript
// In Obsidian Developer Console (Ctrl+Shift+I)
app.plugins.plugins['meeting-tasks'].createTestNote()
```

### 4. Test Core Features

- [ ] **Connection Test**: Click "Test Connection" in settings
- [ ] **Manual Check**: Click ribbon icon or use `Ctrl+M`
- [ ] **WebSocket**: Enable in settings and check status bar
- [ ] **Note Creation**: Process a test email
- [ ] **Scheduler**: Enable auto-check and verify timing
- [ ] **Error Handling**: Test with invalid API key

## Debugging

### Enable Debug Mode

1. Go to Settings → Meeting Tasks → Advanced
2. Enable "Debug Mode"
3. Set "Log Level" to "debug"

### View Console Logs

```javascript
// Open Developer Console
Ctrl+Shift+I (Windows/Linux)
Cmd+Option+I (Mac)

// Filter plugin logs
console.log(app.plugins.plugins['meeting-tasks'])
```

### Check Plugin State

```javascript
// Get plugin instance
const plugin = app.plugins.plugins['meeting-tasks'];

// Check settings
console.log(plugin.settings);

// Check service status
console.log(plugin.scheduler?.getState());
console.log(plugin.webSocketManager?.getStats());

// View cache
console.log(plugin.cacheService?.getStats());

// Check last error
console.log(plugin.errorHandler?.getStats());
```

### Log Files

Logs are stored in:
```
.obsidian/plugins/meeting-tasks/logs/
├── meeting-tasks-YYYY-MM-DD.log
└── meeting-tasks-YYYY-MM-DD-1.log (rotated)
```

### Common Issues

**Plugin won't load:**
```bash
# Check manifest.json is valid
cat manifest.json | jq .

# Verify main.js exists
ls -la main.js

# Check console for errors
# Open Developer Console in Obsidian
```

**Build errors:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npm run lint
```

**WebSocket won't connect:**
```javascript
// Test WebSocket manually
const ws = new WebSocket('ws://localhost:3000');
ws.onopen = () => console.log('Connected');
ws.onerror = (e) => console.error('Error:', e);
```

## Performance Profiling

### Memory Usage

```javascript
// Check plugin memory
console.log(performance.memory);

// Monitor cache size
plugin.cacheService?.getStats();
```

### API Performance

```javascript
// Enable performance monitoring
plugin.logger?.startTimer('api-call');
// ... operation ...
plugin.logger?.endTimer('api-call');

// View metrics
plugin.logger?.getPerformanceMetrics();
```

## Release Process

### 1. Update Version

```bash
# Update version in manifest.json and package.json
npm version patch  # or minor/major
```

### 2. Run Tests

```bash
npm test
npm run lint
```

### 3. Build Release

```bash
npm run build:release
# Creates dist/ folder and .zip file
```

### 4. Test Release Build

```bash
# Install in a fresh vault
unzip meeting-tasks-*.zip -d ~/TestVault/.obsidian/plugins/meeting-tasks-release/
# Test all features
```

### 5. Create GitHub Release

```bash
git tag v1.0.0
git push origin v1.0.0

# Upload the .zip file to GitHub release
```

## VSCode Setup

### Recommended Extensions

Create `.vscode/extensions.json`:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-tsc-compiler-plugin",
    "christian-kohler.path-intellisense",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

### Debug Configuration

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["test"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Tasks Configuration

Create `.vscode/tasks.json`:
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Build Dev",
      "type": "npm",
      "script": "dev",
      "isBackground": true,
      "problemMatcher": "$tsc-watch",
      "group": {
        "kind": "build",
        "isDefault": true
      }
    },
    {
      "label": "Test",
      "type": "npm",
      "script": "test",
      "group": {
        "kind": "test",
        "isDefault": true
      }
    }
  ]
}
```

## Contributing Guidelines

### Code Style

- Use TypeScript strict mode
- Follow existing patterns in the codebase
- Add JSDoc comments for public methods
- Keep files under 500 lines

### Testing

- Write tests for new features
- Maintain >80% code coverage
- Test error cases
- Include integration tests for API calls

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Ensure all tests pass
5. Update documentation
6. Submit PR with clear description

## Useful Resources

- [Obsidian Plugin API](https://github.com/obsidianmd/obsidian-api)
- [Plugin Developer Docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Obsidian Forum](https://forum.obsidian.md/c/developers/8)

---

For questions or issues, please open a GitHub issue or discussion.