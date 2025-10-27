# Task Dashboard User Guide

> Complete guide to using the Meeting Tasks plugin dashboard for task management, filtering, and AI-powered clustering.

## Table of Contents

- [Overview](#overview)
- [Opening the Dashboard](#opening-the-dashboard)
- [Dashboard Layout](#dashboard-layout)
- [View Modes](#view-modes)
- [Filters](#filters)
- [Task Management](#task-management)
- [Clustering Features](#clustering-features)
- [Configuration](#configuration)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Tips & Tricks](#tips--tricks)
- [Troubleshooting](#troubleshooting)

## Overview

The Task Dashboard provides an interactive, visual interface for managing all tasks extracted from your emails. It features:

- **Two view modes**: Normal list view and AI-clustered view
- **Multi-filter support**: Combine filters to find exactly what you need
- **Inline editing**: Complete and edit tasks without leaving the dashboard
- **Persistent clustering**: Task groupings saved across sessions
- **Real-time updates**: Changes immediately reflected in your notes

## Opening the Dashboard

There are three ways to open the Task Dashboard:

### 1. Command Palette
1. Press `Cmd/Ctrl + P` to open command palette
2. Type "Show task dashboard"
3. Press `Enter`

### 2. Ribbon Icon
- Click the **checkmark icon** (✓) in the left sidebar ribbon

### 3. Hotkey (if configured)
- Set a custom hotkey in Settings → Hotkeys → "Show task dashboard"

The dashboard opens in a new pane to the right of your current note.

## Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│  Task Dashboard                          [×]         │
├─────────────────────────────────────────────────────┤
│  Statistics Bar:                                    │
│  📊 Total: 24  ✓ Done: 8  📋 Active: 16            │
├─────────────────────────────────────────────────────┤
│  Filters:                                           │
│  [🔴 High] [🟡 Medium] [⏰ Past Due]                │
│  [📅 This Week] [👥 Delegated] [✅ Done]           │
├─────────────────────────────────────────────────────┤
│  View Controls:                                     │
│  [Show Clustered View ▼]                           │
│    ↳ [Re-cluster ▼]                                │
│       • Smart (new tasks only)                     │
│       • Force (all tasks)                          │
├─────────────────────────────────────────────────────┤
│  Task List / Clusters:                             │
│                                                     │
│  [Task cards grouped by assignee/cluster]          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## View Modes

### Normal List View (Default)

Tasks are displayed grouped by assignee in priority order:

```markdown
## Your Name (@YourName)

### 🔴 High Priority
- [ ] Review API documentation [[@You]] 📅 2025-02-01 🔴
- [ ] Fix critical bug [[@You]] 📅 2025-01-28 🔴

### 🟡 Medium Priority
- [ ] Update README [[@You]] 📅 2025-02-03 🟡

## Other Assignee (@TeamMember)

### 🔴 High Priority
- [ ] Deploy to production [[@TeamMember]] 📅 2025-01-30 🔴
```

**Key features:**
- Always shows your tasks first
- Groups by priority within each assignee
- Shows task metadata (dates, confidence, clusters)
- Click checkbox to mark complete

### Clustered View

Tasks are grouped by AI-identified relationships:

```markdown
📦 Cluster: API Documentation & Testing
💡 Claude suggests: These tasks are related to API updates - consider coordinating deployment.

- [ ] Review API documentation [[@You]] 📅 2025-02-01 🔴
- [ ] Update API tests [[@TeamMember]] 📅 2025-02-02 🟡
- [ ] Deploy API changes [[@DevOps]] 📅 2025-02-05 🟡

[Edit Title ✏️] [Show All Tasks]
```

**Key features:**
- Groups related/similar tasks automatically
- Shows AI reasoning for grouping
- Editable cluster titles (click ✏️ button)
- Combined task suggestions
- Maintains all filtering capabilities

### Switching Views

Click the **"Show Clustered View"** / **"Show Normal View"** button to toggle.

**Important:**
- Switching views is instant (no API calls)
- Active filters persist across view changes
- Cluster data is restored from saved cluster IDs

## Filters

The dashboard provides 6 powerful filters that can be combined:

### Available Filters

| Filter | Icon | Description |
|--------|------|-------------|
| **High Priority** | 🔴 | Shows only high-priority tasks |
| **Medium Priority** | 🟡 | Shows only medium-priority tasks |
| **Past Due** | ⏰ | Tasks with due dates in the past |
| **This Week** | 📅 | Tasks due within the next 7 days |
| **Delegated** | 👥 | Tasks assigned to others (not you) |
| **Done** | ✅ | Completed tasks |

### Using Filters

**Single filter:**
- Click a filter button to activate it
- Button highlights when active
- Click again to deactivate

**Multiple filters (OR logic):**
- Click multiple filter buttons
- Tasks matching ANY active filter are shown
- Example: `🔴 High` + `⏰ Past Due` shows tasks that are either high priority OR past due

**Common filter combinations:**

```
🔴 + ⏰          = Urgent tasks (high priority or overdue)
📅 + 🔴          = This week's critical work
👥              = What others are working on
🔴 + 🟡 + 📅    = All active work this week
✅              = Review completed tasks
```

### Filter Behavior

**"My Tasks" filtering:**
- By default, dashboard only shows YOUR assigned tasks
- Exception: When `👥 Delegated` filter is active, shows tasks assigned to others
- This ensures you always see relevant work

**Filter persistence:**
- Active filters are maintained when switching views
- Filters apply equally to both normal and clustered views
- In clustered view, entire clusters are hidden/shown based on their tasks

## Task Management

### Completing Tasks

**Method 1: Click checkbox**
1. Click the `[ ]` checkbox next to any task
2. Task is marked complete in the underlying note file
3. Dashboard updates to show `[x]` checkmark

**Method 2: Keyboard**
1. Tab to focus a task checkbox
2. Press `Space` or `Enter` to toggle

**What happens:**
- Task line in original note file is updated
- Task moves to completed section (if "Done" filter is inactive)
- Statistics update in real-time

### Inline Editing

**Edit task text:**
1. Click directly on task description
2. Markdown edit mode opens
3. Make changes
4. Click outside or press `Escape` to save

**Edit in source file:**
- Click the task text to see the source file reference
- `Cmd/Ctrl + Click` opens the source note

### Task Metadata

Tasks display rich metadata:

```markdown
- [ ] Task description [[@Assignee]] 📅 2025-02-01 🔴 🧩 cluster:abc123 ⚠️ 85% #eng
      └────────┬─────┘  └────┬────┘   └────┬────┘  └┬┘ └──────┬──────┘ └───┬──┘ └─┬─┘
          Description      Assignee      Due Date  Pri  Cluster ID      Conf.   Tag
```

**Symbols explained:**
- `[[@Name]]` - Task assignee (wiki link)
- `📅 YYYY-MM-DD` - Due date
- `🔴 🟡 🟢` - Priority (high/medium/low)
- `🧩 cluster:id` - Cluster membership (for grouping)
- `⚠️ XX%` - AI confidence score (shown if <70%)
- `#tag` - Category tags

## Clustering Features

### Automatic Clustering

**When it happens:**
- Automatically after processing each batch of emails
- Runs in background during email import
- No manual action required

**What it does:**
- Analyzes all incomplete tasks
- Groups similar/related tasks
- Saves cluster IDs to task lines
- Provides combination suggestions

### Manual Re-clustering

Click the **"Re-cluster"** button dropdown for two options:

#### Smart Re-clustering
```
Re-cluster ▼
  • Smart (new tasks only)  ← Recommended
  • Force (all tasks)
```

**Smart mode:**
- Only clusters tasks without existing cluster IDs
- Preserves your existing clusters
- Fast (only analyzes new tasks)
- Use after adding new emails

**Force mode:**
- Re-analyzes ALL tasks from scratch
- Creates completely fresh clusters
- Slower (processes everything)
- Use when tasks have significantly changed

**Progress indication:**
- "Clustering tasks..." notification appears
- "Clustering complete" when done
- Errors shown if Claude API issues

### Editing Cluster Titles

**Default titles:** AI generates descriptive names like "API Documentation & Testing"

**To customize:**
1. Click the **✏️ Edit** button on any cluster card
2. Modal opens with current title
3. Enter new title
4. Press `Enter` or click "Save"

**Title storage:**
- Custom titles saved to `.obsidian/plugins/meeting-tasks/cluster-titles.json`
- Persists across sessions
- Survives plugin updates

### Cluster Information

Each cluster card shows:

```markdown
📦 Cluster: Your Custom Title
💡 Claude suggests: AI reasoning for why these tasks are grouped
Confidence: 92%

[3 tasks in this cluster]

- [ ] Task 1 ...
- [ ] Task 2 ...
- [ ] Task 3 ...

[Edit Title ✏️] [Show All Tasks]
```

**AI suggestions:**
- Explains relationships between tasks
- May suggest combining into single task
- Provides recommended assignee
- Helps with sprint planning

## Configuration

### Dashboard Settings

Configure in **Settings → Meeting Tasks**:

**Dashboard Name:**
```
Setting: Dashboard My Name
Purpose: Filters tasks to show only yours
Example: "Jim" or "jimallen" or "Jim Allen"
```

**Important:** Set this to your name as it appears in task assignees!

### Notes Folder

```
Setting: Email Notes Folder
Default: TaskAgent
Purpose: Where to scan for task-containing notes
```

Dashboard scans this folder and all subfolders for tasks.

### Claude API

```
Setting: Anthropic API Key
Purpose: Required for clustering features
Models: claude-sonnet-4 (recommended) or claude-3-5-haiku
```

**Without API key:**
- Dashboard still works
- Normal list view fully functional
- Clustering features unavailable

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open dashboard | Set in Hotkeys settings |
| Toggle task complete | `Space` / `Enter` (when focused) |
| Close dashboard | `Escape` (when input not focused) |
| Save cluster title edit | `Enter` |
| Cancel cluster title edit | `Escape` |
| Navigate filters | `Tab` / `Shift+Tab` |

## Tips & Tricks

### Efficient Task Management

**Morning routine:**
1. Open dashboard
2. Apply `🔴 High` + `📅 This Week` filters
3. Review your critical work
4. Re-order by clicking through to notes if needed

**Team review:**
1. Apply `👥 Delegated` filter
2. See what teammates are working on
3. Identify blockers or dependencies

**Sprint planning:**
1. Switch to **Clustered View**
2. Review AI groupings
3. Use cluster suggestions for story breakdown
4. Edit cluster titles to match sprint themes

### Cluster Management

**Best practices:**
- Let clustering run automatically after email import
- Use **Smart re-cluster** for incremental updates
- Use **Force re-cluster** sparingly (weekly or after major changes)
- Edit cluster titles to match your team's terminology

**When to force re-cluster:**
- After completing many related tasks
- When project priorities have shifted
- After bulk editing task descriptions
- When clusters no longer make sense

### Performance Optimization

**For large task lists (100+ tasks):**
- Use filters to narrow down view
- Complete old tasks regularly
- Archive completed work to separate notes
- Consider label-based organization

**Dashboard loads slowly:**
- Check folder path includes only relevant notes
- Verify no circular folder references
- Reduce number of notes with task checkboxes

## Troubleshooting

### Tasks not appearing

**Check:**
1. Folder path in settings points to correct location
2. Notes are in markdown format with proper frontmatter
3. Tasks use standard format: `- [ ] Task text [[@Assignee]]`
4. Dashboard name matches your assignee name exactly

**Debug:**
- Open console: `Ctrl/Cmd + Shift + I`
- Look for "Found X tasks" message
- Check for parsing errors

### Clustering not working

**Symptoms:**
- "Re-cluster" button disabled
- No clustered view option
- "Clustering unavailable" message

**Solutions:**
1. Verify Anthropic API key in settings
2. Check API key is valid (not expired)
3. Ensure internet connection active
4. Review console for API errors

### Filters not working

**Issue:** Tasks still visible when they shouldn't be

**Check:**
1. Multiple filters use OR logic (not AND)
2. "My Tasks" filtering respects Delegated filter
3. Task metadata is properly formatted
4. Due dates are valid ISO format (YYYY-MM-DD)

### Cluster titles not saving

**Check:**
1. Plugin folder is writable: `.obsidian/plugins/meeting-tasks/`
2. No filesystem permissions issues
3. Check console for "Failed to save cluster titles" errors

### Performance issues

**If dashboard is slow:**
1. Reduce number of notes being scanned
2. Complete/archive old tasks
3. Use filters to narrow view
4. Check for very large note files (>10MB)

**If clustering is slow:**
- Use Smart mode instead of Force
- Reduce number of active tasks
- Check Claude API response times

## Advanced Usage

### Custom Workflows

**GTD (Getting Things Done):**
1. Process emails daily (extract tasks)
2. Review dashboard weekly
3. Use `📅 This Week` for weekly planning
4. Archive to "Completed" folder monthly

**Scrum/Agile:**
1. Edit cluster titles to match sprint stories
2. Use clusters as epics
3. Track velocity via completed tasks
4. Review Delegated view in standups

**Personal Productivity:**
1. Set custom hotkey for quick access
2. Leave dashboard open in side pane
3. Use as your primary task list
4. Complete tasks as you work

### Integration with Other Plugins

**Dataview:**
- Query tasks from dashboard notes
- Create custom task views
- Build reports and metrics

**Calendar:**
- Tasks with due dates appear in calendar
- Click through to dashboard from calendar

**Daily Notes:**
- Link dashboard tasks to daily notes
- Create TODO blocks from dashboard

## Getting Help

**Documentation:**
- [README](../README.md) - Plugin overview and setup
- [System Architecture](./system-architecture.md) - Technical details
- [Google OAuth Setup](./google-oauth-setup.md) - Gmail integration

**Support:**
- GitHub Issues: Report bugs or request features
- Discussions: Ask questions and share tips
- Console logs: Include when reporting issues

---

**Last updated:** v3.3.0
**Questions?** Open an issue at: https://github.com/jimallen/TasksAgent/issues
