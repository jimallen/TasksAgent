# Task List: Meeting Transcript Task Extraction Agent

## Relevant Files

### Core Application Files
- `src/index.ts` - Main application entry point and orchestrator
- `src/index.test.ts` - Unit tests for main application
- `src/config/config.ts` - Configuration management (schedules, credentials, paths)
- `src/config/config.test.ts` - Unit tests for configuration
- `.env` - Environment variables for API keys and secrets
- `package.json` - Project dependencies and scripts
- `tsconfig.json` - TypeScript configuration

### Gmail Integration
- `src/services/gmailService.ts` - Gmail MCP connection and email fetching
- `src/services/gmailService.test.ts` - Unit tests for Gmail service
- `src/parsers/emailParser.ts` - Email pattern detection and attachment extraction
- `src/parsers/emailParser.test.ts` - Unit tests for email parser

### Task Extraction
- `src/extractors/taskExtractor.ts` - NLP-based task extraction logic
- `src/extractors/taskExtractor.test.ts` - Unit tests for task extractor
- `src/parsers/transcriptParser.ts` - Parse different transcript formats (PDF, DOC, TXT)
- `src/parsers/transcriptParser.test.ts` - Unit tests for transcript parser

### Obsidian Integration
- `src/services/obsidianService.ts` - Obsidian vault file operations
- `src/services/obsidianService.test.ts` - Unit tests for Obsidian service
- `src/templates/meetingNoteTemplate.ts` - Meeting note structure generator
- `src/templates/meetingNoteTemplate.test.ts` - Unit tests for templates

### State Management
- `src/database/stateManager.ts` - Track processed emails and tasks
- `src/database/stateManager.test.ts` - Unit tests for state manager
- `src/database/schema.ts` - Database schema definitions
- `data/processed-emails.json` - Persistent storage of processed email IDs

### Notifications
- `src/services/notificationService.ts` - Send task extraction notifications
- `src/services/notificationService.test.ts` - Unit tests for notifications

### Scheduling
- `src/scheduler/cronScheduler.ts` - Cron job management for 3x daily runs
- `src/scheduler/cronScheduler.test.ts` - Unit tests for scheduler

### Utilities
- `src/utils/logger.ts` - Logging utility for debugging and monitoring
- `src/utils/errorHandler.ts` - Centralized error handling
- `src/utils/dateFormatter.ts` - Date formatting utilities

## Notes

- Unit tests should be placed alongside code files with `.test.ts` extension
- Use `npx jest` to run all tests or `npx jest path/to/file.test.ts` for specific tests
- Environment variables should be configured in `.env` file (never commit this)
- Use TypeScript for type safety throughout the project
- Follow existing Obsidian vault structure when creating meeting notes
- Implement proper error handling and logging for production stability

## Tasks

- [x] **1.0 Setup Project Infrastructure**
  - [x] 1.1 Initialize Node.js project with `npm init` and create package.json
  - [x] 1.2 Install TypeScript and configure tsconfig.json for ES2020+ target
  - [x] 1.3 Install core dependencies (jest, dotenv, node-cron, axios)
  - [x] 1.4 Setup Jest testing framework with TypeScript support
  - [x] 1.5 Create project folder structure (src/, tests/, data/, docs/)
  - [x] 1.6 Create .env.example file with required environment variables
  - [x] 1.7 Setup ESLint and Prettier for code quality
  - [x] 1.8 Create logger utility with different log levels (debug, info, warn, error)

- [x] **2.0 Implement Gmail Integration**
  - [x] 2.1 Install and configure Gmail MCP client dependencies
  - [x] 2.2 Create gmailService.ts with authentication setup
  - [x] 2.3 Implement fetchEmails() method with date range filtering
  - [x] 2.4 Create email pattern detection for Google Meet transcripts
  - [x] 2.5 Implement attachment download functionality (PDF, DOC, TXT)
  - [x] 2.6 Add email filtering by sender domain (@google.com, @meet.google.com)
  - [x] 2.7 Write unit tests for Gmail service methods
  - [x] 2.8 Implement rate limiting to respect Gmail API quotas

