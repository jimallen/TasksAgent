---
description: Generate task list from PRD
---

Generate a detailed task list from an existing Product Requirements Document (PRD).

## Usage

```
/qtask <prd-file>
```

Examples:
- `/qtask prd-dark-mode.md` - Generate tasks from PRD file in /tasks/
- `/qtask /tasks/prd-user-auth.md` - Full path also accepted

## Process

1. **Load PRD File**: 
   - Accept PRD filename as parameter
   - Check `/tasks/` directory if filename only
   - Accept full path if provided
   - Error if file not found
2. **Analyze PRD**: Read and analyze functional requirements, user stories, and other sections
3. **Assess Current State**: Review existing codebase for infrastructure, patterns, and reusable components
4. **Phase 1: Generate Parent Tasks**: Create 5-7 high-level tasks and present them. Ask: "I have generated the high-level tasks based on the PRD. Ready to generate the sub-tasks? Respond with 'Go' to proceed."
5. **Wait for Confirmation**: Pause for user to respond with "Go"
6. **Phase 2: Generate Sub-Tasks**: Break down each parent task into actionable sub-tasks
7. **Identify Relevant Files**: List files to be created or modified
8. **Generate Final Output**: Combine all elements into the task list structure
9. **Save Task List**: Save as `tasks-[prd-file-name].md` in `/tasks/` directory

## Output Format

```markdown
### Relevant Files

- `path/to/file1.ts` - Brief description of relevance
- `path/to/file1.test.ts` - Unit tests for file1.ts
- `path/to/file2.tsx` - Brief description
- `path/to/file2.test.tsx` - Unit tests for file2.tsx

### Notes

- Unit tests should be placed alongside code files
- Use `npx jest [optional/path/to/test/file]` to run tests

### Tasks

- [ ] 1.0 Parent Task Title
  - [ ] 1.1 Sub-task description
  - [ ] 1.2 Sub-task description
- [ ] 2.0 Parent Task Title
  - [ ] 2.1 Sub-task description
- [ ] 3.0 Parent Task Title
```

## Important

- Always pause after Phase 1 for user confirmation
- Target audience is junior developers
- Consider existing codebase patterns
- Output filename: `tasks-[prd-file-name].md`