/**
 * Test setup file - runs before all tests
 * Global configuration for test environment
 */

// The obsidian module is mocked via vitest.config.ts alias
// pointing to tests/__mocks__/obsidian.ts

// Mock browser APIs for mobile OAuth tests
import { vi } from 'vitest';
import crypto from 'crypto';

// Mock window object with OAuth resolver
global.window = {
  _oauthMobileResolver: undefined,
  open: vi.fn(),
} as any;

// Mock crypto.getRandomValues
if (!global.crypto) {
  global.crypto = {} as any;
}

global.crypto.getRandomValues = (array: Uint8Array) => {
  const randomBytes = crypto.randomBytes(array.length);
  randomBytes.forEach((value, i) => {
    array[i] = value;
  });
  return array;
};

// Mock crypto.subtle for SHA-256
Object.defineProperty(global.crypto, 'subtle', {
  value: {
    digest: async (algorithm: string, data: ArrayBuffer) => {
      const hash = crypto.createHash('sha256');
      hash.update(Buffer.from(data));
      return hash.digest();
    },
  },
  writable: true,
  configurable: true,
});

// Mock btoa for base64 encoding
global.btoa = (str: string) => {
  return Buffer.from(str, 'binary').toString('base64');
};
