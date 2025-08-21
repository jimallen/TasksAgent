/**
 * Unit tests for API Client
 */

import { requestUrl } from 'obsidian';
import { ApiClient, ApiError } from './client';
import {
  API_ENDPOINTS,
  STATUS_CODES,
  ERROR_CODES,
  HEADERS,
  CONTENT_TYPES,
} from './endpoints';
import {
  HealthCheckResponse,
  ProcessEmailsRequest,
  ProcessEmailsResponse,
  ServiceStatus,
  ServiceConfiguration,
  MeetingNote,
  ConnectionTestResult,
} from './types';

// Mock Obsidian's requestUrl
jest.mock('obsidian', () => ({
  ...jest.requireActual('obsidian'),
  requestUrl: jest.fn(),
}));

describe('ApiClient', () => {
  let client: ApiClient;
  const mockRequestUrl = requestUrl as jest.MockedFunction<typeof requestUrl>;

  beforeEach(() => {
    client = new ApiClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'test-api-key',
      timeout: 5000,
      retryAttempts: 2,
      retryDelay: 100,
    });
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultClient = new ApiClient();
      const config = defaultClient.getConfig();
      expect(config.baseUrl).toBe('http://localhost:3000');
      expect(config.webSocketUrl).toBe('ws://localhost:3000');
      expect(config.timeout).toBe(60000);
      expect(config.retryAttempts).toBe(3);
    });

    it('should accept custom configuration', () => {
      const customClient = new ApiClient({
        baseUrl: 'http://custom:4000',
        apiKey: 'custom-key',
        timeout: 10000,
      });
      const config = customClient.getConfig();
      expect(config.baseUrl).toBe('http://custom:4000');
      expect(config.apiKey).toBe('custom-key');
      expect(config.timeout).toBe(10000);
    });

    it('should generate unique client ID', () => {
      const client1 = new ApiClient();
      const client2 = new ApiClient();
      expect(client1.getClientId()).not.toBe(client2.getClientId());
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      client.updateConfig({ apiKey: 'new-key', timeout: 15000 });
      const config = client.getConfig();
      expect(config.apiKey).toBe('new-key');
      expect(config.timeout).toBe(15000);
      expect(config.baseUrl).toBe('http://localhost:3000'); // unchanged
    });
  });

  describe('checkHealth', () => {
    it('should return health check response on success', async () => {
      const mockResponse: HealthCheckResponse = {
        status: 'ok',
        version: '1.0.0',
        services: {
          gmail: true,
          claude: true,
          obsidian: true,
          database: true,
        },
        uptime: 3600,
      };

      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: mockResponse,
        text: JSON.stringify(mockResponse),
        arrayBuffer: new ArrayBuffer(0),
        headers: {},
      });

      const result = await client.checkHealth();
      expect(result).toEqual(mockResponse);
      expect(mockRequestUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://localhost:3000/api/health',
          method: 'GET',
          headers: expect.objectContaining({
            [HEADERS.API_KEY]: 'test-api-key',
            [HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
          }),
        })
      );
    });

    it('should retry on retryable errors', async () => {
      mockRequestUrl
        .mockResolvedValueOnce({
          status: STATUS_CODES.SERVICE_UNAVAILABLE,
          json: null,
          text: 'Service unavailable',
          arrayBuffer: new ArrayBuffer(0),
          headers: {},
        })
        .mockResolvedValueOnce({
          status: STATUS_CODES.OK,
          json: { status: 'ok' },
          text: '{"status":"ok"}',
          arrayBuffer: new ArrayBuffer(0),
          headers: {},
        });

      const result = await client.checkHealth();
      expect(result).toEqual({ status: 'ok' });
      expect(mockRequestUrl).toHaveBeenCalledTimes(2);
    });

    it('should throw ApiError after max retries', async () => {
      mockRequestUrl.mockResolvedValue({
        status: STATUS_CODES.SERVICE_UNAVAILABLE,
        json: null,
        text: 'Service unavailable',
        arrayBuffer: new ArrayBuffer(0),
        headers: {},
      });

      await expect(client.checkHealth()).rejects.toThrow(ApiError);
      expect(mockRequestUrl).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('processEmails', () => {
    it('should send process emails request', async () => {
      const request: ProcessEmailsRequest = {
        lookbackHours: 48,
        maxEmails: 20,
        patterns: ['Meeting:', 'Notes:'],
        anthropicApiKey: 'sk-ant-123',
      };

      const mockResponse: ProcessEmailsResponse = {
        processed: 5,
        meetings: [],
        errors: [],
        skipped: 0,
        duration: 1500,
      };

      mockRequestUrl.mockResolvedValueOnce({
        status: STATUS_CODES.OK,
        json: mockResponse,
        text: JSON.stringify(mockResponse),
        arrayBuffer: new ArrayBuffer(0),
        headers: {},
      });

      const result = await client.processEmails(request);
      expect(result).toEqual(mockResponse);
      expect(mockRequestUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://localhost:3000/api/process',
          method: 'POST',
          body: JSON.stringify(request),
        })
      );
    });
  });

  describe('getConfiguration', () => {
    it('should fetch configuration', async () => {
      const mockConfig: ServiceConfiguration = {
        gmailPatterns: ['Meeting:', 'Notes:'],
        lookbackHours: 120,
        maxEmails: 50,
        notificationChannels: ['console', 'desktop'],
        obsidianPath: '/vault',
        claudeModel: 'claude-3-haiku',
        checkInterval: 60,
        retryAttempts: 3,
        timeout: 60000,
      };

      mockRequestUrl.mockResolvedValueOnce({
        status: STATUS_CODES.OK,
        json: mockConfig,
        text: JSON.stringify(mockConfig),
        arrayBuffer: new ArrayBuffer(0),
        headers: {},
      });

      const result = await client.getConfiguration();
      expect(result).toEqual(mockConfig);
    });
  });

  describe('updateConfiguration', () => {
    it('should update configuration', async () => {
      const updateRequest = {
        gmailPatterns: ['New pattern'],
        lookbackHours: 72,
      };

      const mockResponse: ServiceConfiguration = {
        gmailPatterns: ['New pattern'],
        lookbackHours: 72,
        maxEmails: 50,
        notificationChannels: ['console'],
        obsidianPath: '/vault',
        claudeModel: 'claude-3-haiku',
        checkInterval: 60,
        retryAttempts: 3,
        timeout: 60000,
      };

      mockRequestUrl.mockResolvedValueOnce({
        status: STATUS_CODES.OK,
        json: mockResponse,
        text: JSON.stringify(mockResponse),
        arrayBuffer: new ArrayBuffer(0),
        headers: {},
      });

      const result = await client.updateConfiguration(updateRequest);
      expect(result).toEqual(mockResponse);
      expect(mockRequestUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateRequest),
        })
      );
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const mockHealth: HealthCheckResponse = {
        status: 'ok',
        version: '1.0.0',
        services: {
          gmail: true,
          claude: true,
          obsidian: true,
          database: true,
        },
        uptime: 3600,
      };

      mockRequestUrl.mockResolvedValueOnce({
        status: STATUS_CODES.OK,
        json: mockHealth,
        text: JSON.stringify(mockHealth),
        arrayBuffer: new ArrayBuffer(0),
        headers: {},
      });

      // Mock WebSocket
      const mockWebSocket = {
        onopen: null,
        onerror: null,
        close: jest.fn(),
      };
      global.WebSocket = jest.fn().mockImplementation(() => {
        setTimeout(() => {
          if (mockWebSocket.onopen) mockWebSocket.onopen(new Event('open'));
        }, 0);
        return mockWebSocket;
      }) as any;

      const result = await client.testConnection();
      expect(result.success).toBe(true);
      expect(result.services.api).toBe(true);
      expect(result.services.gmail).toBe(true);
      expect(result.services.claude).toBe(true);
      expect(result.latency).toBeGreaterThan(0);
    });

    it('should handle connection failure', async () => {
      mockRequestUrl.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('error handling', () => {
    it('should handle 401 Unauthorized', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: STATUS_CODES.UNAUTHORIZED,
        json: { error: 'Unauthorized' },
        text: 'Unauthorized',
        arrayBuffer: new ArrayBuffer(0),
        headers: {},
      });

      await expect(client.checkHealth()).rejects.toThrow(
        expect.objectContaining({
          code: ERROR_CODES.AUTH_FAILED,
          statusCode: STATUS_CODES.UNAUTHORIZED,
        })
      );
    });

    it('should handle 429 Too Many Requests with retry', async () => {
      mockRequestUrl
        .mockResolvedValueOnce({
          status: STATUS_CODES.TOO_MANY_REQUESTS,
          json: null,
          text: 'Rate limited',
          arrayBuffer: new ArrayBuffer(0),
          headers: {},
        })
        .mockResolvedValueOnce({
          status: STATUS_CODES.OK,
          json: { status: 'ok' },
          text: '{"status":"ok"}',
          arrayBuffer: new ArrayBuffer(0),
          headers: {},
        });

      const result = await client.checkHealth();
      expect(result).toEqual({ status: 'ok' });
      expect(mockRequestUrl).toHaveBeenCalledTimes(2);
    });

    it('should handle network errors with retry', async () => {
      mockRequestUrl
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockResolvedValueOnce({
          status: STATUS_CODES.OK,
          json: { status: 'ok' },
          text: '{"status":"ok"}',
          arrayBuffer: new ArrayBuffer(0),
          headers: {},
        });

      const result = await client.checkHealth();
      expect(result).toEqual({ status: 'ok' });
      expect(mockRequestUrl).toHaveBeenCalledTimes(2);
    });
  });

  describe('request tracking', () => {
    it('should track request count', async () => {
      mockRequestUrl.mockResolvedValue({
        status: STATUS_CODES.OK,
        json: { status: 'ok' },
        text: '{"status":"ok"}',
        arrayBuffer: new ArrayBuffer(0),
        headers: {},
      });

      expect(client.getRequestCount()).toBe(0);
      
      await client.checkHealth();
      expect(client.getRequestCount()).toBe(1);
      
      await client.getStatus();
      expect(client.getRequestCount()).toBe(2);
      
      client.resetRequestCount();
      expect(client.getRequestCount()).toBe(0);
    });

    it('should include request ID in headers', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: STATUS_CODES.OK,
        json: {},
        text: '{}',
        arrayBuffer: new ArrayBuffer(0),
        headers: {},
      });

      await client.checkHealth();
      
      expect(mockRequestUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            [HEADERS.REQUEST_ID]: expect.stringMatching(/^obsidian-.*-1$/),
          }),
        })
      );
    });
  });
});