# Product Requirements Document: Meeting Transcript Task Extraction Agent

## 1. Introduction/Overview

The Meeting Transcript Task Extraction Agent is an automated system that monitors Gmail for Google Meet transcripts, intelligently extracts action items and tasks from meeting content, and organizes them in an Obsidian vault. This agent eliminates manual task tracking from meetings, ensuring no action items are missed while maintaining a searchable, organized task repository.

### Problem Statement
Currently, action items discussed in meetings get buried in lengthy transcripts, requiring manual review and extraction. This leads to missed tasks, delayed follow-ups, and inefficient task management workflows.

## 2. Goals

- **Primary Goal**: Automatically extract and organize 100% of action items from meeting transcripts within 8 hours of receipt
- **Reduce Manual Work**: Eliminate manual transcript review for task extraction
- **Prevent Task Loss**: Ensure zero action items are missed or duplicated
- **Improve Searchability**: Create a structured, searchable task repository in Obsidian
- **Enable Proactive Task Management**: Provide timely notifications of new tasks

## 3. User Stories

1. **As a meeting participant**, I want my action items automatically extracted from meeting transcripts so that I never miss a commitment made during meetings.

2. **As a task manager**, I want all my meeting tasks organized in Obsidian with proper context so that I can easily review and prioritize my workload.

3. **As a busy professional**, I want to be notified when new tasks are extracted so that I can immediately plan their execution.

4. **As an Obsidian user**, I want meeting tasks properly linked to their source meetings so that I can always reference the full context when needed.

## 4. Functional Requirements

1. **Gmail Monitoring**
   - Check Gmail inbox 3 times daily (suggested: 9 AM, 1 PM, 5 PM)
   - Identify Google Meet transcript emails through pattern recognition
   - Process transcript attachments (PDF, DOC, or TXT formats)

2. **Task Extraction**
   - Use NLP/AI to identify action items from transcript text
   - Recognize various task patterns (e.g., "action item:", "will do", "I'll handle", "todo:", "follow up on")
   - Extract task description and any mentioned context
   - Assign all extracted tasks to the user

3. **Obsidian Integration**
   - Create meeting notes in `/Meetings/YYYY-MM-DD-MeetingTitle.md` format
   - Format tasks as checkbox items: `- [ ] Task description`
   - Include meeting metadata (date, participants if available, duration)
   - Link tasks to their source meeting note using Obsidian's internal linking

4. **Deduplication Logic**
   - Track processed email IDs to avoid reprocessing
   - For updated transcripts, compare extracted tasks against existing ones
   - Only add genuinely new tasks not previously captured
   - Maintain a processing log to track all operations

5. **Notification System**
   - Send notification summary after each processing run
   - Include count of new tasks extracted
   - List task descriptions with links to Obsidian notes
   - Alert if processing errors occur

6. **Email Pattern Detection**
   - Identify Google Meet transcripts by:
     - Sender domain (@google.com, @meet.google.com)
     - Subject patterns ("Recording of", "Transcript for", "Meeting notes")
     - Attachment presence and types

## 5. Non-Goals (Out of Scope)

- Processing transcripts from non-Google Meet sources (Zoom, Teams, etc.)
- Task assignment to other team members
- Setting task due dates or priorities automatically
- Editing or modifying existing tasks in Obsidian
- Processing video or audio recordings directly
- Integration with external task management tools (Jira, Asana, etc.)
- Real-time processing (instant processing as emails arrive)

## 6. Design Considerations

### Obsidian Note Structure
```markdown
# Meeting: [Meeting Title]
Date: [[YYYY-MM-DD]]
Participants: [If available]
Transcript Email ID: [Unique identifier]

## Action Items
- [ ] Task 1 description
- [ ] Task 2 description
- [ ] Task 3 description

## Meeting Context
[Optional: Key discussion points or summary]

---
*Processed: [Timestamp]*
```

### Notification Format
```
📋 New Tasks Extracted
✅ 3 new tasks from "Product Planning Meeting"
• Review Q4 roadmap priorities
• Send budget proposal to finance
• Schedule follow-up with design team

View in Obsidian: [[2024-01-15-Product-Planning]]
```

## 7. Technical Considerations

- **Gmail MCP Server**: Utilize Gmail MCP for email access and monitoring
- **Processing Engine**: Implement robust NLP for task extraction (GPT-based or similar)
- **Obsidian API**: Use Obsidian's file system access or API for vault manipulation
- **State Management**: Maintain database of processed emails and extracted tasks
- **Error Handling**: Graceful handling of malformed transcripts or connection issues
- **Rate Limiting**: Respect Gmail API quotas and implement appropriate throttling

## 8. Success Metrics

1. **Task Capture Rate**: ≥95% of actual action items successfully extracted
2. **Processing Time**: All transcripts processed within 30 minutes of scheduled check
3. **Duplicate Rate**: <1% duplicate tasks created
4. **System Uptime**: 99% availability during scheduled check times
5. **User Satisfaction**: Reduction in manually tracked tasks by >90%
6. **False Positive Rate**: <5% of extracted items are not actual tasks

## 9. Open Questions

1. **Task Prioritization**: Should the agent attempt to infer task priority from context?
2. **Meeting Types**: Should different meeting types (1:1, team, client) be handled differently?
3. **Archive Strategy**: How long should processed transcripts be retained in Gmail?
4. **Backup Strategy**: Should there be a fallback if Obsidian is unavailable?
5. **Multi-language Support**: Will transcripts be in languages other than English?
6. **Integration Expansion**: Future integration with calendar for meeting context?
7. **Task Grouping**: Should related tasks be grouped or tagged together?
8. **Participant Mentions**: Should the agent track who else was assigned tasks (for reference only)?

---

*Document Version: 1.0*
*Created: 2024-01-15*
*Status: Draft - Awaiting Review*