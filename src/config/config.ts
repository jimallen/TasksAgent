import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export const config = {
  async load() {
    // Configuration is already loaded from environment variables
    return this;
  },
  gmail: {
    mcp: {
      serverUrl: process.env['GMAIL_MCP_SERVER_URL'] || '',
      clientId: process.env['GMAIL_CLIENT_ID'] || '',
      clientSecret: process.env['GMAIL_CLIENT_SECRET'] || '',
      refreshToken: process.env['GMAIL_REFRESH_TOKEN'] || '',
      accessToken: process.env['GMAIL_ACCESS_TOKEN'] || '',
    },
    hoursToLookBack: process.env['GMAIL_HOURS_LOOKBACK'] || '24',
    checkIntervalHours: parseInt(process.env['GMAIL_CHECK_INTERVAL_HOURS'] || '8', 10),
    senderDomains: (process.env['GMAIL_SENDER_DOMAINS'] || '@google.com,@meet.google.com').split(
      ','
    ),
    subjectPatterns: (
      process.env['GMAIL_SUBJECT_PATTERNS'] || 'Recording of,Transcript for,Meeting notes,Notes:'
    ).split(','),
  },

  obsidian: {
    vaultPath:
      process.env['OBSIDIAN_VAULT_PATH'] || path.join(process.env['HOME'] || '', 'Obsidian'),
    meetingsFolder: process.env['OBSIDIAN_MEETINGS_FOLDER'] || 'Meetings',
    taskTag: process.env['OBSIDIAN_TASK_TAG'] || '#meeting-task',
  },

  scheduling: {
    times: (process.env['SCHEDULE_TIMES'] || '09:00,13:00,17:00').split(','),
    timezone: process.env['TIMEZONE'] || 'America/New_York',
  },

  notifications: {
    enabled: process.env['ENABLE_NOTIFICATIONS'] === 'true',
    type: process.env['NOTIFICATION_TYPE'] || 'desktop',
  },

  app: {
    nodeEnv: process.env['NODE_ENV'] || 'development',
    logLevel: process.env['LOG_LEVEL'] || 'info',
    logFilePath: process.env['LOG_FILE_PATH'] || './logs/app.log',
  },

  ai: {
    openaiApiKey: process.env['OPENAI_API_KEY'] || '',
    model: process.env['AI_MODEL'] || 'gpt-3.5-turbo',
    temperature: parseFloat(process.env['AI_TEMPERATURE'] || '0.3'),
    maxTokens: parseInt(process.env['AI_MAX_TOKENS'] || '500', 10),
  },

  database: {
    stateFilePath: process.env['STATE_FILE_PATH'] || './data/processed-emails.json',
    taskHistoryPath: process.env['TASK_HISTORY_PATH'] || './data/task-history.json',
    maxHistoryDays: parseInt(process.env['MAX_HISTORY_DAYS'] || '30', 10),
  },

  errorHandling: {
    maxRetryAttempts: parseInt(process.env['MAX_RETRY_ATTEMPTS'] || '3', 10),
    retryDelayMs: parseInt(process.env['RETRY_DELAY_MS'] || '5000', 10),
    errorNotification: process.env['ERROR_NOTIFICATION'] === 'true',
  },

  performance: {
    maxConcurrentTranscripts: parseInt(process.env['MAX_CONCURRENT_TRANSCRIPTS'] || '3', 10),
    transcriptTimeoutMs: parseInt(process.env['TRANSCRIPT_TIMEOUT_MS'] || '30000', 10),
    cleanupTempFiles: process.env['CLEANUP_TEMP_FILES'] !== 'false',
  },
};

// Validate required configuration
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.obsidian.vaultPath) {
    errors.push('OBSIDIAN_VAULT_PATH is required');
  }

  if (config.app.nodeEnv === 'production') {
    if (!config.gmail.mcp.clientId || !config.gmail.mcp.clientSecret) {
      errors.push('Gmail MCP credentials are required in production');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

export default config;
