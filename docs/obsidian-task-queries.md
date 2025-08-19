# Obsidian Task Queries for Jim Allen

## Method 1: Dataview Plugin Query

Create a note in your Obsidian vault with this dataview query:

```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]") OR contains(text, "@jimallen") OR contains(text, "@Jim")
WHERE !completed
SORT due ASC
```

## Method 2: Obsidian Tasks Plugin Query

If using the Tasks plugin, use this query:

```tasks
path includes Meetings
description includes @[[Jim Allen]]
not done
sort by due
```

## Method 3: Obsidian Search Query

Use Obsidian's built-in search:

```
path:Meetings -[ ] @[[Jim Allen]]
```

Or for all your uncompleted tasks:

```
path:Meetings task-todo:"@[[Jim Allen]]"
```

## Method 4: Create a Dashboard Note

Create a file called `My Tasks Dashboard.md` in your vault:

```markdown
---
tags: dashboard
---

# Jim's Task Dashboard

## High Priority Tasks 🔴
```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]") AND contains(text, "🔴")
WHERE !completed
SORT due ASC
```

## Medium Priority Tasks 🟡
```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]") AND contains(text, "🟡")
WHERE !completed
SORT due ASC
```

## All My Tasks
```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]")
WHERE !completed
GROUP BY file.name
SORT due ASC
```
```

## Method 5: Smart Folder with Search

1. Create a new folder in Obsidian called "My Tasks"
2. Use Obsidian's search with the query: `path:Meetings task-todo:"@[[Jim Allen]]"`
3. Save this search as a bookmark

## Method 6: Using Templater or QuickAdd

Create a template that automatically filters your tasks:

```javascript
<%*
const files = app.vault.getMarkdownFiles();
const tasks = [];

for (const file of files) {
  if (file.path.includes("Meetings")) {
    const content = await app.vault.read(file);
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.includes('- [ ]') && 
          (line.includes('@[[Jim Allen]]') || line.includes('@Jim'))) {
        tasks.push({
          file: file.basename,
          task: line,
          path: file.path
        });
      }
    }
  }
}

// Output tasks
tR += "# My Tasks\n\n";
tasks.forEach(t => {
  tR += `- From [[${t.file}]]:\n`;
  tR += `  ${t.task}\n\n`;
});
%>
```

## Method 7: Manual Task Collection Note

Create a note where you manually collect your tasks:

```markdown
# Jim's Active Tasks

## From Recent Meetings

### From [[2025-08-19 - Notes- 'Plan B ' 19 Aug 2025]]
- [ ] 🟡 Loop Karishma Karnik into the conversation about the Vietnamese team's ramp-up date
- [ ] 🔴 Nail down the dates for the trip to Hanoi 📅 2025-10-29

### From [[2025-08-19 - Notes- 'Board Update' 19 Aug 2025]]
- [ ] Your tasks here...
```

## Method 8: Command Line Extraction

Run this bash command to extract just your tasks:

```bash
grep -r "\- \[ \].*@\[\[Jim Allen\]\]" "/home/jima/Documents/Jim's Vault/Meetings/" --include="*.md"
```

Or create a script:

```bash
#!/bin/bash
# File: extract-my-tasks.sh

VAULT_PATH="/home/jima/Documents/Jim's Vault"
ASSIGNEE="Jim Allen"
OUTPUT_FILE="$VAULT_PATH/My-Tasks-$(date +%Y-%m-%d).md"

echo "# Tasks for $ASSIGNEE - $(date +%Y-%m-%d)" > "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

find "$VAULT_PATH/Meetings" -name "*.md" -type f | while read file; do
    tasks=$(grep "\- \[ \].*@\[\[$ASSIGNEE\]\]" "$file" 2>/dev/null)
    if [ ! -z "$tasks" ]; then
        filename=$(basename "$file" .md)
        echo "## From: $filename" >> "$OUTPUT_FILE"
        echo "$tasks" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    fi
done

echo "Tasks extracted to: $OUTPUT_FILE"
```