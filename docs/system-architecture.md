# System Architecture

## Overview

The Meeting Transcript Agent is an automated system that monitors Gmail for meeting transcripts, extracts actionable tasks using AI, and creates organized notes in your Obsidian vault. The system can run as a scheduled cron job or as a persistent background daemon with a Terminal User Interface (TUI) for real-time monitoring and control.

## Architecture Diagram

```mermaid
graph TB
    subgraph "Email Sources"
        GM[Gmail MCP Server]
        GN[Google Gemini Notes]
        GT[Google Meet Transcripts]
        ZM[Zoom Recordings]
        TM[Teams Transcripts]
    end
    
    subgraph "HTTP Services Layer"
        GMCPHTTP[Gmail MCP HTTP<br/>Port 3000<br/>stdio-to-HTTP bridge]
        DAEMONHTTP[Daemon HTTP API<br/>Port 3002<br/>Control & Triggers]
    end
    
    subgraph "Daemon Service Layer"
        DS[DaemonService]
        TUI[TUI Interface]
        PROC[EmailProcessor]
    end
    
    subgraph "Obsidian Plugin"
        OPLUGIN[Meeting Tasks Plugin]
        DASH[Task Dashboard]
        SETTINGS[Plugin Settings]
    end
    
    subgraph "Core Agent"
        GS[GmailService]
        EP[EmailParser]
        TP[TranscriptParser]
        CE[ClaudeTaskExtractor]
        OS[ObsidianService]
        NS[NotificationService]
        SM[StateManager]
    end
    
    subgraph "External Services"
        GMCP[Gmail MCP Process<br/>OAuth Authentication]
        CLAUDE[Claude AI API<br/>Task Extraction]
        OBS[Obsidian Vault<br/>Note Storage]
    end
    
    subgraph "Storage"
        DB[(SQLite Database)]
        STATS[(Daemon Stats DB)]
        LOGS[Log Files]
        VDATA[(Plugin data.json)]
    end
    
    GM --> GMCP
    GN --> GMCP
    GT --> GMCP
    ZM --> GMCP
    TM --> GMCP
    
    GMCP -.stdio.-> GMCPHTTP
    GMCPHTTP -.HTTP.-> OPLUGIN
    
    OPLUGIN --> DAEMONHTTP
    SETTINGS --> VDATA
    OPLUGIN --> DASH
    
    DAEMONHTTP --> DS
    TUI --> DS
    DS --> PROC
    DS --> STATS
    PROC --> GS
    
    GS --> EP
    EP --> TP
    TP --> CE
    CE --> CLAUDE
    CE --> OS
    OS --> OBS
    
    GS --> SM
    SM --> DB
    
    OS --> NS
    CE --> NS
    
    GS --> LOGS
    EP --> LOGS
    CE --> LOGS
    DS --> LOGS
```

## Component Flow

```mermaid
sequenceDiagram
    participant User
    participant Scheduler
    participant Gmail
    participant Parser
    participant Claude
    participant Obsidian
    participant Notifier
    
    User->>Scheduler: Start Agent
    Scheduler->>Gmail: Fetch Recent Emails
    Gmail->>Gmail: Search for Meeting Patterns
    Gmail-->>Parser: Return Matching Emails
    Parser->>Parser: Identify Transcript Type
    Parser->>Parser: Extract Content
    Parser-->>Claude: Send Transcript
    Claude->>Claude: Extract Tasks & Summary
    Claude-->>Obsidian: Return Structured Data
    Obsidian->>Obsidian: Create Meeting Note
    Obsidian->>Obsidian: Link to Daily Note
    Obsidian-->>Notifier: Success Status
    Notifier-->>User: Desktop Notification
```

## Data Flow

```mermaid
graph LR
    subgraph "Input"
        E1[Email with Attachment]
        E2[Email with Body Text]
        E3[Email with Link]
    end
    
    subgraph "Processing"
        P1[Parse Email]
        P2[Extract Transcript]
        P3[AI Analysis]
        P4[Task Extraction]
    end
    
    subgraph "Output"
        O1[Meeting Note]
        O2[Task List]
        O3[Daily Note Link]
        O4[Notifications]
    end
    
    E1 --> P1
    E2 --> P1
    E3 --> P1
    P1 --> P2
    P2 --> P3
    P3 --> P4
    P4 --> O1
    P4 --> O2
    O1 --> O3
    O1 --> O4
```

## Component Details

### Gmail Service
- **Purpose**: Interface with Gmail via MCP protocol
- **Authentication**: OAuth 2.0 via Gmail MCP server
- **Operations**:
  - Search emails by patterns
  - Read email content
  - Download attachments
  - Mark emails as processed

