#!/usr/bin/env node

/**
 * Build script for Meeting Tasks Plugin
 * Creates production-ready plugin bundle with minification
 */

import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Build configuration
const PROD = process.env.NODE_ENV === 'production';
const VERSION = process.env.VERSION || require('./package.json').version;
const OUTDIR = 'dist';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function clean() {
  log('🧹 Cleaning previous build...', 'yellow');
  
  if (fs.existsSync(OUTDIR)) {
    fs.rmSync(OUTDIR, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTDIR, { recursive: true });
}

async function build() {
  log('🔨 Building plugin...', 'blue');
  
  const startTime = Date.now();
  
  try {
    // Main plugin build
    await esbuild.build({
      entryPoints: ['src/main-daemon-style.ts'],
      bundle: true,
      platform: 'browser',
      target: 'es2018',
      format: 'cjs',
      outfile: `${OUTDIR}/main.js`,
      external: [
        'obsidian',
        'electron',
        '@codemirror/autocomplete',
        '@codemirror/collab',
        '@codemirror/commands',
        '@codemirror/language',
        '@codemirror/lint',
        '@codemirror/search',
        '@codemirror/state',
        '@codemirror/view',
        '@lezer/common',
        '@lezer/highlight',
        '@lezer/lr',
      ],
      minify: PROD,
      sourcemap: PROD ? false : 'inline',
      treeShaking: true,
      define: {
        'process.env.NODE_ENV': JSON.stringify(PROD ? 'production' : 'development'),
        'process.env.VERSION': JSON.stringify(VERSION),
      },
      logLevel: 'info',
      metafile: true,
    });
    
    const buildTime = Date.now() - startTime;
    log(`✅ Build completed in ${buildTime}ms`, 'green');
    
  } catch (error) {
    log(`❌ Build failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function copyAssets() {
  log('📦 Copying assets...', 'blue');
  
  // Copy manifest
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  manifest.version = VERSION;
  fs.writeFileSync(
    `${OUTDIR}/manifest.json`,
    JSON.stringify(manifest, null, PROD ? 0 : 2)
  );
  
  // Copy styles
  if (fs.existsSync('styles.css')) {
    let styles = fs.readFileSync('styles.css', 'utf8');
    
    if (PROD) {
      // Minify CSS
      styles = styles
        .replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, '') // Remove comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/:\s+/g, ':') // Remove space after colons
        .replace(/;\s+/g, ';') // Remove space after semicolons
        .replace(/\s*{\s*/g, '{') // Remove space around braces
        .replace(/\s*}\s*/g, '}')
        .replace(/\s*,\s*/g, ',') // Remove space around commas
        .trim();
    }
    
    fs.writeFileSync(`${OUTDIR}/styles.css`, styles);
  }
  
  // Copy README for release
  if (fs.existsSync('README.md')) {
    fs.copyFileSync('README.md', `${OUTDIR}/README.md`);
  }
  
  log('✅ Assets copied', 'green');
}

async function generateReport() {
  if (!PROD) return;
  
  log('📊 Generating build report...', 'blue');
  
  const mainStats = fs.statSync(`${OUTDIR}/main.js`);
  const manifestStats = fs.statSync(`${OUTDIR}/manifest.json`);
  const stylesStats = fs.existsSync(`${OUTDIR}/styles.css`) 
    ? fs.statSync(`${OUTDIR}/styles.css`) 
    : { size: 0 };
  
  const totalSize = mainStats.size + manifestStats.size + stylesStats.size;
  
  const report = {
    version: VERSION,
    timestamp: new Date().toISOString(),
    environment: PROD ? 'production' : 'development',
    files: {
      'main.js': `${(mainStats.size / 1024).toFixed(2)} KB`,
      'manifest.json': `${(manifestStats.size / 1024).toFixed(2)} KB`,
      'styles.css': `${(stylesStats.size / 1024).toFixed(2)} KB`,
    },
    totalSize: `${(totalSize / 1024).toFixed(2)} KB`,
  };
  
  fs.writeFileSync(
    `${OUTDIR}/build-report.json`,
    JSON.stringify(report, null, 2)
  );
  
  log(`📦 Total bundle size: ${report.totalSize}`, 'green');
}

async function createZip() {
  if (!PROD) return;
  
  log('🗜️ Creating release zip...', 'blue');
  
  const zipName = `meeting-tasks-${VERSION}.zip`;
  
  try {
    // Use native zip command if available
    execSync(`cd ${OUTDIR} && zip -r ../${zipName} main.js manifest.json styles.css README.md`, {
      stdio: 'ignore',
    });
    
    log(`✅ Created ${zipName}`, 'green');
  } catch (error) {
    // Fallback to Node.js implementation if zip command not available
    log('⚠️ Native zip failed, using Node.js fallback', 'yellow');
    
    const archiver = require('archiver');
    const output = fs.createWriteStream(zipName);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      log(`✅ Created ${zipName} (${archive.pointer()} bytes)`, 'green');
    });
    
    archive.on('error', (err) => {
      throw err;
    });
    
    archive.pipe(output);
    archive.file(`${OUTDIR}/main.js`, { name: 'main.js' });
    archive.file(`${OUTDIR}/manifest.json`, { name: 'manifest.json' });
    archive.file(`${OUTDIR}/styles.css`, { name: 'styles.css' });
    
    if (fs.existsSync(`${OUTDIR}/README.md`)) {
      archive.file(`${OUTDIR}/README.md`, { name: 'README.md' });
    }
    
    await archive.finalize();
  }
}

async function runTests() {
  if (PROD) {
    log('🧪 Running tests before production build...', 'yellow');
    
    try {
      execSync('npm test', { stdio: 'inherit' });
      log('✅ All tests passed', 'green');
    } catch (error) {
      log('❌ Tests failed - aborting build', 'red');
      process.exit(1);
    }
  }
}

async function validatePlugin() {
  log('🔍 Validating plugin...', 'blue');
  
  // Check for required files
  const requiredFiles = ['manifest.json', 'src/main-daemon-style.ts'];
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      log(`❌ Missing required file: ${file}`, 'red');
      process.exit(1);
    }
  }
  
  // Validate manifest
  try {
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
    const required = ['id', 'name', 'version', 'minAppVersion', 'description', 'author'];
    
    for (const field of required) {
      if (!manifest[field]) {
        log(`❌ Missing required manifest field: ${field}`, 'red');
        process.exit(1);
      }
    }
    
    log('✅ Validation passed', 'green');
  } catch (error) {
    log(`❌ Invalid manifest.json: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function main() {
  console.log();
  log(`🚀 Meeting Tasks Plugin Build Script v${VERSION}`, 'bright');
  log(`📍 Environment: ${PROD ? 'PRODUCTION' : 'DEVELOPMENT'}`, 'bright');
  console.log();
  
  try {
    // Build steps
    await validatePlugin();
    await runTests();
    await clean();
    await build();
    await copyAssets();
    await generateReport();
    await createZip();
    
    console.log();
    log('🎉 Build completed successfully!', 'green');
    
    if (PROD) {
      console.log();
      log('📋 Release checklist:', 'yellow');
      log('  1. Test the plugin in a fresh Obsidian vault', 'reset');
      log('  2. Update CHANGELOG.md with release notes', 'reset');
      log('  3. Create a GitHub release with the zip file', 'reset');
      log('  4. Submit to Obsidian community plugins if applicable', 'reset');
    }
    
  } catch (error) {
    console.error();
    log(`❌ Build failed: ${error.message}`, 'red');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { build, clean, copyAssets };