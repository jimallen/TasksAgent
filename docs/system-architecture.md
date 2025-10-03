# System Architecture - TaskAgent Plugin

## Overview

The TaskAgent Plugin is a standalone Obsidian solution that integrates directly with Gmail API and Claude AI to automatically extract and manage tasks from emails. The plugin features a **dynamic, configurable label processor architecture** that allows unlimited email types through simple configuration.

## Architecture Diagram

```mermaid
graph TB
    subgraph "Obsidian Plugin"
        A[Main Plugin<br/>main.ts] --> B[Gmail Service<br/>gmailService.ts]
        A --> C[Claude Extractor<br/>claudeExtractor.ts]
        A --> C2[Task Clusterer<br/>taskClusterer.ts]
        A --> D[Task Dashboard<br/>taskDashboard.ts]
        A --> E[OAuth Server<br/>oauthServer.ts]
        A --> F[Processor Registry<br/>ProcessorRegistry.ts]

        F --> G[Label Processors<br/>LabelProcessor.ts]
        G --> H[Dynamic Routing]

        B --> I[OAuth Authentication]
        I --> J[Token Management]

        C --> K[Meeting Extraction]
        C --> L[Action Item Extraction]

        C2 --> K2[Task Clustering]
        C2 --> L2[Cluster ID Assignment]

        H --> M[Note Creation]
        M --> N[Folder Organization]

        A --> N2[Auto Clustering<br/>Post-Import]
        N2 --> C2

        D --> O[Task Visualization]
        D --> P[Task Filtering]
        D --> P2[Cluster View]
        D --> P3[Auto-Restore Clusters]
    end

    subgraph "External APIs"
        Q[Gmail API v1]
        R[Claude API<br/>Anthropic]
        S[Google OAuth 2.0]
    end

    subgraph "Local Storage"
        T[Plugin Settings<br/>data.json]
        U[OAuth Tokens]
        V[Processed Email Cache]
        W[Email Notes<br/>Vault Files]
        W2[Cluster IDs<br/>In Task Lines]
    end

    B -.-> Q
    C -.-> R
    C2 -.-> R
    E -.-> S

    A --> T
    I --> U
    A --> V
    M --> W
    L2 --> W2
    P3 --> W2

    style A fill:#f9f,stroke:#333,stroke-width:4px
    style C2 fill:#9f6,stroke:#333,stroke-width:3px
    style F fill:#f96,stroke:#333,stroke-width:3px
    style Q fill:#bbf,stroke:#333,stroke-width:2px
    style R fill:#bbf,stroke:#333,stroke-width:2px
    style S fill:#bbf,stroke:#333,stroke-width:2px
    style W2 fill:#6f9,stroke:#333,stroke-width:2px
```

## Component Architecture

### Core Components

#### 1. Main Plugin (main.ts)
- **Purpose**: Entry point and orchestrator
- **Responsibilities**:
  - Plugin lifecycle management
  - Command registration
  - Settings management
  - Event handling (file delete/rename)
  - Service initialization
  - Processor configuration

#### 2. Gmail Service (gmailService.ts)
- **Purpose**: Direct Gmail API integration
- **Features**:
  - OAuth 2.0 authentication flow
  - Token refresh management
  - **Label-based email search** (searches each label separately)
  - Email retrieval with full content
  - Attachment metadata extraction
  - Gmail URL generation for direct email access
  - Batch processing support (3-5 emails in parallel)
  - Automatic pagination (handles 50-500+ emails)
  - Rate limiting protection

#### 3. Processor Registry (ProcessorRegistry.ts)
- **Purpose**: Dynamic email routing system
- **Features**:
  - Initializes processors from settings configuration
  - Routes emails to appropriate processor based on labels
  - Supports unlimited custom processors
  - Falls back to default processor when needed

#### 4. Label Processor (LabelProcessor.ts)
- **Purpose**: Configurable email processing engine
- **Features**:
  - **Dynamic configuration** per Gmail label
  - Custom folder names per label
  - **Prompt type selection** (meeting, actionitem, custom)
  - Automatic folder creation (BaseFolder/LabelFolder/YYYY/MM/)
  - Note formatting with frontmatter
  - Email ID caching for deduplication

