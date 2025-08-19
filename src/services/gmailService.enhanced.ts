import { EmailMessage, GmailSearchQuery } from './gmailService';
import { gmailService } from './gmailService';
import { logInfo } from '../utils/logger';
import { config } from '../config/config';

export interface MeetingTranscript {
  emailId: string;
  meetingTitle: string;
  meetingDate: Date;
  transcriptAttachment: {
    id: string;
    filename: string;
    mimeType: string;
  } | null;
  participants?: string[];
  duration?: string;
}

/**
 * Enhanced Gmail service methods for meeting transcript processing
 */
export class GmailEnhancedService {
  /**
   * Fetch meeting transcripts from Gmail within date range
   */
  async fetchMeetingTranscripts(
    startDate?: Date,
    endDate?: Date
  ): Promise<MeetingTranscript[]> {
    const start = startDate || new Date(Date.now() - config.gmail.checkIntervalHours * 60 * 60 * 1000);
    const end = endDate || new Date();

    logInfo(`Fetching meeting transcripts from ${start.toISOString()} to ${end.toISOString()}`);

    // Build comprehensive search query for meeting transcripts
    const searchQuery: GmailSearchQuery = {
      after: start,
      before: end,
      hasAttachment: true,
      query: this.buildMeetingTranscriptQuery(),
    };

    const emails = await gmailService.searchEmails(searchQuery);
    const transcripts: MeetingTranscript[] = [];

    for (const email of emails) {
      const transcript = this.extractMeetingTranscript(email);
      if (transcript) {
        transcripts.push(transcript);
      }
    }

    logInfo(`Found ${transcripts.length} meeting transcripts`);
    return transcripts;
  }

  /**
   * Fetch meeting transcripts for a specific date
   */
  async fetchTranscriptsForDate(date: Date): Promise<MeetingTranscript[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.fetchMeetingTranscripts(startOfDay, endOfDay);
  }

  /**
   * Fetch unprocessed meeting transcripts
   */
  async fetchUnprocessedTranscripts(
    processedEmailIds: Set<string>
  ): Promise<MeetingTranscript[]> {
    const allTranscripts = await this.fetchMeetingTranscripts();
    
    return allTranscripts.filter(
      transcript => !processedEmailIds.has(transcript.emailId)
    );
  }

  /**
   * Build comprehensive query for meeting transcripts
   */
  private buildMeetingTranscriptQuery(): string {
    const queries: string[] = [];

    // Add sender domain queries
    if (config.gmail.senderDomains.length > 0) {
      const domainQuery = config.gmail.senderDomains
        .map(domain => `from:${domain}`)
        .join(' OR ');
      queries.push(`(${domainQuery})`);
    }

    // Add subject pattern queries
    if (config.gmail.subjectPatterns.length > 0) {
      const subjectQuery = config.gmail.subjectPatterns
        .map(pattern => `subject:"${pattern}"`)
        .join(' OR ');
      queries.push(`(${subjectQuery})`);
    }

    // Add common meeting-related keywords
    const meetingKeywords = [
      'meeting recording',
      'meeting transcript',
      'meeting notes',
      'meeting summary',
    ];
    const keywordQuery = meetingKeywords
      .map(keyword => `"${keyword}"`)
      .join(' OR ');
    queries.push(`(${keywordQuery})`);

    // Combine all queries with OR
    return queries.join(' OR ');
  }

  /**
   * Extract meeting transcript information from email
   */
  private extractMeetingTranscript(email: EmailMessage): MeetingTranscript | null {
    // Check if email is likely a meeting transcript
    if (!this.isLikelyMeetingTranscript(email)) {
      return null;
    }

    // Find transcript attachment
    const transcriptAttachment = this.findTranscriptAttachment(email.attachments);

    // Extract meeting title from subject
    const meetingTitle = this.extractMeetingTitle(email.subject);

    // Extract meeting date (prefer from email metadata over email date)
    const meetingDate = this.extractMeetingDate(email.subject, email.body) || email.date;

    // Extract participants if available
    const participants = this.extractParticipants(email.body);

    // Extract duration if available
    const duration = this.extractDuration(email.body);

    return {
      emailId: email.id,
      meetingTitle,
      meetingDate,
      transcriptAttachment,
      participants,
      duration,
    };
  }

