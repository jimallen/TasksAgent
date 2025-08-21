---
description: Process task list systematically
---

Process an existing task list file following strict task management protocols.

## Usage

```
/qprocess-task-list <task-file>
```

Examples:
- `/qprocess-task-list tasks-prd-dark-mode.md` - Process task file in /tasks/
- `/qprocess-task-list /tasks/tasks-prd-user-auth.md` - Full path also accepted

## Task Implementation Protocol

**CRITICAL: One sub-task at a time!**
- Do NOT start the next sub-task until user gives permission ("yes" or "y")
- Stop after each sub-task and wait for user approval

## Completion Protocol

When you finish a **sub-task**:
1. Mark it as completed by changing `[ ]` to `[x]`
2. Update the task list file immediately
3. Ask user: "Sub-task completed. Ready to continue with the next sub-task? (yes/y)"

When **all** sub-tasks under a parent are `[x]`:
1. **First**: Run the full test suite (`pytest`, `npm test`, etc.)
2. **Only if tests pass**: Stage changes (`git add .`)
3. **Clean up**: Remove temporary files and code
4. **Commit** with descriptive message:
   ```bash
   git commit -m "feat: complete parent task" -m "- Detail 1" -m "- Detail 2" -m "Related to task X.0"
   ```
5. Mark the **parent task** as `[x]`

## Task List Maintenance

During implementation:
- Update task list file after each sub-task
- Add newly discovered tasks as they emerge
- Keep "Relevant Files" section current with all created/modified files
- Add one-line descriptions for each file

## Workflow

1. Read the task list file from `/tasks/`
2. Identify the next uncompleted sub-task
3. Implement the sub-task
4. Mark sub-task as complete in the file
5. Save the updated task list
6. **STOP and wait for user permission**
7. Repeat until all tasks are complete

## Important

- Never skip ahead to the next sub-task without permission
- Always update the task list file in real-time
- Follow conventional commit format
- Maintain accurate file tracking