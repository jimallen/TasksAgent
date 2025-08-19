import { EmailMessage } from '../services/gmailService';
import { logDebug } from '../utils/logger';
import { config } from '../config/config';

export interface EmailPattern {
  type: 'sender' | 'subject' | 'body' | 'attachment';
  pattern: string | RegExp;
  priority: number; // Higher number = higher priority
  service?: 'google-meet' | 'zoom' | 'teams' | 'unknown';
}

export interface ParsedMeetingEmail {
  isTranscript: boolean;
  confidence: number; // 0-100
  service: 'google-meet' | 'zoom' | 'teams' | 'unknown';
  meetingInfo: {
    title?: string;
    date?: Date;
    time?: string;
    duration?: string;
    meetingId?: string;
    participants?: string[];
    organizer?: string;
  };
  transcriptLocation: 'attachment' | 'body' | 'link' | 'none';
  attachmentInfo?: {
    filename: string;
    mimeType: string;
    attachmentId: string;
  };
}

export class EmailParser {
  private patterns: EmailPattern[] = [
    // Google Meet patterns
    {
      type: 'sender',
      pattern: /(@google\.com|@meet\.google\.com|noreply.*google|calendar-notification@google|gemini-notes@google)/i,
      priority: 10,
      service: 'google-meet',
    },
    {
      type: 'subject',
      pattern: /Recording of .* - Google Meet/i,
      priority: 10,
      service: 'google-meet',
    },
    {
      type: 'subject',
      pattern: /Notes: .*/i,  // Google Gemini meeting notes
      priority: 9,
      service: 'google-meet',
    },
    {
      type: 'subject',
      pattern: /Meeting recording - .*/i,
      priority: 8,
      service: 'google-meet',
    },
    {
      type: 'subject',
      pattern: /Transcript for .* meeting/i,
      priority: 9,
      service: 'google-meet',
    },
    {
      type: 'body',
      pattern: /meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i,
      priority: 7,
      service: 'google-meet',
    },
    {
      type: 'body',
      pattern: /Google Meet recording/i,
      priority: 8,
      service: 'google-meet',
    },
    {
      type: 'attachment',
      pattern: /transcript.*\.(txt|pdf|docx?|vtt)/i,
      priority: 9,
      service: 'google-meet',
    },
    
    // Zoom patterns
    {
      type: 'sender',
      pattern: /@zoom\.us/i,
      priority: 10,
      service: 'zoom',
    },
    {
      type: 'subject',
      pattern: /Cloud Recording - .* is now available/i,
      priority: 10,
      service: 'zoom',
    },
    
    // Teams patterns
    {
      type: 'sender',
      pattern: /@microsoft\.com|@teams\.microsoft\.com/i,
      priority: 10,
      service: 'teams',
    },
    {
      type: 'subject',
      pattern: /Meeting Recording: .*/i,
      priority: 9,
      service: 'teams',
    },
    
    // Generic meeting patterns
    {
      type: 'subject',
      pattern: /\b(meeting|call|conference|standup|sync|discussion)\b.*\b(recording|transcript|notes|summary)\b/i,
      priority: 5,
    },
    {
      type: 'body',
      pattern: /\b(transcript|recording|meeting notes|action items)\b/i,
      priority: 3,
    },
    {
      type: 'attachment',
      pattern: /\.(txt|pdf|docx?|vtt|srt)$/i,
      priority: 2,
    },
  ];

