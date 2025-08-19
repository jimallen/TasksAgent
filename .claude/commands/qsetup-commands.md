---
description: Set up Claude Code slash commands from Celebrate Rules
---

# Setup Slash Commands

Create or update slash commands in `.claude/commands` directory using the Celebrate Rules MCP server.

## Purpose

This command uses the MCP server to:
- Download all available slash commands from Celebrate Rules
- Create `.claude/commands/` directory structure
- Install command files with proper formatting
- Enable quick access to development workflows

## Prerequisites

### MCP Server Required

```bash
# Verify MCP server is configured
claude mcp list | grep celebrate-rules

# If not found, configure it:
claude mcp add -s user celebrate-rules -- node /path/to/celebrate-rules-mcp.cjs --github-token YOUR_TOKEN
```

## Command Installation Process

### Step 1: Check Environment

```typescript
// Verify MCP availability
const mcpAvailable = await checkMcpServer('celebrate-rules');
if (!mcpAvailable) {
  console.log("⚠️ Celebrate Rules MCP server not configured");
  return;
}

// Check for existing commands
const commandsDir = '.claude/commands';
if (fs.existsSync(commandsDir)) {
  console.log("ℹ️ Commands directory exists, will update");
}
```

### Step 2: Install Commands

Use the MCP tool to set up commands:

```typescript
// Call the setup_slash_commands tool
await useMcpTool('celebrate-rules', 'setup_slash_commands', {});
```

This will:
1. Create `.claude/commands/` directory if needed
2. Download all command definitions
3. Write command files with proper frontmatter
4. Report installed/updated commands

### Step 3: Verify Installation

Check the installed commands:

```bash
# List installed commands
ls -la .claude/commands/

# View a specific command
cat .claude/commands/qnew.md
```

## Available Commands

After setup, you'll have access to:

### Core Workflow Commands
- **qnew**: Apply best practices from agent rules
- **qplan**: Validate design approach
- **qcode**: Implement with tests
- **qcheck**: Quality review for changes

### Feature Development
- **qnew-feature**: PRD-driven feature implementation
- **qprd**: Generate Product Requirements Document
- **qtask**: Create task list from PRD
- **qprocess-task-list**: Execute tasks systematically

### Bug Fixing
- **qfix-bug**: Systematic debugging workflow

### Review & Quality
- **qexec-review**: Executive-level code review
- **qcheckf**: Function-level quality check
- **qcheckt**: Test quality review

### Documentation & Git
- **qdocs**: Update all documentation
- **qgit**: Commit with conventional format
- **qux**: Generate UX test scenarios

### MCP Management
- **qrefresh-rules**: Update agent rules
- **qsetup-commands**: This command

## Manual Alternative

If MCP is not available, manually create commands:

```bash
# Create commands directory
mkdir -p .claude/commands

# Download commands from repository
gh repo clone kartenmacherei/Celebrate_Agent_Rules temp-rules
cp temp-rules/commands/*.md .claude/commands/
rm -rf temp-rules
```

## Command Structure

Each command file includes:
```markdown
---
description: Brief description for command palette
---

# Command Name

Detailed instructions and workflow...
```

## Troubleshooting

### Commands Not Appearing
- Restart Claude Code after installation
- Verify `.claude/commands/` exists
- Check file permissions

### MCP Connection Issues
```bash
# Test MCP connection
claude mcp test celebrate-rules

# Check logs
claude mcp logs celebrate-rules
```

### Outdated Commands
- Run `qrefresh-rules` first to get latest version
- Then run `qsetup-commands` to update

## Best Practices

1. **Initial Setup**: Run once when setting up a new project
2. **Team Onboarding**: Include in project setup documentation
3. **Version Control**: Commit `.claude/commands/` to repository
4. **Regular Updates**: Refresh commands when rules update
5. **Customization**: Add project-specific commands to `.claude/commands/`

## Success Indicators

Successful setup will:
- ✅ Create `.claude/commands/` directory
- ✅ Install 15+ command files
- ✅ Show list of available commands
- ✅ Commands appear in Claude Code palette

## Project Integration

After setup, integrate commands into your workflow:

1. **New Features**: Start with `qnew-feature`
2. **Bug Fixes**: Use `qfix-bug`
3. **Code Review**: Apply `qexec-review`
4. **Daily Coding**: Use `qnew`, `qcode`, `qcheck`

## Related Commands

- `qrefresh-rules`: Update agent rules before setting up commands
- Use `/` in Claude Code to see all available commands
- Each command has its own documentation