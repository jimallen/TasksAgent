import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { createHash } from 'crypto';
import { logDebug, logError, logInfo, logWarn } from '../utils/logger';
import type { ExtractedTask } from '../extractors/claudeTaskExtractor';
import type { EmailMessage } from '../services/gmailService';

export interface ProcessedEmail {
  id: string;
  message_id: string;
  thread_id: string;
  subject: string;
  sender: string;
  email_date: Date;
  processed_at: Date;
  transcript_hash?: string;
  obsidian_note_path?: string;
  extracted_tasks: number;
  confidence: number;
  status: 'processed' | 'skipped' | 'failed' | 'partial';
  error_message?: string;
}

export interface TaskRecord {
  id?: number;
  email_id: string;
  description: string;
  assignee: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  category?: string;
  due_date?: Date;
  raw_text?: string;
  obsidian_task_id?: string;
  status: 'pending' | 'completed' | 'cancelled';
  content_hash: string;
}

export interface MeetingRecord {
  id?: number;
  email_id: string;
  title: string;
  meeting_date: Date;
  duration_minutes?: number;
  service: 'google-meet' | 'zoom' | 'teams' | 'unknown';
  transcript_available: boolean;
  obsidian_note_path?: string;
  participants?: string[];
}

export class StateManager {
  private db!: Database.Database; // Initialized in initialize() method
  private dbPath: string;
  private preparedStatements: Map<string, Database.Statement> = new Map();

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'state.db');
  }

  /**
   * Initialize database and create tables
   */
  async initialize(): Promise<void> {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      await fs.mkdir(dataDir, { recursive: true });

      // Open database
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better performance
      this.db.pragma('foreign_keys = ON');  // Enable foreign key constraints

      // Read and execute schema
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = await fs.readFile(schemaPath, 'utf-8');
      this.db.exec(schema);

      // Prepare frequently used statements
      this.prepareStatements();

      logInfo(`State database initialized at: ${this.dbPath}`);
    } catch (error) {
      logError('Failed to initialize state database', error);
      throw error;
    }
  }

  /**
   * Prepare frequently used SQL statements
   */
  private prepareStatements(): void {
    // Email statements
    this.preparedStatements.set('insertEmail', this.db.prepare(`
      INSERT OR REPLACE INTO processed_emails (
        id, message_id, thread_id, subject, sender, email_date,
        transcript_hash, obsidian_note_path, extracted_tasks, confidence, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `));

    this.preparedStatements.set('getEmailById', this.db.prepare(
      'SELECT * FROM processed_emails WHERE id = ?'
    ));

    this.preparedStatements.set('getEmailByMessageId', this.db.prepare(
      'SELECT * FROM processed_emails WHERE message_id = ?'
    ));

    // Task statements
    this.preparedStatements.set('insertTask', this.db.prepare(`
      INSERT INTO extracted_tasks (
        email_id, description, assignee, priority, confidence,
        category, due_date, raw_text, obsidian_task_id, status, content_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `));

    this.preparedStatements.set('getTaskByHash', this.db.prepare(
      'SELECT * FROM extracted_tasks WHERE content_hash = ?'
    ));

    this.preparedStatements.set('getTasksByEmailId', this.db.prepare(
      'SELECT * FROM extracted_tasks WHERE email_id = ?'
    ));

    // Meeting statements
    this.preparedStatements.set('insertMeeting', this.db.prepare(`
      INSERT INTO meetings (
        email_id, title, meeting_date, duration_minutes,
        service, transcript_available, obsidian_note_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `));

    // Queue statements
    this.preparedStatements.set('addToQueue', this.db.prepare(`
      INSERT INTO processing_queue (email_id, priority, scheduled_for)
      VALUES (?, ?, ?)
    `));

    this.preparedStatements.set('getNextQueueItem', this.db.prepare(`
      SELECT * FROM processing_queue
      WHERE status = 'pending'
      AND (scheduled_for IS NULL OR scheduled_for <= datetime('now'))
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    `));
  }

  /**
   * Check if email has been processed
   */
  async isEmailProcessed(emailId: string): Promise<boolean> {
    const stmt = this.preparedStatements.get('getEmailById')!;
    const result = stmt.get(emailId);
    return !!result;
  }

  /**
   * Check if transcript has been updated
   */
  async hasTranscriptChanged(emailId: string, newHash: string): Promise<boolean> {
    const stmt = this.preparedStatements.get('getEmailById')!;
    const result = stmt.get(emailId) as ProcessedEmail | undefined;
    
    if (!result) {
      return true; // Not processed yet, so it's "new"
    }
    
    return result.transcript_hash !== newHash;
  }

  /**
   * Get email processing status and details
   */
  async getEmailStatus(emailId: string): Promise<{
    processed: boolean;
    status?: ProcessedEmail['status'];
    hasChanged?: boolean;
    lastProcessed?: Date;
    taskCount?: number;
  }> {
    const stmt = this.preparedStatements.get('getEmailById')!;
    const result = stmt.get(emailId) as ProcessedEmail | undefined;
    
    if (!result) {
      return { processed: false };
    }
    
    return {
      processed: true,
      status: result.status,
      hasChanged: false, // Will be checked separately with hash
      lastProcessed: result.processed_at,
      taskCount: result.extracted_tasks
    };
  }

  /**
   * Save processed email record
   */
  async saveProcessedEmail(
    email: EmailMessage,
    status: ProcessedEmail['status'],
    extractedTasks: number = 0,
    confidence: number = 0,
    obsidianPath?: string,
    error?: string
  ): Promise<void> {
    const stmt = this.preparedStatements.get('insertEmail')!;
    
    const transcriptHash = email.body 
      ? this.generateHash(email.body)
      : undefined;

    stmt.run(
      email.id,
      email.id, // Using Gmail ID as message_id for now
      email.threadId || '',
      email.subject,
      email.from,
      new Date(email.date).toISOString(),
      transcriptHash,
      obsidianPath,
      extractedTasks,
      confidence,
      status,
      error
    );

    logDebug(`Saved processed email: ${email.id} with status: ${status}`);
  }

  /**
   * Save extracted tasks
   */
  async saveTasks(emailId: string, tasks: ExtractedTask[]): Promise<number[]> {
    const stmt = this.preparedStatements.get('insertTask')!;
    const savedIds: number[] = [];

    const transaction = this.db.transaction((tasks: ExtractedTask[]) => {
      for (const task of tasks) {
        const hash = this.generateTaskHash(task);
        
        // Check for duplicate
        const existing = this.preparedStatements.get('getTaskByHash')!.get(hash) as any;
        if (existing && typeof existing === 'object' && 'id' in existing) {
          logDebug(`Duplicate task found: ${task.description}`);
          this.recordSimilarTask(existing.id, existing.id, 1.0);
          continue;
        }

        const result = stmt.run(
          emailId,
          task.description,
          task.assignee,
          task.priority,
          task.confidence,
          task.category,
          task.dueDate ? new Date(task.dueDate).toISOString() : null,
          task.rawText,
          null, // obsidian_task_id
          'pending',
          hash
        );

        savedIds.push(result.lastInsertRowid as number);
      }
    });

    transaction(tasks);
    
    logInfo(`Saved ${savedIds.length} unique tasks from email ${emailId}`);
    return savedIds;
  }

  /**
   * Save meeting record
   */
  async saveMeeting(
    emailId: string,
    title: string,
    date: Date,
    participants: string[],
    service: MeetingRecord['service'] = 'unknown',
    obsidianPath?: string
  ): Promise<number> {
    const stmt = this.preparedStatements.get('insertMeeting')!;
    
    const result = stmt.run(
      emailId,
      title,
      date.toISOString(),
      null, // duration_minutes
      service,
      1, // transcript_available
      obsidianPath
    );

    const meetingId = result.lastInsertRowid as number;

    // Save participants
    if (participants.length > 0) {
      const participantStmt = this.db.prepare(
        'INSERT INTO meeting_participants (meeting_id, participant_name) VALUES (?, ?)'
      );
      
      for (const participant of participants) {
        participantStmt.run(meetingId, participant);
      }
    }

    logDebug(`Saved meeting record: ${title}`);
    return meetingId;
  }

  /**
   * Find similar tasks for deduplication
   */
  async findSimilarTasks(task: ExtractedTask, threshold: number = 0.85): Promise<TaskRecord[]> {
    const allTasks = this.db.prepare(
      'SELECT * FROM extracted_tasks WHERE status = "pending"'
    ).all() as TaskRecord[];

    const similar: TaskRecord[] = [];
    const taskWords = new Set(task.description.toLowerCase().split(/\s+/));

    for (const existing of allTasks) {
      const existingWords = new Set(existing.description.toLowerCase().split(/\s+/));
      const similarity = this.calculateSimilarity(taskWords, existingWords);
      
      if (similarity >= threshold) {
        similar.push(existing);
        
        // Record similarity if task has an ID
        if (existing.id) {
          this.recordSimilarTask(existing.id, existing.id, similarity);
        }
      }
    }

    return similar;
  }

  /**
   * Record similar tasks
   */
  private recordSimilarTask(taskId: number, similarId: number, score: number): void {
    try {
      const stmt = this.db.prepare(
        'INSERT OR IGNORE INTO similar_tasks (task_id, similar_task_id, similarity_score) VALUES (?, ?, ?)'
      );
      stmt.run(taskId, similarId, score);
    } catch (error) {
      logWarn('Failed to record similar task', error as any);
    }
  }

  /**
   * Calculate similarity between two sets of words
   */
  private calculateSimilarity(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 || set2.size === 0) return 0;
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Generate hash for content
   */
  private generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Generate hash for task deduplication
   */
  private generateTaskHash(task: ExtractedTask): string {
    const normalized = task.description
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    return this.generateHash(normalized);
  }

  /**
   * Add email to processing queue
   */
  async addToQueue(emailId: string, priority: number = 5): Promise<void> {
    const stmt = this.preparedStatements.get('addToQueue')!;
    stmt.run(emailId, priority, null);
    logDebug(`Added email ${emailId} to processing queue`);
  }

  /**
   * Get next item from queue
   */
  async getNextQueueItem(): Promise<any | null> {
    const stmt = this.preparedStatements.get('getNextQueueItem')!;
    return stmt.get();
  }

  /**
   * Update queue item status
   */
  async updateQueueStatus(
    id: number,
    status: 'processing' | 'completed' | 'failed',
    error?: string
  ): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE processing_queue
      SET status = ?, error_message = ?, last_attempt = datetime('now'), attempts = attempts + 1
      WHERE id = ?
    `);
    
    stmt.run(status, error, id);
  }

  /**
   * Get processing statistics
   */
  async getStats(): Promise<any> {
    const today = new Date().toISOString().split('T')[0];
    
    const stats = this.db.prepare(`
      SELECT 
        COUNT(DISTINCT id) as total_emails,
        COUNT(DISTINCT CASE WHEN status = 'processed' THEN id END) as processed_emails,
        COUNT(DISTINCT CASE WHEN status = 'failed' THEN id END) as failed_emails,
        AVG(confidence) as avg_confidence
      FROM processed_emails
    `).get();

    const taskStats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_tasks
      FROM extracted_tasks
    `).get();

    const todayStats = this.db.prepare(
      'SELECT * FROM processing_stats WHERE date = ?'
    ).get(today);

    return {
      ...(stats as Record<string, any>),
      ...(taskStats as Record<string, any>),
      today: todayStats
    };
  }

  /**
   * Clean up old records
   */
  async cleanup(daysToKeep: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const stmt = this.db.prepare(`
      DELETE FROM processed_emails 
      WHERE processed_at < ? 
      AND status IN ('processed', 'skipped')
    `);
    
    const result = stmt.run(cutoffDate.toISOString());
    logInfo(`Cleaned up ${result.changes} old email records`);
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: number, status: TaskRecord['status']): Promise<void> {
    const stmt = this.db.prepare(
      'UPDATE extracted_tasks SET status = ? WHERE id = ?'
    );
    stmt.run(status, taskId);
  }

  /**
   * Get recent processed emails
   */
  async getRecentEmails(limit: number = 10): Promise<ProcessedEmail[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM processed_emails
      ORDER BY processed_at DESC
      LIMIT ?
    `);
    
    return stmt.all(limit) as ProcessedEmail[];
  }

  /**
   * Get pending tasks
   */
  async getPendingTasks(assignee?: string): Promise<TaskRecord[]> {
    let query = 'SELECT * FROM extracted_tasks WHERE status = "pending"';
    const params: any[] = [];
    
    if (assignee) {
      query += ' AND assignee = ?';
      params.push(assignee);
    }
    
    query += ' ORDER BY priority ASC, due_date ASC';
    
    const stmt = this.db.prepare(query);
    return stmt.all(...params) as TaskRecord[];
  }

  /**
   * Check for duplicate email by message ID
   */
  async isDuplicateEmail(messageId: string): Promise<boolean> {
    const stmt = this.preparedStatements.get('getEmailByMessageId')!;
    const result = stmt.get(messageId);
    return !!result;
  }

  /**
   * Update daily statistics
   */
  async updateDailyStats(
    emailsProcessed: number = 0,
    tasksExtracted: number = 0,
    meetingsFound: number = 0,
    errors: number = 0
  ): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    
    const stmt = this.db.prepare(`
      INSERT INTO processing_stats (
        date, emails_processed, tasks_extracted, meetings_found, errors_count
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        emails_processed = emails_processed + excluded.emails_processed,
        tasks_extracted = tasks_extracted + excluded.tasks_extracted,
        meetings_found = meetings_found + excluded.meetings_found,
        errors_count = errors_count + excluded.errors_count
    `);
    
    stmt.run(date, emailsProcessed, tasksExtracted, meetingsFound, errors);
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      logDebug('State database connection closed');
    }
  }

  /**
   * Export data for backup
   */
  async exportData(): Promise<any> {
    const emails = this.db.prepare('SELECT * FROM processed_emails').all();
    const tasks = this.db.prepare('SELECT * FROM extracted_tasks').all();
    const meetings = this.db.prepare('SELECT * FROM meetings').all();
    
    return {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      emails,
      tasks,
      meetings,
      stats: await this.getStats()
    };
  }

  /**
   * Get configuration value
   */
  getConfig(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM state_config WHERE key = ?');
    const result = stmt.get(key) as any;
    return result ? result.value : null;
  }

  /**
   * Set configuration value
   */
  setConfig(key: string, value: string): void {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO state_config (key, value) VALUES (?, ?)'
    );
    stmt.run(key, value);
  }
}

// Export singleton instance
export const stateManager = new StateManager();