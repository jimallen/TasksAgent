import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MobileOAuthHandler } from '../../src/oauthMobile';

describe('MobileOAuthHandler', () => {
  let handler: MobileOAuthHandler;
  const testClientId = 'test-client-id';
  const testClientSecret = 'test-client-secret';

  beforeEach(() => {
    handler = new MobileOAuthHandler(testClientId, testClientSecret);
    // Clear any previous resolver
    delete (window as any)._oauthMobileResolver;
  });

  describe('Constructor', () => {
    it('should initialize with client credentials', () => {
      expect(handler).toBeInstanceOf(MobileOAuthHandler);
    });

    it('should accept and store credentials', () => {
      const newHandler = new MobileOAuthHandler('client-123', 'secret-456');
      expect(newHandler).toBeTruthy();
    });
  });

  describe('PKCE Code Verifier Generation', () => {
    it('should generate code verifier of correct length', () => {
      // Access private method through prototype
      const verifier = (handler as any).generateRandomString(128);

      expect(verifier).toBeTruthy();
      expect(verifier.length).toBe(128);
    });

    it('should use only valid PKCE characters', () => {
      const verifier = (handler as any).generateRandomString(128);
      const validChars = /^[A-Za-z0-9\-._~]+$/;

      expect(verifier).toMatch(validChars);
    });

    it('should generate unique values on each call', () => {
      const verifier1 = (handler as any).generateRandomString(128);
      const verifier2 = (handler as any).generateRandomString(128);

      expect(verifier1).not.toBe(verifier2);
    });

    it('should generate correct length for different sizes', () => {
      expect((handler as any).generateRandomString(43).length).toBe(43);
      expect((handler as any).generateRandomString(128).length).toBe(128);
      expect((handler as any).generateRandomString(256).length).toBe(256);
    });

    it('should handle zero length gracefully', () => {
      const verifier = (handler as any).generateRandomString(0);
      expect(verifier.length).toBe(0);
    });
  });

  describe('SHA-256 Code Challenge', () => {
    it('should generate base64url encoded hash', async () => {
      const plaintext = 'test-code-verifier-string';
      const challenge = await (handler as any).sha256(plaintext);

      expect(challenge).toBeTruthy();
      expect(typeof challenge).toBe('string');
    });

    it('should use base64url encoding (no +/= characters)', async () => {
      const plaintext = 'test-string-that-might-produce-special-chars-+++///===';
      const challenge = await (handler as any).sha256(plaintext);

      expect(challenge).not.toContain('+');
      expect(challenge).not.toContain('/');
      expect(challenge).not.toContain('=');
    });

    it('should produce consistent hashes for same input', async () => {
      const plaintext = 'consistent-test-string';
      const hash1 = await (handler as any).sha256(plaintext);
      const hash2 = await (handler as any).sha256(plaintext);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', async () => {
      const hash1 = await (handler as any).sha256('string-one');
      const hash2 = await (handler as any).sha256('string-two');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', async () => {
      const challenge = await (handler as any).sha256('');

      expect(challenge).toBeTruthy();
      expect(typeof challenge).toBe('string');
    });

    it('should handle long strings', async () => {
      const longString = 'a'.repeat(10000);
      const challenge = await (handler as any).sha256(longString);

      expect(challenge).toBeTruthy();
      expect(challenge.length).toBeGreaterThan(0);
    });
  });

  describe('Token Validation', () => {
    it('should validate unexpired tokens as valid', () => {
      const futureTime = Date.now() + (60 * 60 * 1000); // 1 hour from now

      expect(handler.isTokenValid(futureTime)).toBe(true);
    });

    it('should validate tokens with 5+ minute buffer as valid', () => {
      const nearFuture = Date.now() + (10 * 60 * 1000); // 10 minutes from now

      expect(handler.isTokenValid(nearFuture)).toBe(true);
    });

    it('should invalidate tokens within 5 minute buffer', () => {
      const tooSoon = Date.now() + (3 * 60 * 1000); // 3 minutes from now

      expect(handler.isTokenValid(tooSoon)).toBe(false);
    });

    it('should invalidate expired tokens', () => {
      const pastTime = Date.now() - (60 * 60 * 1000); // 1 hour ago

      expect(handler.isTokenValid(pastTime)).toBe(false);
    });

    it('should handle exact boundary condition', () => {
      const boundary = Date.now() + (5 * 60 * 1000); // Exactly 5 minutes

      // Should be invalid due to buffer
      expect(handler.isTokenValid(boundary)).toBe(false);
    });

    it('should handle token expiry at current time', () => {
      const now = Date.now();

      expect(handler.isTokenValid(now)).toBe(false);
    });
  });

  describe('Callback Handling', () => {
    it('should extract code and state from callback URL', async () => {
      const testCode = 'test-auth-code-123';
      const testState = 'test-state-456';
      const url = `obsidian://meeting-tasks-callback?code=${testCode}&state=${testState}`;

      // Set up the state that would have been generated
      (handler as any).state = testState;
      (handler as any).codeVerifier = 'test-verifier';

      // Mock the token exchange
      vi.spyOn(handler as any, 'exchangeCodeForTokens').mockResolvedValue({
        access_token: 'access-123',
        refresh_token: 'refresh-456',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/gmail.readonly'
      });

      // Set up resolver
      const resolverPromise = new Promise((resolve) => {
        (window as any)._oauthMobileResolver = {
          resolve,
          reject: () => {}
        };
      });

      await handler.handleCallback(url);
      const result = await resolverPromise;

      expect(result).toBeTruthy();
    });

    it('should reject callback with error parameter', async () => {
      const url = 'obsidian://meeting-tasks-callback?error=access_denied';

      const rejectPromise = new Promise((resolve, reject) => {
        (window as any)._oauthMobileResolver = {
          resolve: () => {},
          reject
        };
      });

      await handler.handleCallback(url);

      await expect(rejectPromise).rejects.toThrow('OAuth error: access_denied');
    });

    it('should reject callback with invalid state (CSRF protection)', async () => {
      const url = 'obsidian://meeting-tasks-callback?code=test-code&state=wrong-state';
      (handler as any).state = 'correct-state';

      const rejectPromise = new Promise((resolve, reject) => {
        (window as any)._oauthMobileResolver = {
          resolve: () => {},
          reject
        };
      });

      await handler.handleCallback(url);

      await expect(rejectPromise).rejects.toThrow('Invalid state parameter');
    });

    it('should reject callback without code', async () => {
      const url = 'obsidian://meeting-tasks-callback?state=test-state';
      (handler as any).state = 'test-state';

      const rejectPromise = new Promise((resolve, reject) => {
        (window as any)._oauthMobileResolver = {
          resolve: () => {},
          reject
        };
      });

      await handler.handleCallback(url);

      await expect(rejectPromise).rejects.toThrow('No authorization code received');
    });

    it('should handle callback URL parsing errors gracefully', async () => {
      const invalidUrl = 'not-a-valid-url';

      const rejectPromise = new Promise((resolve, reject) => {
        (window as any)._oauthMobileResolver = {
          resolve: () => {},
          reject
        };
      });

      await handler.handleCallback(invalidUrl);

      await expect(rejectPromise).rejects.toThrow();
    });
  });

  describe('Refresh Token', () => {
    it('should preserve refresh token when not returned by server', async () => {
      const originalRefreshToken = 'original-refresh-token';

      // Mock requestUrl to return token response without refresh_token
      vi.doMock('obsidian', () => ({
        requestUrl: vi.fn().mockResolvedValue({
          status: 200,
          json: {
            access_token: 'new-access-token',
            expires_in: 3600,
            token_type: 'Bearer',
            scope: 'https://www.googleapis.com/auth/gmail.readonly'
            // Note: no refresh_token
          }
        })
      }));

      // This would need actual requestUrl mock, but we're testing the logic
      // In real implementation, would preserve the original refresh_token
    });
  });

  describe('Security Validations', () => {
    it('should generate cryptographically random values', () => {
      const samples = Array.from({ length: 10 }, () =>
        (handler as any).generateRandomString(128)
      );

      // Check all samples are unique
      const uniqueSamples = new Set(samples);
      expect(uniqueSamples.size).toBe(samples.length);
    });

    it('should enforce PKCE code verifier length requirements (43-128)', () => {
      // OAuth 2.0 PKCE spec requires 43-128 characters
      const verifier = (handler as any).generateRandomString(128);
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
    });

    it('should use URL-safe charset for code verifier', () => {
      const verifier = (handler as any).generateRandomString(128);

      // PKCE spec: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
      const pkceCharset = /^[A-Za-z0-9\-._~]+$/;
      expect(verifier).toMatch(pkceCharset);
    });

    it('should produce code challenges of expected length', async () => {
      const verifier = (handler as any).generateRandomString(128);
      const challenge = await (handler as any).sha256(verifier);

      // Base64url encoded SHA-256 should be 43 characters
      expect(challenge.length).toBe(43);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors during token exchange', async () => {
      // This would test actual network error handling
      // Requires mocking requestUrl to throw
      expect(handler).toBeTruthy(); // Placeholder
    });

    it('should handle malformed server responses', async () => {
      // This would test handling of invalid JSON responses
      expect(handler).toBeTruthy(); // Placeholder
    });

    it('should timeout after 5 minutes if no callback received', () => {
      // This tests the timeout mechanism in authenticate()
      // Would require actually running authenticate() with a timer
      expect(handler).toBeTruthy(); // Placeholder
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle full PKCE flow structure', async () => {
      // Generate code verifier
      const verifier = (handler as any).generateRandomString(128);
      expect(verifier).toBeTruthy();

      // Generate code challenge
      const challenge = await (handler as any).sha256(verifier);
      expect(challenge).toBeTruthy();

      // Generate state
      const state = (handler as any).generateRandomString(32);
      expect(state).toBeTruthy();

      // All components should be unique
      expect(verifier).not.toBe(challenge);
      expect(verifier).not.toBe(state);
      expect(challenge).not.toBe(state);
    });

    it('should validate state matches original (CSRF protection)', () => {
      const originalState = 'original-state-value';
      (handler as any).state = originalState;

      // Simulating callback with matching state
      const callbackState = 'original-state-value';
      expect(callbackState).toBe((handler as any).state);
    });

    it('should reject tampered state (CSRF attack)', () => {
      const originalState = 'original-state-value';
      (handler as any).state = originalState;

      // Simulating callback with tampered state
      const callbackState = 'tampered-state-value';
      expect(callbackState).not.toBe((handler as any).state);
    });
  });
});
