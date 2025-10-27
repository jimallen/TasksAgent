# Claude Code Configuration

This directory contains **Claude Code** configuration and custom slash commands used during the development of this plugin.

## What is Claude Code?

[Claude Code](https://claude.com/claude-code) is Anthropic's AI-powered development assistant that integrates directly with your codebase. This `.claude/` directory contains project-specific configurations that customize Claude Code's behavior for this project.

## Directory Structure

```
.claude/
├── agents/          # Custom agent configurations for party mode
├── commands/        # Custom slash commands
│   ├── bmad/       # BMAD framework integration commands
│   └── q*.md       # Quick development workflow commands
└── README.md        # This file
```

## Purpose in This Repository

This configuration demonstrates:
1. **AI-assisted development workflows** - Custom commands for common tasks
2. **Agent configurations** - Specialized AI personas for different roles
3. **Integration with BMAD** - Commands that orchestrate complex workflows
4. **Development efficiency** - Slash commands for rapid iteration

## Custom Slash Commands

The `.claude/commands/` directory includes various workflow commands:
- `/qcode` - Implement features with tests
- `/qdocs` - Update documentation
- `/qgit` - Git commit workflow
- `/qcheck` - Quality review
- And many more BMAD-integrated commands

## Not Required for Plugin Runtime

**Important:** The Claude Code configuration is a **development-time tool only**. It is:
- ✅ Used during development to accelerate coding workflows
- ✅ Included in repository to showcase AI-assisted development
- ❌ **NOT** deployed to Obsidian (see `deploy.sh`)
- ❌ **NOT** required for users to run the plugin

## For Developers

If you want to use these commands:
1. Install [Claude Code](https://claude.com/claude-code)
2. Clone this repository
3. Open the project in Claude Code
4. Type `/` to see available commands

## Learn More

- [Claude Code Documentation](https://docs.claude.com/claude-code)
- [BMAD Framework](../bmad/README.md) - The methodology these commands orchestrate
- [Main README](../README.md) - Plugin documentation