  /**
   * Check if email is likely a meeting transcript
   */
  private isLikelyMeetingTranscript(email: EmailMessage): boolean {
    const subjectLower = email.subject.toLowerCase();
    const fromLower = email.from.toLowerCase();

    // Check sender
    const isFromMeetingService = config.gmail.senderDomains.some(
      domain => fromLower.includes(domain.replace('@', ''))
    );

    // Check subject patterns
    const hasSubjectPattern = config.gmail.subjectPatterns.some(
      pattern => subjectLower.includes(pattern.toLowerCase())
    );

    // Check for meeting-related keywords
    const meetingKeywords = ['meeting', 'transcript', 'recording', 'summary', 'notes'];
    const hasMeetingKeyword = meetingKeywords.some(
      keyword => subjectLower.includes(keyword)
    );

    return isFromMeetingService || hasSubjectPattern || hasMeetingKeyword;
  }

  /**
   * Find transcript attachment in email attachments
   */
  private findTranscriptAttachment(attachments: EmailMessage['attachments']) {
    if (!attachments || attachments.length === 0) {
      return null;
    }

    // Prioritize transcript file types
    const transcriptTypes = [
      { mime: 'text/plain', ext: '.txt' },
      { mime: 'application/pdf', ext: '.pdf' },
      { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: '.docx' },
      { mime: 'application/msword', ext: '.doc' },
      { mime: 'text/vtt', ext: '.vtt' }, // Video transcript format
      { mime: 'text/srt', ext: '.srt' }, // Subtitle format
    ];

    // Find best matching attachment
    for (const type of transcriptTypes) {
      const attachment = attachments.find(
        att => 
          att.mimeType === type.mime || 
          att.filename.toLowerCase().endsWith(type.ext)
      );
      
      if (attachment) {
        return {
          id: attachment.id,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
        };
      }
    }

    // Fallback to first attachment if no specific type found
    const firstAttachment = attachments[0];
    if (firstAttachment) {
      return {
        id: firstAttachment.id,
        filename: firstAttachment.filename,
        mimeType: firstAttachment.mimeType,
      };
    }

    return null;
  }

  /**
   * Extract meeting title from subject
   */
  private extractMeetingTitle(subject: string): string {
    // Remove common prefixes
    let title = subject;
    const prefixes = [
      'Recording of',
      'Transcript for',
      'Meeting notes:',
      'Meeting recording:',
      'Summary of',
      'Notes from',
      'Re:',
      'Fwd:',
    ];

    for (const prefix of prefixes) {
      const regex = new RegExp(`^${prefix}\\s*`, 'i');
      title = title.replace(regex, '');
    }

    // Remove date/time patterns
    title = title.replace(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g, '').trim();
    title = title.replace(/\d{1,2}:\d{2}\s*(AM|PM)?/gi, '').trim();

    // Clean up extra spaces and special characters
    title = title.replace(/\s+/g, ' ').trim();
    
    return title || 'Untitled Meeting';
  }

  /**
   * Extract meeting date from subject or body
   */
  private extractMeetingDate(subject: string, body: string): Date | null {
    const text = `${subject} ${body}`;
    
    // Common date patterns
    const datePatterns = [
      /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/g, // MM/DD/YYYY or MM-DD-YYYY
      /(\d{4})[/-](\d{1,2})[/-](\d{1,2})/g, // YYYY-MM-DD
      /(\w{3,})\s+(\d{1,2}),?\s+(\d{4})/gi, // Month DD, YYYY
      /(\d{1,2})\s+(\w{3,})\s+(\d{4})/gi, // DD Month YYYY
    ];

    for (const pattern of datePatterns) {
      const match = pattern.exec(text);
      if (match) {
        try {
          const date = new Date(match[0]);
          if (!isNaN(date.getTime())) {
            return date;
          }
        } catch {
          // Continue to next pattern
        }
      }
    }

    return null;
  }

  /**
   * Extract participants from email body
   */
  private extractParticipants(body: string): string[] | undefined {
    const participants: string[] = [];
    
    // Look for participant patterns
    const patterns = [
      /Participants?:\s*([^\n]+)/i,
      /Attendees?:\s*([^\n]+)/i,
      /Present:\s*([^\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(body);
      if (match && match[1]) {
        const names = match[1]
          .split(/[,;]/)
          .map(name => name.trim())
          .filter(name => name.length > 0);
        participants.push(...names);
      }
    }

    return participants.length > 0 ? participants : undefined;
  }

  /**
   * Extract meeting duration from email body
   */
  private extractDuration(body: string): string | undefined {
    // Look for duration patterns
    const patterns = [
      /Duration:\s*([^\n]+)/i,
      /Length:\s*([^\n]+)/i,
      /(\d+)\s*(hours?|hrs?|minutes?|mins?)/i,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(body);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }
}

// Export singleton instance
export const gmailEnhancedService = new GmailEnhancedService();