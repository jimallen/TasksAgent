/**
 * API Endpoint Definitions for Meeting Tasks Plugin
 * Centralized endpoint configuration for TasksAgent service communication
 */

/**
 * Base API configuration
 */
export const API_CONFIG = {
  DEFAULT_BASE_URL: 'http://localhost:3000',
  DEFAULT_WS_URL: 'ws://localhost:3000',
  API_VERSION: 'v1',
  DEFAULT_TIMEOUT: 60000, // 60 seconds
  DEFAULT_RETRY_ATTEMPTS: 3,
  DEFAULT_RETRY_DELAY: 1000, // 1 second
} as const;

/**
 * HTTP Methods
 */
export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
} as const;

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  // Health & Status
  HEALTH: '/api/health',
  STATUS: '/api/status',
  VERSION: '/api/version',
  
  // Email Processing
  PROCESS_EMAILS: '/api/process',
  PROCESS_SINGLE: '/api/process/single',
  REPROCESS: '/api/reprocess',
  
  // Configuration
  CONFIG: '/api/config',
  CONFIG_VALIDATE: '/api/config/validate',
  
  // Gmail Operations
  GMAIL_AUTH_STATUS: '/api/gmail/auth-status',
  GMAIL_SEARCH: '/api/gmail/search',
  GMAIL_FETCH: '/api/gmail/fetch',
  
  // Task Management
  TASKS_LIST: '/api/tasks',
  TASKS_BY_MEETING: '/api/tasks/meeting',
  TASKS_UPDATE: '/api/tasks/update',
  
  // Meeting Management
  MEETINGS_LIST: '/api/meetings',
  MEETINGS_GET: '/api/meetings/:id',
  MEETINGS_SEARCH: '/api/meetings/search',
  
  // History & Analytics
  HISTORY: '/api/history',
  STATS: '/api/stats',
  ANALYTICS: '/api/analytics',
  
  // WebSocket
  WS_CONNECT: '/ws',
  WS_SUBSCRIBE: '/ws/subscribe',
  WS_UNSUBSCRIBE: '/ws/unsubscribe',
} as const;

/**
 * Request Headers
 */
export const HEADERS = {
  CONTENT_TYPE: 'Content-Type',
  AUTHORIZATION: 'Authorization',
  API_KEY: 'X-API-Key',
  CLIENT_ID: 'X-Client-Id',
  CLIENT_VERSION: 'X-Client-Version',
  REQUEST_ID: 'X-Request-Id',
} as const;

/**
 * Content Types
 */
export const CONTENT_TYPES = {
  JSON: 'application/json',
  TEXT: 'text/plain',
  HTML: 'text/html',
  FORM_DATA: 'multipart/form-data',
  URL_ENCODED: 'application/x-www-form-urlencoded',
} as const;

/**
 * Response Status Codes
 */
export const STATUS_CODES = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  
  // Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,
  
  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  
  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

/**
 * Error Codes
 */
export const ERROR_CODES = {
  // Connection Errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  
  // Authentication Errors
  AUTH_FAILED: 'AUTH_FAILED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Service Errors
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  GMAIL_NOT_CONFIGURED: 'GMAIL_NOT_CONFIGURED',
  CLAUDE_NOT_CONFIGURED: 'CLAUDE_NOT_CONFIGURED',
  OBSIDIAN_PATH_INVALID: 'OBSIDIAN_PATH_INVALID',
  
  // Processing Errors
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  EXTRACTION_FAILED: 'EXTRACTION_FAILED',
  NOTE_CREATION_FAILED: 'NOTE_CREATION_FAILED',
  
  // Validation Errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Rate Limiting
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
} as const;

/**
 * WebSocket Event Types
 */