  /**
   * Parse email to detect if it contains meeting transcript
   */
  parseEmail(email: EmailMessage): ParsedMeetingEmail {
    const matchedPatterns: Array<{ pattern: EmailPattern; matched: boolean }> = [];
    let totalScore = 0;
    let detectedService: ParsedMeetingEmail['service'] = 'unknown';

    // Check sender patterns
    for (const pattern of this.patterns.filter(p => p.type === 'sender')) {
      if (this.matchesPattern(email.from, pattern.pattern)) {
        matchedPatterns.push({ pattern, matched: true });
        totalScore += pattern.priority;
        if (pattern.service && pattern.priority >= 8) {
          detectedService = pattern.service;
        }
      }
    }

    // Check subject patterns
    for (const pattern of this.patterns.filter(p => p.type === 'subject')) {
      if (this.matchesPattern(email.subject, pattern.pattern)) {
        matchedPatterns.push({ pattern, matched: true });
        totalScore += pattern.priority;
        if (pattern.service && pattern.priority >= 8) {
          detectedService = pattern.service;
        }
      }
    }

    // Check body patterns
    for (const pattern of this.patterns.filter(p => p.type === 'body')) {
      if (this.matchesPattern(email.body, pattern.pattern)) {
        matchedPatterns.push({ pattern, matched: true });
        totalScore += pattern.priority * 0.7; // Body patterns are less reliable
        if (pattern.service && detectedService === 'unknown') {
          detectedService = pattern.service;
        }
      }
    }

    // Check attachment patterns
    let transcriptAttachment: ParsedMeetingEmail['attachmentInfo'];
    for (const attachment of email.attachments) {
      for (const pattern of this.patterns.filter(p => p.type === 'attachment')) {
        if (this.matchesPattern(attachment.filename, pattern.pattern)) {
          matchedPatterns.push({ pattern, matched: true });
          totalScore += pattern.priority;
          transcriptAttachment = {
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            attachmentId: attachment.id,
          };
          break;
        }
      }
    }

    // Calculate confidence (normalize to 0-100)
    const maxPossibleScore = 30; // Approximate max score from high-priority patterns
    const confidence = Math.min(100, Math.round((totalScore / maxPossibleScore) * 100));

    // Determine if it's a transcript
    const isTranscript = confidence >= 30; // 30% confidence threshold

    // Extract meeting information
    const meetingInfo = this.extractMeetingInfo(email, detectedService);

    // Determine transcript location
    let transcriptLocation: ParsedMeetingEmail['transcriptLocation'] = 'none';
    if (transcriptAttachment) {
      transcriptLocation = 'attachment';
    } else if (this.hasTranscriptInBody(email.body)) {
      transcriptLocation = 'body';
    } else if (this.hasTranscriptLink(email.body)) {
      transcriptLocation = 'link';
    }

    const result: ParsedMeetingEmail = {
      isTranscript,
      confidence,
      service: detectedService,
      meetingInfo,
      transcriptLocation,
      attachmentInfo: transcriptAttachment,
    };

    logDebug(`Parsed email ${email.id}: isTranscript=${isTranscript}, confidence=${confidence}%, service=${detectedService}`);
    
    return result;
  }

  /**
   * Check if pattern matches text
   */
  private matchesPattern(text: string, pattern: string | RegExp): boolean {
    if (!text) return false;
    
    if (typeof pattern === 'string') {
      return text.toLowerCase().includes(pattern.toLowerCase());
    } else {
      return pattern.test(text);
    }
  }

  /**
   * Extract meeting information from email
   */
  private extractMeetingInfo(
    email: EmailMessage,
    service: ParsedMeetingEmail['service']
  ): ParsedMeetingEmail['meetingInfo'] {
    const info: ParsedMeetingEmail['meetingInfo'] = {};

    // Extract title
    info.title = this.extractMeetingTitle(email.subject, service);

    // Extract date and time
    const dateTime = this.extractDateTime(email.subject, email.body);
    if (dateTime) {
      info.date = dateTime.date;
      info.time = dateTime.time;
    }

    // Extract meeting ID
    info.meetingId = this.extractMeetingId(email.body, service);

    // Extract duration
    info.duration = this.extractDuration(email.body);

    // Extract participants
    info.participants = this.extractParticipants(email.body);

    // Extract organizer
    info.organizer = this.extractOrganizer(email.from, email.body);

    return info;
  }

