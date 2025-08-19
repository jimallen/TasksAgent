#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logInfo, logError, logWarn } from '../utils/logger';

const CREDENTIALS_FILE = 'gcp-oauth.keys.json';

async function setupGmailAuth(): Promise<void> {
  try {
    logInfo('Starting Gmail MCP Server authentication setup...');

    // Check if credentials file exists
    if (!fs.existsSync(CREDENTIALS_FILE)) {
      if (!fs.existsSync(path.join('src/config', 'gmail.credentials.json'))) {
        logError(`
Gmail credentials file not found!

Please follow these steps:
1. Go to Google Cloud Console (https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials for a Desktop application
3. Download the credentials JSON file
4. Save it as: src/config/gmail.credentials.json

See docs/GMAIL_SETUP.md for detailed instructions.
        `);
        process.exit(1);
      }

      // Copy credentials to root
      logInfo('Copying credentials file...');
      fs.copyFileSync(
        path.join('src/config', 'gmail.credentials.json'),
        CREDENTIALS_FILE
      );
    }

    // Run authentication
    logInfo('Opening browser for authentication...');
    logInfo('Please sign in with your Google account and grant permissions.');
    
    try {
      execSync('npx @gongrzhe/server-gmail-autoauth-mcp auth', {
        stdio: 'inherit',
      });
      
      logInfo('✅ Gmail authentication successful!');
      logInfo('The Gmail MCP Server is now configured and ready to use.');
      
      // Clean up credentials file from root if it exists
      if (fs.existsSync(CREDENTIALS_FILE)) {
        logWarn('Removing temporary credentials file from project root...');
        fs.unlinkSync(CREDENTIALS_FILE);
      }
      
    } catch (error) {
      logError('Authentication failed', error);
      process.exit(1);
    }

  } catch (error) {
    logError('Setup failed', error);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupGmailAuth().catch((error) => {
    logError('Unexpected error during setup', error);
    process.exit(1);
  });
}

export default setupGmailAuth;