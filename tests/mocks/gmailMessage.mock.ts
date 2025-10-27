import { GmailMessage } from '../../src/gmailService';

/**
 * Mock Gmail messages for testing
 */

export const createMockGmailMessage = (overrides?: Partial<GmailMessage>): GmailMessage => ({
  id: 'test-message-123',
  subject: 'Test Meeting - Product Sync',
  from: 'sender@example.com',
  date: '2025-01-27',
  body: 'Meeting transcript content...',
  searchedLabels: ['transcript'],
  attachments: [],
  ...overrides
});

export const mockTranscriptEmail: GmailMessage = {
  id: 'transcript-001',
  subject: 'Weekly Team Standup',
  from: 'calendar@example.com',
  date: '2025-01-27',
  body: `
    John: Let's start with updates from engineering.
    Sarah: I finished the authentication refactor.
    John: Great! Can you review the API docs by Friday?
    Sarah: Sure, I'll get that done.
  `,
  searchedLabels: ['transcript'],
  attachments: []
};

export const mockActionEmail: GmailMessage = {
  id: 'action-001',
  subject: 'Action Items from Q1 Planning',
  from: 'pm@example.com',
  date: '2025-01-27',
  body: `
    Hi team,

    Here are the action items from today's planning:
    - Update the roadmap with Q1 priorities
    - Schedule user interviews
    - Review budget proposal

    Thanks!
  `,
  searchedLabels: ['action'],
  attachments: []
};

export const mockEmailWithMultipleLabels: GmailMessage = {
  id: 'multi-label-001',
  subject: 'Important Meeting Follow-up',
  from: 'ceo@example.com',
  date: '2025-01-27',
  body: 'Meeting content with action items...',
  searchedLabels: ['transcript', 'action', 'important'],
  attachments: []
};

export const mockEmailWithAttachments: GmailMessage = {
  id: 'attachment-001',
  subject: 'Q1 Planning Meeting',
  from: 'pm@example.com',
  date: '2025-01-27',
  body: 'See attached slides...',
  searchedLabels: ['transcript'],
  attachments: [
    { filename: 'Q1_Planning.pdf', mimeType: 'application/pdf', size: 125000 },
    { filename: 'Roadmap.xlsx', mimeType: 'application/vnd.ms-excel', size: 45000 }
  ]
};
