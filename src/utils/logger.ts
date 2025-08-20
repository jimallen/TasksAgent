import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from '../config/config';

// Ensure logs directory exists
const logsDir = path.dirname(config.app.logFilePath);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Create Winston logger instance
const logger = winston.createLogger({
  level: config.app.logLevel,
  format: logFormat,
  defaultMeta: { service: 'meeting-transcript-agent' },
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: config.app.logFilePath,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport for errors only
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport in development (but not in TUI mode)
if (config.app.nodeEnv !== 'production' && !process.env['TUI_MODE']) {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Stream for other libraries (like Morgan for HTTP logging)
export const logStream = {
  write: (message: string): void => {
    logger.info(message.trim());
  },
};

// Convenience methods
export const logDebug = (message: string, meta?: object): void => {
  logger.debug(message, meta);
};

export const logInfo = (message: string, meta?: object): void => {
  logger.info(message, meta);
};

export const logWarn = (message: string, meta?: object): void => {
  logger.warn(message, meta);
};

export const logError = (message: string, error?: Error | unknown, meta?: object): void => {
  if (error instanceof Error) {
    logger.error(message, { error: error.message, stack: error.stack, ...meta });
  } else {
    logger.error(message, { error, ...meta });
  }
};

// Performance logging
export const logPerformance = (operation: string, duration: number, meta?: object): void => {
  logger.info(`Performance: ${operation}`, { duration_ms: duration, ...meta });
};

// Audit logging for important operations
export const logAudit = (action: string, details: object): void => {
  logger.info(`AUDIT: ${action}`, { audit: true, ...details });
};

export default logger;