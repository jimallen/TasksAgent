# Product Requirements Document: Meeting Tasks Obsidian Plugin

## Executive Summary
Create a standalone Obsidian plugin that integrates with a locally-running Meeting Transcript Agent service to automatically import meeting tasks and notes directly into Obsidian. The plugin will provide a user-friendly interface for configuration and manual task checking, with real-time WebSocket updates for immediate task notifications.

## Goals & Objectives
- **Primary Goal**: Enable Obsidian users to seamlessly integrate meeting transcript processing within their note-taking workflow
- **Secondary Goals**:
  - Provide intuitive in-app configuration
  - Support both automatic and manual task checking
  - Maintain separation of concerns between service and plugin

## User Stories

### As an Obsidian user:
1. I want to configure all settings within Obsidian's plugin settings interface
2. I want to manually trigger task checking from within Obsidian
3. I want to see notifications when new meeting tasks are imported
4. I want to control where meeting notes are created in my vault
5. I want to view processing status and history within Obsidian

### As a power user:
1. I want to set up automatic periodic checking for new tasks
2. I want to filter which meetings get processed
3. I want to customize the note template for imported meetings
4. I want to see detailed logs for troubleshooting

## Functional Requirements

### 1. Core Integration
- Connect to the Meeting Transcript Agent service via HTTP API
- Support both local and remote service instances
- Handle authentication securely (API keys stored in Obsidian settings)
- Process meeting transcripts and extract tasks