#### 5. Claude Extractor (claudeExtractor.ts)
- **Purpose**: AI-powered task extraction
- **Capabilities**:
  - **Meeting transcript analysis** with participant detection
  - **Action item extraction** from regular emails
  - Task identification and prioritization
  - Assignee detection from participants
  - Next steps extraction with owner assignment
  - Google Meet AI suggestions capture
  - Task/Next step deduplication
  - Confidence scoring
  - Fallback extraction mode

#### 6. Task Clusterer (taskClusterer.ts)
- **Purpose**: AI-powered task clustering and similarity detection
- **Capabilities**:
  - **Intelligent grouping** of similar/related tasks
  - **Duplicate detection** and consolidation suggestions
  - **Project-based clustering** for related work items
  - **Combination recommendations** with confidence scoring
  - **Automatic clustering** during email import
  - **Parallel processing** alongside extraction
  - **Persistent storage** via cluster IDs in task lines

#### 7. Task Dashboard (taskDashboard.ts)
- **Purpose**: Visual task management interface
- **Features**:
  - **Cluster view** with expandable groups
  - **Auto-restore** clustering from saved IDs
  - Priority-based task organization
  - Interactive task completion
  - Advanced filtering options (works in both normal and clustered views)
  - Real-time statistics
  - My Tasks/All Tasks toggle
  - Next steps visualization with assignees
  - Combined task suggestions from Claude

#### 8. OAuth Server (oauthServer.ts)
- **Purpose**: Local OAuth callback handler
- **Functions**:
  - Temporary HTTP server for OAuth flow
  - Authorization code capture
  - Token exchange handling

## Label Processor Architecture

```mermaid
graph LR
    A[Email Arrives] --> B[Gmail Service]
    B --> C{Processor Registry}

    C --> D[Get Matching Processor]
    D --> E{Match Found?}

    E -->|Yes| F[Label Processor]
    E -->|No| G[Skip Email]

    F --> H{Prompt Type}
    H -->|meeting| I[Claude: Meeting Extraction]
    H -->|actionitem| J[Claude: Action Item Extraction]
    H -->|custom| K[Claude: Custom Prompt]

    I --> L[Create Note in Label Folder]
    J --> L
    K --> L

    L --> M[TaskAgent/Label/YYYY/MM/note.md]

    style C fill:#f96,stroke:#333,stroke-width:3px
    style F fill:#6f9,stroke:#333,stroke-width:2px
    style M fill:#bbf,stroke:#333,stroke-width:2px
```

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Plugin
    participant Registry
    participant Processor
    participant Gmail
    participant Claude
    participant Clusterer
    participant Vault

    User->>Plugin: Trigger email processing
    Plugin->>Plugin: Check OAuth token

    alt Token expired
        Plugin->>Gmail: Refresh token
        Gmail-->>Plugin: New access token
    end

    Plugin->>Gmail: Search for labels separately
    Gmail-->>Plugin: Email list with searchedLabels

    Plugin->>Plugin: Filter unprocessed emails

    loop For each batch (3-5 emails)
        Plugin->>Gmail: Fetch full email
        Gmail-->>Plugin: Email content

        Plugin->>Registry: Get processor for email
        Registry-->>Plugin: Matching processor

        Plugin->>Processor: Process email
        Processor->>Claude: Extract tasks (with prompt type)
        Claude-->>Processor: Structured tasks

        Processor->>Vault: Create note in label folder
        Processor->>Plugin: Update cache

        Note over Plugin,Clusterer: Parallel clustering
        Plugin->>Clusterer: Cluster all vault tasks (background)
        Clusterer->>Vault: Load all incomplete tasks
        Clusterer->>Claude: Analyze for similarities
        Claude-->>Clusterer: Cluster assignments
        Clusterer->>Vault: Save cluster IDs to task lines
    end

    Plugin->>User: Show completion notice

    User->>Plugin: Open dashboard
    Plugin->>Vault: Load all tasks (with cluster IDs)
    Plugin->>Plugin: Auto-restore clusters from IDs
    Plugin->>User: Display task dashboard (clustered view)
