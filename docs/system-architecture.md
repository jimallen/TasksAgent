# System Architecture - Obsidian Meeting Tasks Plugin

## Overview

The Obsidian Meeting Tasks Plugin is a standalone solution that integrates directly with Gmail API and Claude AI to automatically extract and manage tasks from meeting transcripts. The plugin operates entirely within Obsidian without requiring external services or daemons.

## Architecture Diagram

```mermaid
graph TB
    subgraph "Obsidian Plugin"
        A[Main Plugin<br/>main.ts] --> B[Gmail Service<br/>gmailService.ts]
        A --> C[Claude Extractor<br/>claudeExtractor.ts]
        A --> D[Task Dashboard<br/>taskDashboard.ts]
        A --> E[OAuth Server<br/>oauthServer.ts]

        B --> F[OAuth Authentication]
        F --> G[Token Management]

        C --> H[Task Extraction]
        H --> I[Meeting Notes Creation]

        D --> J[Task Visualization]
        D --> K[Task Filtering]
    end

    subgraph "External APIs"
        L[Gmail API v1]
        M[Claude API<br/>Anthropic]
        N[Google OAuth 2.0]
    end

    subgraph "Local Storage"
        O[Plugin Settings<br/>data.json]
        P[OAuth Tokens]
        Q[Processed Email Cache]
        R[Meeting Notes<br/>Vault Files]
    end

    B -.-> L
    C -.-> M
    E -.-> N

    A --> O
    F --> P
    A --> Q
    I --> R

    style A fill:#f9f,stroke:#333,stroke-width:4px
    style L fill:#bbf,stroke:#333,stroke-width:2px
    style M fill:#bbf,stroke:#333,stroke-width:2px
    style N fill:#bbf,stroke:#333,stroke-width:2px
```

## Component Architecture

### Core Components

#### 1. Main Plugin (main.ts)
- **Purpose**: Entry point and orchestrator
- **Responsibilities**:
  - Plugin lifecycle management
  - Command registration
  - Settings management
  - Event handling
  - Service initialization

#### 2. Gmail Service (gmailService.ts)
- **Purpose**: Direct Gmail API integration
- **Features**:
  - OAuth 2.0 authentication flow
  - Token refresh management
  - Email search and retrieval
  - Attachment metadata extraction
  - Gmail URL generation for direct email access
  - Batch processing support
  - Rate limiting protection

#### 3. Claude Extractor (claudeExtractor.ts)
- **Purpose**: AI-powered task extraction
- **Capabilities**:
  - Meeting transcript analysis
  - Task identification and prioritization
  - Assignee detection from participants
  - Next steps extraction with owner assignment
  - Google Meet AI suggestions capture
  - Task/Next step deduplication
  - Confidence scoring
  - Fallback extraction mode

#### 4. Task Dashboard (taskDashboard.ts)
- **Purpose**: Visual task management interface
- **Features**:
  - Priority-based task organization
  - Interactive task completion
  - Advanced filtering options
  - Real-time statistics
  - My Tasks/All Tasks toggle
  - Next steps visualization with assignees

#### 5. OAuth Server (oauthServer.ts)
- **Purpose**: Local OAuth callback handler
- **Functions**:
  - Temporary HTTP server for OAuth flow
  - Authorization code capture
  - Token exchange handling

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Plugin
    participant Gmail
    participant Claude
    participant Vault

    User->>Plugin: Trigger email processing
    Plugin->>Plugin: Check OAuth token

    alt Token expired
        Plugin->>Gmail: Refresh token
        Gmail-->>Plugin: New access token
    end

    Plugin->>Gmail: Search for transcripts
    Gmail-->>Plugin: Email list

    Plugin->>Plugin: Filter unprocessed emails

    loop For each email
        Plugin->>Gmail: Fetch full email
        Gmail-->>Plugin: Email content

        Plugin->>Claude: Extract tasks
        Claude-->>Plugin: Structured tasks

        Plugin->>Vault: Create meeting note
        Plugin->>Plugin: Update cache
    end

    Plugin->>User: Show completion notice

    User->>Plugin: Open dashboard
    Plugin->>Vault: Load all tasks
    Plugin->>User: Display task dashboard
