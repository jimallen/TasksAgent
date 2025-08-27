import winston from 'winston';
import { logDebug, logInfo, logWarn, logError, logPerformance, logAudit } from './logger';

// Mock winston
jest.mock('winston', () => {
  const mFormat = {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    splat: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    printf: jest.fn(),
  };

  const mTransports = {
    File: jest.fn(),
    Console: jest.fn(),
  };

  const mLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    add: jest.fn(),
  };

  return {
    format: mFormat,
    transports: mTransports,
    createLogger: jest.fn(() => mLogger),
  };
});

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}));

// Mock config
jest.mock('../config/config', () => ({
  config: {
    app: {
      logFilePath: './logs/test.log',
      logLevel: 'info',
      nodeEnv: 'test',
    },
  },
}));

describe('Logger', () => {
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = (winston.createLogger as jest.Mock).mock.results[0]?.value;
  });

  describe('Log level methods', () => {
    it('should call logger.debug for logDebug', () => {
      logDebug('Debug message', { extra: 'data' });
      expect(mockLogger.debug).toHaveBeenCalledWith('Debug message', { extra: 'data' });
    });

    it('should call logger.info for logInfo', () => {
      logInfo('Info message', { extra: 'data' });
      expect(mockLogger.info).toHaveBeenCalledWith('Info message', { extra: 'data' });
    });

    it('should call logger.warn for logWarn', () => {
      logWarn('Warning message', { extra: 'data' });
      expect(mockLogger.warn).toHaveBeenCalledWith('Warning message', { extra: 'data' });
    });

    it('should handle Error objects in logError', () => {
      const error = new Error('Test error');
      error.stack = 'Test stack trace';
      logError('Error occurred', error, { context: 'test' });
      
      expect(mockLogger.error).toHaveBeenCalledWith('Error occurred', {
        error: 'Test error',
        stack: 'Test stack trace',
        context: 'test',
      });
    });

    it('should handle non-Error objects in logError', () => {
      logError('Error occurred', 'String error', { context: 'test' });
      
      expect(mockLogger.error).toHaveBeenCalledWith('Error occurred', {
        error: 'String error',
        context: 'test',
      });
    });
  });

  describe('Specialized logging', () => {
    it('should log performance metrics', () => {
      logPerformance('database_query', 150, { query: 'SELECT * FROM tasks' });
      
      expect(mockLogger.info).toHaveBeenCalledWith('Performance: database_query', {
        duration_ms: 150,
        query: 'SELECT * FROM tasks',
      });
    });

    it('should log audit events', () => {
      logAudit('email_processed', { emailId: '123', taskCount: 5 });
      
      expect(mockLogger.info).toHaveBeenCalledWith('AUDIT: email_processed', {
        audit: true,
        emailId: '123',
        taskCount: 5,
      });
    });
  });

  describe('Logger configuration', () => {
    it('should create logger with correct configuration', () => {
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          defaultMeta: { service: 'meeting-transcript-agent' },
        })
      );
    });

    it('should add console transport in non-production environment', () => {
      expect(mockLogger.add).toHaveBeenCalled();
    });
  });
});