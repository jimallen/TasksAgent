import { gmailService, EmailMessage, GmailSearchQuery } from './gmailService';
import { rateLimiter, batchProcessor, retryWithBackoff } from '../utils/rateLimiter';
import { logInfo, logDebug } from '../utils/logger';

/**
 * Rate-limited Gmail service wrapper
 * Ensures all Gmail API calls respect quotas and rate limits
 */
export class GmailServiceRateLimited {
  private gmailService = gmailService;
  private rateLimiter = rateLimiter;
  private batchProcessor = batchProcessor;
  private retryWithBackoff = retryWithBackoff;

  /**
   * Connect to Gmail MCP Server with rate limiting
   */
  async connect(): Promise<void> {
    return this.rateLimiter.execute('gmail.connect', async () => {
      return this.gmailService.connect();
    });
  }

  /**
   * Search emails with rate limiting
   */
  async searchEmails(query: GmailSearchQuery): Promise<EmailMessage[]> {
    return this.rateLimiter.execute('gmail.search', async () => {
      return this.retryWithBackoff.execute(
        () => this.gmailService.searchEmails(query),
        this.isRetriableError
      );
    });
  }

  /**
   * Fetch recent emails with rate limiting and batching
   */
  async fetchRecentEmails(hoursBack?: number): Promise<EmailMessage[]> {
    return this.rateLimiter.execute('gmail.search', async () => {
      return this.retryWithBackoff.execute(
        () => this.gmailService.fetchRecentEmails(hoursBack),
        this.isRetriableError
      );
    });
  }

  /**
   * Read multiple emails with batching and rate limiting
   */
  async readEmails(emailIds: string[]): Promise<(EmailMessage | null)[]> {
    logInfo(`Reading ${emailIds.length} emails with rate limiting`);

    const results = await this.batchProcessor.processBatch(
      emailIds,
      (emailId: unknown) => this.readEmail(emailId as string),
      'gmail.read'
    );
    return results as (EmailMessage | null)[];
  }

  /**
   * Read single email with rate limiting
   */
  async readEmail(emailId: string): Promise<EmailMessage | null> {
    return this.rateLimiter.execute('gmail.read', async () => {
      return this.retryWithBackoff.execute(
        () => this.gmailService.readEmail(emailId),
        this.isRetriableError
      );
    });
  }

  /**
   * Download attachments with rate limiting
   */
  async downloadAttachments(
    attachments: Array<{ messageId: string; attachmentId: string }>
  ): Promise<Buffer[]> {
    logInfo(`Downloading ${attachments.length} attachments with rate limiting`);

    const results = await this.batchProcessor.processBatch(
      attachments,
      (attachment: unknown) => {
        const att = attachment as { messageId: string; attachmentId: string };
        return this.downloadAttachment(att.messageId, att.attachmentId);
      },
      'gmail.attachment'
    );
    return results as Buffer[];
  }

