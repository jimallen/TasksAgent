/**
 * API Type Definitions for Meeting Tasks Plugin
 * These interfaces define the data models for communication with TasksAgent service
 */

// ============================================================================
// Core Data Models
// ============================================================================

/**
 * Represents an extracted task from a meeting transcript
 */
export interface ExtractedTask {
  description: string;
  assignee: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  dueDate?: string;
  category?: string;
  context?: string;
  rawText?: string;
}

/**
 * Result of task extraction from a meeting transcript
 */
export interface TaskExtractionResult {
  tasks: ExtractedTask[];
  summary: string;
  participants: string[];
  meetingDate: Date;
  keyDecisions: string[];
  nextSteps: string[];
  confidence: number;
}

/**
 * Represents a complete meeting note with all extracted information
 */
export interface MeetingNote {
  id: string;
  title: string;
  date: Date;
  participants: string[];
  tasks: ExtractedTask[];
  summary: string;
  keyDecisions: string[];
  nextSteps: string[];
  transcript?: string;
  sourceEmail: string;
  processedAt: Date;
  confidence: number;
}

/**
 * Transcript content from various sources
 */
export interface TranscriptContent {
  text: string;
  format: 'text' | 'pdf' | 'docx' | 'html' | 'vtt' | 'srt';
  metadata?: {
    title?: string;
    date?: string;
    duration?: string;
    participants?: string[];
  };
}

// ============================================================================
// API Request Models
// ============================================================================

/**
 * Request to process emails for meeting transcripts
 */
export interface ProcessEmailsRequest {
  lookbackHours?: number;
  maxEmails?: number;
  patterns?: string[];
  force?: boolean;
  anthropicApiKey: string;
}

/**
 * Configuration update request
 */
export interface UpdateConfigRequest {
  gmailPatterns?: string[];
  lookbackHours?: number;
  maxEmails?: number;
  notificationChannels?: string[];
  obsidianPath?: string;
  anthropicApiKey?: string;
  claudeModel?: string;
}

// ============================================================================
// API Response Models
// ============================================================================

/**
 * Health check response from service
 */
export interface HealthCheckResponse {
  status: 'ok' | 'error' | 'degraded';
  version: string;
  services: {
    gmail: boolean;
    claude: boolean;
    obsidian: boolean;
    database: boolean;
  };
  uptime: number;
}

/**
 * Response from processing emails
 */
export interface ProcessEmailsResponse {
  processed: number;
  meetings: MeetingNote[];
  errors: ErrorInfo[];
  skipped: number;
  duration: number;
}

/**
 * Service status information
 */
export interface ServiceStatus {
  lastRun: string;
  nextRun: string;
  stats: ProcessingStats;
  queue: QueueItem[];
  isProcessing: boolean;
}

/**
 * Processing statistics
 */
export interface ProcessingStats {
  totalProcessed: number;
  totalTasks: number;
  totalMeetings: number;
  successRate: number;
  averageTasksPerMeeting: number;
  lastError?: string;
  lastErrorTime?: string;
}

/**
 * Queue item for processing
 */
export interface QueueItem {
  id: string;
  emailId: string;
  subject: string;
  from: string;
  receivedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  error?: string;
}

/**
 * Service configuration
 */
export interface ServiceConfiguration {
  gmailPatterns: string[];
  lookbackHours: number;
  maxEmails: number;
  notificationChannels: string[];
  obsidianPath: string;
  claudeModel: string;
  checkInterval: number;
  retryAttempts: number;
  timeout: number;
}

/**
 * Error information
 */
export interface ErrorInfo {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  source?: string;
}

// ============================================================================
// WebSocket Event Models
// ============================================================================

/**
 * Base WebSocket message structure
 */
export interface WebSocketMessage<T = any> {
  type: string;
  data: T;
  timestamp: Date;
  clientId?: string;
}

/**
 * WebSocket subscription message
 */
