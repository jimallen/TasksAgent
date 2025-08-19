# Obsidian Setup for Meeting Transcript Agent

## Installation Guide

### 1. Install Required Plugins

Install these Obsidian community plugins:
1. **Dataview** - For dynamic task queries
2. **Tasks** (optional) - Enhanced task management
3. **Templater** (optional) - For daily note templates
4. **Calendar** (optional) - Visual calendar with daily notes

### 2. Copy Dashboard to Your Vault

Copy `My Task Dashboard.md` to your Obsidian vault root:
```bash
cp "obsidian-setup/My Task Dashboard.md" "/home/jima/Documents/Jim's Vault/"
```

### 3. Set Up Daily Notes (Optional)

1. Go to Settings → Daily notes
2. Set template location to: `Daily Note Template.md`
3. Set new file location to: `Daily Notes`
4. Set date format to: `YYYY-MM-DD`

### 4. Pin Your Dashboard

1. Open `My Task Dashboard.md` in Obsidian
2. Right-click the tab → Pin
3. Consider adding it to your starred files

## Dataview Queries for Jim's Tasks

### Basic Query - All Your Tasks
```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]")
WHERE !completed
```

### High Priority Only
```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]") AND contains(text, "🔴")
WHERE !completed
SORT due ASC
```

### Today's Tasks
```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]")
WHERE !completed
WHERE due = date(today)
```

### This Week's Tasks
```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]")
WHERE !completed
WHERE due <= date(today) + dur(7 days)
SORT due ASC
```

### Overdue Tasks
```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]")
WHERE !completed
WHERE due < date(today)
SORT due ASC
```

### Tasks by Meeting
```dataview
TABLE WITHOUT ID
  file.link AS Meeting,
  filter(file.tasks, (t) => contains(t.text, "@[[Jim Allen]]") AND !t.completed) AS "My Tasks"
FROM "Meetings"
WHERE any(file.tasks, (t) => contains(t.text, "@[[Jim Allen]]") AND !t.completed)
SORT file.mtime DESC
```

### Task Count by Priority
```dataview
TABLE WITHOUT ID
  "🔴 High" AS Priority,
  length(filter(pages.file.tasks, (t) => contains(t.text, "@[[Jim Allen]]") AND contains(t.text, "🔴") AND !t.completed)) AS Count
FROM "Meetings"
UNION ALL
TABLE WITHOUT ID
  "🟡 Medium" AS Priority,
  length(filter(pages.file.tasks, (t) => contains(t.text, "@[[Jim Allen]]") AND contains(t.text, "🟡") AND !t.completed)) AS Count
FROM "Meetings"
UNION ALL
TABLE WITHOUT ID
  "🟢 Low" AS Priority,
  length(filter(pages.file.tasks, (t) => contains(t.text, "@[[Jim Allen]]") AND contains(t.text, "🟢") AND !t.completed)) AS Count
FROM "Meetings"
```

## Quick Search Queries

Use these in Obsidian's search bar:

### Find all your uncompleted tasks:
```
path:Meetings -[ ] "@[[Jim Allen]]"
```

### Find high priority tasks:
```
path:Meetings -[ ] 🔴 "@[[Jim Allen]]"
```

### Find tasks due this week:
```
path:Meetings -[ ] "@[[Jim Allen]]" /📅.*2025-08-1[9-9]|2025-08-2[0-5]/
```

## Tips & Tricks

### 1. Quick Task Toggle
- Click any checkbox to mark complete
- Completed tasks will disappear from dashboard queries

### 2. Bulk Task Management
- Use search & replace to reassign tasks
- Example: Replace `@[[Jim Allen]]` with `@[[Someone Else]]`

### 3. Task Review Workflow
1. Open your Task Dashboard every morning
2. Review high priority items first
3. Check due dates for the week
4. Complete tasks directly from dashboard

### 4. Create Task Reports
Create a note with this query to see task completion rate:
```dataview
TABLE WITHOUT ID
  dateformat(file.day, "MMM yyyy") AS Month,
  length(filter(file.tasks, (t) => contains(t.text, "@[[Jim Allen]]") AND t.completed)) AS Completed,
  length(filter(file.tasks, (t) => contains(t.text, "@[[Jim Allen]]") AND !t.completed)) AS Pending,
  round(100 * length(filter(file.tasks, (t) => contains(t.text, "@[[Jim Allen]]") AND t.completed)) / length(filter(file.tasks, (t) => contains(t.text, "@[[Jim Allen]]"))), 2) + "%" AS "Completion Rate"
FROM "Meetings"
WHERE file.tasks
GROUP BY dateformat(file.day, "yyyy-MM")
SORT file.day DESC
```

### 5. Keyboard Shortcuts
Set up hotkeys for:
- Open Task Dashboard: `Cmd/Ctrl + Shift + T`
- Insert today's date: `Cmd/Ctrl + Shift + D`
- Toggle checkbox: `Cmd/Ctrl + Enter`

## Troubleshooting

### Tasks not showing up?
1. Check the assignee format matches exactly: `@[[Jim Allen]]`
2. Ensure Dataview plugin is enabled
3. Check that files are in the `Meetings` folder

### Want to track other people's tasks too?
Change the query to:
```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]") OR contains(text, "@[[Karishma Karnik]]")
WHERE !completed
GROUP BY assignee
```

### Need to export tasks?
Use this Templater script:
```javascript
<%* 
const dv = app.plugins.plugins.dataview.api;
const tasks = dv.pages('"Meetings"')
  .file.tasks
  .where(t => t.text.includes("@[[Jim Allen]]") && !t.completed);
  
tR += "# My Tasks Export\n\n";
tasks.forEach(t => tR += `- ${t.text}\n`);
%>
```

## Integration with Other Tools

### Export to CSV
```bash
grep -h "- \[ ].*@\[\[Jim Allen\]\]" /home/jima/Documents/Jim\'s\ Vault/Meetings/**/*.md | \
  sed 's/- \[ \] //' | \
  sed 's/@\[\[Jim Allen\]\]//' | \
  sed 's/🔴/HIGH/' | \
  sed 's/🟡/MEDIUM/' | \
  sed 's/🟢/LOW/' > my-tasks.csv
```

### Sync with Todoist/Notion
Use Obsidian plugins:
- Tasks plugin → Todoist sync
- Notion Sync plugin for Notion

### Email Daily Summary
Create a script that runs daily:
```bash
#!/bin/bash
tasks=$(grep -h "- \[ ].*@\[\[Jim Allen\]\].*📅.*$(date +%Y-%m-%d)" \
  "/home/jima/Documents/Jim's Vault/Meetings/"*.md)
  
if [ ! -z "$tasks" ]; then
  echo "$tasks" | mail -s "Today's Tasks from Meetings" jimallen@gmail.com
fi
```