### Email Parser
- **Purpose**: Identify meeting transcript emails
- **Patterns Detected**:
  - Google Meet recordings
  - Zoom recordings
  - Teams transcripts
  - Gemini meeting notes
- **Confidence Scoring**: 0-100% based on pattern matches

### Transcript Parser
- **Purpose**: Extract structured content from various formats
- **Supported Formats**:
  - PDF documents
  - Text files
  - VTT subtitles
  - HTML content
  - Plain text body

### Claude Task Extractor
- **Purpose**: AI-powered task and insight extraction
- **Extracts**:
  - Action items with assignees
  - Key decisions
  - Meeting summary
  - Participants
  - Next steps
  - Priority levels

### Obsidian Service
- **Purpose**: Create and organize meeting notes
- **Features**:
  - Hierarchical folder structure (Year/Month)
  - Frontmatter metadata
  - Task formatting with checkboxes
  - Daily note linking
  - Participant linking

### State Manager
- **Purpose**: Track processed emails and prevent duplicates
- **Storage**: SQLite database
- **Tracks**:
  - Processed email IDs
  - Task history
  - Processing errors
  - Performance metrics

### Notification Service
- **Purpose**: Multi-channel notifications
- **Channels**:
  - Console output
  - Desktop notifications (native)
  - Obsidian in-app
  - Slack webhooks
- **Priority Levels**: High, Normal, Low

### Cron Scheduler
- **Purpose**: Automated periodic processing
- **Default Schedule**: 9 AM, 1 PM, 5 PM
- **Modes**:
  - Continuous (scheduled)
  - Once (single run)
  - Test (validation only)

## Daemon Service Architecture

### Overview
The daemon service provides a persistent background process with real-time monitoring capabilities through a Terminal User Interface (TUI). It includes an embedded HTTP API server for external control and integration with the Obsidian plugin.

```mermaid
graph TB
    subgraph "Daemon Components"
        DAEMON[daemon.ts<br/>Entry Point]
        SERVICE[DaemonService<br/>Core Service]
        HTTP[DaemonHttpServer<br/>HTTP API]
        TUI[TUIInterface<br/>Terminal UI]
        PROC[EmailProcessor<br/>Wrapper]
    end
    
    subgraph "TUI Panels"
        STATUS[Service Status]
        STATS[Statistics Table]
        GAUGE[Success Rate]
        SCHED[Next Runs]
        ERRORS[Error Panel]
        LOGS[Activity Log]
        MENU[F-Key Controls]
    end
    
    subgraph "Data Persistence"
        STATSDB[(daemon-stats.db)]
        STATE[(state.db)]
    end
    
    DAEMON --> SERVICE
    DAEMON --> HTTP
    DAEMON --> TUI
    HTTP --> SERVICE
    SERVICE --> PROC
    SERVICE --> STATSDB
    PROC --> STATE
    
    TUI --> STATUS
    TUI --> STATS
    TUI --> GAUGE
    TUI --> SCHED
    TUI --> ERRORS
    TUI --> LOGS
    TUI --> MENU
```

### Service States
```mermaid
stateDiagram-v2
    [*] --> Stopped
    Stopped --> Running: Start (F1)
    Running --> Processing: Manual (F3) or Scheduled
    Processing --> Running: Complete
    Running --> Stopped: Stop (F2)
    Processing --> Error: Failure
    Error --> Running: Recovery
    Running --> Error: Critical Error
    Error --> Stopped: Stop (F2)
```

### TUI Controls
- **F1**: Start service
- **F2**: Stop service
- **F3**: Process emails manually
- **F4**: Clear statistics
- **F5**: View application logs
- **F6**: Edit configuration
- **Q**: Quit TUI (service continues)

## Security Architecture

```mermaid
graph TB
    subgraph "Authentication Layer"
        OAUTH[OAuth 2.0]
        REFRESH[Refresh Tokens]
        KEYS[API Keys]
    end
    
    subgraph "Secure Storage"
        ENV[.env File]
        GMCP[~/.gmail-mcp/]
        CREDS[Encrypted Credentials]
    end
    
    subgraph "Access Control"
        GMAIL[Gmail Scopes]
        CLAUDE[Claude API Limits]
        FS[File System Permissions]
    end
    
    OAUTH --> GMCP
    REFRESH --> GMCP
    KEYS --> ENV
    
    GMCP --> GMAIL
    ENV --> CLAUDE
    ENV --> FS
```

## Error Handling