  /**
   * Extract meeting title from subject
   */
  private extractMeetingTitle(subject: string, service: ParsedMeetingEmail['service']): string {
    let title = subject;

    // Service-specific cleaning
    if (service === 'google-meet') {
      title = title.replace(/Recording of (.*) - Google Meet/i, '$1');
      title = title.replace(/Meeting recording - /i, '');
      title = title.replace(/Transcript for /i, '');
    } else if (service === 'zoom') {
      title = title.replace(/Cloud Recording - (.*) is now available/i, '$1');
    } else if (service === 'teams') {
      title = title.replace(/Meeting Recording: /i, '');
    }

    // Generic cleaning
    const prefixes = [
      'Recording of', 'Transcript for', 'Meeting notes:', 'Summary of',
      'Notes from', 'Re:', 'Fwd:', 'Meeting recording:', 'Recording:',
    ];
    
    for (const prefix of prefixes) {
      const regex = new RegExp(`^${prefix}\\s*`, 'i');
      title = title.replace(regex, '');
    }

    // Remove timestamps
    title = title.replace(/\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?/gi, '').trim();
    title = title.replace(/\s+/g, ' ').trim();

    return title || 'Untitled Meeting';
  }

  /**
   * Extract date and time from email
   */
  private extractDateTime(
    subject: string,
    body: string
  ): { date: Date; time: string } | null {
    const text = `${subject}\n${body}`;
    
    // ISO date pattern
    const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);
    if (isoMatch && isoMatch[1] && isoMatch[2]) {
      return {
        date: new Date(isoMatch[1]),
        time: isoMatch[2],
      };
    }

