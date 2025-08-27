import { EmailParser } from './emailParser';
import { EmailMessage } from '../services/gmailService';

// Mock logger
jest.mock('../utils/logger', () => ({
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

// Mock config
jest.mock('../config/config', () => ({
  config: {
    gmail: {
      senderDomains: ['@google.com', '@meet.google.com'],
      subjectPatterns: ['Recording of', 'Transcript for', 'Meeting notes'],
    },
  },
}));

describe('EmailParser', () => {
  let parser: EmailParser;

  beforeEach(() => {
    parser = new EmailParser();
  });

  describe('parseEmail', () => {
    it('should detect Google Meet transcript with high confidence', () => {
      const email: EmailMessage = {
        id: 'email1',
        threadId: 'thread1',
        subject: 'Recording of Team Standup - Google Meet',
        from: 'calendar-notification@google.com',
        date: new Date('2024-01-15T10:00:00Z'),
        body: 'Your Google Meet recording is ready. Meeting ID: abc-defg-hij',
        attachments: [
          {
            id: 'attach1',
            filename: 'transcript_team_standup.txt',
            mimeType: 'text/plain',
            size: 1024,
          },
        ],
        labels: ['INBOX'],
      };

      const result = parser.parseEmail(email);

      expect(result.isTranscript).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
      expect(result.service).toBe('google-meet');
      expect(result.transcriptLocation).toBe('attachment');
      expect(result.attachmentInfo?.filename).toBe('transcript_team_standup.txt');
      expect(result.meetingInfo.title).toBe('Team Standup');
      expect(result.meetingInfo.meetingId).toBe('abc-defg-hij');
    });

    it('should detect Zoom recording email', () => {
      const email: EmailMessage = {
        id: 'email2',
        threadId: 'thread2',
        subject: 'Cloud Recording - Product Review is now available',
        from: 'no-reply@zoom.us',
        date: new Date(),
        body: 'Your cloud recording is now available.\nMeeting ID: 12345678901',
        attachments: [],
        labels: [],
      };

      const result = parser.parseEmail(email);

      expect(result.isTranscript).toBe(true);
      expect(result.service).toBe('zoom');
      expect(result.meetingInfo.title).toBe('Product Review');
      expect(result.meetingInfo.meetingId).toBe('12345678901');
    });

    it('should detect Teams meeting recording', () => {
      const email: EmailMessage = {
        id: 'email3',
        threadId: 'thread3',
        subject: 'Meeting Recording: Sprint Planning',
        from: 'meetings@teams.microsoft.com',
        date: new Date(),
        body: 'The recording for your meeting is ready.',
        attachments: [
          {
            id: 'attach2',
            filename: 'Meeting Recording.mp4',
            mimeType: 'video/mp4',
            size: 1000000,
          },
        ],
        labels: [],
      };

      const result = parser.parseEmail(email);

      expect(result.isTranscript).toBe(true);
      expect(result.service).toBe('teams');
      expect(result.meetingInfo.title).toBe('Sprint Planning');
    });

    it('should detect generic meeting transcript', () => {
      const email: EmailMessage = {
        id: 'email4',
        threadId: 'thread4',
        subject: 'Meeting notes from today',
        from: 'assistant@company.com',
        date: new Date(),
        body: 'Please find the transcript attached.\nDuration: 45 minutes\nParticipants: John, Jane, Bob',
        attachments: [
          {
            id: 'attach3',
            filename: 'notes.pdf',
            mimeType: 'application/pdf',
            size: 5000,
          },
        ],
        labels: [],
      };

      const result = parser.parseEmail(email);

      expect(result.isTranscript).toBe(true);
      expect(result.confidence).toBeGreaterThan(30);
      expect(result.transcriptLocation).toBe('attachment');
      expect(result.meetingInfo.duration).toBe('45 minutes');
      expect(result.meetingInfo.participants).toContain('John');
      expect(result.meetingInfo.participants).toContain('Jane');
      expect(result.meetingInfo.participants).toContain('Bob');
    });

    it('should not detect non-meeting email as transcript', () => {
      const email: EmailMessage = {
        id: 'email5',
        threadId: 'thread5',
        subject: 'Weekly Newsletter',
        from: 'newsletter@company.com',
        date: new Date(),
        body: 'Here is your weekly update...',
        attachments: [],
        labels: [],
      };

      const result = parser.parseEmail(email);

      expect(result.isTranscript).toBe(false);
      expect(result.confidence).toBeLessThan(30);
      expect(result.transcriptLocation).toBe('none');
    });

    it('should detect transcript in email body', () => {
      const email: EmailMessage = {
        id: 'email6',
        threadId: 'thread6',
        subject: 'Meeting Transcript',
        from: 'meet@google.com',
        date: new Date(),
        body: `MEETING TRANSCRIPT
        
00:00:00 Speaker 1: Let's begin the meeting
00:00:15 Speaker 2: Sounds good
00:01:00 Speaker 1: First item on the agenda...`,
        attachments: [],
        labels: [],
      };

      const result = parser.parseEmail(email);

      expect(result.isTranscript).toBe(true);
      expect(result.transcriptLocation).toBe('body');
    });

    it('should detect transcript link in email', () => {
      const email: EmailMessage = {
        id: 'email7',
        threadId: 'thread7',
        subject: 'Your meeting recording is ready',
        from: 'noreply@google.com',
        date: new Date(),
        body: 'Click here to view the transcript: https://meet.google.com/recording/abc123',
        attachments: [],
        labels: [],
      };

      const result = parser.parseEmail(email);

      expect(result.isTranscript).toBe(true);
      expect(result.transcriptLocation).toBe('link');
    });
  });

  describe('shouldProcessEmail', () => {
    it('should process high confidence meeting emails', () => {
      const email: EmailMessage = {
        id: 'email1',
        threadId: 'thread1',
        subject: 'Recording of Team Meeting - Google Meet',
        from: 'meet@google.com',
        date: new Date(),
        body: 'Your recording is ready',
        attachments: [
          {
            id: 'attach1',
            filename: 'transcript.txt',
            mimeType: 'text/plain',
            size: 1000,
          },
        ],
        labels: [],
      };

      expect(parser.shouldProcessEmail(email)).toBe(true);
    });

    it('should process emails matching config patterns', () => {
      const email: EmailMessage = {
        id: 'email2',
        threadId: 'thread2',
        subject: 'Meeting notes for review',
        from: 'someone@google.com',
        date: new Date(),
        body: 'Please review the attached notes',
        attachments: [
          {
            id: 'attach1',
            filename: 'notes.pdf',
            mimeType: 'application/pdf',
            size: 5000,
          },
        ],
        labels: [],
      };

      expect(parser.shouldProcessEmail(email)).toBe(true);
    });

    it('should not process unrelated emails', () => {
      const email: EmailMessage = {
        id: 'email3',
        threadId: 'thread3',
        subject: 'Invoice for services',
        from: 'billing@vendor.com',
        date: new Date(),
        body: 'Please find attached invoice',
        attachments: [
          {
            id: 'attach1',
            filename: 'invoice.pdf',
            mimeType: 'application/pdf',
            size: 2000,
          },
        ],
        labels: [],
      };

      expect(parser.shouldProcessEmail(email)).toBe(false);
    });
  });

  describe('addCustomPattern', () => {
    it('should allow adding custom patterns', () => {
      const customEmail: EmailMessage = {
        id: 'custom1',
        threadId: 'thread1',
        subject: 'Custom Meeting System Output',
        from: 'custom@mycompany.com',
        date: new Date(),
        body: 'Custom transcript',
        attachments: [],
        labels: [],
      };

      // Initially should not detect as transcript
      let result = parser.parseEmail(customEmail);
      expect(result.confidence).toBeLessThan(30);

      // Add custom pattern
      parser.addCustomPattern({
        type: 'subject',
        pattern: /Custom Meeting System/i,
        priority: 10,
      });

      // Now should detect as transcript
      result = parser.parseEmail(customEmail);
      expect(result.confidence).toBeGreaterThan(30);
      expect(result.isTranscript).toBe(true);
    });
  });
});