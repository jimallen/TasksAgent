---
tags: dashboard
cssclass: dashboard
---

# Jim's Task Dashboard

> Auto-generated from Meeting Transcript Agent emails

## 🔴 High Priority Tasks
```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]") AND contains(text, "🔴")
WHERE !completed
SORT due ASC
```

## 🟡 Medium Priority Tasks
```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]") AND contains(text, "🟡")
WHERE !completed
SORT due ASC
```

## 🟢 Low Priority Tasks
```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]") AND contains(text, "🟢")
WHERE !completed
SORT due ASC
```

## 📅 Due This Week
```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]")
WHERE !completed
WHERE due <= date(today) + dur(7 days)
SORT due ASC
```

## 📊 Task Statistics
```dataview
TABLE 
  length(filter(file.tasks, (t) => contains(t.text, "@[[Jim Allen]]") AND !t.completed)) AS "My Tasks",
  length(filter(file.tasks, (t) => contains(t.text, "🔴") AND contains(t.text, "@[[Jim Allen]]") AND !t.completed)) AS "High",
  length(filter(file.tasks, (t) => contains(t.text, "🟡") AND contains(t.text, "@[[Jim Allen]]") AND !t.completed)) AS "Medium",
  length(filter(file.tasks, (t) => contains(t.text, "🟢") AND contains(t.text, "@[[Jim Allen]]") AND !t.completed)) AS "Low"
FROM "Meetings"
WHERE file.tasks
WHERE any(file.tasks, (t) => contains(t.text, "@[[Jim Allen]]") AND !t.completed)
SORT file.mtime DESC
```

## 📝 Recent Meetings with My Tasks
```dataview
LIST
FROM "Meetings"
WHERE any(file.tasks, (t) => contains(t.text, "@[[Jim Allen]]") AND !t.completed)
SORT file.mtime DESC
LIMIT 10
```

## ✅ Recently Completed
```dataview
TASK
FROM "Meetings"
WHERE contains(text, "@[[Jim Allen]]")
WHERE completed
WHERE file.mtime >= date(today) - dur(7 days)
SORT file.mtime DESC
```

---

*Last updated: `= dateformat(date(now), "yyyy-MM-dd HH:mm")`*