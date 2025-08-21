/**
 * Custom Error Classes for Meeting Tasks Plugin
 * Provides specific error types for better error handling
 */

/**
 * Base error class for plugin-specific errors
 */
export class MeetingTasksError extends Error {
  public readonly code: string;
  public readonly details?: any;
  public readonly timestamp: Date;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'MeetingTasksError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    
    // Maintain proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

/**
 * Connection-related errors
 */
export class ConnectionError extends MeetingTasksError {
  constructor(message: string, details?: any) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
  }
}

/**
 * WebSocket-specific errors
 */
export class WebSocketError extends ConnectionError {
  public readonly wsCode?: number;
  public readonly wsReason?: string;

  constructor(message: string, wsCode?: number, wsReason?: string) {
    super(message, { wsCode, wsReason });
    this.name = 'WebSocketError';
    this.wsCode = wsCode;
    this.wsReason = wsReason;
  }
}

/**
 * API-related errors
 */
export class ApiError extends MeetingTasksError {
  public readonly statusCode?: number;
  public readonly endpoint?: string;
  public readonly method?: string;

  constructor(
    message: string,
    statusCode?: number,
    endpoint?: string,
    method?: string
  ) {
    super(message, 'API_ERROR', { statusCode, endpoint, method });
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    this.method = method;
  }
}

/**
 * Authentication errors
 */
export class AuthenticationError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 401, details?.endpoint, details?.method);
    this.name = 'AuthenticationError';
    this.code = 'AUTHENTICATION_ERROR';
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends ApiError {
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message, 429);
    this.name = 'RateLimitError';
    this.code = 'RATE_LIMIT_ERROR';
    this.retryAfter = retryAfter;
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends MeetingTasksError {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, 'CONFIGURATION_ERROR', { field });
    this.name = 'ConfigurationError';
    this.field = field;
  }
}

/**
 * Settings validation errors
 */
export class SettingsValidationError extends ConfigurationError {
  public readonly validationErrors: string[];

  constructor(validationErrors: string[]) {
    const message = `Settings validation failed: ${validationErrors.join(', ')}`;
    super(message);
    this.name = 'SettingsValidationError';
    this.code = 'SETTINGS_VALIDATION_ERROR';
    this.validationErrors = validationErrors;
  }
}

/**
 * Note creation errors
 */
export class NoteCreationError extends MeetingTasksError {
  public readonly meetingId?: string;
  public readonly notePath?: string;

  constructor(message: string, meetingId?: string, notePath?: string) {
    super(message, 'NOTE_CREATION_ERROR', { meetingId, notePath });
    this.name = 'NoteCreationError';
    this.meetingId = meetingId;
    this.notePath = notePath;
  }
}

/**
 * Duplicate note errors
 */
export class DuplicateNoteError extends NoteCreationError {
  public readonly existingPath: string;

  constructor(existingPath: string, meetingId?: string) {
    super(`Note already exists at: ${existingPath}`, meetingId, existingPath);
    this.name = 'DuplicateNoteError';
    this.code = 'DUPLICATE_NOTE_ERROR';
    this.existingPath = existingPath;
  }
}

/**
 * Template errors
 */
export class TemplateError extends MeetingTasksError {
  public readonly templatePath?: string;

  constructor(message: string, templatePath?: string) {
    super(message, 'TEMPLATE_ERROR', { templatePath });
    this.name = 'TemplateError';
    this.templatePath = templatePath;
  }
}

/**
 * Processing errors
 */
export class ProcessingError extends MeetingTasksError {
  public readonly stage?: string;
  public readonly emailId?: string;

  constructor(message: string, stage?: string, emailId?: string) {
    super(message, 'PROCESSING_ERROR', { stage, emailId });
    this.name = 'ProcessingError';
    this.stage = stage;
    this.emailId = emailId;
  }
}

/**
 * Cache errors
 */
export class CacheError extends MeetingTasksError {
  public readonly operation?: 'read' | 'write' | 'delete' | 'clear';

