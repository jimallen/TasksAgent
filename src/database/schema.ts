/**
 * Database schema definitions for state management
 * Uses JSON file storage for simplicity and portability
 */

export interface ProcessedEmail {
  id: string;                    // Unique email ID from Gmail
  messageId: string;              // RFC822 Message-ID header
  threadId: string;               // Gmail thread ID
  subject: string;                // Email subject
  from: string;                   // Sender email
  date: Date;                     // Email date
  processedAt: Date;              // When we processed it
  transcriptHash: string;         // Hash of transcript content
  obsidianNotePath?: string;      // Path to created Obsidian note
  attachments: AttachmentRecord[];
  extractedTasks: number;         // Number of tasks extracted
  confidence: number;             // Overall confidence score
  status: 'processed' | 'skipped' | 'failed' | 'partial';
  error?: string;                 // Error message if failed
}

export interface AttachmentRecord {
  id: string;                     // Attachment ID from Gmail
  filename: string;               // Original filename
  mimeType: string;               // MIME type
  size: number;                   // Size in bytes
  hash: string;                   // Content hash
  processed: boolean;             // Whether we processed it
  extractedTasks?: number;        // Tasks found in this attachment
}

export interface ExtractedTaskRecord {
  id: string;                     // Unique task ID (generated)
  emailId: string;                // Source email ID
  description: string;            // Task description
  assignee: string;               // Who it's assigned to
  priority: 'high' | 'medium' | 'low';
  confidence: number;             // Confidence score
  category?: string;              // Task category
  dueDate?: Date;                 // Due date if specified
  createdAt: Date;                // When we extracted it
  obsidianTaskId?: string;        // Link to Obsidian task
  status: 'pending' | 'completed' | 'cancelled';
  hash: string;                   // Hash for deduplication
  similarTasks?: string[];        // IDs of similar tasks
}

export interface MeetingRecord {
  id: string;                     // Unique meeting ID
  emailId: string;                // Source email
  title: string;                  // Meeting title
  date: Date;                     // Meeting date
  participants: string[];         // List of participants
  duration?: number;              // Duration in minutes
  service: 'google-meet' | 'zoom' | 'teams' | 'unknown';
  transcriptAvailable: boolean;   // Whether transcript was found
  obsidianNotePath?: string;      // Obsidian note path
  createdAt: Date;                // When record was created
  updatedAt: Date;                // Last update time
}

export interface ProcessingQueue {
  id: string;                     // Queue item ID
  emailId: string;                // Email to process
  priority: number;               // Processing priority (1-10)
  attempts: number;               // Number of processing attempts
  lastAttempt?: Date;             // Last attempt timestamp
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;                 // Last error message
  createdAt: Date;                // When added to queue
  scheduledFor?: Date;            // When to process
}

export interface StateDatabase {
  version: string;                 // Schema version
  emails: ProcessedEmail[];        // Processed emails
  tasks: ExtractedTaskRecord[];    // All extracted tasks
  meetings: MeetingRecord[];       // Meeting records
  queue: ProcessingQueue[];        // Processing queue
  stats: DatabaseStats;            // Statistics
  lastSync: Date;                  // Last Gmail sync
  config: StateConfig;             // Runtime configuration
}

export interface DatabaseStats {
  totalEmailsProcessed: number;
  totalTasksExtracted: number;
  totalMeetingsFound: number;
  lastProcessedDate?: Date;
  averageConfidence: number;
  taskCompletionRate: number;
  processingErrors: number;
  duplicatesFound: number;
  storageSize: number;            // Database file size in bytes
}

export interface StateConfig {
  autoCleanupDays: number;        // Days to keep old records
  duplicateThreshold: number;     // Similarity threshold (0-1)
  maxQueueSize: number;           // Max items in queue
  retryAttempts: number;          // Max retry attempts
  batchSize: number;              // Batch processing size
  enableAutoSync: boolean;        // Auto-sync with Gmail
  syncIntervalHours: number;      // Hours between syncs
}

// Indexes for efficient lookups
export interface DatabaseIndexes {
  emailsByMessageId: Map<string, ProcessedEmail>;
  emailsByThreadId: Map<string, ProcessedEmail[]>;
  tasksByEmailId: Map<string, ExtractedTaskRecord[]>;
  tasksByHash: Map<string, ExtractedTaskRecord>;
  meetingsByDate: Map<string, MeetingRecord[]>;
  queueByStatus: Map<string, ProcessingQueue[]>;
}

// Query interfaces
export interface EmailQuery {
  id?: string;
  messageId?: string;
  threadId?: string;
  from?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: ProcessedEmail['status'];
  hasAttachments?: boolean;
  minConfidence?: number;
}

export interface TaskQuery {
  id?: string;
  emailId?: string;
  assignee?: string;
  priority?: ExtractedTaskRecord['priority'];
  category?: string;
  status?: ExtractedTaskRecord['status'];
  dueBefore?: Date;
  dueAfter?: Date;
  minConfidence?: number;
  searchText?: string;
}

export interface MeetingQuery {
  id?: string;
  emailId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  participant?: string;
  service?: MeetingRecord['service'];
  hasTranscript?: boolean;
}

// Change tracking for sync
export interface ChangeLog {
  id: string;
  entityType: 'email' | 'task' | 'meeting';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  timestamp: Date;
  changes?: Record<string, any>;
  syncStatus: 'pending' | 'synced' | 'failed';
}

// Default values
export const DEFAULT_STATE_CONFIG: StateConfig = {
  autoCleanupDays: 90,
  duplicateThreshold: 0.85,
  maxQueueSize: 100,
  retryAttempts: 3,
  batchSize: 10,
  enableAutoSync: true,
  syncIntervalHours: 1,
};

export const SCHEMA_VERSION = '1.0.0';

// Type guards
export function isProcessedEmail(obj: any): obj is ProcessedEmail {
  return obj && 
    typeof obj.id === 'string' &&
    typeof obj.messageId === 'string' &&
    typeof obj.subject === 'string' &&
    obj.date instanceof Date;
}

export function isExtractedTaskRecord(obj: any): obj is ExtractedTaskRecord {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.hash === 'string';
}

export function isMeetingRecord(obj: any): obj is MeetingRecord {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    Array.isArray(obj.participants);
}