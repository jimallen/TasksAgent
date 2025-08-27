import { EmailFilterService, EmailFilterCriteria } from './emailFilter';
import { EmailMessage } from './gmailService';

// Mock dependencies
jest.mock('../parsers/emailParser', () => ({
  emailParser: {
    parseEmail: jest.fn(() => ({ confidence: 50 })),
  },
}));

jest.mock('../utils/logger', () => ({
  logDebug: jest.fn(),
  logInfo: jest.fn(),
}));

jest.mock('../config/config', () => ({
  config: {
    gmail: {
      senderDomains: ['@google.com', '@meet.google.com'],
      subjectPatterns: ['Recording of', 'Transcript for'],
    },
  },
}));

describe('EmailFilterService', () => {
  let filterService: EmailFilterService;

  beforeEach(() => {
    filterService = new EmailFilterService();
    jest.clearAllMocks();
  });

  const createTestEmail = (overrides?: Partial<EmailMessage>): EmailMessage => ({
    id: 'email1',
    threadId: 'thread1',
    subject: 'Test Email',
    from: 'test@example.com',
    date: new Date(),
    body: 'Test body',
    attachments: [],
    labels: ['INBOX'],
    ...overrides,
  });

  describe('filterEmails', () => {
    it('should filter emails by sender domain', () => {
      const emails = [
        createTestEmail({ from: 'meet@google.com' }),
        createTestEmail({ from: 'user@gmail.com' }),
        createTestEmail({ from: 'external@company.com' }),
      ];

      const criteria: EmailFilterCriteria = {
        senderDomains: ['@google.com'],
        minConfidence: 0,
      };

      const filtered = filterService.filterEmails(emails, criteria);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.from).toBe('meet@google.com');
    });

    it('should filter emails by subject pattern', () => {
      const emails = [
        createTestEmail({ subject: 'Recording of Team Meeting' }),
        createTestEmail({ subject: 'Weekly Newsletter' }),
        createTestEmail({ subject: 'Transcript for Project Review' }),
      ];

      const criteria: EmailFilterCriteria = {
        subjectPatterns: ['Recording of', 'Transcript for'],
        minConfidence: 0,
      };

      const filtered = filterService.filterEmails(emails, criteria);
      
      expect(filtered).toHaveLength(2);
      expect(filtered[0]?.subject).toContain('Recording of');
      expect(filtered[1]?.subject).toContain('Transcript for');
    });

    it('should filter emails with attachments', () => {
      const emails = [
        createTestEmail({
          attachments: [
            { id: 'a1', filename: 'doc.pdf', mimeType: 'application/pdf', size: 1000 },
          ],
        }),
        createTestEmail({ attachments: [] }),
        createTestEmail({
          attachments: [
            { id: 'a2', filename: 'image.png', mimeType: 'image/png', size: 2000 },
          ],
        }),
      ];

      const criteria: EmailFilterCriteria = {
        hasAttachment: true,
        minConfidence: 0,
      };

      const filtered = filterService.filterEmails(emails, criteria);
      
      expect(filtered).toHaveLength(2);
      expect(filtered[0]?.attachments.length).toBeGreaterThan(0);
      expect(filtered[1]?.attachments.length).toBeGreaterThan(0);
    });

    it('should filter by date range', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const emails = [
        createTestEmail({ date: new Date() }),
        createTestEmail({ date: yesterday }),
        createTestEmail({ date: lastWeek }),
      ];

      const criteria: EmailFilterCriteria = {
        dateRange: {
          start: yesterday,
          end: tomorrow,
        },
        minConfidence: 0,
      };

      const filtered = filterService.filterEmails(emails, criteria);
      
      expect(filtered).toHaveLength(2);
    });

    it('should exclude emails with specific labels', () => {
      const emails = [
        createTestEmail({ labels: ['INBOX'] }),
        createTestEmail({ labels: ['INBOX', 'SPAM'] }),
        createTestEmail({ labels: ['TRASH'] }),
      ];

      const criteria: EmailFilterCriteria = {
        excludeLabels: ['SPAM', 'TRASH'],
        minConfidence: 0,
      };

      const filtered = filterService.filterEmails(emails, criteria);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.labels).not.toContain('SPAM');
      expect(filtered[0]?.labels).not.toContain('TRASH');
    });

    it('should filter by minimum confidence', () => {
      const emails = [
        createTestEmail({ from: 'meet@google.com', subject: 'Recording of Meeting' }),
        createTestEmail({ from: 'random@example.com', subject: 'Random Email' }),
      ];

      const criteria: EmailFilterCriteria = {
        minConfidence: 40,
      };

      const filtered = filterService.filterEmails(emails, criteria);
      
      // First email should have higher confidence due to matching patterns
      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  describe('evaluateEmail', () => {
    it('should evaluate email against multiple criteria', () => {
      const email = createTestEmail({
        from: 'meet@google.com',
        subject: 'Recording of Team Standup',
        attachments: [
          { id: 'a1', filename: 'transcript.txt', mimeType: 'text/plain', size: 1000 },
        ],
      });

      const result = filterService.evaluateEmail(email);
      
      expect(result.passed).toBe(true);
      expect(result.confidence).toBeGreaterThan(30);
      expect(result.matchedCriteria).toContain('sender_domain');
      expect(result.matchedCriteria).toContain('subject_pattern');
      expect(result.matchedCriteria).toContain('attachment_requirement');
    });

    it('should fail evaluation when required criteria not met', () => {
      const email = createTestEmail({
        from: 'external@company.com',
        attachments: [],
      });

      const criteria: EmailFilterCriteria = {
        senderDomains: ['@google.com'],
        hasAttachment: true,
      };

      const result = filterService.evaluateEmail(email, criteria);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should handle regex patterns in subject', () => {
      const email = createTestEmail({
        subject: 'Meeting ID: 12345',
      });

      const criteria: EmailFilterCriteria = {
        subjectPatterns: ['/Meeting ID: \\d+/'],
        minConfidence: 0,
      };

      const result = filterService.evaluateEmail(email, criteria);
      
      expect(result.passed).toBe(true);
      expect(result.matchedCriteria).toContain('subject_pattern');
    });

    it('should handle specific sender emails', () => {
      const email = createTestEmail({
        from: 'John Doe <john.doe@google.com>',
      });

      const criteria: EmailFilterCriteria = {
        senderEmails: ['john.doe@google.com'],
        minConfidence: 0,
      };

      const result = filterService.evaluateEmail(email, criteria);
      
      expect(result.passed).toBe(true);
      expect(result.matchedCriteria).toContain('sender_email');
    });
  });

  describe('service-specific filters', () => {
    it('should create Google Meet filter', () => {
      const filter = filterService.createGoogleMeetFilter();
      
      expect(filter.senderDomains).toContain('@google.com');
      expect(filter.senderDomains).toContain('@meet.google.com');
      expect(filter.subjectPatterns).toContain('Recording of');
      expect(filter.hasAttachment).toBe(true);
    });

    it('should create Zoom filter', () => {
      const filter = filterService.createZoomFilter();
      
      expect(filter.senderDomains).toContain('@zoom.us');
      expect(filter.subjectPatterns).toContain('Cloud Recording');
    });

    it('should create Teams filter', () => {
      const filter = filterService.createTeamsFilter();
      
      expect(filter.senderDomains).toContain('@microsoft.com');
      expect(filter.subjectPatterns).toContain('Meeting Recording');
    });

    it('should create combined filter for all services', () => {
      const filter = filterService.createAllMeetingServicesFilter();
      
      expect(filter.senderDomains).toContain('@google.com');
      expect(filter.senderDomains).toContain('@zoom.us');
      expect(filter.senderDomains).toContain('@microsoft.com');
      expect(filter.hasAttachment).toBe(true);
    });
  });

  describe('default criteria management', () => {
    it('should update default criteria', () => {
      const newCriteria: Partial<EmailFilterCriteria> = {
        minConfidence: 60,
        excludeLabels: ['SPAM', 'TRASH', 'PROMOTIONS'],
      };

      filterService.updateDefaultCriteria(newCriteria);
      const defaults = filterService.getDefaultCriteria();
      
      expect(defaults.minConfidence).toBe(60);
      expect(defaults.excludeLabels).toContain('PROMOTIONS');
    });

    it('should use default criteria when none provided', () => {
      const email = createTestEmail({
        from: 'meet@google.com',
        subject: 'Recording of Meeting',
        attachments: [
          { id: 'a1', filename: 'doc.pdf', mimeType: 'application/pdf', size: 1000 },
        ],
      });

      const result = filterService.evaluateEmail(email);
      
      expect(result.passed).toBe(true);
    });
  });
});