```

## Configuration Model

```mermaid
graph TD
    A[Plugin Settings] --> B[Gmail Labels]
    A --> C[Email Notes Folder]
    A --> D[Label Processors Config]

    D --> E[Processor 1]
    D --> F[Processor 2]
    D --> G[Processor N...]

    E --> H[label: transcript]
    E --> I[folderName: Transcript]
    E --> J[promptType: meeting]

    F --> K[label: action]
    F --> L[folderName: Action]
    F --> M[promptType: actionitem]

    G --> N[label: custom]
    G --> O[folderName: CustomFolder]
    G --> P[promptType: custom]
    G --> Q[customPrompt: optional]

    style A fill:#f9f,stroke:#333,stroke-width:3px
    style D fill:#f96,stroke:#333,stroke-width:2px
```

### Configuration Example

```typescript
interface MeetingTasksSettings {
  gmailLabels: string;              // "transcript, action, custom"
  emailNotesFolder: string;         // "TaskAgent"
  labelProcessors: LabelProcessorConfig[];
}

interface LabelProcessorConfig {
  label: string;                    // Gmail label name
  folderName: string;               // Subfolder name
  promptType?: 'meeting' | 'actionitem' | 'custom';
  customPrompt?: string;            // Future: custom extraction prompt
}

// Example configuration:
{
  gmailLabels: "transcript, action",
  emailNotesFolder: "TaskAgent",
  labelProcessors: [
    {
      label: "transcript",
      folderName: "Transcript",
      promptType: "meeting"
    },
    {
      label: "action",
      folderName: "Action",
      promptType: "actionitem"
    }
  ]
}
```

## File Organization

```mermaid
graph TD
    A[Email Notes Organization]
    A --> B[TaskAgent/]
    B --> C[Transcript/]
    B --> D[Action/]

    C --> E[2025/]
    E --> F[01/]
    E --> G[02/]
    F --> H[2025-01-15 - Team Meeting.md]
    F --> I[2025-01-20 - Project Review.md]

    D --> J[2025/]
    J --> K[01/]
    K --> L[2025-01-15 - Follow up.md]
    K --> M[2025-01-16 - Review request.md]

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#f96,stroke:#333,stroke-width:2px
    style C fill:#bbf,stroke:#333,stroke-width:1px
    style D fill:#bbf,stroke:#333,stroke-width:1px
```

## Task Format Structure

```typescript
interface TaskStructure {
  content: string;           // Task description
  assignee?: string;         // [[@Person]]
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;         // YYYY-MM-DD format (📅 2025-01-20)
  confidence?: number;       // 0-100 percentage (⚠️ 85%)
  category?: string;        // #tag format
  context?: string;         // Additional information
  originalQuote?: string;   // From email/transcript
  clusterId?: string;       // Cluster assignment (🧩 cluster:abc123)
}
```

### Task Line Example

```markdown
- [ ] Review API documentation [[@John]] 📅 2025-01-20 🔴 🧩 cluster:cluster-1736789012-abc123 #engineering
```

**Metadata Markers:**
- `[[@John]]` - Assignee
- `📅 2025-01-20` - Due date
- `🔴` - High priority (🟡 medium, 🟢 low)
- `🧩 cluster:abc123` - Cluster ID (persisted)
- `#engineering` - Category tag

## Performance Characteristics

- **Email Processing**: Up to 500 emails per run with pagination
- **Pagination**: Automatic handling of Gmail API pages (50-100 per page)
- **Parallel Batching**: 3-5 emails processed simultaneously
- **Smart Sorting**: Newest emails processed first for relevance
- **Content Limit**: 15,000 characters per email
- **Cache Strategy**: Vault-based deduplication (scales infinitely)
- **Memory Usage**: ~50MB typical footprint
- **Build Size**: ~74KB minified bundle

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

## Scalability Features

### Email ID Caching
- **Primary**: Scans vault frontmatter on startup
- **Backup**: Stores email IDs in data.json for faster cold starts
- **Scalable**: Can handle unlimited emails (cached from vault)
- **Auto-cleanup**: Can clear data.json array anytime without data loss

### Performance at Scale
- **1,000 emails**: ~5KB cache, instant processing
- **10,000 emails**: ~16KB cache, <1s vault scan
- **100,000+ emails**: ~160KB cache, <5s vault scan
- **No sharding needed**: Vault scan architecture handles scale