    // US date format with time
    const usMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+at\s+(\d{1,2}:\d{2}\s*(AM|PM)?)/i);
    if (usMatch && usMatch[1] && usMatch[2]) {
      return {
        date: new Date(usMatch[1]),
        time: usMatch[2],
      };
    }

    // Month day, year format
    const monthMatch = text.match(/(\w+\s+\d{1,2},?\s+\d{4})\s+at\s+(\d{1,2}:\d{2}\s*(AM|PM)?)/i);
    if (monthMatch && monthMatch[1] && monthMatch[2]) {
      return {
        date: new Date(monthMatch[1]),
        time: monthMatch[2],
      };
    }

    return null;
  }

  /**
   * Extract meeting ID based on service
   */
  private extractMeetingId(body: string, service: ParsedMeetingEmail['service']): string | undefined {
    if (service === 'google-meet') {
      const match = body.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
      return match ? match[1] : undefined;
    } else if (service === 'zoom') {
      const match = body.match(/Meeting ID:\s*(\d{9,11})/i);
      return match ? match[1] : undefined;
    } else if (service === 'teams') {
      const match = body.match(/Meeting ID:\s*(\d{3}\s*\d{3}\s*\d{3,4})/i);
      return match?.[1]?.replace(/\s/g, '') || undefined;
    }
    
    // Generic meeting ID pattern
    const genericMatch = body.match(/\b(Meeting|Conference)\s+ID:?\s*([A-Z0-9-]+)/i);
    return genericMatch ? genericMatch[2] : undefined;
  }

  /**
   * Extract meeting duration
   */
  private extractDuration(body: string): string | undefined {
    const patterns = [
      /Duration:\s*(\d+\s*(hours?|hrs?|minutes?|mins?)(\s+and\s+\d+\s*(minutes?|mins?))?)/i,
      /Length:\s*(\d+:\d{2}:\d{2})/i,
      /\((\d+\s*(hours?|hrs?|minutes?|mins?))\)/i,
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract participants from email body
   */
  private extractParticipants(body: string): string[] | undefined {
    const patterns = [
      /Participants?:\s*([^\n]+(?:\n(?!\w+:)[^\n]+)*)/i,
      /Attendees?:\s*([^\n]+(?:\n(?!\w+:)[^\n]+)*)/i,
      /Present:\s*([^\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match && match[1]) {
        const participants = match[1]
          .split(/[,;\n]/)
          .map(name => name.trim())
          .filter(name => name.length > 0 && !name.includes('@'));
        
        if (participants.length > 0) {
          return participants;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract meeting organizer
   */
  private extractOrganizer(from: string, body: string): string | undefined {
    // Try to extract from "From" field
    const fromMatch = from.match(/^([^<]+)/);
    if (fromMatch && fromMatch[1]) {
      const name = fromMatch[1].trim();
      if (name && !name.includes('noreply')) {
        return name;
      }
    }

    // Try to extract from body
    const organizerMatch = body.match(/Organizer:\s*([^\n]+)/i);
    if (organizerMatch && organizerMatch[1]) {
      return organizerMatch[1].trim();
    }

    return undefined;
  }

  /**
   * Check if email body contains transcript
   */
  private hasTranscriptInBody(body: string): boolean {
    // Check for transcript markers
    const transcriptMarkers = [
      /^(TRANSCRIPT|MEETING TRANSCRIPT)/im,
      /^(Speaker \d+:|Participant:|Attendee:)/im,
      /^\d{2}:\d{2}:\d{2}/m, // Timestamp format
      /\[(\d{2}:)?\d{2}:\d{2}\]/m, // Bracketed timestamp
      /Notes: /i, // Google Gemini meeting notes
      /Action items?:/i, // Meeting action items
      /Decisions?:/i, // Meeting decisions
      /Summary:/i, // Meeting summary
    ];

    return transcriptMarkers.some(marker => marker.test(body));
  }

  /**
   * Check if email body contains link to transcript
   */
  private hasTranscriptLink(body: string): boolean {
    const linkPatterns = [
      /https?:\/\/[^\s]+\/(transcript|recording|meeting)/i,
      /View (the )?(transcript|recording|meeting)/i,
      /Click here to (view|access|download) (the )?(transcript|recording)/i,
    ];

    return linkPatterns.some(pattern => pattern.test(body));
  }

  /**
   * Add custom pattern for specific use cases
   */
  addCustomPattern(pattern: EmailPattern): void {
    this.patterns.push(pattern);
    logDebug(`Added custom email pattern: ${pattern.pattern.toString()}`);
  }

  /**
   * Check if email should be processed based on configuration
   */
  shouldProcessEmail(email: EmailMessage): boolean {
    // Check sender domains from config
    const fromLower = email.from.toLowerCase();
    const matchesSenderDomain = config.gmail.senderDomains.some(domain => {
      const domainPattern = domain.startsWith('@') ? domain.substring(1) : domain;
      return fromLower.includes(domainPattern);
    });

    // Check subject patterns from config
    const subjectLower = email.subject.toLowerCase();
    const matchesSubjectPattern = config.gmail.subjectPatterns.some(pattern =>
      subjectLower.includes(pattern.toLowerCase())
    );

    // Check if it has attachments (most transcripts come as attachments)
    const hasAttachments = email.attachments && email.attachments.length > 0;

    // Parse email for meeting transcript patterns
    const parsed = this.parseEmail(email);

    // Decision logic
    if (parsed.confidence >= 70) {
      // High confidence - definitely process
      return true;
    } else if (parsed.confidence >= 40) {
      // Medium confidence - process if matches config patterns
      return matchesSenderDomain || matchesSubjectPattern;
    } else if (parsed.confidence >= 20) {
      // Low confidence - only process if strongly matches config AND has attachments
      return (matchesSenderDomain || matchesSubjectPattern) && hasAttachments;
    } else {
      // Very low confidence - check if explicitly matches config patterns
      return matchesSenderDomain && matchesSubjectPattern && hasAttachments;
    }
  }
}

// Export singleton instance
export const emailParser = new EmailParser();