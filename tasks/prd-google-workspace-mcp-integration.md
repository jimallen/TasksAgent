# Product Requirements Document: Google Workspace MCP Integration

## 1. Introduction/Overview

This feature replaces the current Gmail-only MCP integration (`@gongrzhe/server-gmail-autoauth-mcp`) with a comprehensive Google Workspace MCP integration (`taylorwilsdon/google_workspace_mcp`). The implementation will be delivered in phases, starting with a direct replacement to ensure stability, followed by incremental feature additions.

### Problem Statement
The current system effectively processes meeting transcripts from Gmail but lacks the ability to:
- Automatically schedule follow-up meetings based on extracted action items
- Create and store meeting agendas in Google Drive
- Provide a complete meeting workflow automation beyond email processing

### Implementation Approach
**Phased Delivery**: To minimize risk and ensure system stability, the integration will be implemented in distinct phases:
- **Phase 1**: Direct replacement maintaining existing functionality
- **Phase 2**: Calendar integration for follow-up meetings
- **Phase 3**: Drive integration for document management

## 2. Goals

1. **Expand Integration Scope**: Enable access to Gmail, Google Calendar, and Google Drive through a unified MCP interface
2. **Automate Follow-ups**: Automatically suggest and create follow-up meetings based on extracted tasks
3. **Centralize Documentation**: Store meeting agendas and notes in Google Drive for easy access
4. **Maintain Reliability**: Ensure seamless transition from current Gmail-only functionality
5. **Enhance Productivity**: Reduce manual work in scheduling follow-ups and creating agendas

## 3. User Stories

1. **As a meeting organizer**, I want the system to suggest follow-up meetings based on extracted action items, so that I can ensure tasks are reviewed and completed on schedule.

2. **As a project manager**, I want meeting agendas automatically created and stored in Google Drive, so that all participants have easy access to meeting materials.

3. **As a team member**, I want to see calendar events created for task deadlines extracted from meetings, so that I never miss important deliverables.

4. **As an existing user**, I want all my current Gmail transcript processing to continue working, so that my workflow isn't disrupted during the upgrade.

5. **As a meeting participant**, I want follow-up meeting invites to include links to the original transcript and extracted tasks, so that I have full context for the follow-up.

## 4. Functional Requirements

### Phase 1: Direct Replacement (Core Requirements)

#### Core Integration Requirements
1. **FR-1**: Replace `@gongrzhe/server-gmail-autoauth-mcp` with `taylorwilsdon/google_workspace_mcp`
2. **FR-2**: Maintain all existing Gmail functionality:
   - Search emails with existing patterns
   - Read email content and attachments
   - Process meeting transcripts as currently implemented
   - Maintain rate limiting (250 units/sec)
3. **FR-3**: Update daemon service to use new Google Workspace MCP endpoints
4. **FR-4**: Ensure backward compatibility with existing OAuth tokens
5. **FR-5**: Maintain all existing HTTP API endpoints for Gmail operations
6. **FR-6**: Preserve current Obsidian plugin functionality

#### Phase 1 System Integration
7. **FR-7**: Update `src/daemon/gmailMcpService.ts` to launch new MCP server
8. **FR-8**: Modify `src/services/gmailService.ts` to use new endpoint structure
9. **FR-9**: Ensure all existing tests pass with new integration
10. **FR-10**: Maintain current logging and error handling

### Phase 2: Calendar Integration (Follow-up Meetings)

#### Email Processing Enhancements
11. **FR-11**: Extract and identify tasks that require follow-up meetings
12. **FR-12**: Parse deadlines and suggested meeting times from transcript content

#### Calendar Integration Features
13. **FR-13**: Implement Google Calendar integration for event creation
14. **FR-14**: Create calendar events for extracted task deadlines
15. **FR-15**: Suggest follow-up meetings based on task complexity and deadlines
16. **FR-16**: Generate calendar events with:
    - Appropriate attendees (extracted from original meeting)
    - Suggested duration based on task count
    - Link to original transcript in event description
    - List of relevant action items in event description

#### Phase 2 System Updates
17. **FR-17**: Add calendar-specific HTTP API endpoints
18. **FR-18**: Update Obsidian plugin to display suggested follow-ups
19. **FR-19**: Implement OAuth scope expansion for Calendar access

### Phase 3: Drive Integration (Document Management)

#### Drive Integration Features
20. **FR-20**: Implement Google Drive integration for document storage
21. **FR-21**: Create meeting agenda documents in Google Drive for follow-up meetings
22. **FR-22**: Store processed transcripts in organized Drive folders
23. **FR-23**: Generate agenda documents that include:
    - Previous meeting summary
    - Outstanding action items
    - Suggested discussion topics
    - Links to relevant documents

#### Phase 3 System Updates
24. **FR-24**: Add Drive-specific HTTP API endpoints
25. **FR-25**: Update Obsidian plugin to show Drive storage locations
26. **FR-26**: Implement OAuth scope expansion for Drive access

## 5. Non-Goals (Out of Scope)

1. **Integration with non-Google calendar systems** (Outlook, Apple Calendar)
2. **Real-time calendar conflict resolution** - suggestions only, no automatic rescheduling
3. **Google Docs editing** - only creation and storage, no content manipulation
4. **Google Sheets integration** - not needed for current use cases
5. **Multi-account support** - single Google Workspace account per installation
6. **Retroactive processing** - no migration of previously processed transcripts to Drive

