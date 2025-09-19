/**
 * TypeScript interfaces for Gmail MCP integration
 */

/**
 * MCP JSON-RPC request format
 */
export interface McpRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
  id: string | number;
}

/**
 * MCP JSON-RPC response format
 */
export interface McpResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: McpError;
  id: string | number;
}

/**
 * MCP error format
 */
export interface McpError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * MCP tool call request
 */
export interface McpToolCall {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * Gmail search parameters
 */
export interface GmailSearchParams {
  query?: string;
  maxResults?: number;
  pageToken?: string;
  labelIds?: string[];
}

/**
 * Gmail read email parameters
 */
export interface GmailReadParams {
  messageId: string;
  format?: 'minimal' | 'full' | 'raw' | 'metadata';
}

/**
 * Gmail email message
 */
export interface GmailMessage {
  id: string;
  threadId?: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: Date | string;
  body?: string;
  snippet?: string;
  labelIds?: string[];
  attachments?: GmailAttachment[];
}

/**
 * Gmail attachment
 */
export interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: string; // Base64 encoded
}

/**
 * Gmail MCP service configuration
 */
export interface GmailMcpConfig {
  restartAttempts: number;
  startupTimeout: number;
  requestTimeout: number;
  mcpPath?: string; // Path to Google Workspace MCP installation
}

/**
 * Gmail MCP service status
 */
export interface GmailMcpStatus {
  running: boolean;
  pid?: number;
  startTime?: Date;
  uptime?: number;
  requestCount: number;
  errorCount: number;
  lastError?: string;
  restartCount: number;
}

/**
 * Pending request tracker
 */
export interface PendingRequest {
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
  timeout: NodeJS.Timeout;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

/**
 * Gmail MCP process events
 */
export type GmailMcpEvent = 
  | 'started'
  | 'stopped'
  | 'error'
  | 'crashed'
  | 'restarting'
  | 'request'
  | 'response';

/**
 * Standard MCP initialization parameters
 */
export interface McpInitializeParams {
  protocolVersion: string;
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    sampling?: boolean;
  };
  clientInfo?: {
    name: string;
    version: string;
  };
}