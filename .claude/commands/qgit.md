---
description: Git commit workflow
allowed-tools: Bash
---

First, ensure git is properly configured (user.name and user.email). If not configured, ask the user to configure it before continuing.

Then perform the following:
1. Run git status to see changes
2. Add all changes with git add
3. Create a commit using Conventional Commit format (feat:, fix:, docs:, etc.)
4. Avoid mentioning Claude or Anthropic in the commit message
5. Push the changes to the remote repository if requested