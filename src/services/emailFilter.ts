import { EmailMessage } from './gmailService';
import { emailParser } from '../parsers/emailParser';
import { config } from '../config/config';
import { logDebug, logInfo } from '../utils/logger';

export interface EmailFilterCriteria {
  senderDomains?: string[];
  senderEmails?: string[];
  subjectPatterns?: string[];
  bodyPatterns?: string[];
  hasAttachment?: boolean;
  minConfidence?: number;
  labels?: string[];
  excludeLabels?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
}

export interface FilterResult {
  passed: boolean;
  reason?: string;
  confidence: number;
  matchedCriteria: string[];
}

export class EmailFilterService {
  private defaultCriteria: EmailFilterCriteria;

  constructor() {
    // Initialize with config defaults
    this.defaultCriteria = {
      senderDomains: config.gmail.senderDomains,
      subjectPatterns: config.gmail.subjectPatterns,
      hasAttachment: true,
      minConfidence: 30,
      excludeLabels: ['SPAM', 'TRASH'],
    };
  }

  /**
   * Filter emails based on criteria
   */
  filterEmails(
    emails: EmailMessage[],
    criteria?: EmailFilterCriteria
  ): EmailMessage[] {
    const filterCriteria = { ...this.defaultCriteria, ...criteria };
    
    const filtered = emails.filter(email => {
      const result = this.evaluateEmail(email, filterCriteria);
      
      if (result.passed) {
        logDebug(`Email ${email.id} passed filter: ${result.reason}`, {
          confidence: result.confidence,
          matched: result.matchedCriteria,
        });
      }
      
      return result.passed;
    });

    logInfo(`Filtered ${emails.length} emails to ${filtered.length} matching criteria`);
    return filtered;
  }

  /**
   * Evaluate single email against criteria
   */
  evaluateEmail(
    email: EmailMessage,
    criteria?: EmailFilterCriteria
  ): FilterResult {
    const filterCriteria = { ...this.defaultCriteria, ...criteria };
    const matchedCriteria: string[] = [];
    let confidence = 0;

    // Check sender domain
    if (filterCriteria.senderDomains && filterCriteria.senderDomains.length > 0) {
      const matchesDomain = this.checkSenderDomain(email.from, filterCriteria.senderDomains);
      if (matchesDomain) {
        matchedCriteria.push('sender_domain');
        confidence += 30;
      } else if (filterCriteria.senderDomains === this.defaultCriteria.senderDomains) {
        // If using default domains and doesn't match, reduce confidence but don't fail
        confidence -= 10;
      } else {
        // If specific domains required and doesn't match, fail
        return {
          passed: false,
          reason: 'Sender domain does not match',
          confidence,
          matchedCriteria,
        };
      }
    }

    // Check specific sender emails
    if (filterCriteria.senderEmails && filterCriteria.senderEmails.length > 0) {
      const matchesEmail = this.checkSenderEmail(email.from, filterCriteria.senderEmails);
      if (matchesEmail) {
        matchedCriteria.push('sender_email');
        confidence += 40;
      } else {
        return {
          passed: false,
          reason: 'Sender email does not match',
          confidence,
          matchedCriteria,
        };
      }
    }

    // Check subject patterns
    if (filterCriteria.subjectPatterns && filterCriteria.subjectPatterns.length > 0) {
      const matchesSubject = this.checkSubjectPatterns(email.subject, filterCriteria.subjectPatterns);
      if (matchesSubject) {
        matchedCriteria.push('subject_pattern');
        confidence += 25;
      }
    }

    // Check body patterns
    if (filterCriteria.bodyPatterns && filterCriteria.bodyPatterns.length > 0) {
      const matchesBody = this.checkBodyPatterns(email.body, filterCriteria.bodyPatterns);
      if (matchesBody) {
        matchedCriteria.push('body_pattern');
        confidence += 15;
      }
    }

    // Check attachment requirement
    if (filterCriteria.hasAttachment !== undefined) {
      const hasAttachments = email.attachments && email.attachments.length > 0;
      if (filterCriteria.hasAttachment === hasAttachments) {
        matchedCriteria.push('attachment_requirement');
        confidence += 20;
      } else {
        return {
          passed: false,
          reason: filterCriteria.hasAttachment 
            ? 'Email does not have attachments' 
            : 'Email has attachments but none expected',
          confidence,
          matchedCriteria,
        };
      }
    }

    // Check labels
    if (filterCriteria.labels && filterCriteria.labels.length > 0) {
      const hasRequiredLabel = filterCriteria.labels.some(label => 
        email.labels.includes(label)
      );
      if (!hasRequiredLabel) {
        return {
          passed: false,
          reason: 'Missing required label',
          confidence,
          matchedCriteria,
        };
      }
      matchedCriteria.push('required_label');
      confidence += 10;
    }

    // Check excluded labels
    if (filterCriteria.excludeLabels && filterCriteria.excludeLabels.length > 0) {
      const hasExcludedLabel = filterCriteria.excludeLabels.some(label => 
        email.labels.includes(label)
      );
      if (hasExcludedLabel) {
        return {
          passed: false,
          reason: 'Has excluded label',
          confidence,
          matchedCriteria,
        };
      }
    }

    // Check date range
    if (filterCriteria.dateRange) {
      const inRange = this.checkDateRange(email.date, filterCriteria.dateRange);
      if (!inRange) {
        return {
          passed: false,
          reason: 'Outside date range',
          confidence,
          matchedCriteria,
        };
      }
      matchedCriteria.push('date_range');
    }

    // Use email parser for additional confidence
    const parsedEmail = emailParser.parseEmail(email);
    confidence = Math.max(confidence, parsedEmail.confidence);

    // Check minimum confidence threshold
    if (filterCriteria.minConfidence && confidence < filterCriteria.minConfidence) {
      return {
        passed: false,
        reason: `Confidence ${confidence} below threshold ${filterCriteria.minConfidence}`,
        confidence,
        matchedCriteria,
      };
    }

    return {
      passed: true,
      reason: 'Meets all criteria',
      confidence,
      matchedCriteria,
    };
  }