```mermaid
stateDiagram-v2
    [*] --> FetchEmails
    FetchEmails --> ParseEmail: Success
    FetchEmails --> RetryFetch: Network Error
    RetryFetch --> FetchEmails: Retry < 3
    RetryFetch --> LogError: Retry >= 3
    
    ParseEmail --> ExtractTasks: Valid Transcript
    ParseEmail --> SkipEmail: Invalid Format
    
    ExtractTasks --> CreateNote: Tasks Found
    ExtractTasks --> LogNoTasks: No Tasks
    
    CreateNote --> Notify: Success
    CreateNote --> LogError: Write Failed
    
    Notify --> [*]: Complete
    LogError --> [*]: Failed
    LogNoTasks --> [*]: Complete
    SkipEmail --> [*]: Skipped
```

## Performance Considerations

### Rate Limiting
- Gmail API: 250 quota units per user per second
- Claude API: Based on tier (default: 50 requests/minute)
- Batch processing: Up to 50 emails per run

### Caching Strategy
- Email metadata cached for 30 days
- Processed email IDs stored indefinitely
- Transcript content not cached (privacy)

### Resource Usage
- Memory: ~100-200MB typical
- CPU: Burst usage during AI processing
- Disk: Minimal (logs + SQLite database)
- Network: Proportional to email volume

## HTTP Server Architecture

### Dual HTTP Server Design
The system uses two separate HTTP servers for different purposes. See [HTTP Server Architecture Documentation](./ARCHITECTURE_HTTP_SERVERS.md) for detailed explanation.

```mermaid
graph LR
    subgraph "Port 3000"
        GMCPHTTP[Gmail MCP HTTP<br/>stdio-to-HTTP bridge]
        GMCPSTDIO[Gmail MCP Process<br/>stdio communication]
    end
    
    subgraph "Port 3002"
        DAEMONAPI[Daemon HTTP API<br/>Control endpoints]
        DAEMONCORE[Daemon Service<br/>Email processing]
    end
    
    subgraph "Clients"
        PLUGIN[Obsidian Plugin]
        CURL[curl/HTTP clients]
    end
    
    PLUGIN -->|Search emails| GMCPHTTP
    PLUGIN -->|Trigger processing| DAEMONAPI
    CURL -->|Status/Control| DAEMONAPI
    
    GMCPHTTP <-->|stdio| GMCPSTDIO
    DAEMONAPI --> DAEMONCORE
```

#### Why Two Servers?
1. **Gmail MCP HTTP (Port 3000)**: Required because Obsidian plugins cannot spawn processes or use stdio
2. **Daemon HTTP API (Port 3002)**: Provides control interface for the daemon service

They cannot be combined because Gmail MCP is an external NPM package that only supports stdio communication.

## Meeting Platform Configuration

The system supports configurable meeting platforms through the Obsidian plugin settings:

```mermaid
graph TB
    subgraph "Plugin Settings"
        PLAT[Meeting Platforms]
        GMEET[Google Meet ✓]
        ZOOM[Zoom ✓]
        TEAMS[Teams ✗]
        GENERIC[Generic Meetings ✓]
    end
    
    subgraph "API Parameters"
        PARAMS[{
            lookbackHours: 520,
            meetingPlatforms: {...}
        }]
    end
    
    subgraph "Email Search Queries"
        Q1[from:gemini-notes@google.com]
        Q2[from:noreply@zoom.us]
        Q3[subject:"meeting notes"]
    end
    
    PLAT --> PARAMS
    PARAMS -->|/trigger endpoint| DAEMONAPI[Daemon API]
    DAEMONAPI --> Q1
    DAEMONAPI --> Q2
    DAEMONAPI --> Q3
```

## Deployment Options

### Local Development
```bash
npm install
npm run build
npm run start:test  # Test connections
npm run daemon      # Run with TUI
```

### Production Deployment

#### Option 1: Daemon with TUI
```bash
npm ci --production
npm run build
npm run daemon      # Interactive monitoring
```

#### Option 2: Headless Daemon
```bash
npm ci --production
npm run build
npm run daemon:headless  # Background service
```

#### Option 3: Systemd Service (Linux)
```bash
npm ci --production
npm run build
sudo npm run daemon:install
sudo systemctl start meeting-transcript-agent@$USER
sudo systemctl enable meeting-transcript-agent@$USER
```

#### Option 4: Classic Cron Mode
```bash
npm ci --production
npm run build
npm start
```

### Docker Deployment
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

### Systemd Service
```ini
[Unit]
Description=Meeting Transcript Agent
After=network.target

[Service]
Type=simple
User=username
WorkingDirectory=/path/to/agent
ExecStart=/usr/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```