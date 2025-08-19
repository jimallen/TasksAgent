import { config, validateConfig } from './config';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('config object', () => {
    it('should load default values when environment variables are not set', () => {
      expect(config.gmail.checkIntervalHours).toBe(8);
      expect(config.scheduling.times).toEqual(['09:00', '13:00', '17:00']);
      // Jest sets NODE_ENV to 'test' by default
      expect(config.app.nodeEnv).toBe('test');
    });

    it('should parse gmail sender domains correctly', () => {
      expect(config.gmail.senderDomains).toContain('@google.com');
      expect(config.gmail.senderDomains).toContain('@meet.google.com');
    });

    it('should parse scheduling times as array', () => {
      expect(Array.isArray(config.scheduling.times)).toBe(true);
      expect(config.scheduling.times).toHaveLength(3);
    });

    it('should parse boolean values correctly', () => {
      expect(typeof config.notifications.enabled).toBe('boolean');
      expect(typeof config.performance.cleanupTempFiles).toBe('boolean');
    });

    it('should parse numeric values correctly', () => {
      expect(typeof config.gmail.checkIntervalHours).toBe('number');
      expect(typeof config.ai.temperature).toBe('number');
      expect(typeof config.performance.maxConcurrentTranscripts).toBe('number');
    });
  });

  describe('validateConfig', () => {
    it('should not throw error in development mode without Gmail credentials', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['OBSIDIAN_VAULT_PATH'] = '/test/path';

      expect(() => validateConfig()).not.toThrow();
    });

    it('should throw error if OBSIDIAN_VAULT_PATH is not set', () => {
      delete process.env['OBSIDIAN_VAULT_PATH'];

      expect(() => validateConfig()).toThrow('Configuration validation failed');
    });

    it('should require Gmail credentials in production mode', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['OBSIDIAN_VAULT_PATH'] = '/test/path';
      delete process.env['GMAIL_CLIENT_ID'];
      delete process.env['GMAIL_CLIENT_SECRET'];

      expect(() => validateConfig()).toThrow('Gmail MCP credentials are required in production');
    });
  });
});
