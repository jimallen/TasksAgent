# Google OAuth Setup Guide

This guide walks you through setting up Google OAuth credentials for the Obsidian Meeting Tasks Plugin.

## Prerequisites
- Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step-by-Step Instructions

### 1. Create or Select a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top of the page
3. Choose one of the following:
   - **Select an existing project** if you have one
   - **Click "New Project"** to create a new one:
     - Enter a project name (e.g., "Obsidian Gmail Plugin")
     - Click "Create"
     - Wait for the project to be created (about 30 seconds)

### 2. Enable Gmail API

1. In the Google Cloud Console, navigate to **"APIs & Services" > "Library"**
   - You can find this in the left sidebar menu
   - Or use the search bar at the top and type "API Library"

2. Search for **"Gmail API"**:
   - Type "Gmail" in the search box
   - Click on "Gmail API" from the results

3. Click the **"Enable"** button
   - If you see "Manage" instead, the API is already enabled
   - Wait for the API to be enabled (usually instant)

### 3. Configure OAuth Consent Screen

Before creating credentials, you need to configure the OAuth consent screen:

1. Go to **"APIs & Services" > "OAuth consent screen"**

2. Choose User Type:
   - Select **"External"** (unless you have a Google Workspace account)
   - Click **"Create"**

3. Fill in the App Information:
   - **App name**: "Obsidian Meeting Tasks" (or your preferred name)
   - **User support email**: Select your email from the dropdown
   - **Developer contact information**: Enter your email
   - Leave other fields blank/default
   - Click **"Save and Continue"**

4. Scopes (Important!):
   - Click **"Add or Remove Scopes"**
   - Search for and select these scopes:
     - `https://www.googleapis.com/auth/gmail.readonly` - Read access to Gmail
     - `https://www.googleapis.com/auth/gmail.modify` - Modify labels (optional)
   - Click **"Update"**
   - Click **"Save and Continue"**

5. Test Users (Optional for development):
   - Click **"Add Users"**
   - Add your email address
   - Add any other emails that will use the plugin
   - Click **"Save and Continue"**

6. Review and finish:
   - Review your settings
   - Click **"Back to Dashboard"**

### 4. Create OAuth 2.0 Credentials

1. Navigate to **"APIs & Services" > "Credentials"**

2. Click **"+ Create Credentials"** button at the top

3. Select **"OAuth client ID"** from the dropdown

4. Configure the OAuth client:
   - **Application type**: Select **"Desktop app"**
   - **Name**: "Obsidian Plugin" (or any name you prefer)
   - Click **"Create"**

5. Save your credentials:
   - A dialog will appear with your credentials
   - **Copy the Client ID** - You'll need this for the plugin
   - **Copy the Client Secret** - You'll need this for the plugin
   - Click **"OK"**

### 5. Download Credentials (Optional)

For backup purposes, you can download the credentials:

1. In the Credentials page, find your OAuth 2.0 Client ID
2. Click the download button (⬇️) on the right
3. Save the JSON file securely
4. **Note**: The plugin only needs the Client ID and Secret, not the full JSON

## Important Security Notes

### Keep Your Credentials Secure
- **Never share** your Client Secret publicly
- **Never commit** credentials to version control
- **Store securely** in the plugin settings only

### Publishing Considerations
If you plan to share the plugin:
- Each user needs their own Google Cloud Project
- Don't include your credentials in the plugin distribution
- Consider the OAuth verification process for production apps

### API Quotas and Limits
- Gmail API has quotas (default is generous for personal use)
- Check your usage in Google Cloud Console > APIs & Services > Gmail API > Quotas
- Free tier typically includes:
  - 250 quota units per user per second
  - 1,000,000,000 quota units per day

## Configuring the Plugin

Once you have your credentials:

1. Open Obsidian Settings
2. Navigate to the Meeting Tasks plugin settings
3. Enter your credentials:
   - **Google Client ID**: Paste the Client ID you copied
   - **Google Client Secret**: Paste the Client Secret you copied
4. Click **"Save"** to store the credentials
5. Click **"Authenticate"** to start the OAuth flow

## Troubleshooting

### "Access blocked" Error
- Make sure you've configured the OAuth consent screen
- Add your email to test users if in development
- Check that Gmail API is enabled

### "Invalid client" Error
- Verify Client ID and Secret are copied correctly
- Ensure you selected "Desktop app" as application type
- Check for extra spaces when pasting credentials

### "Scope not authorized" Error
- Return to OAuth consent screen configuration
- Add the required Gmail scope
- Save and try again

### Rate Limit Errors
- Check your quota usage in Google Cloud Console
- Implement exponential backoff (plugin handles this)
- Consider upgrading if needed for production use

## OAuth Flow Explained

When you authenticate in the plugin:

1. Plugin opens browser with Google sign-in page
2. You sign in and grant permissions
3. Google provides an authorization code
4. You paste the code in Obsidian
5. Plugin exchanges code for access/refresh tokens
6. Tokens are stored securely in plugin settings
7. Plugin can now access Gmail on your behalf

## Verification for Production (Optional)

If distributing to many users, consider:

1. **OAuth App Verification**:
   - Required for apps with 100+ users
   - Submit for review in Google Cloud Console
   - Provide privacy policy and terms of service
   - Process takes 4-6 weeks

2. **Restricted Scopes**:
   - Gmail scopes are considered "restricted"
   - May require additional security assessment
   - Consider using minimum required permissions

## Next Steps

After setting up OAuth:

1. Test the authentication in Obsidian
2. Process your first batch of emails
3. Configure other plugin settings as needed
4. Review [System Architecture](./system-architecture.md) for technical details

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google Cloud Console Help](https://cloud.google.com/docs)
- [OAuth Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes)

---

If you encounter issues not covered here, please check the [README](../README.md) troubleshooting section or create an issue on GitHub.