- [ ] **3.0 Build Task Extraction Engine**
  - [x] 3.1 Create transcriptParser.ts to handle different file formats
  - [x] 3.2 Implement PDF parsing using pdf-parse library
  - [x] 3.3 Implement DOC/DOCX parsing using mammoth library
  - [x] 3.4 Implement plain text parsing and cleaning
  - [x] 3.5 Create taskExtractor.ts with NLP pattern matching
  - [x] 3.6 Define task patterns array ("action item:", "will do", "I'll handle", etc.)
  - [x] 3.7 Implement AI/NLP integration for advanced task detection
  - [x] 3.8 Extract meeting metadata (title, date, participants)
  - [x] 3.9 Write comprehensive unit tests with sample transcripts
  - [x] 3.10 Add confidence scoring for extracted tasks

- [ ] **4.0 Develop Obsidian Integration**
  - [x] 4.1 Create obsidianService.ts with vault path configuration
  - [x] 4.2 Implement createMeetingNote() method with proper formatting
  - [x] 4.3 Create meeting note template with metadata frontmatter
  - [x] 4.4 Implement checkbox task formatting (`- [ ] Task description`)
  - [x] 4.5 Add internal linking functionality for cross-references
  - [x] 4.6 Create /Meetings/ folder structure with date-based naming
  - [x] 4.7 Implement file existence checking to prevent overwrites
  - [x] 4.8 Write unit tests for Obsidian file operations
  - [x] 4.9 Add error handling for file system permissions

- [ ] **5.0 Create Deduplication System**
  - [x] 5.1 Design state management database schema
  - [x] 5.2 Create stateManager.ts with CRUD operations
  - [x] 5.3 Implement processed email tracking by unique ID
  - [x] 5.4 Create task comparison algorithm for duplicate detection
  - [x] 5.5 Implement JSON file storage for persistence
  - [x] 5.6 Add methods to check if email was previously processed
  - [x] 5.7 Create task hash generation for comparison
  - [x] 5.8 Implement update detection for modified transcripts
  - [x] 5.9 Write unit tests for deduplication logic
  - [x] 5.10 Add cleanup routine for old processed records

- [x] **6.0 Implement Notification System**
  - [x] 6.1 Create notificationService.ts with multiple channel support
  - [x] 6.2 Implement console notification for development
  - [x] 6.3 Add desktop notification using node-notifier
  - [x] 6.4 Create notification templates with task summaries
  - [x] 6.5 Implement error notification for processing failures
  - [x] 6.6 Add Obsidian URI links in notifications for quick access
  - [x] 6.7 Create daily summary notification aggregator
  - [x] 6.8 Write unit tests for notification formatting
  - [x] 6.9 Add notification preferences configuration

- [ ] **7.0 Setup Scheduling and Orchestration**
  - [x] 7.1 Create cronScheduler.ts using node-cron library
  - [x] 7.2 Configure 3x daily schedule (9 AM, 1 PM, 5 PM)
  - [x] 7.3 Implement main orchestration flow in index.ts
  - [x] 7.4 Add error handling and retry logic for failures
  - [x] 7.5 Create health check endpoint for monitoring
  - [x] 7.6 Implement graceful shutdown handling
  - [x] 7.7 Add manual trigger option for testing
  - [x] 7.8 Create processing queue to handle multiple transcripts
  - [x] 7.9 Write integration tests for full workflow
  - [x] 7.10 Add performance metrics and logging

- [ ] **8.0 Testing and Documentation**
  - [x] 8.1 Write comprehensive unit tests achieving >80% coverage
  - [x] 8.2 Create integration tests for end-to-end workflow
  - [x] 8.3 Add sample transcript files for testing
  - [x] 8.4 Write README.md with setup instructions
  - [x] 8.5 Create API documentation for all services
  - [x] 8.6 Add troubleshooting guide for common issues
  - [x] 8.7 Document environment variable configuration
  - [x] 8.8 Create deployment guide for production setup

- [x] **9.0 Production Readiness**
  - [x] 9.1 Add comprehensive error handling throughout application
  - [x] 9.2 Implement retry logic for transient failures
  - [x] 9.3 Add monitoring and alerting setup
  - [x] 9.4 Create backup strategy for state management
  - [x] 9.5 Optimize performance for large transcripts
  - [x] 9.6 Add security measures for API credentials
  - [x] 9.7 Create Docker container for deployment
  - [x] 9.8 Setup CI/CD pipeline configuration
  - [x] 9.9 Perform security audit and dependency updates
  - [x] 9.10 Create production configuration profile

---

*Generated from: prd-meeting-transcript-agent.md*
*Total Tasks: 85 sub-tasks across 9 parent tasks*
*Estimated Timeline: 3-4 weeks for junior developer*