export const WS_EVENTS = {
  // Connection Events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  RECONNECT: 'reconnect',
  ERROR: 'error',
  
  // Subscription Events
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  SUBSCRIBED: 'subscribed',
  UNSUBSCRIBED: 'unsubscribed',
  
  // Data Events
  TASK_NEW: 'task:new',
  TASK_UPDATED: 'task:updated',
  TASK_DELETED: 'task:deleted',
  MEETING_PROCESSED: 'meeting:processed',
  MEETING_FAILED: 'meeting:failed',
  STATUS_UPDATE: 'status:update',
  PROGRESS_UPDATE: 'progress:update',
  
  // System Events
  HEARTBEAT: 'heartbeat',
  PING: 'ping',
  PONG: 'pong',
} as const;

/**
 * Query Parameter Keys
 */
export const QUERY_PARAMS = {
  // Pagination
  PAGE: 'page',
  LIMIT: 'limit',
  OFFSET: 'offset',
  
  // Sorting
  SORT: 'sort',
  ORDER: 'order',
  
  // Filtering
  FILTER: 'filter',
  SEARCH: 'search',
  FROM_DATE: 'from_date',
  TO_DATE: 'to_date',
  
  // Options
  INCLUDE: 'include',
  EXCLUDE: 'exclude',
  FIELDS: 'fields',
  
  // Processing
  FORCE: 'force',
  DRY_RUN: 'dry_run',
  ASYNC: 'async',
} as const;

/**
 * Default Values
 */
export const DEFAULTS = {
  PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  SORT_ORDER: 'desc',
  LOOKBACK_HOURS: 120,
  MAX_EMAILS: 50,
  RETRY_DELAY: 1000,
  RECONNECT_DELAY: 5000,
  HEARTBEAT_INTERVAL: 30000,
  CACHE_TTL: 3600000, // 1 hour
} as const;

/**
 * Helper function to build URL with path parameters
 * @param endpoint - Endpoint template with :param placeholders
 * @param params - Object with parameter values
 * @returns Formatted endpoint URL
 */
export function buildEndpoint(endpoint: string, params: Record<string, string>): string {
  let url = endpoint;
  Object.keys(params).forEach(key => {
    url = url.replace(`:${key}`, encodeURIComponent(params[key]));
  });
  return url;
}

/**
 * Helper function to build query string from parameters
 * @param params - Query parameters object
 * @returns Formatted query string
 */
export function buildQueryString(params: Record<string, any>): string {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => queryParams.append(key, String(v)));
      } else {
        queryParams.append(key, String(value));
      }
    }
  });
  const queryString = queryParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Helper function to get full URL for an endpoint
 * @param baseUrl - Base URL of the API
 * @param endpoint - API endpoint
 * @param pathParams - Path parameters
 * @param queryParams - Query parameters
 * @returns Complete URL
 */
export function getFullUrl(
  baseUrl: string,
  endpoint: string,
  pathParams?: Record<string, string>,
  queryParams?: Record<string, any>
): string {
  const path = pathParams ? buildEndpoint(endpoint, pathParams) : endpoint;
  const query = queryParams ? buildQueryString(queryParams) : '';
  return `${baseUrl}${path}${query}`;
}

/**
 * Helper function to check if status code indicates success
 * @param statusCode - HTTP status code
 * @returns True if successful
 */
export function isSuccessStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300;
}

/**
 * Helper function to check if error is retryable
 * @param statusCode - HTTP status code
 * @returns True if request should be retried
 */
export function isRetryableError(statusCode: number): boolean {
  return (
    statusCode === STATUS_CODES.TOO_MANY_REQUESTS ||
    statusCode === STATUS_CODES.BAD_GATEWAY ||
    statusCode === STATUS_CODES.SERVICE_UNAVAILABLE ||
    statusCode === STATUS_CODES.GATEWAY_TIMEOUT ||
    statusCode >= 500
  );
}

/**
 * Type for HTTP methods
 */
export type HttpMethod = typeof HTTP_METHODS[keyof typeof HTTP_METHODS];

/**
 * Type for API endpoints
 */
export type ApiEndpoint = typeof API_ENDPOINTS[keyof typeof API_ENDPOINTS];

/**
 * Type for WebSocket events
 */
export type WsEvent = typeof WS_EVENTS[keyof typeof WS_EVENTS];

/**
 * Type for error codes
 */
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];