  constructor(message: string, operation?: 'read' | 'write' | 'delete' | 'clear') {
    super(message, 'CACHE_ERROR', { operation });
    this.name = 'CacheError';
    this.operation = operation;
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends MeetingTasksError {
  public readonly timeoutMs: number;
  public readonly operation?: string;

  constructor(operation: string, timeoutMs: number) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms`, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.operation = operation;
  }
}

/**
 * User cancellation error
 */
export class CancellationError extends MeetingTasksError {
  constructor(operation?: string) {
    super(
      operation ? `Operation '${operation}' cancelled by user` : 'Operation cancelled by user',
      'CANCELLATION_ERROR'
    );
    this.name = 'CancellationError';
  }
}

/**
 * Plugin lifecycle errors
 */
export class PluginLifecycleError extends MeetingTasksError {
  public readonly lifecycle: 'load' | 'unload' | 'reload';

  constructor(message: string, lifecycle: 'load' | 'unload' | 'reload') {
    super(message, 'PLUGIN_LIFECYCLE_ERROR', { lifecycle });
    this.name = 'PluginLifecycleError';
    this.lifecycle = lifecycle;
  }
}

/**
 * Error utility functions
 */

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof ConnectionError) {
    return true;
  }
  
  if (error instanceof ApiError) {
    const statusCode = error.statusCode;
    return statusCode === 408 || // Request Timeout
           statusCode === 429 || // Too Many Requests
           statusCode === 502 || // Bad Gateway
           statusCode === 503 || // Service Unavailable
           statusCode === 504;   // Gateway Timeout
  }
  
  if (error instanceof TimeoutError) {
    return true;
  }
  
  return false;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: Error): string {
  if (error instanceof ConnectionError) {
    return 'Unable to connect to the service. Please check your internet connection and service URL.';
  }
  
  if (error instanceof AuthenticationError) {
    return 'Authentication failed. Please check your API key in settings.';
  }
  
  if (error instanceof RateLimitError) {
    return `Rate limit exceeded. Please wait ${error.retryAfter || 'a moment'} before trying again.`;
  }
  
  if (error instanceof ConfigurationError) {
    return `Configuration error: ${error.message}. Please check your settings.`;
  }
  
  if (error instanceof DuplicateNoteError) {
    return `A note for this meeting already exists at: ${error.existingPath}`;
  }
  
  if (error instanceof TemplateError) {
    return 'Template error. Please check your template configuration.';
  }
  
  if (error instanceof ProcessingError) {
    return `Processing failed at stage: ${error.stage || 'unknown'}`;
  }
  
  if (error instanceof TimeoutError) {
    return `The operation timed out. Please try again.`;
  }
  
  if (error instanceof CancellationError) {
    return 'Operation cancelled.';
  }
  
  // Generic error message
  return error.message || 'An unexpected error occurred.';
}

/**
 * Convert any error to MeetingTasksError
 */
export function normalizeError(error: any): MeetingTasksError {
  if (error instanceof MeetingTasksError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new MeetingTasksError(error.message, 'UNKNOWN_ERROR', {
      originalError: error.name,
      stack: error.stack,
    });
  }
  
  return new MeetingTasksError(
    String(error),
    'UNKNOWN_ERROR',
    { originalValue: error }
  );
}

/**
 * Create error from HTTP response
 */
export function createApiErrorFromResponse(
  response: Response,
  endpoint: string,
  method: string
): ApiError {
  const statusCode = response.status;
  
  if (statusCode === 401) {
    return new AuthenticationError('Invalid or expired API key', { endpoint, method });
  }
  
  if (statusCode === 429) {
    const retryAfter = response.headers.get('Retry-After');
    return new RateLimitError(
      'Rate limit exceeded',
      retryAfter ? parseInt(retryAfter, 10) : undefined
    );
  }
  
  return new ApiError(
    `API request failed: ${response.statusText}`,
    statusCode,
    endpoint,
    method
  );
}