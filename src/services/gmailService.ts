import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { logInfo, logError, logDebug, logWarn } from '../utils/logger';
import { config } from '../config/config';
import { getDateRangeForEmailCheck } from '../utils/dateFormatter';

interface ToolCallResult {
  content?: unknown[];
  isError?: boolean;
  error?: string;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: Date;
  body: string;
  attachments: EmailAttachment[];
  labels: string[];
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: Buffer;
}

export interface GmailSearchQuery {
  from?: string;
  subject?: string;
  after?: Date;
  before?: Date;
  hasAttachment?: boolean;
  label?: string;
  query?: string;
}

export class GmailService {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnected = false;

  /**
   * Initialize connection to Gmail MCP Server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logDebug('Gmail MCP Server already connected');
      return;
    }

    try {
      logInfo('Connecting to Gmail MCP Server...');

      // Create transport to communicate with the MCP server
      const transportOptions: any = {
        command: 'npx',
        args: ['@gongrzhe/server-gmail-autoauth-mcp'],
      };
      
      // Suppress subprocess output in TUI mode
      if (process.env['TUI_MODE']) {
        // Use node directly to bypass npx output
        transportOptions.command = 'node';
        transportOptions.args = [
          require.resolve('@gongrzhe/server-gmail-autoauth-mcp/dist/index.js')
        ];
        // Redirect stderr to null to prevent TUI corruption
        transportOptions.stderr = 'ignore';
        transportOptions.env = {
          ...process.env,
          NODE_NO_WARNINGS: '1',
          NPM_CONFIG_LOGLEVEL: 'silent',
          NPM_CONFIG_PROGRESS: 'false',
          FORCE_COLOR: '0',
          NO_COLOR: '1',
          CI: 'true',
          TERM: 'dumb',
        };
      }
      
      this.transport = new StdioClientTransport(transportOptions);

      // Create client
      this.client = new Client(
        {
          name: 'meeting-transcript-agent',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect to the server
      await this.client.connect(this.transport);
      this.isConnected = true;

      logInfo('Successfully connected to Gmail MCP Server');
    } catch (error) {
      logError('Failed to connect to Gmail MCP Server', error);
      throw error;
    }
  }

  /**
   * Disconnect from Gmail MCP Server
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      if (this.client) {
        await this.client.close();
      }
      this.isConnected = false;
      logInfo('Disconnected from Gmail MCP Server');
    } catch (error) {
      logError('Error disconnecting from Gmail MCP Server', error);
    }
  }

  /**
   * Build Gmail search query string
   */
  private buildSearchQuery(query: GmailSearchQuery): string {
    const parts: string[] = [];

    if (query.from) {
      parts.push(`from:${query.from}`);
    }

    if (query.subject) {
      parts.push(`subject:"${query.subject}"`);
    }

    if (query.after) {
      const dateStr = query.after.toISOString().split('T')[0];
      parts.push(`after:${dateStr}`);
    }

    if (query.before) {
      // Add one day to before date to include emails from today
      const beforeDate = new Date(query.before);
      beforeDate.setDate(beforeDate.getDate() + 1);
      const dateStr = beforeDate.toISOString().split('T')[0];
      parts.push(`before:${dateStr}`);
    }

    if (query.hasAttachment) {
      parts.push('has:attachment');
    }

    if (query.label) {
      parts.push(`label:${query.label}`);
    }

    if (query.query) {
      parts.push(query.query);
    }

    return parts.join(' ');
  }

  /**
   * Search for emails matching the query
   */
  async searchEmails(query: GmailSearchQuery): Promise<EmailMessage[]> {
    await this.ensureConnected();

    try {
      const searchQuery = this.buildSearchQuery(query);
      logDebug(`Searching emails with query: ${searchQuery}`);

      const result = await this.client!.callTool({
        name: 'search_emails',
        arguments: {
          query: searchQuery,
          maxResults: 50,
        }
      }) as unknown as ToolCallResult;

      // Log the result to debug
      logDebug('Search result:', result);

      if (!result.content || (result.content as unknown[]).length === 0) {
        logInfo('No emails found matching the search criteria');
        return [];
      }

      // Parse the text format returned by Gmail MCP
      const emails: EmailMessage[] = [];
      
      // Gmail MCP returns results as text in this format:
      // ID: xxx\nSubject: xxx\nFrom: xxx\nDate: xxx\n\n
      let textContent = '';
      if (Array.isArray(result.content) && result.content[0] && typeof result.content[0] === 'object' && 'text' in result.content[0]) {
        textContent = (result.content[0] as { text: string }).text;
      } else if (typeof result.content === 'string') {
        textContent = result.content;
      } else {
        logError('Unexpected result format:', result);
        return [];
      }
      
      // If textContent is empty, return empty array (no results)
      if (!textContent || textContent.trim() === '') {
        logDebug('No emails found in search results');
        return [];
      }

      // Parse the text format
      const emailBlocks = textContent.split('\n\n').filter(block => block.trim());
      
      for (const block of emailBlocks) {
        const lines = block.split('\n');
        const emailData: any = {};
        
        for (const line of lines) {
          if (line.startsWith('ID: ')) {
            emailData.id = line.substring(4);
          } else if (line.startsWith('Subject: ')) {
            emailData.subject = line.substring(9);
          } else if (line.startsWith('From: ')) {
            emailData.from = line.substring(6);
          } else if (line.startsWith('Date: ')) {
            emailData.date = line.substring(6);
          }
        }
        
        if (emailData.id) {
          // For now, we need to fetch the full email details
          const fullEmail = await this.readEmail(emailData.id);
          if (fullEmail) {
            emails.push(fullEmail);
          }
        }
      }

      logInfo(`Found ${emails.length} emails matching search criteria`);
      return emails;
    } catch (error) {
      logError('Failed to search emails', error);
      throw error;
    }
  }