## 6. Design Considerations

### User Interface Updates
- Add "Suggested Follow-ups" section in Obsidian plugin dashboard
- Display calendar integration status in daemon TUI
- Show Drive storage location for transcripts in processed email notifications

### Workflow Design
1. Email arrives with meeting transcript
2. System extracts tasks and deadlines
3. For tasks requiring follow-up:
   - Suggest calendar event with appropriate timing
   - Generate draft agenda document
   - Present suggestions to user for approval
4. Upon user approval:
   - Create calendar event
   - Upload agenda to Drive
   - Link all components together

## 7. Technical Considerations

### Phase 1: Direct Replacement

#### Dependencies
- Remove: `@gongrzhe/server-gmail-autoauth-mcp`
- Add: `taylorwilsdon/google_workspace_mcp`
- Ensure compatibility with existing Node.js version

#### OAuth Scopes (Phase 1)
- Maintain existing Gmail scopes only
- Use same OAuth credentials location
- No new permission requests needed

#### Testing Strategy
- Run full existing test suite
- Verify all Gmail operations work identically
- Load test to ensure rate limiting still functions
- Test with existing authenticated users

### Phase 2: Calendar Integration

#### OAuth Scopes (Phase 2)
- Add Calendar scopes: `calendar.events`, `calendar.readonly`
- Implement scope upgrade flow for existing users
- Handle mixed permission scenarios gracefully

#### API Rate Limits
- Calendar API: 1,000,000 queries/day
- Implement separate rate limiter for Calendar

### Phase 3: Drive Integration

#### OAuth Scopes (Phase 3)
- Add Drive scopes: `drive.file`, `drive.metadata`
- Second scope upgrade for Drive permissions

#### API Rate Limits
- Drive API: 1,000,000,000 queries/day
- Implement separate rate limiter for Drive

### Data Migration
- No data migration required (per requirement #8)
- Clean removal of old Gmail MCP configuration in Phase 1
- Progressive OAuth permission expansion in Phases 2 & 3

## 8. Success Metrics

### Phase 1 Success Criteria
1. **Functionality Preservation**: 100% of existing Gmail processing features continue working
2. **Performance Parity**: No degradation in email processing speed
3. **Zero Downtime Migration**: Seamless transition for existing users
4. **Test Coverage**: All existing tests pass without modification
5. **Error Rate**: Maintain or improve current error rates

### Phase 2 Success Criteria
1. **Calendar Integration**: Successfully create events for 90% of meetings with follow-up tasks
2. **User Adoption**: 75% of users utilize follow-up meeting suggestions within first month
3. **Efficiency Gain**: Reduce time spent on follow-up scheduling by 50%
4. **Accuracy**: 85% of suggested follow-up times deemed appropriate by users

### Phase 3 Success Criteria
1. **Storage Organization**: All transcripts organized in Drive with 99% retrieval success rate
2. **Agenda Quality**: 80% of generated agendas require minimal manual editing
3. **Document Accessibility**: All team members can access relevant documents within 2 clicks
4. **System Reliability**: Maintain 99.9% uptime across all services

## 9. Open Questions

### Phase 1 Questions (Immediate)
1. **MCP Compatibility**: Are there any breaking changes in the Google Workspace MCP API compared to the Gmail-only MCP?
2. **Authentication Migration**: Can existing OAuth tokens be reused, or do users need to re-authenticate?
3. **Endpoint Mapping**: Does the new MCP use the same endpoint structure for Gmail operations?

### Phase 2 Questions (Calendar)
1. **Calendar Permissions**: Should the system have permission to see existing calendar events to avoid conflicts, or only create new events?
2. **Follow-up Timing**: What heuristics should determine when a follow-up meeting is suggested?
   - Task deadline proximity?
   - Number of action items?
   - Explicit mentions in transcript?
3. **Approval Workflow**: Should calendar events be created immediately or require user approval?
   - Could have a setting for auto-create vs. manual approval

### Phase 3 Questions (Drive)
1. **Drive Organization**: What folder structure should be used for storing transcripts and agendas?
   - By date? By meeting type? By project?
2. **Agenda Templates**: Should we support customizable agenda templates for different meeting types?
3. **Storage Limits**: How should we handle Google Drive storage quotas?

### General Questions
1. **Permission Handling**: How should the system handle cases where users have limited Google Workspace access (e.g., Gmail only)?
   - Graceful degradation?
   - Feature flags?
2. **Notification Strategy**: How should users be notified of suggested follow-ups?
   - Through Obsidian plugin?
   - Email notifications?
   - Slack integration?

## 10. Implementation Timeline

### Phase 1: Direct Replacement
**Duration**: 1-2 weeks
- Week 1: Integration, testing, validation
- Week 2: Deployment, monitoring, bug fixes

### Phase 2: Calendar Integration
**Duration**: 2-3 weeks
- Week 1: Calendar API integration
- Week 2: Follow-up suggestion logic
- Week 3: UI updates and testing

### Phase 3: Drive Integration
**Duration**: 2-3 weeks
- Week 1: Drive API integration
- Week 2: Agenda generation logic
- Week 3: Organization system and testing

---

*PRD Generated: 2025-01-19*
*Feature: Google Workspace MCP Integration*
*Version: 2.0 (Phased Approach)*