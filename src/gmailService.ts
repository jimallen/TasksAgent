import { requestUrl, Notice, RequestUrlParam } from 'obsidian';

interface GmailToken {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  scope?: string;
}

interface GmailMessage {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  snippet: string;
  attachments?: GmailAttachment[];
  gmailUrl?: string;
}

interface GmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
  downloadUrl?: string;
}

interface GmailCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri?: string;
}

export class GmailService {
  private credentials: GmailCredentials | null = null;
  private token: GmailToken | null = null;
  private baseUrl = 'https://gmail.googleapis.com/gmail/v1';
  private authBaseUrl = 'https://accounts.google.com/o/oauth2';
  private tokenUrl = 'https://oauth2.googleapis.com/token';
  private redirectUri: string = 'http://localhost';

  constructor(
    private getStoredToken: () => GmailToken | null,
    private saveToken: (token: GmailToken) => Promise<void>
  ) {
    this.token = this.getStoredToken();
  }

  setCredentials(clientId: string, clientSecret: string, redirectUri?: string) {
    this.redirectUri = redirectUri || 'http://localhost';
    this.credentials = {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: this.redirectUri
    };
  }

  getAuthorizationUrl(): string {
    if (!this.credentials) {
      throw new Error('Credentials not set. Please configure Google OAuth in settings.');
    }

    const params = new URLSearchParams({
      client_id: this.credentials.client_id,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      access_type: 'offline',
      prompt: 'consent'
    });

    return `${this.authBaseUrl}/auth?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<void> {
    if (!this.credentials) {
      throw new Error('Credentials not set');
    }

    try {
      const response = await requestUrl({
        url: this.tokenUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: this.credentials.client_id,
          client_secret: this.credentials.client_secret,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code'
        }).toString()
      });

      if (response.status === 200) {
        const tokenData = response.json;
        this.token = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expiry_date: Date.now() + (tokenData.expires_in * 1000),
          token_type: tokenData.token_type,
          scope: tokenData.scope
        };

        await this.saveToken(this.token);
      } else {
        throw new Error(`Failed to exchange code: ${response.text}`);
      }
    } catch (error) {
      console.error('OAuth token exchange failed:', error);
      throw error;
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.credentials || !this.token?.refresh_token) {
      throw new Error('Cannot refresh token: missing credentials or refresh token');
    }

    try {
      const response = await requestUrl({
        url: this.tokenUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: this.token.refresh_token,
          client_id: this.credentials.client_id,
          client_secret: this.credentials.client_secret,
          grant_type: 'refresh_token'
        }).toString()
      });

      if (response.status === 200) {
        const tokenData = response.json;
        this.token = {
          ...this.token,
          access_token: tokenData.access_token,
          expiry_date: Date.now() + (tokenData.expires_in * 1000),
        };

        await this.saveToken(this.token);
      } else {
        throw new Error(`Failed to refresh token: ${response.text}`);
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.token) {
      throw new Error('Not authenticated. Please authenticate with Gmail first.');
    }

    if (this.token.expiry_date && Date.now() >= this.token.expiry_date - 60000) {
      console.log('[Gmail] Token expired or expiring soon, refreshing...');
      await this.refreshAccessToken();
    }
  }

  private async makeGmailRequest(
    endpoint: string,
    options: Partial<RequestUrlParam> = {}
  ): Promise<any> {
    await this.ensureValidToken();

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    try {
      const response = await requestUrl({
        url,
        method: options.method || 'GET',
        headers: {
          'Authorization': `Bearer ${this.token!.access_token}`,
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (response.status === 401) {
        console.log('[Gmail] Received 401, attempting token refresh...');
        await this.refreshAccessToken();

        const retryResponse = await requestUrl({
          url,
          method: options.method || 'GET',
          headers: {
            'Authorization': `Bearer ${this.token!.access_token}`,
            'Content-Type': 'application/json',
            ...options.headers
          },
          ...options
        });

        return retryResponse.json;
      }

      return response.json;
    } catch (error) {
      console.error(`Gmail API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  async searchEmails(query: string, maxResults: number = 100, batchSize: number = 5): Promise<GmailMessage[]> {
    try {
      console.log(`[Gmail] Searching with query: ${query}`);

      const listResponse = await this.makeGmailRequest(
        `/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`
      );

      if (!listResponse.messages || listResponse.messages.length === 0) {
        console.log('[Gmail] No messages found');
        return [];
      }

      console.log(`[Gmail] Found ${listResponse.messages.length} messages, fetching in batches of ${batchSize}`);

      const messages: GmailMessage[] = [];
      const messageRefs = listResponse.messages.filter((ref: any) => ref.id);
      const totalBatches = Math.ceil(messageRefs.length / batchSize);

      console.log(`[Gmail] Starting parallel fetch: ${messageRefs.length} emails in ${totalBatches} batches`);

      for (let i = 0; i < messageRefs.length; i += batchSize) {
        const batch = messageRefs.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;

        console.log(`[Gmail] Fetching batch ${batchNum}/${totalBatches} (${batch.length} emails in parallel)...`);
        const startTime = Date.now();

        const batchPromises = batch.map((messageRef: any) => {
          console.log(`[Gmail] Starting fetch for email ${messageRef.id}`);
          return this.getEmailById(messageRef.id).catch(error => {
            console.error(`[Gmail] Failed to fetch message ${messageRef.id}:`, error);
            return null;
          });
        });

        const batchResults = await Promise.all(batchPromises);
        const successfulResults = batchResults.filter(msg => msg !== null);
        messages.push(...successfulResults);

        const elapsed = Date.now() - startTime;
        console.log(`[Gmail] Batch ${batchNum} complete: ${successfulResults.length}/${batch.length} successful in ${elapsed}ms`);
      }

      console.log(`[Gmail] All batches complete: ${messages.length} emails fetched successfully`);

      return messages;
    } catch (error) {
      console.error('Email search failed:', error);
      throw error;
    }
  }

  async getEmailById(messageId: string): Promise<GmailMessage> {
    try {
      const message = await this.makeGmailRequest(
        `/users/me/messages/${messageId}?format=full`
      );

      const headers = message.payload?.headers || [];
      const getHeader = (name: string): string => {
        const header = headers.find((h: any) =>
          h.name?.toLowerCase() === name.toLowerCase()
        );
        return header?.value || '';
      };

      const body = this.extractBody(message.payload);

      const attachments: GmailAttachment[] = [];
      if (message.payload?.parts) {
        for (const part of message.payload.parts) {
          if (part.filename && part.body?.attachmentId) {
            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType,
              size: part.body.size,
              attachmentId: part.body.attachmentId,
              downloadUrl: `https://mail.google.com/mail/u/0/?ui=2&ik=${messageId}&attid=${part.body.attachmentId}&disp=safe&zw`
            });
          }
        }
      }

      // Generate Gmail URL for the email
      const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${messageId}`;

      return {
        id: messageId,
        threadId: message.threadId,
        subject: getHeader('subject'),
        from: getHeader('from'),
        to: getHeader('to'),
        date: getHeader('date'),
        body,
        snippet: message.snippet || '',
        attachments,
        gmailUrl
      };
    } catch (error) {
      console.error(`Failed to get email ${messageId}:`, error);
      throw error;
    }
  }

  private extractBody(payload: any): string {
    if (!payload) return '';

    if (payload.body?.data) {
      return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
      }

      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          const htmlBody = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          return htmlBody.replace(/<[^>]*>/g, '').trim();
        }
      }

      for (const part of payload.parts) {
        const nestedBody = this.extractBody(part);
        if (nestedBody) return nestedBody;
      }
    }

    return '';
  }

  async fetchRecentMeetingEmails(hoursBack: number, labels?: string): Promise<GmailMessage[]> {
    const afterDate = new Date();
    afterDate.setTime(afterDate.getTime() - hoursBack * 60 * 60 * 1000);
    const dateStr = afterDate.toISOString().split('T')[0];

    const labelList = (labels || 'transcript')
      .split(',')
      .map(l => l.trim())
      .filter(l => l);

    console.log(
      `[Gmail] Looking for emails with labels: ${labelList.join(', ')} after ${dateStr} (${hoursBack} hours back)`
    );

    let labelQuery = '';
    if (labelList.length === 1) {
      labelQuery = `label:${labelList[0]}`;
    } else {
      labelQuery = `(${labelList.map(l => `label:${l}`).join(' OR ')})`;
    }

    const query = `${labelQuery} after:${dateStr}`;

    return this.searchEmails(query, 100);
  }

  isAuthenticated(): boolean {
    return !!this.token?.access_token;
  }

  hasRefreshToken(): boolean {
    return !!this.token?.refresh_token;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.ensureValidToken();
      const profile = await this.makeGmailRequest('/users/me/profile');
      console.log('[Gmail] Connection test successful:', profile.emailAddress);
      return true;
    } catch (error) {
      console.error('[Gmail] Connection test failed:', error);
      return false;
    }
  }

  clearAuthentication() {
    this.token = null;
  }
}