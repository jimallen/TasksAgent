# CLAUDE.md - Obsidian Meeting Tasks Plugin

## Project Overview
**Standalone Obsidian plugin** that fetches meeting emails from Gmail via OAuth, extracts tasks using Claude AI, and creates organized meeting notes with a visual task dashboard.

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
- Flexible lookback time (6h, 3d, 2w, 1M)
- Batch processing up to 100 emails
- Deduplication via frontmatter cache

### Task Extraction
- Claude models: Haiku, Sonnet 4, Opus 4.1
- Extracts: tasks, assignees, priorities, dates
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
- Transcript truncation: 15,000 chars max
- Efficient caching: Frontmatter-based dedup
- Bundle size: ~65KB minified
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

## Release Checklist
- [ ] Run `npm run lint`
- [ ] Test all features
- [ ] Update version in `manifest.json`
- [ ] Build production: `npm run build`
- [ ] Test deployment: `npm run deploy`
- [ ] Create git tag
- [ ] Update documentation

## Recent Updates
- Converted to standalone plugin (no daemon)
- Added interactive deployment script
- Cleaned up all unnecessary dependencies
- Improved documentation structure
- Enhanced build process

## Future Enhancements
- Real-time email monitoring
- Custom note templates
- Bulk task operations
- Multi-vault sync
- Analytics dashboard