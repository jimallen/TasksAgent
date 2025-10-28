import { Notice, requestUrl } from 'obsidian';

/**
 * Mobile OAuth Handler using PKCE flow
 * Implements OAuth 2.0 with Proof Key for Code Exchange for mobile platforms
 * Uses custom URL scheme (obsidian://) instead of localhost callback
 */

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export class MobileOAuthHandler {
  private clientId: string;
  private clientSecret: string;
  private codeVerifier: string = '';
  private state: string = '';

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Generate cryptographically random string for PKCE
   */
  private generateRandomString(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {
      result += charset[randomValues[i] % charset.length];
    }
    return result;
  }

  /**
   * Generate SHA-256 hash and base64url encode
   */
  private async sha256(plain: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hash = await crypto.subtle.digest('SHA-256', data);

    // Convert to base64url encoding
    const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Start OAuth flow with PKCE
   * Opens browser with authorization URL
   * Returns promise that resolves when callback is received
   */
  async authenticate(): Promise<OAuthTokens> {
    // Generate PKCE parameters
    this.codeVerifier = this.generateRandomString(128);
    this.state = this.generateRandomString(32);
    const codeChallenge = await this.sha256(this.codeVerifier);

    // Build authorization URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('redirect_uri', 'obsidian://meeting-tasks-callback');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.readonly');
    authUrl.searchParams.set('state', this.state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    console.log('[Mobile OAuth] Starting authentication flow...');
    new Notice('Opening browser for Gmail authentication...');

    // Open browser (mobile OS will handle this)
    window.open(authUrl.toString());

    // Wait for callback via custom URL scheme
    // The callback will be handled by handleCallback() which must be registered
    // in main.ts via obsidian.registerObsidianProtocolHandler()
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('OAuth authentication timeout (5 minutes)'));
      }, 5 * 60 * 1000);

      // Store resolver for callback handler
      (window as any)._oauthMobileResolver = {
        resolve: (tokens: OAuthTokens) => {
          clearTimeout(timeout);
          resolve(tokens);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        }
      };
    });
  }

  /**
   * Handle OAuth callback from custom URL scheme
   * Called by main.ts protocol handler
   * Format: obsidian://meeting-tasks-callback?code=...&state=...
   */
  async handleCallback(url: string): Promise<void> {
    try {
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');
      const state = urlObj.searchParams.get('state');
      const error = urlObj.searchParams.get('error');

      // Check for error response
      if (error) {
        throw new Error(`OAuth error: ${error}`);
      }

      // Validate state (CSRF protection)
      if (state !== this.state) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }

      if (!code) {
        throw new Error('No authorization code received');
      }

      console.log('[Mobile OAuth] Authorization code received, exchanging for tokens...');

      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code);

      // Resolve the authentication promise
      const resolver = (window as any)._oauthMobileResolver;
      if (resolver) {
        resolver.resolve(tokens);
        delete (window as any)._oauthMobileResolver;
      }

      new Notice('Gmail authentication successful!');
    } catch (error) {
      console.error('[Mobile OAuth] Callback handling failed:', error);
      const resolver = (window as any)._oauthMobileResolver;
      if (resolver) {
        resolver.reject(error);
        delete (window as any)._oauthMobileResolver;
      }
      new Notice('Gmail authentication failed: ' + error.message);
    }
  }

  /**
   * Exchange authorization code for access tokens
   */
  private async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const tokenUrl = 'https://oauth2.googleapis.com/token';

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: code,
      code_verifier: this.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: 'obsidian://meeting-tasks-callback'
    });

    console.log('[Mobile OAuth] Exchanging code for tokens...');

    const response = await requestUrl({
      url: tokenUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (response.status !== 200) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    return response.json as OAuthTokens;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const tokenUrl = 'https://oauth2.googleapis.com/token';

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    console.log('[Mobile OAuth] Refreshing access token...');

    const response = await requestUrl({
      url: tokenUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (response.status !== 200) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const tokens = response.json as OAuthTokens;

    // Google doesn't always return a new refresh token
    // Keep the old one if not provided
    if (!tokens.refresh_token) {
      tokens.refresh_token = refreshToken;
    }

    return tokens;
  }

  /**
   * Check if tokens are still valid
   */
  isTokenValid(expiresAt: number): boolean {
    // Add 5-minute buffer for clock skew
    return Date.now() < (expiresAt - 5 * 60 * 1000);
  }
}
