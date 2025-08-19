# API Reference

## Core Services

### GmailService

#### `connect(): Promise<void>`
Establishes connection to Gmail MCP server.

**Throws:**
- `Error` if connection fails

#### `fetchRecentEmails(hoursBack?: number): Promise<EmailMessage[]>`
Fetches emails from the specified time window.

**Parameters:**
- `hoursBack` (optional): Number of hours to look back (default: from config)

**Returns:**
- Array of `EmailMessage` objects

#### `searchEmails(query: GmailSearchQuery): Promise<EmailMessage[]>`
Searches Gmail with specified criteria.

**Parameters:**
```typescript
interface GmailSearchQuery {
  from?: string;
  subject?: string;
  after?: Date;
  before?: Date;
  hasAttachment?: boolean;
  label?: string;
  query?: string;
}
```

#### `readEmail(emailId: string): Promise<EmailMessage | null>`
Fetches full email content.

**Parameters:**
- `emailId`: Gmail message ID

**Returns:**
- `EmailMessage` object or null if not found

### EmailParser

#### `parseEmail(email: EmailMessage): ParsedMeetingEmail`
Analyzes email to determine if it contains meeting transcript.

**Parameters:**
```typescript
interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: Date;
  body: string;
  attachments: EmailAttachment[];
  labels: string[];
}
```

**Returns:**
```typescript
interface ParsedMeetingEmail {
  isTranscript: boolean;
  confidence: number; // 0-100
  service: 'google-meet' | 'zoom' | 'teams' | 'unknown';
  meetingInfo: {
    title?: string;
    date?: Date;
    duration?: string;
    participants?: string[];
    meetingId?: string;
  };
  transcriptLocation: 'attachment' | 'body' | 'link' | 'none';
  attachmentInfo?: EmailAttachment;
}
```

### TranscriptParser

#### `parseTranscript(buffer: Buffer, filename: string, mimeType: string): Promise<TranscriptContent>`
Extracts structured content from transcript files.

**Parameters:**
- `buffer`: File content
- `filename`: Original filename
- `mimeType`: MIME type of content

**Supported Formats:**
- PDF (`.pdf`)
- Text (`.txt`)
- VTT (`.vtt`)
- HTML (`.html`)
- Word (`.docx`)

**Returns:**
```typescript
interface TranscriptContent {
  text: string;
  metadata: {
    duration?: string;
    participants?: string[];
    timestamps?: boolean;
    wordCount?: number;
  };
  sections: Array<{
    speaker?: string;
    timestamp?: string;
    text: string;
  }>;
}
```

### ClaudeTaskExtractor

#### `extractTasks(transcript: TranscriptContent): Promise<TaskExtraction>`
Uses Claude AI to extract actionable tasks from transcript.

**Parameters:**
- `transcript`: Parsed transcript content

**Returns:**
```typescript
interface TaskExtraction {
  tasks: ExtractedTask[];
  summary: string;
  participants: string[];
  keyDecisions: string[];
  nextSteps: string[];
  confidence: number;
}

interface ExtractedTask {
  description: string;
  assignee?: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  category?: string;
  confidence: number;
}
```

### ObsidianService

#### `initialize(): Promise<void>`
Creates vault structure if needed.

**Creates:**
- `/Meetings/` directory
- `/Meetings/Archive/` directory
- `/Templates/` directory

#### `createMeetingNote(data: MeetingNoteData): Promise<string>`
Creates formatted meeting note in vault.

**Parameters:**
```typescript
interface MeetingNoteData {
  title: string;
  date: Date;
  participants: string[];
  summary: string;
  tasks: ExtractedTask[];
  decisions: string[];
  nextSteps: string[];
  originalEmail?: EmailMessage;
  confidence: number;
}
```

**Returns:**
- Path to created note

#### `linkToDaily(meetingPath: string, date: Date): Promise<void>`
Adds link to meeting in daily note.

**Parameters:**
- `meetingPath`: Path to meeting note
- `date`: Date for daily note

### StateManager

#### `initialize(): Promise<void>`
Initializes SQLite database.

#### `isEmailProcessed(emailId: string): Promise<boolean>`
Checks if email was already processed.

#### `markEmailProcessed(emailId: string, data?: any): Promise<void>`
Records email as processed.

#### `getProcessedEmails(days?: number): Promise<ProcessedEmail[]>`
Retrieves processing history.

### NotificationService

#### `send(message: string, options?: NotificationOptions): Promise<void>`
Sends notification to configured channels.

**Parameters:**
```typescript
interface NotificationOptions {
  priority?: 'high' | 'normal' | 'low';
  title?: string;
  data?: any;
  obsidianUri?: string;
}
```

**Channels:**
- `console` - Terminal output
- `desktop` - System notifications
- `obsidian` - In-app notifications
- `slack` - Webhook notifications

## Data Models

### EmailMessage
```typescript
interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: Date;
  body: string;
  attachments: EmailAttachment[];
  labels: string[];
}
```

### EmailAttachment
```typescript
interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}
```

### ProcessedEmail
```typescript
interface ProcessedEmail {
  id: string;
  emailId: string;
  processedAt: Date;
  success: boolean;
  taskCount?: number;
  error?: string;
  metadata?: any;
}
```

## Configuration

### Environment Variables
```typescript
interface Config {
  gmail: {
    hoursToLookBack: string;
    checkIntervalHours: number;
    senderDomains: string[];
    subjectPatterns: string[];
  };
  obsidian: {
    vaultPath: string;
    meetingsFolder: string;
    taskTag: string;
  };
  scheduling: {
    times: string[];
    timezone: string;
  };
  notifications: {
    enabled: boolean;
    channels: string[];
  };
  ai: {
    anthropicApiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
}
```

## Error Handling

### Error Types
```typescript
class GmailConnectionError extends Error {}
class TranscriptParseError extends Error {}
class AIExtractionError extends Error {}
class ObsidianWriteError extends Error {}
class NotificationError extends Error {}
```

### Retry Logic
- Network requests: 3 retries with exponential backoff
- AI requests: 2 retries with 5-second delay
- File operations: 1 retry with 1-second delay

## Events

### Processing Events
```typescript
agent.on('email:found', (email: EmailMessage) => {});
agent.on('transcript:parsed', (content: TranscriptContent) => {});
agent.on('tasks:extracted', (tasks: ExtractedTask[]) => {});
agent.on('note:created', (path: string) => {});
agent.on('error', (error: Error) => {});
```

## Rate Limits

### Gmail API
- 250 quota units per user per second
- Search: 5 units
- Get: 5 units
- Attachment: 5 units

### Claude API
- Based on tier (default: 50 requests/minute)
- Automatic retry with backoff on rate limit

### Obsidian
- No rate limits (local file system)

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Test Mode
```bash
npm run start:test
```

## Logging

### Log Levels
- `error` - Critical errors
- `warn` - Warning conditions
- `info` - Informational messages
- `debug` - Debug information

### Log Files
- `logs/app.log` - All logs
- `logs/error.log` - Errors only

### Log Format
```json
{
  "timestamp": "2025-08-19 18:00:00",
  "level": "info",
  "service": "meeting-transcript-agent",
  "message": "Processing email",
  "data": {}
}
```