## Error Handling Strategy

1. **OAuth Errors**: Token refresh with exponential backoff
2. **API Rate Limits**: Built-in rate limiting and retry logic
3. **Network Failures**: Graceful degradation with user notifications
4. **Parsing Errors**: Fallback extraction mode
5. **Cache Conflicts**: Automatic resolution with deduplication
6. **Reprocessing Safety**: Preserves file paths and handles conflicts
7. **Missing Processors**: Skips emails without configured processor

## Extensibility

### Adding New Email Types

1. **Configure in Settings**:
```json
{
  "gmailLabels": "transcript, action, newsletter",
  "labelProcessors": [
    {
      "label": "newsletter",
      "folderName": "Newsletter",
      "promptType": "actionitem"
    }
  ]
}
```

2. **Plugin automatically**:
   - Creates processor for the label
   - Routes matching emails
   - Creates organized folder structure
   - Uses appropriate Claude prompt

### Future Custom Prompts

The architecture supports custom extraction prompts (planned feature):

```typescript
{
  label: "research",
  folderName: "Research",
  promptType: "custom",
  customPrompt: "Extract research topics and questions from this email..."
}
```

## Task Clustering Architecture

### Clustering Flow

```mermaid
graph LR
    A[Email Import] --> B[Extract Tasks]
    B --> C[Batch Complete]
    C --> D[Trigger Clustering]

    D --> E[Load All Tasks]
    E --> F[Filter Incomplete]

    F --> G{Enough Tasks?}
    G -->|< 2 tasks| H[Skip]
    G -->|≥ 2 tasks| I[Send to Claude]

    I --> J[Analyze Similarities]
    J --> K[Group Related Tasks]
    K --> L[Generate Clusters]

    L --> M[Save Cluster IDs]
    M --> N[Update Task Lines]
    N --> O[🧩 cluster:xyz added]

    O --> P[Dashboard Auto-Restores]

    style D fill:#9f6,stroke:#333,stroke-width:2px
    style I fill:#bbf,stroke:#333,stroke-width:2px
    style M fill:#6f9,stroke:#333,stroke-width:2px
```

### Cluster Persistence Model

```mermaid
graph TB
    subgraph "Task Storage in Markdown"
        A[Task Line] --> B[Core Content]
        A --> C[Metadata]

        C --> D[Assignee: [[@Name]]]
        C --> E[Due Date: 📅 YYYY-MM-DD]
        C --> F[Priority: 🔴🟡🟢]
        C --> G[Cluster: 🧩 cluster:id]
        C --> H[Category: #tag]
    end

    subgraph "Cluster Loading"
        I[Dashboard Loads] --> J[Read All Tasks]
        J --> K[Extract Cluster IDs]
        K --> L{Clusters Found?}

        L -->|Yes| M[Group by Cluster ID]
        L -->|No| N[Show Normal View]

        M --> O[Build Cluster Objects]
        O --> P[Display Clustered View]
    end

    G -.-> K

    style G fill:#9f6,stroke:#333,stroke-width:2px
    style M fill:#6f9,stroke:#333,stroke-width:2px
```

### Clustering Features

1. **Automatic Clustering**: Runs in parallel after each email batch import
2. **Persistent Storage**: Cluster IDs saved directly in markdown task lines
3. **Auto-Restore**: Dashboard automatically rebuilds clusters from saved IDs
4. **Smart Grouping**: Claude analyzes task descriptions, categories, assignees, priorities
5. **Duplicate Detection**: Identifies similar or duplicate tasks
6. **Combination Suggestions**: Recommends merging related tasks with confidence scores
7. **Filter Integration**: All filters (priority, date, etc.) work in clustered view
8. **Manual Control**: Users can manually trigger re-clustering or clear clusters

## Future Architecture Considerations

- **WebSocket Support**: For real-time email monitoring
- **Custom Prompt UI**: For defining extraction templates
- **Custom Clustering Prompts**: User-defined clustering logic
- **Cluster Templates**: Save and reuse clustering configurations
- **Sync Service**: For multi-device task synchronization
- **Template Engine**: For customizable note formats
- **Analytics Dashboard**: For productivity insights with cluster insights
- **Bulk Operations**: For batch task management across clusters
