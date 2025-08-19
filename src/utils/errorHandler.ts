import { logError } from './logger';
import { config } from '../config/config';

export class AppError extends Error {
  public readonly isOperational: boolean;
  public readonly statusCode?: number;
  public readonly context?: object;

  constructor(
    message: string,
    isOperational = true,
    statusCode?: number,
    context?: object
  ) {
    super(message);
    this.name = this.constructor.name;
    this.isOperational = isOperational;
    this.statusCode = statusCode;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: object) {
    super(message, true, 400, context);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, context?: object) {
    super(message, true, 404, context);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, context?: object) {
    super(`${service}: ${message}`, true, 503, context);
  }
}

export const handleError = (error: Error | AppError | unknown): void => {
  if (error instanceof AppError) {
    logError(error.message, error, error.context);
    
    if (!error.isOperational) {
      // For non-operational errors, we might want to exit the process
      process.exit(1);
    }
  } else if (error instanceof Error) {
    logError('Unexpected error occurred', error);
    
    if (config.app.nodeEnv === 'production') {
      // In production, exit for unexpected errors
      process.exit(1);
    }
  } else {
    logError('Unknown error occurred', error as Error);
  }
};

export const withRetry = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  maxAttempts = config.errorHandling.maxRetryAttempts,
  delayMs = config.errorHandling.retryDelayMs
): Promise<T> => {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxAttempts) {
        logError(
          `${operationName} failed on attempt ${attempt}/${maxAttempts}. Retrying...`,
          error,
          { attempt, maxAttempts }
        );
        
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw new AppError(
    `${operationName} failed after ${maxAttempts} attempts`,
    true,
    500,
    { lastError: lastError?.message }
  );
};

// Global error handlers
export const setupGlobalErrorHandlers = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logError('Uncaught Exception', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    logError('Unhandled Rejection', reason as Error, { promise });
    process.exit(1);
  });

  process.on('SIGTERM', () => {
    logError('SIGTERM received, shutting down gracefully', undefined);
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logError('SIGINT received, shutting down gracefully', undefined);
    process.exit(0);
  });
};