### 2. Configuration Interface
- **Service Connection**:
  - Service URL (default: http://localhost:3000)
  - WebSocket URL (default: ws://localhost:3000)
  - Connection test button
  - Real-time connection status indicator
  
- **Gmail Settings** (via proxy):
  - Email patterns to match (configurable list)
  - Hours lookback window (default: 120)
  - Maximum emails per check (default: 50)
  
- **AI Settings** (user-provided):
  - Anthropic API key (stored securely in plugin)
  - Model selection (default: claude-3-haiku)
  - Custom prompts for task extraction
  
- **Obsidian Integration**:
  - Target folder for meeting notes
  - Note template customization
  - Naming convention for notes
  - Tag configuration
  
- **Automation**:
  - Enable/disable automatic checking
  - Check interval (in minutes)
  - Quiet hours configuration

### 3. User Interface Components
- **Ribbon Icon**: Quick access to check for new tasks
- **Status Bar**: Display last check time and result count
- **Command Palette Commands**:
  - "Check for new meeting tasks"
  - "Open plugin settings"
  - "View processing history"
  - "Force reprocess last meeting"
  
- **Settings Tab**: Full configuration interface
- **Modal Dialogs**:
  - Processing progress indicator
  - Results summary after checking
  - Error messages with actionable steps

### 4. Processing Features
- Manual trigger via ribbon icon or command
- Automatic periodic checking (if enabled)
- Deduplication to prevent duplicate notes
- Error handling with user-friendly messages
- Retry logic for transient failures

### 5. Note Management
- Create structured meeting notes with:
  - Meeting metadata (title, date, attendees)
  - Extracted tasks with checkboxes
  - Original transcript reference
  - Automatic linking and tagging
- **Templater Integration** (optional dependency):
  - Support for Templater syntax (`{{title}}`, `{{date}}`, etc.)
  - Custom variables passed to templates:
    - `{{title}}` - Meeting title
    - `{{date}}` - Meeting date (ISO format)
    - `{{participants}}` - Comma-separated list
    - `{{tasks}}` - Formatted task list with checkboxes
    - `{{summary}}` - AI-generated summary
    - `{{decisions}}` - Key decisions list
    - `{{nextSteps}}` - Next steps list
    - `{{transcriptLink}}` - Link to original email/transcript
  - Template folder detection from Templater settings
  - Full support for tp_* commands and JavaScript execution
  - Dynamic template selection based on meeting type
  - Automatic daily note linking
  - Task priority visualization with emojis
  - Dataview query generation for task tracking
- **Duplicate Handling**: Always create new notes with timestamps to avoid overwrites
- **Caching**: Local cache of processed transcripts for offline viewing

## Non-Functional Requirements

### Performance
- Check operation should complete within 60 seconds for 50 emails
- WebSocket connection for instant updates (< 1 second latency)
- Minimal impact on Obsidian performance
- Efficient caching of processed emails and transcripts

### Reliability
- Graceful handling of service unavailability
- Clear error messages for configuration issues
- Automatic retry with exponential backoff

### Security
- Secure storage of API keys in Obsidian settings
- No logging of sensitive information
- Support for HTTPS connections

### Usability
- Zero-configuration quick start (sensible defaults)
- Inline help text for all settings
- Progressive disclosure of advanced options
- Clear status indicators

## Technical Requirements

### Plugin Architecture
- TypeScript-based implementation
- Follow Obsidian plugin API best practices
- Modular design with clear separation of concerns
- Comprehensive error handling
- Event-driven architecture for real-time updates
- Background task queue for non-blocking operations

### Dependencies
- Obsidian Plugin API (latest version)
- HTTP client for service communication
- WebSocket client for real-time updates (required)
- No external Node.js dependencies (browser-compatible only)
- Optional: Templater plugin for advanced templates

### Service Integration
- RESTful API communication with Meeting Transcript Agent
- WebSocket connection for real-time updates
- JSON-based request/response format
- Gmail authentication via service proxy (no direct OAuth)
- Health check endpoint monitoring
- Automatic reconnection with exponential backoff
- Event-based updates for new tasks and status changes

### API Endpoints Required

#### 1. Health Check
```http
GET /api/health
Response: { status: 'ok', version: string, services: {...} }
```

#### 2. Process Emails
```http
POST /api/process
Body: {
  lookbackHours?: number,
  maxEmails?: number,
  patterns?: string[],
  force?: boolean,
  anthropicApiKey: string  // User's API key from plugin
}
Response: {
  processed: number,
  meetings: MeetingNote[],
  errors: Error[]
}
```

#### 6. WebSocket Events
```typescript
// Client -> Server
ws.send({ type: 'subscribe', clientId: string });
ws.send({ type: 'unsubscribe', clientId: string });

// Server -> Client
{ type: 'task:new', data: ExtractedTask }
{ type: 'meeting:processed', data: MeetingNote }
{ type: 'status:update', data: ProcessingStatus }
{ type: 'error', data: ErrorInfo }
```

#### 3. Get Processing Status
```http
GET /api/status
Response: {
  lastRun: string,
  nextRun: string,
  stats: ProcessingStats,
  queue: QueueItem[]
}
```

#### 4. Get Configuration
```http
GET /api/config
Response: {
  gmailPatterns: string[],
  lookbackHours: number,
  notificationChannels: string[],
  obsidianPath: string
}
```

#### 5. Update Configuration
```http
PUT /api/config
Body: Partial<Configuration>
Response: { success: boolean, config: Configuration }
```

### Data Storage
- Settings stored in Obsidian's data.json
- Processing history in plugin-specific storage
- Respect Obsidian's sync preferences
- Cache processed email IDs to prevent duplicates
- Store task extraction templates locally

### Data Models

#### ExtractedTask
```typescript
interface ExtractedTask {
  description: string;
  assignee: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  dueDate?: string;
  category?: string;
  context?: string;
  rawText?: string;
}
```

#### TaskExtractionResult
```typescript
interface TaskExtractionResult {
  tasks: ExtractedTask[];
  summary: string;
  participants: string[];
  meetingDate: Date;
  keyDecisions: string[];
  nextSteps: string[];
  confidence: number;
}
```

#### MeetingNote
```typescript
interface MeetingNote {
  id: string;
  title: string;
  date: Date;
  participants: string[];
  tasks: ExtractedTask[];
  summary: string;
  transcript?: string;
  sourceEmail: string;
  processedAt: Date;
}
```

#### PluginSettings
```typescript
interface PluginSettings {
  serviceUrl: string;
  apiKey: string;
  gmailPatterns: string[];
  lookbackHours: number;
  maxEmails: number;
  anthropicApiKey: string;  // User-provided, stored securely
  claudeModel: string;
  targetFolder: string;
  noteTemplate: string;  // Basic template if Templater not used
  useTemplater: boolean;
  templaterTemplate?: string;  // Path to template in Templates folder
  templateVariables?: Record<string, string>;  // Custom variable mappings
  autoCheck: boolean;
  checkInterval: number;
  quietHours: { start: string; end: string; };
  notifications: {
    enabled: boolean;
    onNewTasks: boolean;
    onErrors: boolean;
  };
  advanced: {
    retryAttempts: number;
    timeout: number;
    cacheExpiry: number;
    enableTranscriptCache: boolean;
    webSocketReconnectDelay: number;
  };
}
```

## Acceptance Criteria

1. **Installation**: Plugin can be installed via BRAT or manual installation
2. **Configuration**: All settings configurable within Obsidian UI
3. **Manual Checking**: User can trigger task checking with single click
4. **Automatic Checking**: Optional periodic checking works reliably
5. **Note Creation**: Meeting notes created correctly in specified location
6. **Error Handling**: Clear error messages for all failure scenarios
7. **Performance**: Operations complete within acceptable time limits
8. **Documentation**: Comprehensive README with setup instructions

## MVP Scope

### Phase 1 (MVP) - Core Functionality
- Basic plugin structure and settings interface
- Manual task checking via ribbon icon
- Simple note creation with extracted tasks
- Essential configuration options
- Basic error handling
- Connection validation and testing
- Default note template
- Status bar indicators

### Phase 2 - Enhanced User Experience
- Automatic periodic checking
- Custom note templates with variables
- Processing history view with search
- Advanced filtering options
- Bulk operations support
- Keyboard shortcuts
- Quick settings panel

### Phase 3 - Advanced Features
- Multiple service instance management
- AI prompt customization UI
- Task analytics dashboard
- Export/import settings
- Collaborative features
- Advanced Templater integration features

## Implementation Details

### Templater Integration

The plugin includes a comprehensive meeting template (`meeting-tasks-template.md`) designed specifically for extracted meeting tasks. This template leverages Templater's advanced features for dynamic content generation.

#### Template Features
- **Priority-based task organization** (High 🔴, Medium 🟡, Low 🟢)
- **Automatic participant linking** using Obsidian's [[]] syntax
- **Callout boxes** for better visual organization
- **Dataview/Tasks plugin compatibility** for task queries
- **Auto-linking to daily notes** when they exist
- **Comprehensive metadata** in frontmatter
- **Confidence scoring** for AI-extracted content

#### Required Template Variables
The plugin passes these variables to Templater:
```javascript
{
  title: string,              // Meeting title
  date: string,               // Meeting date (YYYY-MM-DD)
  time: string,               // Meeting time (HH:mm)
  participants: string[],     // Array of participant names
  tasks: ExtractedTask[],     // Array of task objects
  summary: string,            // AI-generated summary
  keyDecisions: string[],     // Key decisions made
  nextSteps: string[],        // Next steps identified
  confidence: number,         // AI confidence score (0-100)
  sourceEmail: string,        // Source email ID
  transcriptLink: string,     // Link to original transcript
  meeting_type: string,       // Type of meeting
  aiModel: string,           // AI model used
  pluginVersion: string      // Plugin version
}
```

### Plugin Structure
```
obsidian-meeting-tasks/
├── src/
│   ├── main.ts                 # Plugin entry point
│   ├── settings.ts              # Settings tab and management
│   ├── api/
│   │   ├── client.ts           # HTTP client for service
│   │   ├── types.ts            # API type definitions
│   │   └── endpoints.ts        # API endpoint definitions
│   ├── services/
│   │   ├── taskProcessor.ts    # Task processing logic
│   │   ├── noteCreator.ts      # Note creation service
│   │   ├── scheduler.ts        # Auto-check scheduler
│   │   └── cache.ts            # Caching service
│   ├── ui/
│   │   ├── statusBar.ts        # Status bar component
│   │   ├── modals.ts           # Modal dialogs
│   │   └── ribbonIcon.ts       # Ribbon icon handler
│   └── utils/
│       ├── logger.ts           # Logging utilities
│       ├── validators.ts       # Input validation
│       └── formatters.ts       # Note formatting
├── styles.css                   # Plugin styles
├── manifest.json               # Plugin manifest
└── README.md                   # Documentation
```

### Error Handling Strategy
1. **Connection Errors**: Show clear error message, no queuing
2. **WebSocket Disconnection**: Auto-reconnect with exponential backoff
3. **Authentication Failures**: Clear prompt to re-enter API keys
4. **Rate Limiting**: Respect service limits, show user feedback
5. **Data Validation**: Sanitize and validate all inputs
6. **Service Unavailable**: Display error with troubleshooting steps

### Security Considerations
1. **API Key Storage**: Use Obsidian's secure storage
2. **HTTPS Only**: Enforce HTTPS for all connections
3. **Input Sanitization**: Prevent injection attacks
4. **Rate Limiting**: Implement client-side rate limiting
5. **Audit Logging**: Log all API calls for security review

## Constraints & Assumptions

### Constraints
- Must work within Obsidian's plugin sandbox
- Cannot access system resources directly
- Limited to browser-compatible JavaScript APIs
- Must respect Obsidian's rate limits

### Assumptions
- Meeting Transcript Agent service is running locally
- User provides their own Anthropic API key
- Gmail authentication handled via service proxy
- Obsidian desktop app only (no mobile support)
- User has basic understanding of plugin configuration
- Templater plugin installed (optional, for advanced templates)
- Templates stored in "Templates" folder (configurable)

## Success Metrics
- Successfully processes 95%+ of meeting transcripts
- Configuration time < 5 minutes for new users
- User-reported satisfaction score > 4/5
- Zero data loss incidents
- < 1% failure rate for API calls

## Risk Mitigation
- **Service Unavailability**: Implement offline queueing
- **API Rate Limits**: Add configurable delays and limits
- **Data Loss**: Always preserve original content
- **Version Conflicts**: Support multiple API versions
- **User Confusion**: Provide comprehensive documentation

## Migration & Deployment

### Installation Process
1. **From Community Plugins** (future)
   - Search for "Meeting Tasks" in Obsidian settings
   - Click Install and Enable

2. **Via BRAT** (beta testing)
   - Add repository URL to BRAT
   - Enable beta plugin

3. **Manual Installation**
   - Download release from GitHub
   - Extract to `.obsidian/plugins/meeting-tasks/`
   - Enable in Obsidian settings

### Migration from Standalone Service
1. **Export existing configuration** from TasksAgent
2. **Import settings** into plugin
3. **Verify connection** to service
4. **Test with sample meeting**
5. **Enable automation** if desired

### Deployment Checklist
- [ ] Validate all API endpoints
- [ ] Test with various Obsidian themes
- [ ] Verify mobile compatibility (if applicable)
- [ ] Document all settings
- [ ] Create video tutorial
- [ ] Set up support channels

## Testing Strategy

### Unit Tests
- API client methods
- Note formatting functions
- Task extraction parsing
- Cache management

### Integration Tests
- End-to-end processing flow
- Service connection handling
- Note creation in vault
- Settings persistence

### User Acceptance Tests
1. **New User Flow**: Complete setup in < 5 minutes
2. **Task Processing**: Successfully process 10 different meeting formats
3. **Error Recovery**: Gracefully handle service outages
4. **Performance**: Process 50 emails in < 30 seconds
5. **Compatibility**: Work with top 10 Obsidian themes

## Future Enhancements

### Near-term (3-6 months)
- Advanced Templater features:
  - Custom tp_* function support
  - Template inheritance
  - Conditional template selection
  - Template preview before creation
- Multiple service instance support
- Batch processing improvements
- Template marketplace with community sharing

### Long-term (6-12 months)
- AI prompt customization UI
- Meeting analytics dashboard
- Integration with other Obsidian plugins
- Multi-language support
- Voice command integration
- Meeting recording transcription

## Decisions Made

1. **Service Architecture**: Plugin connects to locally-running service (no bundling)
2. **Authentication**: Gmail via service proxy, Anthropic API key in plugin config
3. **Duplicate Handling**: Always create new notes with timestamps
4. **Mobile Support**: Not supported in initial release
5. **Template System**: Integrate with Templater plugin with custom meeting-tasks template
6. **Caching**: Enable transcript caching for offline viewing
7. **Real-time Updates**: WebSocket connection is priority feature
8. **Error Handling**: Show errors clearly, no task queuing
9. **Template Design**: Priority-based task organization with visual indicators
10. **Note Organization**: Auto-link to daily notes and participants

## Remaining Open Questions

1. **Sync Strategy**: How to handle conflicts with Obsidian Sync?
2. **Performance Monitoring**: What metrics to track and display?
3. **Template Marketplace**: Should users share custom templates?
4. **Bulk Operations**: How to handle reprocessing of multiple meetings?