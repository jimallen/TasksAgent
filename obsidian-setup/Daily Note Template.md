---
date: {{date}}
tags: daily-note
---

# {{date:dddd, MMMM Do, YYYY}}

## 📌 Today's Tasks from Meetings
```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]")
WHERE !completed
WHERE due = date("{{date:YYYY-MM-DD}}")
```

## 🎯 High Priority Tasks (All)
```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]") AND contains(text, "🔴")
WHERE !completed
LIMIT 5
```

## 📅 Upcoming (Next 3 Days)
```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]")
WHERE !completed
WHERE due > date("{{date:YYYY-MM-DD}}") AND due <= date("{{date:YYYY-MM-DD}}") + dur(3 days)
SORT due ASC
```

## 📝 Today's Meetings
```dataview
LIST
FROM "Meetings"
WHERE file.day = date("{{date:YYYY-MM-DD}}")
```

---

## Notes
- 

## Completed Today
- 