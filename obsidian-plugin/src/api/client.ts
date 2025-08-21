/**
 * HTTP API Client for Meeting Tasks Plugin
 * Handles all REST API communication with TasksAgent service
 */

import { requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';
import {
  API_CONFIG,
  API_ENDPOINTS,
  HEADERS,
  CONTENT_TYPES,
  HTTP_METHODS,
  STATUS_CODES,
  ERROR_CODES,
  getFullUrl,
  isSuccessStatus,
  isRetryableError,
  HttpMethod,
} from './endpoints';
import {
  ApiClientConfig,
  HealthCheckResponse,
  ProcessEmailsRequest,
  ProcessEmailsResponse,
  ServiceStatus,
  ServiceConfiguration,
  UpdateConfigRequest,
  ConnectionTestResult,
  ErrorInfo,
  ProcessingStats,
  MeetingNote,
  HistoryEntry,
} from './types';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * API Client for TasksAgent service
 */
export class ApiClient {
  private config: ApiClientConfig;
  private clientId: string;
  private requestCount: number = 0;

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl || API_CONFIG.DEFAULT_BASE_URL,
      webSocketUrl: config.webSocketUrl || API_CONFIG.DEFAULT_WS_URL,
      apiKey: config.apiKey,
      timeout: config.timeout || API_CONFIG.DEFAULT_TIMEOUT,
      retryAttempts: config.retryAttempts || API_CONFIG.DEFAULT_RETRY_ATTEMPTS,
      retryDelay: config.retryDelay || API_CONFIG.DEFAULT_RETRY_DELAY,
    };
    
    // Generate unique client ID for this session
    this.clientId = `obsidian-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update client configuration
   */
  public updateConfig(config: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): ApiClientConfig {
    return { ...this.config };
  }

  /**
   * Make HTTP request with retry logic
   */
  private async request<T>(
    method: HttpMethod,
    endpoint: string,
    options: {
      body?: any;
      queryParams?: Record<string, any>;
      pathParams?: Record<string, string>;
      headers?: Record<string, string>;
      retryCount?: number;
    } = {}
  ): Promise<T> {
    const { body, queryParams, pathParams, headers = {}, retryCount = 0 } = options;
    
    const url = getFullUrl(this.config.baseUrl, endpoint, pathParams, queryParams);
    
    // Build request headers
    const requestHeaders: Record<string, string> = {
      [HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
      [HEADERS.CLIENT_ID]: this.clientId,
      [HEADERS.CLIENT_VERSION]: '1.0.0',
      [HEADERS.REQUEST_ID]: `${this.clientId}-${++this.requestCount}`,
      ...headers,
    };
    
    // Add API key if configured
    if (this.config.apiKey) {
      requestHeaders[HEADERS.API_KEY] = this.config.apiKey;
    }
    
    // Build request parameters
    const requestParams: RequestUrlParam = {
      url,
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      throw: false, // We'll handle errors ourselves
    };
    
    try {
      // Make the request using Obsidian's requestUrl
      const response: RequestUrlResponse = await requestUrl(requestParams);
      
      // Check for successful response
      if (isSuccessStatus(response.status)) {
        return response.json;
      }
      
      // Handle error responses
      if (isRetryableError(response.status) && retryCount < this.config.retryAttempts) {
        // Wait before retrying
        await this.delay(this.config.retryDelay * Math.pow(2, retryCount));
        return this.request<T>(method, endpoint, { ...options, retryCount: retryCount + 1 });
      }
      
      // Throw API error for non-retryable errors
      throw new ApiError(
        this.getErrorCode(response.status),
        response.text || `Request failed with status ${response.status}`,
        response.status,
        response.json
      );
      
    } catch (error) {
      // Handle network errors
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Retry on network errors if attempts remaining
      if (retryCount < this.config.retryAttempts) {
        await this.delay(this.config.retryDelay * Math.pow(2, retryCount));
        return this.request<T>(method, endpoint, { ...options, retryCount: retryCount + 1 });
      }
      
      throw new ApiError(
        ERROR_CODES.NETWORK_ERROR,
        `Network error: ${error.message}`,
        undefined,
        error
      );
    }
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error code from status code
   */
  private getErrorCode(statusCode: number): string {
    switch (statusCode) {
      case STATUS_CODES.UNAUTHORIZED:
        return ERROR_CODES.AUTH_FAILED;
      case STATUS_CODES.FORBIDDEN:
        return ERROR_CODES.INVALID_API_KEY;
      case STATUS_CODES.NOT_FOUND:
        return ERROR_CODES.INVALID_REQUEST;
      case STATUS_CODES.TOO_MANY_REQUESTS:
        return ERROR_CODES.RATE_LIMITED;
      case STATUS_CODES.SERVICE_UNAVAILABLE:
        return ERROR_CODES.SERVICE_UNAVAILABLE;
      case STATUS_CODES.GATEWAY_TIMEOUT:
        return ERROR_CODES.TIMEOUT;
      default:
        return ERROR_CODES.PROCESSING_FAILED;
    }
  }

  // ============================================================================
  // Health & Status Endpoints
  // ============================================================================

  /**
   * Check service health
   */
  async checkHealth(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>(
      HTTP_METHODS.GET,
      API_ENDPOINTS.HEALTH
    );
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<ServiceStatus> {
    return this.request<ServiceStatus>(
      HTTP_METHODS.GET,
      API_ENDPOINTS.STATUS
    );
  }

  /**
   * Get service version
   */
  async getVersion(): Promise<{ version: string; apiVersion: string }> {
    return this.request<{ version: string; apiVersion: string }>(
      HTTP_METHODS.GET,
      API_ENDPOINTS.VERSION
    );
  }

  // ============================================================================
  // Email Processing Endpoints
  // ============================================================================

  /**
   * Process emails for meeting transcripts
   */
  async processEmails(request: ProcessEmailsRequest): Promise<ProcessEmailsResponse> {
    return this.request<ProcessEmailsResponse>(
      HTTP_METHODS.POST,
      API_ENDPOINTS.PROCESS_EMAILS,
      { body: request }
    );
  }

  /**
   * Process a single email
   */
  async processSingleEmail(emailId: string, anthropicApiKey: string): Promise<MeetingNote> {
    return this.request<MeetingNote>(
      HTTP_METHODS.POST,
      API_ENDPOINTS.PROCESS_SINGLE,
      { 
        body: { emailId, anthropicApiKey }
      }
    );
  }

  /**
   * Reprocess a meeting
   */
  async reprocessMeeting(meetingId: string, anthropicApiKey: string): Promise<MeetingNote> {
    return this.request<MeetingNote>(
      HTTP_METHODS.POST,
      API_ENDPOINTS.REPROCESS,
      { 
        body: { meetingId, anthropicApiKey }
      }
    );
  }

  // ============================================================================
  // Configuration Endpoints
  // ============================================================================

  /**
   * Get service configuration
   */
  async getConfiguration(): Promise<ServiceConfiguration> {
    return this.request<ServiceConfiguration>(
      HTTP_METHODS.GET,
      API_ENDPOINTS.CONFIG
    );
  }

  /**
   * Update service configuration
   */
  async updateConfiguration(config: UpdateConfigRequest): Promise<ServiceConfiguration> {
    return this.request<ServiceConfiguration>(
      HTTP_METHODS.PUT,
      API_ENDPOINTS.CONFIG,
      { body: config }
    );
  }

  /**
   * Validate configuration
   */
  async validateConfiguration(config: UpdateConfigRequest): Promise<{ valid: boolean; errors?: string[] }> {
    return this.request<{ valid: boolean; errors?: string[] }>(
      HTTP_METHODS.POST,
      API_ENDPOINTS.CONFIG_VALIDATE,
      { body: config }
    );
  }

  // ============================================================================
  // Meeting Management Endpoints
  // ============================================================================

  /**
   * Get list of meetings
   */
  async getMeetings(params?: {
    page?: number;
    limit?: number;
    from_date?: string;
    to_date?: string;
  }): Promise<{ meetings: MeetingNote[]; total: number }> {
    return this.request<{ meetings: MeetingNote[]; total: number }>(
      HTTP_METHODS.GET,
      API_ENDPOINTS.MEETINGS_LIST,
      { queryParams: params }
    );
  }

  /**
   * Get single meeting by ID
   */
  async getMeeting(meetingId: string): Promise<MeetingNote> {
    return this.request<MeetingNote>(
      HTTP_METHODS.GET,
      API_ENDPOINTS.MEETINGS_GET,
      { pathParams: { id: meetingId } }
    );
  }

  /**
   * Search meetings
   */
  async searchMeetings(query: string): Promise<MeetingNote[]> {
    return this.request<MeetingNote[]>(
      HTTP_METHODS.GET,
      API_ENDPOINTS.MEETINGS_SEARCH,
      { queryParams: { search: query } }
    );
  }

  // ============================================================================
  // History & Analytics Endpoints
  // ============================================================================

  /**
   * Get processing history
   */
  async getHistory(params?: {
    page?: number;
    limit?: number;
    from_date?: string;
    to_date?: string;
  }): Promise<{ history: HistoryEntry[]; total: number }> {
    return this.request<{ history: HistoryEntry[]; total: number }>(
      HTTP_METHODS.GET,
      API_ENDPOINTS.HISTORY,
      { queryParams: params }
    );
  }

  /**
   * Get processing statistics
   */
  async getStats(): Promise<ProcessingStats> {
    return this.request<ProcessingStats>(
      HTTP_METHODS.GET,
      API_ENDPOINTS.STATS
    );
  }

  // ============================================================================
  // Connection Testing
  // ============================================================================

  /**
   * Test connection to service
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const result: ConnectionTestResult = {
      success: false,
      latency: 0,
      services: {
        api: false,
        webSocket: false,
        gmail: false,
        claude: false,
      },
    };

    try {
      // Test API connection
      const health = await this.checkHealth();
      result.latency = Date.now() - startTime;
      result.services.api = health.status === 'ok';
      result.services.gmail = health.services.gmail;
      result.services.claude = health.services.claude;
      
      // Test WebSocket connection (basic check)
      result.services.webSocket = await this.testWebSocketConnection();
      
      result.success = result.services.api;
      
    } catch (error) {
      result.error = error.message;
      result.details = error instanceof ApiError ? error.details : undefined;
    }

    return result;
  }

  /**
   * Test WebSocket connection
   */
  private async testWebSocketConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(this.config.webSocketUrl);
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
        
      } catch (error) {
        resolve(false);
      }
    });
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get client ID
   */
  getClientId(): string {
    return this.clientId;
  }

  /**
   * Get request count
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Reset request count
   */
  resetRequestCount(): void {
    this.requestCount = 0;
  }
}