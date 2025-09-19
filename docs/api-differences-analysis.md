# API Differences Analysis: Gmail MCP vs Google Workspace MCP

## Current Gmail MCP Implementation

### Package Details
- **Name**: `@gongrzhe/server-gmail-autoauth-mcp`
- **Type**: Node.js package
- **Launch**: Direct via npx or node
- **Protocol**: MCP (Model Context Protocol) via JSON-RPC over stdio

### Current API Endpoints

#### 1. `search_emails`
```javascript
client.callTool({
  name: 'search_emails',
  arguments: {
    query: string,      // Gmail search query syntax
    maxResults: number  // Default: 50
  }
})
```
**Response Format**: Text with email blocks:
```
ID: xxx
Subject: xxx
From: xxx
Date: xxx

ID: yyy
Subject: yyy
...
```

#### 2. `read_email`
```javascript
client.callTool({
  name: 'read_email',
  arguments: {
    messageId: string,      // Email ID
    attachmentId?: string   // Optional for attachments
  }
})
```
**Response Format**: Full email content as text

### Current HTTP Proxy Endpoints
- `GET /gmail/health` - Health check
- `GET /gmail/status` - Detailed status
- `POST /gmail/search` - Search emails
- `POST /gmail/read` - Read email by ID
- `POST /gmail/mcp` - Generic MCP proxy

## Google Workspace MCP Implementation

### Package Details
- **Repository**: `taylorwilsdon/google_workspace_mcp`
- **Type**: Python application (Python 3.10+)
- **Launch**: `uv run main.py --tools gmail`
- **Protocol**: MCP via JSON-RPC (needs verification)

### Expected API Structure

#### Authentication Differences
| Aspect | Current Gmail MCP | Google Workspace MCP |
|--------|------------------|---------------------|
| Method | JSON file (`~/.gmail-mcp/gcp-oauth.keys.json`) | Environment variables |
| Variables | N/A | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` |
| Scope | Gmail only | Configurable (Gmail, Calendar, Drive) |

#### Process Management Differences
| Aspect | Current | New |
|--------|---------|-----|
| Language | Node.js | Python |
| Process spawn | `spawn('npx', ['@gongrzhe/...'])` | `spawn('python', ['main.py', '--tools', 'gmail'])` |
| Dependencies | npm package | Python with uv package manager |
| Startup | Immediate | May require Python environment setup |

## API Compatibility Assessment

### Compatible Elements
1. **MCP Protocol**: Both use JSON-RPC over stdio
2. **Tool Concept**: Both expose operations as MCP "tools"
3. **Request/Response**: Similar JSON structure expected

### Incompatible Elements

#### 1. Tool Names
- **Risk**: Tool names might differ
- **Current**: `search_emails`, `read_email`
- **New**: Needs verification (could be `gmail_search`, `gmail_read`, etc.)
- **Solution**: Create mapping layer or verify exact names

#### 2. Argument Structure
- **Risk**: Different parameter names or formats
- **Example**: `messageId` vs `message_id` vs `id`
- **Solution**: Implement argument transformation layer

#### 3. Response Format
- **Risk**: Different response structure
- **Current**: Text-based email blocks
- **New**: Could be JSON or different text format
- **Solution**: Response parser adapter

#### 4. Authentication Flow
- **Risk**: Different OAuth initialization
- **Current**: Reads from JSON file
- **New**: Expects environment variables
- **Solution**: Convert auth on startup

## Required Adaptations

### Phase 1: Minimal Changes Approach

#### 1. Authentication Adapter
```typescript
// Convert existing auth to env vars
const authPath = '~/.gmail-mcp/gcp-oauth.keys.json';
const auth = JSON.parse(fs.readFileSync(authPath));
process.env.GOOGLE_OAUTH_CLIENT_ID = auth.client_id;
process.env.GOOGLE_OAUTH_CLIENT_SECRET = auth.client_secret;
```

#### 2. Process Spawn Modification
```typescript
// Old
spawn('npx', ['@gongrzhe/server-gmail-autoauth-mcp'])

// New
spawn('python', ['/path/to/main.py', '--tools', 'gmail'])
```

#### 3. Tool Name Mapping
```typescript
const TOOL_MAP = {
  'search_emails': 'gmail_search',  // Verify actual name
  'read_email': 'gmail_read'        // Verify actual name
};
```

#### 4. Response Format Adapter
```typescript
function adaptResponse(tool: string, response: any): any {
  // Convert new format to expected format
  if (tool === 'search_emails') {
    // Transform to text block format
  }
  return response;
}
```

## Testing Requirements

### Unit Test Updates
1. Mock new Python process spawn
2. Adapt response format expectations
3. Test authentication conversion
4. Verify error handling for Python errors

### Integration Tests
1. Test with real Google Workspace MCP
2. Verify all Gmail operations
3. Test rate limiting behavior
4. Validate OAuth flow

## Risk Assessment

### High Risk
1. **Python Dependency**: Requires Python 3.10+ on all systems
2. **Tool Name Mismatch**: Could break all operations if wrong

### Medium Risk
1. **Performance**: Python process might be slower
2. **Error Messages**: Different format could break error handling

### Low Risk
1. **MCP Protocol**: Standard should be compatible
2. **OAuth Scopes**: Gmail-only should work

## Recommendations

### Immediate Actions
1. **Verify Tool Names**: Clone repo and check actual tool names
2. **Test Locally**: Run Python MCP with minimal example
3. **Create Adapter Layer**: Build compatibility layer for smooth transition

### Alternative Approach
If Python integration proves too complex:
1. **Fork and Port**: Convert Python MCP to TypeScript
2. **Wrapper Service**: Create Node.js wrapper around Python
3. **Hybrid Approach**: Keep current for Gmail, add new for Calendar/Drive

## Next Steps
1. Clone Google Workspace MCP repository
2. Set up Python environment locally
3. Test tool discovery to get exact names
4. Implement minimal adapter in `gmailMcpService.ts`
5. Run side-by-side comparison tests

---

*Analysis Date: 2025-01-19*
*Purpose: Phase 1 Direct Replacement Planning*