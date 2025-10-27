# BMAD Framework

This directory contains the **BMAD (Better Method for Agile Development)** framework - an AI-assisted development methodology system used during the creation of this plugin.

## What is BMAD?

BMAD is a comprehensive development framework that orchestrates AI agents through structured workflows to manage the software development lifecycle. It provides:

- **Specialized AI Agents** (Product Manager, Architect, Developer, etc.)
- **Structured Workflows** (Analysis, Planning, Solutioning, Implementation)
- **Development Methodology** (Scale-adaptive project management)
- **Quality Processes** (Testing, review, retrospectives)

## Why is it in this Repository?

This repository showcases not just the **Obsidian Meeting Tasks Plugin**, but also the **development methodology** used to build it. Including BMAD demonstrates:

1. **Systematic approach** to software development
2. **AI-assisted workflows** for requirements, architecture, and implementation
3. **Professional development practices** with structured phases
4. **Documentation-first thinking** through workflow-driven processes

## Structure

```
bmad/
├── core/          # Core BMAD engine (agents, tasks, workflows)
├── bmb/           # BMAD Builder Module (creates new agents/workflows)
├── bmm/           # BMAD Method Module (SDLC workflows)
└── _cfg/          # Configuration and manifests
```

## Not Required for Plugin Runtime

**Important:** The BMAD framework is a **development-time dependency only**. It is:
- ✅ Used during development to build and maintain the plugin
- ✅ Included in repository to showcase development methodology
- ❌ **NOT** deployed to Obsidian (see `deploy.sh` for runtime-only copy logic)
- ❌ **NOT** required for users to run the plugin

## For Developers

If you're interested in the development process that created this plugin:
1. Review the workflows in `bmad/bmm/workflows/`
2. Check agent configurations in `bmad/bmm/agents/`
3. See `.claude/commands/bmad/` for integrated development commands

## Learn More

The BMAD Method represents a structured approach to AI-assisted software development, emphasizing:
- Workflow-driven development
- Agent specialization
- Scale-adaptive documentation
- Continuous quality feedback

For more details on how BMAD was used in this project, see the main [README.md](../README.md) and [CLAUDE.md](../CLAUDE.md).