  /**
   * Check if sender matches any of the domains
   */
  private checkSenderDomain(from: string, domains: string[]): boolean {
    const fromLower = from.toLowerCase();
    
    return domains.some(domain => {
      const domainPattern = domain.toLowerCase();
      
      // Handle @ prefix
      if (domainPattern.startsWith('@')) {
        return fromLower.includes(domainPattern.substring(1));
      }
      
      // Handle domain without @
      return fromLower.includes(domainPattern);
    });
  }

  /**
   * Check if sender matches any of the email addresses
   */
  private checkSenderEmail(from: string, emails: string[]): boolean {
    const fromLower = from.toLowerCase();
    
    return emails.some(email => {
      const emailPattern = email.toLowerCase();
      
      // Extract email from "Name <email>" format
      const emailMatch = fromLower.match(/<([^>]+)>/);
      const actualEmail = emailMatch ? emailMatch[1] : fromLower;
      
      return actualEmail?.includes(emailPattern) || false;
    });
  }

  /**
   * Check if subject matches any patterns
   */
  private checkSubjectPatterns(subject: string, patterns: string[]): boolean {
    const subjectLower = subject.toLowerCase();
    
    return patterns.some(pattern => {
      // Support regex patterns
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        const regex = new RegExp(pattern.slice(1, -1), 'i');
        return regex.test(subject);
      }
      
      // Simple string matching
      return subjectLower.includes(pattern.toLowerCase());
    });
  }

  /**
   * Check if body matches any patterns
   */
  private checkBodyPatterns(body: string, patterns: string[]): boolean {
    const bodyLower = body.toLowerCase();
    
    return patterns.some(pattern => {
      // Support regex patterns
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        const regex = new RegExp(pattern.slice(1, -1), 'i');
        return regex.test(body);
      }
      
      // Simple string matching
      return bodyLower.includes(pattern.toLowerCase());
    });
  }

  /**
   * Check if date is within range
   */
  private checkDateRange(
    date: Date,
    range: { start?: Date; end?: Date }
  ): boolean {
    if (range.start && date < range.start) {
      return false;
    }
    
    if (range.end && date > range.end) {
      return false;
    }
    
    return true;
  }

  /**
   * Create a filter for Google Meet transcripts
   */
  createGoogleMeetFilter(): EmailFilterCriteria {
    return {
      senderDomains: ['@google.com', '@meet.google.com', 'calendar-notification@google'],
      subjectPatterns: [
        'Recording of',
        'Transcript for',
        'Meeting recording',
        'Google Meet',
      ],
      bodyPatterns: [
        'meet.google.com',
        'Google Meet recording',
        'Your recording is ready',
      ],
      hasAttachment: true,
      minConfidence: 50,
    };
  }

  /**
   * Create a filter for Zoom recordings
   */
  createZoomFilter(): EmailFilterCriteria {
    return {
      senderDomains: ['@zoom.us'],
      subjectPatterns: [
        'Cloud Recording',
        'Recording is now available',
        'Zoom Recording',
      ],
      minConfidence: 50,
    };
  }

  /**
   * Create a filter for Teams recordings
   */
  createTeamsFilter(): EmailFilterCriteria {
    return {
      senderDomains: ['@microsoft.com', '@teams.microsoft.com'],
      subjectPatterns: [
        'Meeting Recording',
        'Teams Recording',
        'Recording available',
      ],
      minConfidence: 50,
    };
  }

  /**
   * Create a combined filter for all meeting services
   */
  createAllMeetingServicesFilter(): EmailFilterCriteria {
    const googleMeet = this.createGoogleMeetFilter();
    const zoom = this.createZoomFilter();
    const teams = this.createTeamsFilter();

    return {
      senderDomains: [
        ...(googleMeet.senderDomains || []),
        ...(zoom.senderDomains || []),
        ...(teams.senderDomains || []),
      ],
      subjectPatterns: [
        ...(googleMeet.subjectPatterns || []),
        ...(zoom.subjectPatterns || []),
        ...(teams.subjectPatterns || []),
      ],
      bodyPatterns: [
        ...(googleMeet.bodyPatterns || []),
      ],
      hasAttachment: true,
      minConfidence: 30,
    };
  }

  /**
   * Update default criteria
   */
  updateDefaultCriteria(criteria: Partial<EmailFilterCriteria>): void {
    this.defaultCriteria = { ...this.defaultCriteria, ...criteria };
    logDebug('Updated default filter criteria', this.defaultCriteria);
  }

  /**
   * Get current default criteria
   */
  getDefaultCriteria(): EmailFilterCriteria {
    return { ...this.defaultCriteria };
  }
}

// Export singleton instance
export const emailFilterService = new EmailFilterService();