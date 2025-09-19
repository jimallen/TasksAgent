# Google Workspace MCP Tool Compatibility Test Results

## Test Date: 2025-01-19

## Credentials Used
- Source: `~/.celebrate-oracle/client_secret.json`
- Project: celebrate-oracle
- Client ID: 1038288956867-g37m52savqafcdvd556emvk6bhumlakt.apps.googleusercontent.com

## Gmail Tools Discovery

### Available Tools in Google Workspace MCP
Based on analysis of `gmail/gmail_tools.py`:

1. **search_gmail_messages** ✅ - Search messages in Gmail
   - Replaces: `search_emails`
   - Parameters: `query`, `user_google_email`, `page_size`

2. **get_gmail_message_content** ✅ - Get full message content
   - Replaces: `read_email`
   - Parameters: `message_id`, `user_google_email`, `include_body`

3. **get_gmail_messages_content_batch** - Batch get messages
4. **send_gmail_message** - Send email
5. **draft_gmail_message** - Create draft (not create_gmail_draft)
6. **get_gmail_thread_content** - Get thread content
7. **get_gmail_threads_content_batch** - Batch get threads
8. **list_gmail_labels** - List labels
9. **manage_gmail_label** - Create/delete labels
10. **modify_gmail_message_labels** - Modify message labels
11. **batch_modify_gmail_message_labels** - Batch modify labels

## Tool Name Mapping

### Critical Mappings for Phase 1

| Current Gmail MCP | Google Workspace MCP | Status |
|------------------|---------------------|--------|
| `search_emails` | `search_gmail_messages` | ✅ Found |
| `read_email` | `get_gmail_message_content` | ✅ Found |

### Parameter Differences

#### search_emails → search_gmail_messages
- Old: `query`, `maxResults`
- New: `query`, `user_google_email`, `page_size`
- **Action Required**: Add `user_google_email` parameter

#### read_email → get_gmail_message_content
- Old: `messageId`, `attachmentId` (optional)
- New: `message_id`, `user_google_email`, `include_body`
- **Action Required**: Rename parameter, add `user_google_email`

## Authentication Differences

### Current Gmail MCP
- Uses: `~/.gmail-mcp/gcp-oauth.keys.json`
- Format: JSON file with client_id and client_secret

### Google Workspace MCP
- Uses: Environment variables
- Required:
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`

### Conversion Strategy
```python
# Read from existing auth file
with open('~/.celebrate-oracle/client_secret.json') as f:
    data = json.load(f)
    os.environ['GOOGLE_OAUTH_CLIENT_ID'] = data['installed']['client_id']
    os.environ['GOOGLE_OAUTH_CLIENT_SECRET'] = data['installed']['client_secret']
```

## Process Management

### Current
```javascript
spawn('npx', ['@gongrzhe/server-gmail-autoauth-mcp'])
```

### New
```javascript
spawn('python', ['/path/to/main.py', '--tools', 'gmail'])
```

## Compatibility Assessment

### ✅ Compatible
- Core Gmail operations (search, read)
- OAuth credential structure
- MCP protocol (JSON-RPC)

### ⚠️ Requires Adaptation
- Tool names (mapping required)
- Parameter names and structure
- Authentication method (file → env vars)
- Process spawn (Node.js → Python)
- Additional required parameter: `user_google_email`

### ❌ Incompatible
- Language runtime (Node.js vs Python)
- Package management (npm vs uv/pip)

## Recommended Adapter Implementation

```typescript
// In gmailMcpService.ts
const TOOL_MAP = {
  'search_emails': 'search_gmail_messages',
  'read_email': 'get_gmail_message_content'
};

function adaptRequest(tool: string, args: any): any {
  const mappedTool = TOOL_MAP[tool] || tool;

  // Add required user_google_email
  if (mappedTool.includes('gmail')) {
    args.user_google_email = process.env.GMAIL_USER_EMAIL || 'default@gmail.com';
  }

  // Parameter name mappings
  if (tool === 'search_emails') {
    args.page_size = args.maxResults;
    delete args.maxResults;
  }

  if (tool === 'read_email') {
    args.message_id = args.messageId;
    delete args.messageId;
    args.include_body = true;
  }

  return { tool: mappedTool, args };
}
```

## Next Steps

1. ✅ Confirmed tools exist with different names
2. ✅ Identified parameter differences
3. ✅ Verified authentication compatibility
4. ⚠️ Need to test actual MCP protocol communication
5. ⚠️ Need to implement adapter layer
6. ⚠️ Need to handle Python dependency in deployment

## Conclusion

The Google Workspace MCP is **compatible** with our requirements but requires:
1. **Tool name mapping** - Simple translation layer
2. **Parameter adaptation** - Add `user_google_email`, rename some params
3. **Process management** - Spawn Python instead of Node.js
4. **Authentication conversion** - File to environment variables

The direct replacement is **feasible** with an adapter layer.