# CLAUDE.md - TaskAgent Plugin

## Project Overview
**Standalone Obsidian plugin** that fetches emails from Gmail via OAuth, extracts tasks using Claude AI, and creates organized notes with a visual task dashboard.

**Version 3.0** features a **dynamic, configurable label processor architecture** that supports unlimited email types through simple configuration.

## Architecture
- **Standalone Plugin**: No external services or daemons required
- **Direct Integration**: Gmail OAuth 2.0 and Claude AI API
- **TypeScript**: Fully typed with strict mode enabled
- **Build System**: esbuild for fast bundling
- **Dynamic Processor Architecture**: Configuration-driven email processing

## Key Files

### Source Code (`src/`)
- `main.ts` - Plugin entry point and orchestrator
- `gmailService.ts` - Gmail API with OAuth authentication & label-based search
- `claudeExtractor.ts` - Claude AI task extraction (dual mode: meeting/actionitem)
- `taskDashboard.ts` - Interactive task dashboard UI
- `oauthServer.ts` - Local OAuth callback handler
- `emailProcessors/` - Dynamic processor architecture
  - `LabelProcessor.ts` - Configurable email processor
  - `ProcessorRegistry.ts` - Dynamic processor registration and routing
  - `index.ts` - Exports

### Configuration
- `manifest.json` - Plugin metadata
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `esbuild.config.js` - Build configuration
- `deploy.sh` - Interactive deployment script

## Development Commands
```bash
npm run dev          # Development build (watch mode)
npm run build        # Production build
npm run lint         # Type checking
npm run deploy       # Interactive deployment
npm run clean        # Clean build artifacts
```

## Plugin Features

### Dynamic Label Processing
- **Configuration-Driven**: Add new email types via settings, no code changes
- **Label Processors**: Each Gmail label gets its own processor
- **Custom Folders**: Organize notes by label (TaskAgent/LabelName/YYYY/MM/)
- **Prompt Types**: Different Claude prompts per label (meeting, actionitem, custom)
- **Automatic Routing**: Emails automatically routed to correct processor
- **Unlimited Scalability**: Support any number of email types

### Email Processing
- OAuth 2.0 authentication with refresh tokens
- **Label-based search**: Searches each Gmail label separately
- Flexible lookback time (6h, 3d, 2w, 1M, 3M)
- Batch processing up to 500 emails with pagination
- Automatic pagination for results >50 emails
- Newest-first sorting for relevance
- Deduplication via vault-based frontmatter cache (scales infinitely)
- Gmail links for direct email access
- Attachment metadata extraction

### Task Extraction
- Claude models: Haiku, Sonnet 4, Opus 4.1
- **Dual extraction modes**:
  - **Meeting Transcripts**: Extracts tasks from meeting conversations
  - **Action Item Emails**: Specialized extraction for regular emails
- Extracts: tasks, assignees, priorities, dates
- Captures Google Meet AI suggestions
- Smart assignee matching from participants
- Next steps with owner assignment
- Task/Next step deduplication
- Confidence scoring for accuracy
- Fallback mode without AI

### Task Dashboard
- Priority sections (High/Medium/Low)
- Interactive filtering and completion
- "My Tasks" personalized view
- Real-time statistics
- Inline task editing

### Note Organization
```
TaskAgent/
├── Transcript/
│   └── 2025/
│       └── 01/
│           └── 2025-01-15 - Team Standup.md
└── Action/
    └── 2025/
        └── 01/
            └── 2025-01-16 - Follow up.md
```

## Task Format
```markdown
- [ ] Task description [[@Assignee]] 📅 2024-12-29 ⚠️ 85% #tag
  - Context: Additional information
  > "Quote from email/transcript"
```

## Note Format
```markdown
---
title: Email Subject
emailId: 19960e976514fa1d
label: transcript
gmailUrl: https://mail.google.com/mail/u/0/#inbox/19960e976514fa1d
---

# Email Subject
**Email:** [View in Gmail](link)
**Attachments:** file.pdf (125KB)

## Email Details
**From:** sender@example.com
**Date:** 2025-01-15

## Action Items
### 🔴 High Priority
- [ ] Task [[@Owner]]

## Next Steps
### 🟡 Medium Priority
- [ ] Follow-up action [[@Assignee]]

---
**[🔄 Reprocess this email](obsidian://meeting-tasks-reprocess?id=emailId)**
```

## Configuration

### Settings Interface
```typescript
interface MeetingTasksSettings {
  // Gmail
  googleClientId: string;
  googleClientSecret: string;
  gmailLabels: string;              // Comma-separated: "transcript, action"
  lookbackTime: string;             // e.g., "3d", "1w", "1M"

  // Claude AI
  anthropicApiKey: string;
  claudeModel: string;              // haiku, sonnet-4, opus-4.1

  // Organization
  emailNotesFolder: string;         // Base folder: "TaskAgent"
  labelProcessors: LabelProcessorConfig[];

  // Dashboard
  dashboardShowOnlyMyTasks: boolean;
  dashboardMyName: string;
}

interface LabelProcessorConfig {
  label: string;                    // Gmail label name
  folderName: string;               // Subfolder name
  promptType?: 'meeting' | 'actionitem' | 'custom';
  customPrompt?: string;            // Future: custom extraction prompt
}
```

