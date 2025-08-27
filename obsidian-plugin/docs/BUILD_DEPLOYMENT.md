# Build & Deployment Guide

## Overview

This guide provides comprehensive instructions for building, testing, and deploying the Obsidian Meeting Tasks Plugin.

## Prerequisites

- **Node.js**: v16.0.0 or higher
- **npm**: v7.0.0 or higher
- **Obsidian**: v1.0.0 or higher
- **Git**: For version control

## Build System

The plugin uses multiple build configurations depending on the use case:

### Build Tools
- **esbuild**: Fast JavaScript/TypeScript bundler
- **TypeScript**: Type checking and compilation
- **build.js**: Custom build script with validation

## Build Commands

### Development Build

```bash
# Quick development build (no type checking)
node esbuild.config.js

# Development build with source maps
node esbuild.config.js development
```

**Output**: `main.js` with inline source maps for debugging

### Production Build

```bash
# Production build (minified, optimized)
node esbuild.config.js production

# Alternative: using npm script
npm run build
```

**Output**: Minified `main.js` without source maps

### Build with Validation

```bash
# Full build with TypeScript checking and validation
node build.js

# This will:
# 1. Validate all required files exist
# 2. Run TypeScript type checking
# 3. Build with esbuild
# 4. Copy styles and manifest
```

### Type Checking Only

```bash
# Run TypeScript compiler without emitting files
npm run typecheck

# This is useful for CI/CD pipelines
```

## File Structure

### Source Files
```
obsidian-plugin/
├── src/
│   ├── main-daemon-style.ts    # Main plugin entry point
│   ├── claudeExtractor.ts      # AI task extraction
│   ├── taskDashboard.ts        # Dashboard view component
│   └── types/                  # TypeScript type definitions
├── styles.css                  # All plugin styles
├── manifest.json               # Plugin metadata
└── esbuild.config.js          # Build configuration
```

### Build Output
```
obsidian-plugin/
├── main.js                     # Compiled plugin (DO NOT EDIT)
├── styles.css                  # Copied from source
└── manifest.json              # Copied from source
```

## Deployment Process

### 1. Local Development Deployment

```bash
# Build the plugin
node esbuild.config.js production

# Copy to your development vault
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/meeting-tasks/

# Reload Obsidian (Ctrl/Cmd + R) or restart
```

### 2. Manual Deployment to Any Vault

```bash
# Create plugin directory if it doesn't exist
mkdir -p /path/to/vault/.obsidian/plugins/meeting-tasks

# Copy all required files
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/meeting-tasks/

# Enable plugin in Obsidian Settings → Community Plugins
```

### 3. Automated Deployment Script

Create a `deploy.sh` script for your vault:

```bash
#!/bin/bash
VAULT_PATH="/path/to/your/vault"
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/meeting-tasks"

# Build
echo "Building plugin..."
node esbuild.config.js production

# Create directory
mkdir -p "$PLUGIN_DIR"

# Deploy
echo "Deploying to $PLUGIN_DIR..."
cp main.js manifest.json styles.css "$PLUGIN_DIR/"

echo "✅ Deployment complete! Restart Obsidian to load changes."
```

### 4. Release Distribution

For distributing to other users:

```bash
# 1. Update version in manifest.json
# 2. Build production version
node esbuild.config.js production

# 3. Create release package
mkdir -p dist
cp main.js manifest.json styles.css dist/

# 4. Create zip for distribution
cd dist
zip -r ../meeting-tasks-v1.0.0.zip *
cd ..

# 5. Upload to GitHub Releases
```

## Build Configuration Details

### esbuild.config.js

```javascript
const esbuild = require('esbuild');
const process = require('process');

const prod = process.argv[2] === 'production';

esbuild.build({
    entryPoints: ['src/main-daemon-style.ts'],
    bundle: true,
    external: ['obsidian'],
    format: 'cjs',
    target: 'es2018',
    logLevel: 'info',
    sourcemap: prod ? false : 'inline',
    treeShaking: true,
    minify: prod,
    outfile: 'main.js',
}).catch(() => process.exit(1));
```

### TypeScript Configuration (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2018",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "jsx": "react",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "obsidian": ["node_modules/obsidian/obsidian.d.ts"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Troubleshooting

### Common Build Issues

#### 1. TypeScript Errors
```bash
# Run type checking to see errors
npm run typecheck

# Common fixes:
# - Check for missing type definitions
# - Ensure all imports are correct
# - Verify tsconfig.json settings
```

#### 2. Build Fails
```bash
# Clean and rebuild
rm -f main.js
npm install
node esbuild.config.js production

# Check Node version
node --version  # Should be v16+
```

#### 3. Plugin Not Loading in Obsidian
- Check console for errors: `Ctrl/Cmd + Shift + I`
- Verify manifest.json has correct structure
- Ensure all required files are in plugin folder
- Check Obsidian version compatibility

#### 4. Styles Not Applying
- Ensure styles.css is in the plugin folder
- Check for CSS syntax errors
- Verify CSS variables are defined
- Try clearing Obsidian cache and restarting

### Debug Build

For debugging issues:

```bash
# Build with source maps and no minification
node esbuild.config.js development

# Deploy to vault
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/meeting-tasks/

# Open Obsidian Developer Console
# Ctrl/Cmd + Shift + I
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Test

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'
        
    - name: Install dependencies
      run: npm install
      
    - name: Type check
      run: npm run typecheck
      
    - name: Build plugin
      run: node esbuild.config.js production
      
    - name: Upload artifacts
      uses: actions/upload-artifact@v2
      with:
        name: plugin-build
        path: |
          main.js
          manifest.json
          styles.css
```

## Version Management

### Updating Plugin Version

1. Update version in `manifest.json`:
```json
{
  "id": "meeting-tasks",
  "name": "Meeting Tasks",
  "version": "1.2.0",  // Update this
  "minAppVersion": "1.0.0",
  ...
}
```

2. Update version in `package.json`:
```json
{
  "name": "obsidian-meeting-tasks",
  "version": "1.2.0",  // Match manifest.json
  ...
}
```

3. Create git tag:
```bash
git tag v1.2.0
git push origin v1.2.0
```

## Best Practices

### Before Building
1. Run `npm run typecheck` to catch type errors
2. Test in development mode first
3. Update version numbers if releasing

### During Development
1. Use development builds with source maps
2. Keep console open for debugging
3. Test with different themes (light/dark)
4. Verify with multiple vault configurations

### Before Release
1. Build in production mode
2. Test thoroughly in a clean vault
3. Update documentation
4. Create proper release notes
5. Tag the release in git

## Support

For build issues:
1. Check this guide first
2. Review error messages in console
3. Check [GitHub Issues](https://github.com/yourusername/TasksAgent/issues)
4. Ask in Obsidian Discord #plugin-dev channel