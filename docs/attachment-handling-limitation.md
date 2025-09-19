# Attachment Handling Limitation with Google Workspace MCP

## Current Status

As of Phase 1 implementation, the Google Workspace MCP does not provide a direct attachment download functionality. The `get_gmail_message_content` tool only returns the message body content, not attachments.

## Impact

This limitation affects the following functionality:
1. **Meeting transcript processing** - Many meeting services send transcripts as PDF or text attachments
2. **Document extraction** - Cannot process attached documents containing meeting notes
3. **Multi-format support** - Cannot handle VTT, SRT, or other transcript formats sent as attachments

## Workaround Strategy

### Option 1: Direct Gmail API Integration (Recommended for Phase 2)
Implement a hybrid approach where:
- Use Google Workspace MCP for search and basic email operations
- Use direct Gmail API calls for attachment downloads
- This requires additional OAuth setup but provides full functionality

### Option 2: Request MCP Enhancement
- Open an issue with the Google Workspace MCP project requesting attachment support
- The Gmail API already supports attachment downloads, so this is feasible

### Option 3: Alternative Processing
- Focus on inline transcript content (body text)
- Many services now include transcript summaries in the email body
- This provides partial functionality while awaiting full attachment support

## Implementation Status

### Phase 1 (Current)
- ✅ Email search and reading work with Google Workspace MCP
- ✅ Inline transcript processing from email body works
- ⚠️ Attachment downloads return empty buffer with warning
- ✅ System continues to function with degraded capability

### Phase 2 (Planned)
- Implement direct Gmail API attachment download
- Maintain Google Workspace MCP for other operations
- Provide seamless fallback between the two approaches

## Code Changes Made

1. **gmailService.ts**
   - Added warning for unsupported attachment downloads
   - Returns empty buffer to prevent system crashes
   - Added TODO comment for Phase 2 implementation

2. **Maintained Compatibility**
   - Rate limiting still applies to all operations
   - System gracefully handles missing attachments
   - Processing can continue with inline content

## Testing Recommendations

When testing the current implementation:
1. Use test emails with inline transcript content
2. Verify that attachment-based emails log appropriate warnings
3. Ensure the system doesn't crash when attachments are encountered
4. Test that inline transcript processing works correctly

## Migration Path

When Phase 2 attachment support is implemented:
1. No changes needed to consuming code
2. The `downloadAttachment` method will start returning actual data
3. Existing rate limiting will continue to work
4. No database migrations required