  /**
   * Fetch emails from the last N hours
   */
  async fetchRecentEmails(hoursBack: number = config.gmail.checkIntervalHours): Promise<EmailMessage[]> {
    const { start, end } = getDateRangeForEmailCheck(hoursBack);
    
    // Build query for Google Meet transcripts
    const queries: GmailSearchQuery[] = [];
    
    // Add queries for each sender domain
    for (const domain of config.gmail.senderDomains) {
      queries.push({
        from: domain,
        after: start,
        before: end,
        hasAttachment: true,
      });
    }

    // Add queries for subject patterns
    for (const pattern of config.gmail.subjectPatterns) {
      queries.push({
        subject: pattern,
        after: start,
        before: end,
        // Don't require attachments for subject pattern matches (e.g., "Notes:" emails)
        hasAttachment: pattern.toLowerCase().includes('recording') || pattern.toLowerCase().includes('transcript'),
      });
    }

    // Fetch emails for all queries
    const allEmails: EmailMessage[] = [];
    const emailIds = new Set<string>();

    for (const query of queries) {
      const emails = await this.searchEmails(query);
      
      // Deduplicate by email ID
      for (const email of emails) {
        if (!emailIds.has(email.id)) {
          emailIds.add(email.id);
          allEmails.push(email);
        }
      }
    }

    logInfo(`Fetched ${allEmails.length} unique emails from the last ${hoursBack} hours`);
    return allEmails;
  }

  /**
   * Read a specific email by ID
   */
  async readEmail(emailId: string): Promise<EmailMessage | null> {
    await this.ensureConnected();

    try {
      logDebug(`Reading email ${emailId}`);

      const result = await this.client!.callTool({
        name: 'read_email',
        arguments: {
          messageId: emailId,  // read_email takes a single messageId, not an array
        }
      }) as unknown as ToolCallResult;

      if (!result.content || (result.content as unknown[]).length === 0) {
        logWarn(`Email ${emailId} not found`);
        return null;
      }

      // Parse the email content - Gmail MCP returns full email details
      let emailContent = '';
      if (Array.isArray(result.content) && result.content[0] && typeof result.content[0] === 'object' && 'text' in result.content[0]) {
        emailContent = (result.content[0] as { text: string }).text;
      } else if (typeof result.content === 'string') {
        emailContent = result.content;
      }

      // Parse email content and create EmailMessage
      const email: EmailMessage = {
        id: emailId,
        threadId: emailId,  // Use same as ID for now
        subject: '',
        from: '',
        date: new Date(),
        body: emailContent,
        attachments: [],
        labels: [],
      };

      // Extract metadata from the content if possible
      const subjectMatch = emailContent.match(/Subject: (.+?)\n/);
      if (subjectMatch && subjectMatch[1]) email.subject = subjectMatch[1];
      
      const fromMatch = emailContent.match(/From: (.+?)\n/);
      if (fromMatch && fromMatch[1]) email.from = fromMatch[1];
      
      const dateMatch = emailContent.match(/Date: (.+?)\n/);
      if (dateMatch && dateMatch[1]) {
        try {
          email.date = new Date(dateMatch[1]);
        } catch {
          // Keep default date if parsing fails
        }
      }

      return email;
    } catch (error) {
      logError(`Failed to read email ${emailId}`, error);
      throw error;
    }
  }

  /**
   * Download attachment from an email
   */
  async downloadAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    await this.ensureConnected();

    try {
      logDebug(`Downloading attachment ${attachmentId} from email ${messageId}`);

      const result = await this.client!.callTool({
        name: 'read_email',
        arguments: {
          messageId,
          attachmentId,
        }
      });

      if (!result.content || (result.content as unknown[]).length === 0) {
        throw new Error('No attachment data received');
      }

      // The attachment data should be base64 encoded
      const attachmentData = (result.content as Array<{ text: string }>)[0]?.text;
      if (!attachmentData) {
        logWarn('No attachment data found');
        throw new Error('No attachment data found');
      }
      const buffer = Buffer.from(attachmentData, 'base64');

      logDebug(`Downloaded attachment: ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      logError(`Failed to download attachment ${attachmentId}`, error);
      throw error;
    }
  }

  /**
   * Mark email as read
   */
  async markAsRead(emailId: string): Promise<void> {
    await this.ensureConnected();

    try {
      logDebug(`Marking email ${emailId} as read`);

      await this.client!.callTool({
        name: 'modify_email',
        arguments: {
          messageId: emailId,
          removeLabels: ['UNREAD'],
        }
      });

      logDebug(`Email ${emailId} marked as read`);
    } catch (error) {
      logError(`Failed to mark email ${emailId} as read`, error);
      throw error;
    }
  }

  /**
   * Add label to email
   */
  async addLabel(emailId: string, label: string): Promise<void> {
    await this.ensureConnected();

    try {
      logDebug(`Adding label '${label}' to email ${emailId}`);

      await this.client!.callTool({
        name: 'modify_email',
        arguments: {
          messageId: emailId,
          addLabels: [label],
        }
      });

      logDebug(`Label '${label}' added to email ${emailId}`);
    } catch (error) {
      logError(`Failed to add label to email ${emailId}`, error);
      throw error;
    }
  }

  /**
   * Ensure we're connected to Gmail MCP
   */
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }
}

// Export singleton instance
export const gmailService = new GmailService();