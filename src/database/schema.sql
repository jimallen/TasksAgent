-- SQLite schema for Meeting Transcript Agent
-- Version: 1.0.0

-- Processed emails table
CREATE TABLE IF NOT EXISTS processed_emails (
    id TEXT PRIMARY KEY,                    -- Gmail email ID
    message_id TEXT UNIQUE NOT NULL,        -- RFC822 Message-ID
    thread_id TEXT NOT NULL,                -- Gmail thread ID
    subject TEXT NOT NULL,                  -- Email subject
    sender TEXT NOT NULL,                   -- From email address
    email_date DATETIME NOT NULL,           -- Email date
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    transcript_hash TEXT,                   -- Hash of transcript content
    obsidian_note_path TEXT,               -- Path to Obsidian note
    extracted_tasks INTEGER DEFAULT 0,      -- Number of tasks extracted
    confidence REAL DEFAULT 0,              -- Overall confidence score (0-100)
    status TEXT CHECK(status IN ('processed', 'skipped', 'failed', 'partial')) DEFAULT 'processed',
    error_message TEXT,                     -- Error if failed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Attachments table
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,                    -- Attachment ID from Gmail
    email_id TEXT NOT NULL,                 -- Foreign key to processed_emails
    filename TEXT NOT NULL,                 -- Original filename
    mime_type TEXT,                         -- MIME type
    size_bytes INTEGER,                     -- Size in bytes
    content_hash TEXT,                      -- Content hash for dedup
    processed BOOLEAN DEFAULT 0,            -- Whether processed
    extracted_tasks INTEGER DEFAULT 0,      -- Tasks found
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_id) REFERENCES processed_emails(id) ON DELETE CASCADE
);

-- Extracted tasks table
CREATE TABLE IF NOT EXISTS extracted_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT NOT NULL,                 -- Source email
    description TEXT NOT NULL,              -- Task description
    assignee TEXT DEFAULT 'me',             -- Who it's assigned to
    priority TEXT CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
    confidence REAL DEFAULT 50,             -- Confidence score (0-100)
    category TEXT,                          -- Task category
    due_date DATE,                          -- Due date if specified
    raw_text TEXT,                          -- Original text that created this task
    obsidian_task_id TEXT,                  -- Link to Obsidian task
    status TEXT CHECK(status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending',
    content_hash TEXT NOT NULL,             -- Hash for deduplication
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_id) REFERENCES processed_emails(id) ON DELETE CASCADE
);

-- Meeting records table
CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT NOT NULL,                 -- Source email
    title TEXT NOT NULL,                    -- Meeting title
    meeting_date DATETIME NOT NULL,         -- Meeting date/time
    duration_minutes INTEGER,               -- Duration in minutes
    service TEXT CHECK(service IN ('google-meet', 'zoom', 'teams', 'unknown')) DEFAULT 'unknown',
    transcript_available BOOLEAN DEFAULT 0, -- Whether transcript was found
    obsidian_note_path TEXT,               -- Obsidian note path
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_id) REFERENCES processed_emails(id) ON DELETE CASCADE
);

-- Meeting participants junction table
CREATE TABLE IF NOT EXISTS meeting_participants (
    meeting_id INTEGER NOT NULL,
    participant_name TEXT NOT NULL,
    email_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (meeting_id, participant_name),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

-- Similar tasks tracking (for deduplication)
CREATE TABLE IF NOT EXISTS similar_tasks (
    task_id INTEGER NOT NULL,
    similar_task_id INTEGER NOT NULL,
    similarity_score REAL NOT NULL,         -- Similarity score (0-1)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, similar_task_id),
    FOREIGN KEY (task_id) REFERENCES extracted_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (similar_task_id) REFERENCES extracted_tasks(id) ON DELETE CASCADE
);

-- Processing queue table
CREATE TABLE IF NOT EXISTS processing_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT NOT NULL,                 -- Email to process
    priority INTEGER DEFAULT 5,             -- Priority (1-10, higher = more important)
    attempts INTEGER DEFAULT 0,             -- Number of attempts
    last_attempt DATETIME,                  -- Last attempt timestamp
    status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    error_message TEXT,                     -- Last error
    scheduled_for DATETIME,                 -- When to process
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- State configuration table
CREATE TABLE IF NOT EXISTS state_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Processing statistics table
CREATE TABLE IF NOT EXISTS processing_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,                     -- Stats date
    emails_processed INTEGER DEFAULT 0,     -- Emails processed that day
    tasks_extracted INTEGER DEFAULT 0,      -- Tasks extracted
    meetings_found INTEGER DEFAULT 0,       -- Meetings found
    errors_count INTEGER DEFAULT 0,         -- Processing errors
    duplicates_found INTEGER DEFAULT 0,     -- Duplicate tasks found
    average_confidence REAL DEFAULT 0,      -- Average confidence
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date)
);

-- Change log for sync tracking
CREATE TABLE IF NOT EXISTS change_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT CHECK(entity_type IN ('email', 'task', 'meeting')) NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT CHECK(action IN ('create', 'update', 'delete')) NOT NULL,
    changes TEXT,                           -- JSON of changes
    sync_status TEXT CHECK(sync_status IN ('pending', 'synced', 'failed')) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON processed_emails(message_id);
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON processed_emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_status ON processed_emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_date ON processed_emails(email_date);
CREATE INDEX IF NOT EXISTS idx_emails_processed_at ON processed_emails(processed_at);

CREATE INDEX IF NOT EXISTS idx_attachments_email_id ON attachments(email_id);
CREATE INDEX IF NOT EXISTS idx_attachments_hash ON attachments(content_hash);

CREATE INDEX IF NOT EXISTS idx_tasks_email_id ON extracted_tasks(email_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON extracted_tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON extracted_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON extracted_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON extracted_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_hash ON extracted_tasks(content_hash);

CREATE INDEX IF NOT EXISTS idx_meetings_email_id ON meetings(email_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date);

CREATE INDEX IF NOT EXISTS idx_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_scheduled ON processing_queue(scheduled_for);

CREATE INDEX IF NOT EXISTS idx_stats_date ON processing_stats(date);

-- Triggers to update timestamps
CREATE TRIGGER IF NOT EXISTS update_emails_timestamp 
    AFTER UPDATE ON processed_emails
    BEGIN
        UPDATE processed_emails SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_tasks_timestamp 
    AFTER UPDATE ON extracted_tasks
    BEGIN
        UPDATE extracted_tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_meetings_timestamp 
    AFTER UPDATE ON meetings
    BEGIN
        UPDATE meetings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_queue_timestamp 
    AFTER UPDATE ON processing_queue
    BEGIN
        UPDATE processing_queue SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Insert default configuration
INSERT OR IGNORE INTO state_config (key, value) VALUES 
    ('schema_version', '1.0.0'),
    ('auto_cleanup_days', '90'),
    ('duplicate_threshold', '0.85'),
    ('max_queue_size', '100'),
    ('retry_attempts', '3'),
    ('batch_size', '10'),
    ('enable_auto_sync', 'true'),
    ('sync_interval_hours', '1');