  /**
   * Download single attachment with rate limiting
   */
  async downloadAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    return this.rateLimiter.execute('gmail.attachment', async () => {
      return this.retryWithBackoff.execute(
        () => this.gmailService.downloadAttachment(messageId, attachmentId),
        this.isRetriableError
      );
    });
  }

  /**
   * Mark multiple emails as read with batching
   */
  async markEmailsAsRead(emailIds: string[]): Promise<void> {
    logInfo(`Marking ${emailIds.length} emails as read with rate limiting`);

    await this.batchProcessor.processBatch(
      emailIds,
      async (emailId: unknown) => {
        await this.markAsRead(emailId as string);
        return undefined;
      },
      'gmail.modify'
    );
  }

  /**
   * Mark single email as read with rate limiting
   */
  async markAsRead(emailId: string): Promise<void> {
    return this.rateLimiter.execute('gmail.modify', async () => {
      return this.retryWithBackoff.execute(
        () => this.gmailService.markAsRead(emailId),
        this.isRetriableError
      );
    });
  }

  /**
   * Add labels to multiple emails with batching
   */
  async addLabelsToEmails(
    emailLabels: Array<{ emailId: string; label: string }>
  ): Promise<void> {
    logInfo(`Adding labels to ${emailLabels.length} emails with rate limiting`);

    await this.batchProcessor.processBatch(
      emailLabels,
      async (item: unknown) => {
        const emailLabel = item as { emailId: string; label: string };
        await this.addLabel(emailLabel.emailId, emailLabel.label);
        return undefined;
      },
      'gmail.modify'
    );
  }

  /**
   * Add label to single email with rate limiting
   */
  async addLabel(emailId: string, label: string): Promise<void> {
    return this.rateLimiter.execute('gmail.modify', async () => {
      return this.retryWithBackoff.execute(
        () => this.gmailService.addLabel(emailId, label),
        this.isRetriableError
      );
    });
  }

  /**
   * Process emails in batches with rate limiting
   */
  async processEmailBatch<T>(
    emails: EmailMessage[],
    processor: (email: EmailMessage) => Promise<T>,
    batchSize: number = 5
  ): Promise<T[]> {
    const batches: EmailMessage[][] = [];
    for (let i = 0; i < emails.length; i += batchSize) {
      batches.push(emails.slice(i, i + batchSize));
    }

    logInfo(`Processing ${emails.length} emails in ${batches.length} batches`);

    const results: T[] = [];
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch) continue;
      logDebug(`Processing batch ${i + 1}/${batches.length}`);

      // Process batch with rate limiting
      const batchPromises = batch.map(email =>
        this.rateLimiter.execute('gmail.read', () => processor(email))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches
      if (i < batches.length - 1) {
        await this.delay(1000);
      }
    }

    return results;
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): Record<string, any> {
    const keys = ['gmail.search', 'gmail.read', 'gmail.modify', 'gmail.attachment', 'gmail.daily'];
    const status: Record<string, any> = {};

    for (const key of keys) {
      status[key] = {
        isRateLimited: this.rateLimiter.isRateLimited(key),
        remainingRequests: this.rateLimiter.getRemainingRequests(key),
        state: this.rateLimiter.getState(key),
      };
    }

    return status;
  }

  /**
   * Reset rate limits (useful for testing)
   */
  resetRateLimits(key?: string): void {
    this.rateLimiter.reset(key);
    logInfo(`Reset rate limits${key ? ` for ${key}` : ' for all keys'}`);
  }

  /**
   * Check if error is retriable
   */
  private isRetriableError(error: any): boolean {
    // Rate limit errors
    if (error.code === 429 || error.message?.includes('quota')) {
      return true;
    }

    // Temporary network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // Gmail temporary errors
    if (error.code >= 500 && error.code < 600) {
      return true;
    }

    return false;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Disconnect from Gmail MCP Server
   */
  async disconnect(): Promise<void> {
    return this.gmailService.disconnect();
  }
}

// Export singleton instance
export const gmailServiceRateLimited = new GmailServiceRateLimited();

// Export convenience functions that automatically use rate limiting
export async function fetchMeetingTranscriptsWithRateLimit(
  hoursBack?: number
): Promise<EmailMessage[]> {
  const emails = await gmailServiceRateLimited.fetchRecentEmails(hoursBack);
  
  // Filter for likely meeting transcripts
  const transcripts = emails.filter(email => {
    const hasAttachments = email.attachments && email.attachments.length > 0;
    const isFromMeetingService = 
      email.from.includes('google.com') ||
      email.from.includes('zoom.us') ||
      email.from.includes('microsoft.com');
    const hasTranscriptKeywords = 
      email.subject.toLowerCase().includes('recording') ||
      email.subject.toLowerCase().includes('transcript') ||
      email.subject.toLowerCase().includes('meeting');
    
    return hasAttachments && (isFromMeetingService || hasTranscriptKeywords);
  });

  logInfo(`Found ${transcripts.length} potential meeting transcripts`);
  return transcripts;
}

export async function processTranscriptsInBatches(
  emails: EmailMessage[],
  processor: (email: EmailMessage) => Promise<any>
): Promise<any[]> {
  return gmailServiceRateLimited.processEmailBatch(emails, processor, 3);
}