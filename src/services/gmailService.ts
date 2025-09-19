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

// Google Workspace MCP specific interfaces
interface GoogleWorkspaceToolCallRequest {
  name: string;
  arguments: Record<string, any>;
}

interface GoogleWorkspaceToolCallResponse {
  content?: Array<{ type: string; text: string }>;
  isError?: boolean;
  error?: string;
}

// Tool name mappings from old Gmail MCP to Google Workspace MCP
const TOOL_MAPPINGS: Record<string, string> = {
  'search_emails': 'search_gmail_messages',
  'read_email': 'get_gmail_message_content',
  'modify_email': 'modify_gmail_message_labels'
};

// Adapter to transform request parameters
function adaptToolRequest(toolName: string, args: Record<string, any>): GoogleWorkspaceToolCallRequest {
  const mappedTool = TOOL_MAPPINGS[toolName] || toolName;
  const adaptedArgs: Record<string, any> = { ...args };

  // Add required user_google_email parameter for all Gmail tools
  if (mappedTool.includes('gmail')) {
    // Try to get email from environment or use default
    adaptedArgs['user_google_email'] = process.env['GMAIL_USER_EMAIL'] || 'me@gmail.com';
  }

  // Adapt search_emails -> search_gmail_messages parameters
  if (toolName === 'search_emails') {
    if ('maxResults' in adaptedArgs) {
      adaptedArgs['page_size'] = adaptedArgs['maxResults'];
      delete adaptedArgs['maxResults'];
    }
  }

  // Adapt read_email -> get_gmail_message_content parameters
  if (toolName === 'read_email') {
    if ('messageId' in adaptedArgs) {
      adaptedArgs['message_id'] = adaptedArgs['messageId'];
      delete adaptedArgs['messageId'];
    }
    adaptedArgs['include_body'] = true;
  }

  // Adapt modify_email -> modify_gmail_message_labels parameters
  if (toolName === 'modify_email') {
    if ('messageId' in adaptedArgs) {
      adaptedArgs['message_id'] = adaptedArgs['messageId'];
      delete adaptedArgs['messageId'];
    }
    if ('addLabels' in adaptedArgs) {
      adaptedArgs['add_labels'] = adaptedArgs['addLabels'];
      delete adaptedArgs['addLabels'];
    }
    if ('removeLabels' in adaptedArgs) {
      adaptedArgs['remove_labels'] = adaptedArgs['removeLabels'];
      delete adaptedArgs['removeLabels'];
    }
  }

  return {
    name: mappedTool,
    arguments: adaptedArgs
  };
}

// Adapter to transform response format
function adaptToolResponse(response: GoogleWorkspaceToolCallResponse): ToolCallResult {
  // Google Workspace MCP returns content in a more structured format
  // We need to maintain compatibility with the existing text parsing logic
  return response as ToolCallResult;
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

      // Adapt request for Google Workspace MCP
      const adaptedRequest = adaptToolRequest('search_emails', {
        query: searchQuery,
        maxResults: 50,
      });

      const result = await this.client!.callTool(adaptedRequest as any) as unknown as GoogleWorkspaceToolCallResponse;
      const adaptedResult = adaptToolResponse(result);

      // Log the result to debug
      logDebug('Search result:', adaptedResult);

      if (!adaptedResult.content || (adaptedResult.content as unknown[]).length === 0) {
        logInfo('No emails found matching the search criteria');
        return [];
      }

      // Parse the text format returned by Gmail MCP
      const emails: EmailMessage[] = [];
      
      // Google Workspace MCP returns results in a structured format
      // Parse the text content from the response
      let textContent = '';
      if (Array.isArray(adaptedResult.content) && adaptedResult.content[0] && typeof adaptedResult.content[0] === 'object' && 'text' in adaptedResult.content[0]) {
        textContent = (adaptedResult.content[0] as { text: string }).text;
      } else if (typeof adaptedResult.content === 'string') {
        textContent = adaptedResult.content;
      } else {
        logError('Unexpected result format:', adaptedResult);
        return [];
      }
      
      // If textContent is empty, return empty array (no results)
      if (!textContent || textContent.trim() === '') {
        logDebug('No emails found in search results');
        return [];
      }

      // Parse Google Workspace MCP response format
      // The new format includes Message ID and Thread ID
      const lines = textContent.split('\n');
      const messageIds: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim() || '';
        // Look for Message ID lines in the new format
        if (line.match(/^\d+\. Message ID: /)) {
          const id = line.substring(line.indexOf('Message ID: ') + 12);
          if (id && id !== 'unknown') {
            messageIds.push(id);
          }
        }
      }

      // Fetch full email details for each message ID
      for (const messageId of messageIds) {
        const fullEmail = await this.readEmail(messageId);
        if (fullEmail) {
          emails.push(fullEmail);
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

      // Adapt request for Google Workspace MCP
      const adaptedRequest = adaptToolRequest('read_email', {
        messageId: emailId,  // Will be converted to message_id
      });

      const result = await this.client!.callTool(adaptedRequest as any) as unknown as GoogleWorkspaceToolCallResponse;
      const adaptedResult = adaptToolResponse(result);

      if (!adaptedResult.content || (adaptedResult.content as unknown[]).length === 0) {
        logWarn(`Email ${emailId} not found`);
        return null;
      }

      // Parse the email content - Google Workspace MCP returns structured format
      let emailContent = '';
      if (Array.isArray(adaptedResult.content) && adaptedResult.content[0] && typeof adaptedResult.content[0] === 'object' && 'text' in adaptedResult.content[0]) {
        emailContent = (adaptedResult.content[0] as { text: string }).text;
      } else if (typeof adaptedResult.content === 'string') {
        emailContent = adaptedResult.content;
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
   * NOTE: Google Workspace MCP doesn't currently support attachment downloads
   * This will need to be implemented in Phase 2
   */
  async downloadAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    await this.ensureConnected();

    try {
      logWarn(`Attachment download not yet supported in Google Workspace MCP`);
      logWarn(`Attachment ${attachmentId} from email ${messageId} cannot be downloaded`);

      // Return empty buffer for now to avoid breaking the flow
      // TODO: Implement attachment download in Phase 2
      return Buffer.from('');
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

      // Adapt request for Google Workspace MCP
      const adaptedRequest = adaptToolRequest('modify_email', {
        messageId: emailId,
        removeLabels: ['UNREAD'],
      });

      await this.client!.callTool(adaptedRequest as any);

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

      // Adapt request for Google Workspace MCP
      const adaptedRequest = adaptToolRequest('modify_email', {
        messageId: emailId,
        addLabels: [label],
      });

      await this.client!.callTool(adaptedRequest as any);

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