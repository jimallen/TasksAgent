# OAuth Scope Requirements for Gmail Operations

## Overview

This document outlines the OAuth 2.0 scope requirements for the Google Workspace MCP integration, focusing on Phase 1 (Gmail-only operations) and planning for future phases (Calendar and Drive).

## Gmail API Scopes

### Current Implementation Requirements

For the meeting transcript processing system, we need the following Gmail operations:
- Search emails by sender, subject, and date range
- Read email content and headers
- Access email attachments
- NO sending, modifying, or deleting emails

### Recommended Scope for Phase 1

#### Option 1: Read-Only Scope (RECOMMENDED)
```
https://www.googleapis.com/auth/gmail.readonly
```
- **Access Level**: Restricted
- **Description**: Read all resources and their metadata—no write operations
- **Benefits**:
  - Covers all current use cases
  - More likely to pass OAuth verification
  - Lower security risk
  - Users more comfortable granting read-only access

#### Option 2: Metadata Scope (LIMITED)
```
https://www.googleapis.com/auth/gmail.metadata
```
- **Access Level**: Restricted
- **Description**: Read resources metadata including labels, history records, and email message headers
- **Limitation**: Cannot read email body or attachments
- **Not Suitable**: We need full email content for transcript processing

#### Option 3: Full Mail Scope (NOT RECOMMENDED)
```
https://mail.google.com/
```
- **Access Level**: Restricted
- **Description**: Full access to the account's mailboxes, including permanent deletion
- **Concerns**:
  - Excessive permissions for our use case
  - Harder to get OAuth verification
  - Users may be reluctant to grant full access

## Phase-by-Phase Scope Requirements

### Phase 1: Gmail Only (Direct Replacement)
```javascript
const PHASE_1_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly'
];
```

### Phase 2: Calendar Integration
```javascript
const PHASE_2_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events',    // Create and modify events
  'https://www.googleapis.com/auth/calendar.readonly'  // Read calendar for conflict detection
];
```

### Phase 3: Drive Integration
```javascript
const PHASE_3_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.file',        // Create and manage files
  'https://www.googleapis.com/auth/drive.metadata'     // Read metadata for organization
];
```

## OAuth Verification Considerations

### Scope Classifications

1. **Sensitive Scopes**:
   - `gmail.send` - Can send emails on user's behalf
   - Require basic OAuth verification

2. **Restricted Scopes**:
   - `gmail.readonly` - Can read all emails
   - `gmail.modify` - Can modify emails
   - `gmail.metadata` - Can read email metadata
   - `calendar.events` - Can create/modify calendar events
   - `drive.file` - Can create/manage files
   - Require full OAuth verification process
   - Annual re-verification required

### Verification Requirements

For our application using restricted scopes:

1. **Brand Verification** (2-3 business days):
   - Verify app ownership
   - Provide privacy policy
   - Terms of service

2. **Scope Verification** (several weeks):
   - Justify need for each scope
   - Demonstrate scope usage
   - Security assessment questionnaire
   - Potential third-party security audit

3. **Annual Re-verification**:
   - Required for apps using restricted scopes
   - Must show continued compliance

## Implementation Strategy

### Phase 1: Minimal Scope Approach

1. **Start with Read-Only**:
   ```javascript
   const scopes = ['https://www.googleapis.com/auth/gmail.readonly'];
   ```

2. **Test Thoroughly**:
   - Verify all search operations work
   - Ensure attachment access functions
   - Confirm no write operations needed

3. **User Communication**:
   - Clearly explain why read access is needed
   - Emphasize no modification capabilities
   - Provide privacy policy link

### Progressive Scope Enhancement

For Phases 2 and 3, implement incremental scope requests:

```javascript
// Phase 1: Initial connection
async function connectPhase1() {
  const scopes = ['https://www.googleapis.com/auth/gmail.readonly'];
  // ... authenticate with Gmail scope
}

// Phase 2: When calendar features needed
async function enableCalendarFeatures() {
  const additionalScopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly'
  ];
  // ... request additional authorization
}

// Phase 3: When Drive features needed
async function enableDriveFeatures() {
  const additionalScopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata'
  ];
  // ... request additional authorization
}
```

## Security Best Practices

### Principle of Least Privilege
- Only request scopes actually needed
- Start with minimal permissions
- Add scopes incrementally as features are added

### Token Management
- Store refresh tokens securely
- Implement token rotation
- Handle token expiration gracefully
- Note: Test mode tokens expire in 7 days

### Scope Documentation
- Clearly document why each scope is needed
- Provide examples of how each scope is used
- Update documentation when scopes change

## Configuration Examples

### Environment Variables for Google Workspace MCP
```bash
# Phase 1: Gmail only
export GOOGLE_OAUTH_SCOPES="https://www.googleapis.com/auth/gmail.readonly"

# Phase 2: Add Calendar
export GOOGLE_OAUTH_SCOPES="https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly"

# Phase 3: Add Drive
export GOOGLE_OAUTH_SCOPES="https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata"
```

### OAuth Consent Screen Configuration

1. **Application Type**: Desktop Application
2. **User Type**: External (for public use) or Internal (for organization only)
3. **Publishing Status**:
   - Testing (during development, 100 user limit)
   - Published (after verification)

## Migration Considerations

### From Current Gmail MCP to Google Workspace MCP

1. **Scope Compatibility**:
   - Current MCP likely uses `gmail.readonly` or full mail scope
   - Google Workspace MCP can be configured with same scope
   - No user re-authorization needed if scope unchanged

2. **Token Migration**:
   - Existing refresh tokens should remain valid
   - May need to convert token storage format
   - Test with existing authenticated users

## Testing Checklist

### Phase 1 Gmail Operations
- [ ] Search emails by sender domain
- [ ] Search emails by subject pattern
- [ ] Search emails by date range
- [ ] Read email full content
- [ ] Access email attachments
- [ ] Verify no write operations attempted
- [ ] Test with multiple Gmail accounts
- [ ] Verify rate limiting still works

### OAuth Flow Testing
- [ ] Initial authorization flow
- [ ] Token refresh mechanism
- [ ] Scope upgrade flow (for Phase 2/3)
- [ ] Error handling for denied permissions
- [ ] Token expiration handling

## Compliance Notes

### GDPR and Privacy
- Only access data necessary for functionality
- Implement data retention policies
- Provide user data deletion mechanism
- Clear privacy policy required

### Google API Services User Data Policy
- Must comply with Google's user data policy
- Annual security assessment may be required
- Data use must match declared purposes

## Recommendations

### For Phase 1 (Immediate)
1. **Use `gmail.readonly` scope only**
2. **Document scope usage clearly**
3. **Prepare for OAuth verification process**
4. **Test thoroughly with limited scope**

### For Future Phases
1. **Plan incremental scope requests**
2. **Consider user consent UX**
3. **Prepare verification documentation early**
4. **Implement scope feature flags**

---

*Document Version: 1.0*
*Date: 2025-01-19*
*For: Google Workspace MCP Integration - Phase 1*