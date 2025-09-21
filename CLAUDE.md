# CLAUDE.md - Obsidian Meeting Tasks Plugin

## Project Overview
**Standalone Obsidian plugin** that fetches meeting emails from Gmail via OAuth, extracts tasks using Claude AI, and creates organized meeting notes with a visual task dashboard.

**Version 2.0** includes enhanced task extraction, email reprocessing, attachment support, and smart next steps assignment.

## Architecture
- **Standalone Plugin**: No external services or daemons required
- **Direct Integration**: Gmail OAuth 2.0 and Claude AI API
- **TypeScript**: Fully typed with strict mode enabled
- **Build System**: esbuild for fast bundling

## Key Files

### Source Code (`src/`)
- `main.ts` - Plugin entry point and orchestrator
- `gmailService.ts` - Gmail API with OAuth authentication
- `claudeExtractor.ts` - Claude AI task extraction
- `taskDashboard.ts` - Interactive task dashboard UI
- `oauthServer.ts` - Local OAuth callback handler

### Configuration
- `manifest.json` - Plugin metadata
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `esbuild.config.js` - Build configuration
- `deploy.sh` - Interactive deployment script

## Development Commands
```bash
npm run dev          # Development build
npm run build        # Production build
npm run lint         # Type checking
npm run deploy       # Interactive deployment
npm run clean        # Clean build artifacts
```

## Plugin Features

### Email Processing
- OAuth 2.0 authentication with refresh tokens
- Search by Gmail labels (default: "transcript")
- Flexible lookback time (6h, 3d, 2w, 1M, 3M)
- Batch processing up to 500 emails with pagination
- Automatic pagination for results >50 emails
- Newest-first sorting for relevance
- Deduplication via frontmatter cache
- Gmail links for direct email access
- Attachment metadata extraction

### Task Extraction
- Claude models: Haiku, Sonnet 4, Opus 4.1
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
Meetings/
├── 2025/
│   ├── 01/
│   │   └── 2025-01-15-Notes-Team-Standup.md
│   └── 02/
│       └── 2025-02-01-Notes-Planning.md
```

## Task Format
```markdown
- [ ] Task description [[@Assignee]] 📅 2024-12-29 ⚠️ 85% #tag
  - Context: Additional information
  > "Quote from transcript"
```

## Meeting Note Format
```markdown
---
title: Meeting Title
emailId: 19960e976514fa1d
gmailUrl: https://mail.google.com/mail/u/0/#inbox/19960e976514fa1d
---

# Meeting Title
**Email:** [View in Gmail](link)
**Attachments:** file.pdf (125KB), presentation.pptx (2.3MB)

## Action Items
### 🔴 High Priority
- [ ] Task [[@Owner]]

## Next Steps
### 🟡 Medium Priority
- [ ] Follow-up action [[@Assignee]]

---
**[🔄 Reprocess this email](obsidian://meeting-tasks-reprocess?id=emailId)**
```

## Configuration Options
```typescript
interface Settings {
  // Gmail
  googleClientId: string;
  googleClientSecret: string;
  gmailLabels: string;        // default: "transcript"
  lookbackTime: string;       // e.g., "3d", "1w", "1M"

  // Claude AI
  anthropicApiKey: string;
  claudeModel: string;        // haiku, sonnet-4, opus-4.1

  // Organization
  notesFolder: string;        // default: "Meetings"

  // Dashboard
  dashboardShowOnlyMyTasks: boolean;
  dashboardMyName: string;
}
```

## Testing Workflow
1. Build: `npm run build`
2. Deploy: `npm run deploy`
3. Reload Obsidian: `Cmd/Ctrl + R`
4. Test email processing: `Cmd/Ctrl + Shift + M`
5. Open dashboard to verify tasks

## Common Development Tasks

### Adding New Email Patterns
Edit search query in `gmailService.ts:searchEmails()`

### Modifying Task Extraction
Update prompt in `claudeExtractor.ts:buildPrompt()`

### Customizing Dashboard
Modify styles in `styles.css` and logic in `taskDashboard.ts`

### Changing Note Format
Update `formatMeetingNote()` in `main.ts`

## Performance Optimization
- Parallel processing: 3-5 emails concurrently
- Gmail pagination: Handles 50-100 emails per page
- Max emails: 500 per processing run
- Transcript truncation: 15,000 chars max
- Efficient caching: Frontmatter-based dedup
- Bundle size: ~70KB minified
- Memory usage: ~50MB typical

## Error Handling
- OAuth: Automatic token refresh
- Rate limits: Exponential backoff
- Network: Graceful degradation
- Parsing: Fallback extraction

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
- Check Gmail query in console logs
- Verify pagination with "Page 1", "Page 2" logs
- Look for "No more pages available" message

## Release Checklist
- [ ] Run `npm run lint`
- [ ] Test all features
- [ ] Update version in `manifest.json`
- [ ] Build production: `npm run build`
- [ ] Test deployment: `npm run deploy`
- [ ] Create git tag
- [ ] Update documentation

## Recent Updates (v2.0)
- Enhanced task extraction with Google Meet AI support
- Added email reprocessing capability
- Implemented smart assignee matching
- Added Gmail links and attachment metadata
- Improved next steps handling with deduplication
- Added protocol handlers for actions
- Updated note format with reprocess links

## Future Enhancements
- Real-time email monitoring
- Custom note templates
- Bulk task operations
- Multi-vault sync
- Analytics dashboard