```

## Authentication Flow

```mermaid
graph LR
    A[User initiates auth] --> B[Open Google OAuth URL]
    B --> C[User grants permissions]
    C --> D[Google redirects with code]
    D --> E[Plugin captures code]
    E --> F[Exchange code for tokens]
    F --> G[Store refresh token]
    G --> H[Ready for API calls]

    style A fill:#f96,stroke:#333,stroke-width:2px
    style H fill:#6f9,stroke:#333,stroke-width:2px
```

## File Organization

```mermaid
graph TD
    A[Meeting Notes Organization]
    A --> B[Meetings/]
    B --> C[2025/]
    C --> D[01/]
    C --> E[02/]
    D --> F[2025-01-15-Notes-Team-Standup.md]
    D --> G[2025-01-20-Notes-Project-Review.md]
    E --> H[2025-02-01-Notes-Planning-Session.md]

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#bbf,stroke:#333,stroke-width:2px
```

## Task Format Structure

```typescript
interface TaskStructure {
  content: string;           // Task description
  assignee?: string;         // [[@Person]]
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;         // YYYY-MM-DD format
  confidence?: number;       // 0-100 percentage
  category?: string;        // #tag format
  context?: string;         // Additional information
  originalQuote?: string;   // From transcript
}
```

## Performance Characteristics

- **Email Processing**: Up to 100 emails per run
- **Parallel Batching**: 3-5 emails processed simultaneously
- **Transcript Limit**: 15,000 characters per email
- **Cache Strategy**: Frontmatter-based deduplication
- **Memory Usage**: ~50MB typical footprint
- **Build Size**: ~65KB minified bundle

## Security Model

```mermaid
graph TB
    subgraph "Security Boundaries"
        A[Local Vault Storage]
        B[Encrypted OAuth Tokens]
        C[API Key Storage]
        D[No External Servers]
    end

    subgraph "Data Privacy"
        E[Local Processing Only]
        F[No Data Persistence]
        G[Direct API Communication]
    end

    A --> B
    A --> C
    D --> E
    E --> F
    F --> G

    style A fill:#6f9,stroke:#333,stroke-width:2px
    style D fill:#6f9,stroke:#333,stroke-width:2px
```

## Deployment Architecture

```mermaid
graph LR
    A[Source Code] --> B[Build Process]
    B --> C[Production Bundle]
    C --> D[Deployment Script]
    D --> E[Vault Detection]
    E --> F[Interactive Selection]
    F --> G[Plugin Installation]
    G --> H[Obsidian Reload]

    style A fill:#f96,stroke:#333,stroke-width:2px
    style H fill:#6f9,stroke:#333,stroke-width:2px
```

## Recent Enhancements (v2.0)

### Enhanced Email Processing
- **Gmail Links**: Direct links to view emails in Gmail web interface
- **Attachment Handling**: Full attachment metadata with file sizes
- **Email Reprocessing**: One-click reprocessing with latest extraction logic

### Improved Task Extraction
- **Next Steps Recognition**: Captures Google Meet AI suggestions
- **Smart Assignee Matching**: Assigns tasks based on meeting participants
- **Deduplication Logic**: Prevents duplicate tasks and next steps
- **Priority-based Organization**: Tasks and next steps grouped by priority

### Meeting Note Features
- **Reprocess Link**: Every note includes a reprocess action
- **Protocol Handlers**: Custom `obsidian://` URLs for actions
- **Live Note Updates**: Replace existing notes when reprocessing

## Error Handling Strategy

1. **OAuth Errors**: Token refresh with exponential backoff
2. **API Rate Limits**: Built-in rate limiting and retry logic
3. **Network Failures**: Graceful degradation with user notifications
4. **Parsing Errors**: Fallback extraction mode
5. **Cache Conflicts**: Automatic resolution with deduplication
6. **Reprocessing Safety**: Preserves file paths and handles conflicts

## Future Architecture Considerations

- **WebSocket Support**: For real-time email monitoring
- **Plugin API**: For third-party integrations
- **Sync Service**: For multi-device task synchronization
- **Template Engine**: For customizable note formats
- **Analytics Dashboard**: For productivity insights