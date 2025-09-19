# Google Workspace MCP Research & Compatibility Assessment

## Repository Information
- **Source**: https://github.com/taylorwilsdon/google_workspace_mcp
- **Language**: Python (requires Python 3.10+)
- **MCP Type**: Python-based MCP server (different from current Node.js implementation)

## Key Differences from Current Gmail MCP

### Current Implementation
- **Package**: `@gongrzhe/server-gmail-autoauth-mcp` (Node.js)
- **Launch**: Direct npm/npx command
- **Auth**: Stores in `~/.gmail-mcp/gcp-oauth.keys.json`
- **Endpoints**: `search_emails`, `read_email`

### New Google Workspace MCP
- **Language**: Python (not Node.js)
- **Launch**: `uv run main.py --tools gmail`
- **Auth**: Environment variables for OAuth credentials
- **Scope**: Full Google Workspace suite, not just Gmail

## Installation Requirements

### Dependencies
```bash
# Python 3.10+ required
# Install uv package manager
pip install uv

# Clone repository
git clone https://github.com/taylorwilsdon/google_workspace_mcp.git
```

### OAuth Setup
1. Create Google Cloud Project
2. Enable Gmail API
3. Create OAuth 2.0 Client ID (Desktop Application)
4. Set environment variables:
   ```bash
   export GOOGLE_OAUTH_CLIENT_ID="your-client-id"
   export GOOGLE_OAUTH_CLIENT_SECRET="your-secret"
   ```

## Server Configuration

### Start Commands
```bash
# Gmail only
uv run main.py --tools gmail

# With extended features
uv run main.py --tools gmail --tool-tier extended

# Multiple services
uv run main.py --tools gmail,calendar,drive
```

### Tool Tiers
- **core**: Basic operations
- **extended**: Additional features
- **complete**: Full API coverage

## Gmail Operations Mapping

### Search Emails
- Current: `search_emails` endpoint
- New: Likely similar, needs testing

### Read Email
- Current: `read_email` endpoint
- New: Likely similar, needs testing

### Rate Limiting
- Current: 250 units/sec enforced
- New: Need to verify rate limiting implementation

## Integration Challenges

### Major Considerations
1. **Language Mismatch**: Python MCP vs Node.js daemon
   - Need to spawn Python process from Node.js
   - Ensure Python environment is available

2. **Authentication Method**:
   - Environment variables vs JSON file
   - May need auth conversion layer

3. **MCP Protocol Communication**:
   - Verify JSON-RPC compatibility
   - Test request/response formats

4. **Process Management**:
   - Update spawn commands for Python
   - Handle Python-specific errors

## Recommended Approach

### Phase 1 Implementation Steps
1. Create Python wrapper script for consistent interface
2. Map environment variables from existing auth
3. Test minimal Gmail operations
4. Verify MCP protocol compatibility
5. Update spawn commands in `gmailMcpService.ts`

### Fallback Option
If Python integration proves too complex:
- Consider forking and converting to TypeScript
- Or maintain current MCP for Phase 1
- Evaluate alternatives for Phases 2-3

## Testing Strategy

### Local Testing
```bash
# Set up test environment
export GOOGLE_OAUTH_CLIENT_ID="test-id"
export GOOGLE_OAUTH_CLIENT_SECRET="test-secret"

# Run minimal test
uv run main.py --tools gmail

# Test with MCP client
# Verify search_emails and read_email work
```

### Integration Testing
1. Test spawn from Node.js
2. Verify OAuth flow
3. Test all Gmail operations
4. Measure performance impact

## Next Steps
1. Set up local Python environment
2. Clone and test Google Workspace MCP
3. Create compatibility layer if needed
4. Document any API differences

---

*Research Date: 2025-01-19*
*For: Phase 1 - Direct Replacement*