# Gmail MCP Server Setup Guide

## Prerequisites

1. A Google account with Gmail enabled
2. Access to Google Cloud Console

## Step 1: Enable Gmail API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Library"
4. Search for "Gmail API"
5. Click on "Gmail API" and then "Enable"

## Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type (or "Internal" for Google Workspace)
   - Fill in the required fields
   - Add your email to test users
4. For Application type, choose "Desktop app"
5. Name your OAuth 2.0 client (e.g., "Meeting Transcript Agent")
6. Click "Create"

## Step 3: Download Credentials

1. After creating the OAuth client, click the download button (⬇) next to your client
2. Save the file as `gmail.credentials.json` in `src/config/`
3. The file should look similar to `gmail.credentials.example.json`

## Step 4: Setup Gmail MCP Server

### Option A: Using Global Authentication (Recommended)
1. Create a directory for MCP credentials:
   ```bash
   mkdir -p ~/.gmail-mcp
   ```
2. Copy your credentials file:
   ```bash
   cp src/config/gmail.credentials.json ~/.gmail-mcp/gcp-oauth.keys.json
   ```
3. Authenticate:
   ```bash
   npx @gongrzhe/server-gmail-autoauth-mcp auth
   ```

### Option B: Local Project Authentication
1. Copy credentials to project:
   ```bash
   cp src/config/gmail.credentials.json gcp-oauth.keys.json
   ```
2. Run authentication:
   ```bash
   npm run setup:gmail
   ```

## Step 5: Configure Scopes

The application requires the following Gmail API scopes:
- `https://www.googleapis.com/auth/gmail.readonly` - Read emails and attachments
- `https://www.googleapis.com/auth/gmail.modify` - Mark emails as read and add labels

## Step 6: Available MCP Tools

The Gmail MCP Server provides these tools:
- `search_emails` - Search emails with Gmail query syntax
- `read_email` - Read full email content including attachments
- `send_email` - Send new emails
- `draft_email` - Create email drafts
- `modify_email` - Modify email labels and status
- `delete_email` - Delete emails
- `list_email_labels` - List available labels
- `batch_modify_emails` - Bulk email operations
- `create_label` - Create new labels
- `create_filter` - Create email filters

## Troubleshooting

### "Access blocked" error
- Ensure your OAuth consent screen is properly configured
- Add your email to the test users list

### "Quota exceeded" error
- Check your Gmail API quotas in Google Cloud Console
- Default quota is usually sufficient for this application

### Token expiration
- The application will automatically refresh tokens
- If issues persist, delete the stored token and re-authenticate

## Security Notes

- Never commit `gmail.credentials.json` to version control
- Keep your client secret secure
- Use environment variables for sensitive data
- Regularly review authorized applications in your Google Account settings