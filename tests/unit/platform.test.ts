import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlatformManager } from '../../src/platform';
import { Platform } from 'obsidian';

describe('PlatformManager', () => {
  describe('isMobile()', () => {
    it('should return true when Platform.isMobile is true', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);
      vi.spyOn(Platform, 'isMobileApp', 'get').mockReturnValue(false);

      expect(PlatformManager.isMobile()).toBe(true);
    });

    it('should return true when Platform.isMobileApp is true', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(false);
      vi.spyOn(Platform, 'isMobileApp', 'get').mockReturnValue(true);

      expect(PlatformManager.isMobile()).toBe(true);
    });

    it('should return true when both are true', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);
      vi.spyOn(Platform, 'isMobileApp', 'get').mockReturnValue(true);

      expect(PlatformManager.isMobile()).toBe(true);
    });

    it('should return false when both are false (desktop)', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(false);
      vi.spyOn(Platform, 'isMobileApp', 'get').mockReturnValue(false);

      expect(PlatformManager.isMobile()).toBe(false);
    });
  });

  describe('getMaxEmailBatch()', () => {
    it('should return 25 for mobile', () => {
      vi.spyOn(PlatformManager, 'isMobile').mockReturnValue(true);

      expect(PlatformManager.getMaxEmailBatch()).toBe(25);
    });

    it('should return 500 for desktop', () => {
      vi.spyOn(PlatformManager, 'isMobile').mockReturnValue(false);

      expect(PlatformManager.getMaxEmailBatch()).toBe(500);
    });
  });

  describe('getMaxClusterTasks()', () => {
    it('should return 50 for mobile', () => {
      vi.spyOn(PlatformManager, 'isMobile').mockReturnValue(true);

      expect(PlatformManager.getMaxClusterTasks()).toBe(50);
    });

    it('should return MAX_SAFE_INTEGER for desktop (unlimited)', () => {
      vi.spyOn(PlatformManager, 'isMobile').mockReturnValue(false);

      expect(PlatformManager.getMaxClusterTasks()).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('supportsBackgroundProcessing()', () => {
    it('should return false for mobile (limited background)', () => {
      vi.spyOn(PlatformManager, 'isMobile').mockReturnValue(true);

      expect(PlatformManager.supportsBackgroundProcessing()).toBe(false);
    });

    it('should return true for desktop (full support)', () => {
      vi.spyOn(PlatformManager, 'isMobile').mockReturnValue(false);

      expect(PlatformManager.supportsBackgroundProcessing()).toBe(true);
    });
  });

  describe('getOAuthCallbackScheme()', () => {
    it('should return custom URL scheme for mobile', () => {
      vi.spyOn(PlatformManager, 'isMobile').mockReturnValue(true);

      expect(PlatformManager.getOAuthCallbackScheme()).toBe('obsidian://meeting-tasks-callback');
    });

    it('should return localhost URL for desktop', () => {
      vi.spyOn(PlatformManager, 'isMobile').mockReturnValue(false);

      expect(PlatformManager.getOAuthCallbackScheme()).toBe('http://localhost:3000/callback');
    });
  });

  describe('getDefaultLookbackTime()', () => {
    it('should return 1d for mobile (reduce data transfer)', () => {
      vi.spyOn(PlatformManager, 'isMobile').mockReturnValue(true);

      expect(PlatformManager.getDefaultLookbackTime()).toBe('1d');
    });

    it('should return 3d for desktop (standard)', () => {
      vi.spyOn(PlatformManager, 'isMobile').mockReturnValue(false);

      expect(PlatformManager.getDefaultLookbackTime()).toBe('3d');
    });
  });

  describe('shouldWarnAboutNetwork()', () => {
    it('should return true for mobile (warn on cellular)', () => {
      vi.spyOn(PlatformManager, 'isMobile').mockReturnValue(true);

      expect(PlatformManager.shouldWarnAboutNetwork()).toBe(true);
    });

    it('should return false for desktop (no warnings needed)', () => {
      vi.spyOn(PlatformManager, 'isMobile').mockReturnValue(false);

      expect(PlatformManager.shouldWarnAboutNetwork()).toBe(false);
    });
  });

  describe('getTouchTargetScale()', () => {
    it('should return 1.5 for mobile (larger touch targets)', () => {
      vi.spyOn(PlatformManager, 'isMobile').mockReturnValue(true);

      expect(PlatformManager.getTouchTargetScale()).toBe(1.5);
    });

    it('should return 1.0 for desktop (normal size)', () => {
      vi.spyOn(PlatformManager, 'isMobile').mockReturnValue(false);

      expect(PlatformManager.getTouchTargetScale()).toBe(1.0);
    });
  });

  describe('Platform Constants', () => {
    it('should have consistent mobile email batch limit', () => {
      expect(PlatformManager.getMaxEmailBatch()).toBeGreaterThan(0);
      expect(PlatformManager.getMaxEmailBatch()).toBeLessThanOrEqual(500);
    });

    it('should have consistent mobile cluster limit', () => {
      expect(PlatformManager.getMaxClusterTasks()).toBeGreaterThan(0);
    });

    it('should have valid touch target scale factors', () => {
      const scale = PlatformManager.getTouchTargetScale();
      expect(scale).toBeGreaterThanOrEqual(1.0);
      expect(scale).toBeLessThanOrEqual(2.0);
    });

    it('should have valid OAuth callback URLs', () => {
      const scheme = PlatformManager.getOAuthCallbackScheme();
      expect(scheme).toBeTruthy();
      expect(scheme).toMatch(/^(https?:\/\/|obsidian:\/\/)/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid platform checks consistently', () => {
      vi.spyOn(PlatformManager, 'isMobile').mockReturnValue(true);

      const results = Array.from({ length: 100 }, () => PlatformManager.getMaxEmailBatch());
      const allSame = results.every(r => r === results[0]);

      expect(allSame).toBe(true);
      expect(results[0]).toBe(25);
    });

    it('should return sensible defaults for all methods', () => {
      expect(typeof PlatformManager.isMobile()).toBe('boolean');
      expect(typeof PlatformManager.getMaxEmailBatch()).toBe('number');
      expect(typeof PlatformManager.getMaxClusterTasks()).toBe('number');
      expect(typeof PlatformManager.supportsBackgroundProcessing()).toBe('boolean');
      expect(typeof PlatformManager.getOAuthCallbackScheme()).toBe('string');
      expect(typeof PlatformManager.getDefaultLookbackTime()).toBe('string');
      expect(typeof PlatformManager.shouldWarnAboutNetwork()).toBe('boolean');
      expect(typeof PlatformManager.getTouchTargetScale()).toBe('number');
    });
  });
});