export interface SubscribeMessage {
  type: 'subscribe';
  clientId: string;
  filters?: {
    meetingTypes?: string[];
    participants?: string[];
  };
}

/**
 * WebSocket unsubscribe message
 */
export interface UnsubscribeMessage {
  type: 'unsubscribe';
  clientId: string;
}

/**
 * New task event from WebSocket
 */
export interface TaskEvent {
  type: 'task:new';
  data: ExtractedTask;
  meetingId: string;
}

/**
 * Meeting processed event from WebSocket
 */
export interface MeetingProcessedEvent {
  type: 'meeting:processed';
  data: MeetingNote;
}

/**
 * Status update event from WebSocket
 */
export interface StatusUpdateEvent {
  type: 'status:update';
  data: ProcessingStatus;
}

/**
 * Error event from WebSocket
 */
export interface ErrorEvent {
  type: 'error';
  data: ErrorInfo;
}

/**
 * Processing status for real-time updates
 */
export interface ProcessingStatus {
  status: 'idle' | 'checking' | 'processing' | 'error';
  currentEmail?: string;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  message?: string;
}

// ============================================================================
// Plugin-specific Models
// ============================================================================

/**
 * Cache entry for processed meetings
 */
export interface CacheEntry {
  meetingId: string;
  emailId: string;
  processedAt: Date;
  expiresAt: Date;
  data: MeetingNote;
}

/**
 * Processing history entry
 */
export interface HistoryEntry {
  id: string;
  timestamp: Date;
  action: 'check' | 'process' | 'create_note' | 'error';
  details: string;
  success: boolean;
  meetingId?: string;
  error?: string;
}

/**
 * Template variable mapping for Templater integration
 */
export interface TemplateVariables {
  title: string;
  date: string;
  time: string;
  participants: string[];
  tasks: ExtractedTask[];
  summary: string;
  keyDecisions: string[];
  nextSteps: string[];
  confidence: number;
  sourceEmail: string;
  transcriptLink?: string;
  meeting_type?: string;
  aiModel: string;
  pluginVersion: string;
  additionalNotes?: string;
  relatedMeetings?: string[];
}

/**
 * API client configuration
 */
export interface ApiClientConfig {
  baseUrl: string;
  webSocketUrl: string;
  apiKey?: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Connection test result
 */
export interface ConnectionTestResult {
  success: boolean;
  latency: number;
  services: {
    api: boolean;
    webSocket: boolean;
    gmail: boolean;
    claude: boolean;
  };
  error?: string;
  details?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a message is a task event
 */
export function isTaskEvent(message: WebSocketMessage): message is TaskEvent {
  return message.type === 'task:new';
}

/**
 * Type guard to check if a message is a meeting processed event
 */
export function isMeetingProcessedEvent(message: WebSocketMessage): message is MeetingProcessedEvent {
  return message.type === 'meeting:processed';
}

/**
 * Type guard to check if a message is a status update event
 */
export function isStatusUpdateEvent(message: WebSocketMessage): message is StatusUpdateEvent {
  return message.type === 'status:update';
}

/**
 * Type guard to check if a message is an error event
 */
export function isErrorEvent(message: WebSocketMessage): message is ErrorEvent {
  return message.type === 'error';
}

// ============================================================================
// Enums
// ============================================================================

/**
 * Task priority levels
 */
export enum TaskPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

/**
 * Processing status states
 */
export enum ProcessingState {
  IDLE = 'idle',
  CHECKING = 'checking',
  PROCESSING = 'processing',
  ERROR = 'error'
}

/**
 * Queue item status
 */
export enum QueueStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Notification channels
 */
export enum NotificationChannel {
  CONSOLE = 'console',
  DESKTOP = 'desktop',
  SLACK = 'slack',
  EMAIL = 'email'
}

/**
 * Transcript formats
 */
export enum TranscriptFormat {
  TEXT = 'text',
  PDF = 'pdf',
  DOCX = 'docx',
  HTML = 'html',
  VTT = 'vtt',
  SRT = 'srt'
}