### Default Configuration
```typescript
{
  emailNotesFolder: "TaskAgent",
  gmailLabels: "transcript, action",
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

## Testing Workflow
1. Build: `npm run build`
2. Deploy: `npm run deploy`
3. Reload Obsidian: `Cmd/Ctrl + R`
4. Test email processing: `Cmd/Ctrl + Shift + M`
5. Open dashboard to verify tasks
6. Check console logs: `Ctrl+Shift+I`

## Common Development Tasks

### Adding Support for New Email Type

**No code changes needed!** Just update configuration:

1. Add label to Gmail search:
```json
{
  "gmailLabels": "transcript, action, newsletter"
}
```

2. Add processor configuration:
```json
{
  "labelProcessors": [
    {
      "label": "newsletter",
      "folderName": "Newsletter",
      "promptType": "actionitem"
    }
  ]
}
```

3. Plugin automatically handles everything:
   - Creates processor
   - Routes matching emails
   - Creates folder structure
   - Uses appropriate Claude prompt

### Modifying Task Extraction
- Update prompt in `claudeExtractor.ts:buildPrompt()` (for meeting extraction)
- Update prompt in `claudeExtractor.ts:buildActionItemPrompt()` (for action items)

### Customizing Dashboard
- Modify styles in `styles.css`
- Update logic in `taskDashboard.ts`

### Modifying Note Format
- Update `formatNote()` in `LabelProcessor.ts`

## Architecture Details

### Processor Flow
1. **Gmail Service** searches each label separately
2. **Main Plugin** retrieves emails with `searchedLabels` array
3. **Processor Registry** finds matching processor for each email
4. **Label Processor** processes email with appropriate prompt type
5. **Claude Extractor** extracts tasks based on prompt type
6. **Label Processor** creates note in label-specific folder
7. **Cache updated** in both vault and data.json

### Key Design Decisions

**Why separate label searches?**
- Accurate tracking of which label matched each email
- Prevents all emails getting all labels (from OR query)
- Enables precise processor routing

**Why vault-based caching?**
- Scales infinitely (not limited by data.json size)
- Can clear cache anytime and rebuild from vault
- Primary source of truth is the vault itself

**Why single base folder?**
- Only scan one folder for all email notes
- Simpler cache loading and file tracking
- Organized subfolders per label

## Performance Optimization
- Parallel processing: 3-5 emails concurrently
- Gmail pagination: Handles 50-100 emails per page
- Max emails: 500 per processing run
- Content truncation: 15,000 chars max
- Efficient caching: Vault scan on startup
- Bundle size: ~74KB minified
- Memory usage: ~50MB typical

### Scalability
- **1,000 emails**: ~5KB cache, instant
- **10,000 emails**: ~16KB cache, <1s vault scan
- **100,000+ emails**: ~160KB cache, <5s vault scan
- **No sharding needed**: Architecture handles scale

## Error Handling
- OAuth: Automatic token refresh
- Rate limits: Exponential backoff
- Network: Graceful degradation
- Parsing: Fallback extraction
- Missing processor: Skip email with warning

## Security Best Practices
- Store credentials in plugin settings only
- Never log sensitive data
- Use HTTPS for all API calls
- Validate all user inputs
- Handle OAuth securely

## Debugging Tips
- Console: `Ctrl+Shift+I` in Obsidian
- Check settings for API status
- Review created notes for quality
- Test without AI using fallback mode
- Gmail query logs: Look for separate label searches
- Pagination logs: "Page 1", "Page 2", "No more pages"
- Processor routing: Check which processor handles each email

## Release Checklist
- [ ] Run `npm run lint`
- [ ] Test all features
- [ ] Test with multiple label configurations
- [ ] Verify processor routing
- [ ] Update version in `manifest.json`
- [ ] Build production: `npm run build`
- [ ] Test deployment: `npm run deploy`
- [ ] Update documentation
- [ ] Create git tag

## Recent Updates (v3.0)

### Dynamic Label Processor Architecture
- **Configuration-driven**: Add email types via settings
- **No hardcoded labels**: All routing based on config
- **Unlimited processors**: Support any number of email types
- **Custom prompts**: Architecture ready for custom extraction prompts

### Single Base Folder
- All notes organized under `emailNotesFolder` (default: "TaskAgent")
- Label-based subfolders (e.g., TaskAgent/Transcript/, TaskAgent/Action/)
- Simplified caching and file tracking

### Improved Gmail Integration
- Separate label searches for accurate tracking
- Each email tagged with matched labels
- Better pagination logging

### Removed Migration Code
- Clean install without backward compatibility overhead
- Simplified settings structure

## Future Enhancements
- **Custom Prompt UI**: Visual editor for extraction templates
- **Real-time monitoring**: WebSocket-based email watching
- **Bulk operations**: Multi-task management
- **Multi-vault sync**: Cross-device synchronization
- **Analytics dashboard**: Productivity insights
- **Template engine**: Customizable note formats
- **More prompt types**: Newsletter, calendar, report, etc.

## Example: Adding Newsletter Support

1. **Settings**:
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

2. **Result**:
- Emails with "newsletter" label → TaskAgent/Newsletter/YYYY/MM/
- Uses action item extraction prompt
- Automatically routed and processed
- No code changes needed!
