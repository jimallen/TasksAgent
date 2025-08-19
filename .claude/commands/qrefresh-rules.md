---
description: Refresh agent rules from Celebrate Rules repository
---

# Refresh Agent Rules

Download or update the agent rules and slash commands for this project using the Celebrate Rules MCP server.

## Purpose

This command uses the MCP (Model Context Protocol) server to:
- Check for the latest agent rules from the Celebrate Rules repository
- Download appropriate rules based on your project type (PHP/TypeScript)
- Update existing `.agent.rules.md` file if present
- Ensure you have the latest coding standards and best practices

## Prerequisites

### MCP Server Setup

The Celebrate Rules MCP server must be configured in your Claude Code settings:

```bash
# Check if MCP server is configured
claude mcp list

# If not configured, add it:
claude mcp add -s user celebrate-rules -- node /path/to/celebrate-rules-mcp.cjs --github-token YOUR_TOKEN
```

## Usage

### Step 1: Check MCP Availability

```typescript
// Verify MCP server is available
const mcpAvailable = await checkMcpServer('celebrate-rules');
if (!mcpAvailable) {
  console.log("⚠️ Celebrate Rules MCP server not configured");
  console.log("Run: claude mcp add -s user celebrate-rules ...");
  return;
}
```

### Step 2: Refresh Rules

Use the MCP tool to refresh rules:

```typescript
// Call the refresh_agent_rules tool
await useMcpTool('celebrate-rules', 'refresh_agent_rules', {});
```

This will:
1. Check if `.agent.rules.md` exists in the current project
2. Detect project type (PHP or TypeScript)
3. Download the appropriate rules from the latest release
4. Update or create `.agent.rules.md` file
5. Report the version and changes

### Step 3: Verify Update

After refreshing:
- Check the `.agent.rules.md` file header for version info
- Review any new rules or changes
- Commit the updated file to your repository

## What Gets Updated

The refresh process updates:
- **Base rules**: Universal coding standards
- **Language-specific rules**: PHP or TypeScript extensions
- **Dev shortcuts**: Quick commands for common tasks
- **Documentation rules**: System architecture requirements
- **Testing guidelines**: TDD and quality standards

## Manual Alternative

If MCP is not available, manually download:

```bash
# For TypeScript projects
gh release download --repo kartenmacherei/Celebrate_Agent_Rules \
  --pattern 'default.agent.rules.ts.md' \
  --output '.agent.rules.md' \
  --clobber

# For PHP projects  
gh release download --repo kartenmacherei/Celebrate_Agent_Rules \
  --pattern 'default.agent.rules.php.md' \
  --output '.agent.rules.md' \
  --clobber
```

## Troubleshooting

### MCP Server Not Found
```bash
# List configured MCP servers
claude mcp list

# Add if missing
claude mcp add -s user celebrate-rules -- celebrate-rules-mcp --github-token YOUR_TOKEN
```

### Permission Denied
- Ensure your GitHub token has `repo` scope for private repositories
- Check token expiration
- Verify repository access

### Wrong Language Rules
- The MCP server auto-detects based on `composer.json` (PHP) or `package.json` (TypeScript)
- Override by specifying the language explicitly if needed

## Success Indicators

A successful refresh will:
- ✅ Show "Agent rules updated successfully"
- ✅ Display the version number
- ✅ List the number of rules included
- ✅ Create or update `.agent.rules.md`

## Best Practices

1. **Regular Updates**: Refresh rules weekly or when starting new features
2. **Team Sync**: Ensure all team members use the same version
3. **Commit Rules**: Always commit `.agent.rules.md` to your repository
4. **Review Changes**: Check rule updates for new best practices

## Related Commands

- `qsetup-commands`: Set up slash commands after refreshing rules
- `qnew`: Apply the latest rules to new code
- `qcheck`: Validate code against current rules