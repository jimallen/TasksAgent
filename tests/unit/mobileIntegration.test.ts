import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlatformManager } from '../../src/platform';
import { Platform } from 'obsidian';

describe('Mobile Integration Tests', () => {
  describe('Email Processing Constraints', () => {
    it('should apply mobile batch limit of 25 emails', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);
      vi.spyOn(Platform, 'isMobileApp', 'get').mockReturnValue(true);

      const maxEmails = PlatformManager.getMaxEmailBatch();
      expect(maxEmails).toBe(25);

      // Simulate email processing with mobile limit
      const mockEmails = Array.from({ length: 100 }, (_, i) => ({
        id: `email-${i}`,
        subject: `Email ${i}`
      }));

      const processedEmails = mockEmails.slice(0, maxEmails);
      expect(processedEmails.length).toBe(25);
    });

    it('should not limit desktop email processing', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(false);
      vi.spyOn(Platform, 'isMobileApp', 'get').mockReturnValue(false);

      const maxEmails = PlatformManager.getMaxEmailBatch();
      expect(maxEmails).toBe(500);

      const mockEmails = Array.from({ length: 1000 }, (_, i) => ({
        id: `email-${i}`,
        subject: `Email ${i}`
      }));

      const processedEmails = mockEmails.slice(0, maxEmails);
      expect(processedEmails.length).toBe(500);
    });

    it('should handle edge case of exactly 25 emails on mobile', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);

      const maxEmails = PlatformManager.getMaxEmailBatch();
      const mockEmails = Array.from({ length: 25 }, (_, i) => ({
        id: `email-${i}`,
        subject: `Email ${i}`
      }));

      const processedEmails = mockEmails.slice(0, maxEmails);
      expect(processedEmails.length).toBe(25);
    });

    it('should handle fewer emails than mobile limit', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);

      const maxEmails = PlatformManager.getMaxEmailBatch();
      const mockEmails = Array.from({ length: 10 }, (_, i) => ({
        id: `email-${i}`,
        subject: `Email ${i}`
      }));

      const processedEmails = mockEmails.slice(0, Math.min(maxEmails, mockEmails.length));
      expect(processedEmails.length).toBe(10);
    });
  });

  describe('Task Clustering Constraints', () => {
    it('should apply mobile cluster limit of 50 tasks', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);
      vi.spyOn(Platform, 'isMobileApp', 'get').mockReturnValue(true);

      const maxTasks = PlatformManager.getMaxClusterTasks();
      expect(maxTasks).toBe(50);

      // Simulate task clustering with mobile limit
      const mockTasks = Array.from({ length: 200 }, (_, i) => ({
        id: `task-${i}`,
        description: `Task ${i}`,
        completed: false
      }));

      const clusteredTasks = mockTasks.slice(0, maxTasks);
      expect(clusteredTasks.length).toBe(50);
    });

    it('should not limit desktop task clustering', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(false);
      vi.spyOn(Platform, 'isMobileApp', 'get').mockReturnValue(false);

      const maxTasks = PlatformManager.getMaxClusterTasks();
      expect(maxTasks).toBe(Number.MAX_SAFE_INTEGER);

      const mockTasks = Array.from({ length: 10000 }, (_, i) => ({
        id: `task-${i}`,
        description: `Task ${i}`,
        completed: false
      }));

      // Desktop should handle all tasks
      expect(mockTasks.length).toBeLessThanOrEqual(maxTasks);
    });

    it('should handle edge case of exactly 50 tasks on mobile', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);

      const maxTasks = PlatformManager.getMaxClusterTasks();
      const mockTasks = Array.from({ length: 50 }, (_, i) => ({
        id: `task-${i}`,
        description: `Task ${i}`,
        completed: false
      }));

      const clusteredTasks = mockTasks.slice(0, maxTasks);
      expect(clusteredTasks.length).toBe(50);
    });

    it('should handle fewer tasks than mobile limit', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);

      const maxTasks = PlatformManager.getMaxClusterTasks();
      const mockTasks = Array.from({ length: 30 }, (_, i) => ({
        id: `task-${i}`,
        description: `Task ${i}`,
        completed: false
      }));

      const clusteredTasks = mockTasks.slice(0, Math.min(maxTasks, mockTasks.length));
      expect(clusteredTasks.length).toBe(30);
    });
  });

  describe('Platform-Specific Configuration', () => {
    it('should use mobile-optimized settings on mobile', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);

      expect(PlatformManager.isMobile()).toBe(true);
      expect(PlatformManager.getMaxEmailBatch()).toBe(25);
      expect(PlatformManager.getMaxClusterTasks()).toBe(50);
      expect(PlatformManager.getDefaultLookbackTime()).toBe('1d');
      expect(PlatformManager.getTouchTargetScale()).toBe(1.5);
      expect(PlatformManager.shouldWarnAboutNetwork()).toBe(true);
      expect(PlatformManager.supportsBackgroundProcessing()).toBe(false);
      expect(PlatformManager.getOAuthCallbackScheme()).toBe('obsidian://meeting-tasks-callback');
    });

    it('should use desktop-optimized settings on desktop', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(false);
      vi.spyOn(Platform, 'isMobileApp', 'get').mockReturnValue(false);

      expect(PlatformManager.isMobile()).toBe(false);
      expect(PlatformManager.getMaxEmailBatch()).toBe(500);
      expect(PlatformManager.getMaxClusterTasks()).toBe(Number.MAX_SAFE_INTEGER);
      expect(PlatformManager.getDefaultLookbackTime()).toBe('3d');
      expect(PlatformManager.getTouchTargetScale()).toBe(1.0);
      expect(PlatformManager.shouldWarnAboutNetwork()).toBe(false);
      expect(PlatformManager.supportsBackgroundProcessing()).toBe(true);
      expect(PlatformManager.getOAuthCallbackScheme()).toBe('http://localhost:3000/callback');
    });

    it('should consistently apply mobile constraints across multiple calls', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);

      // Call multiple times to ensure consistency
      const results = Array.from({ length: 10 }, () => ({
        emails: PlatformManager.getMaxEmailBatch(),
        tasks: PlatformManager.getMaxClusterTasks(),
        lookback: PlatformManager.getDefaultLookbackTime(),
      }));

      // All results should be identical
      results.forEach(result => {
        expect(result.emails).toBe(25);
        expect(result.tasks).toBe(50);
        expect(result.lookback).toBe('1d');
      });
    });
  });

  describe('OAuth Handler Selection', () => {
    it('should use mobile OAuth callback on mobile platforms', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);

      const callbackScheme = PlatformManager.getOAuthCallbackScheme();
      expect(callbackScheme).toBe('obsidian://meeting-tasks-callback');
      expect(callbackScheme).toMatch(/^obsidian:\/\//);
    });

    it('should use localhost OAuth callback on desktop', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(false);
      vi.spyOn(Platform, 'isMobileApp', 'get').mockReturnValue(false);

      const callbackScheme = PlatformManager.getOAuthCallbackScheme();
      expect(callbackScheme).toBe('http://localhost:3000/callback');
      expect(callbackScheme).toMatch(/^http:\/\/localhost/);
    });

    it('should handle iOS platform specifically', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);
      vi.spyOn(Platform, 'isMobileApp', 'get').mockReturnValue(true);
      vi.spyOn(Platform as any, 'isIosApp', 'get').mockReturnValue(true);

      expect(PlatformManager.isMobile()).toBe(true);
      expect(PlatformManager.getOAuthCallbackScheme()).toBe('obsidian://meeting-tasks-callback');
    });

    it('should handle Android platform specifically', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);
      vi.spyOn(Platform, 'isMobileApp', 'get').mockReturnValue(true);
      vi.spyOn(Platform as any, 'isAndroidApp', 'get').mockReturnValue(true);

      expect(PlatformManager.isMobile()).toBe(true);
      expect(PlatformManager.getOAuthCallbackScheme()).toBe('obsidian://meeting-tasks-callback');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should reduce data transfer on mobile with smaller lookback', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);

      const mobileLookback = PlatformManager.getDefaultLookbackTime();
      expect(mobileLookback).toBe('1d');

      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(false);
      vi.spyOn(Platform, 'isMobileApp', 'get').mockReturnValue(false);

      const desktopLookback = PlatformManager.getDefaultLookbackTime();
      expect(desktopLookback).toBe('3d');

      // Mobile should fetch less data
      expect(mobileLookback).not.toBe(desktopLookback);
    });

    it('should warn about network usage on mobile', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);

      expect(PlatformManager.shouldWarnAboutNetwork()).toBe(true);

      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(false);
      vi.spyOn(Platform, 'isMobileApp', 'get').mockReturnValue(false);

      expect(PlatformManager.shouldWarnAboutNetwork()).toBe(false);
    });

    it('should disable background processing on mobile', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);

      expect(PlatformManager.supportsBackgroundProcessing()).toBe(false);

      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(false);
      vi.spyOn(Platform, 'isMobileApp', 'get').mockReturnValue(false);

      expect(PlatformManager.supportsBackgroundProcessing()).toBe(true);
    });
  });

  describe('UI Adaptation', () => {
    it('should scale touch targets on mobile', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);

      const scale = PlatformManager.getTouchTargetScale();
      expect(scale).toBe(1.5);

      // Simulate button sizing
      const baseButtonSize = 32; // pixels
      const touchButtonSize = baseButtonSize * scale;
      expect(touchButtonSize).toBe(48); // 48px meets iOS 44pt minimum
    });

    it('should not scale touch targets on desktop', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(false);
      vi.spyOn(Platform, 'isMobileApp', 'get').mockReturnValue(false);

      const scale = PlatformManager.getTouchTargetScale();
      expect(scale).toBe(1.0);

      const baseButtonSize = 32;
      const desktopButtonSize = baseButtonSize * scale;
      expect(desktopButtonSize).toBe(32);
    });

    it('should provide consistent touch target scaling', () => {
      vi.spyOn(Platform, 'isMobile', 'get').mockReturnValue(true);

      const scales = Array.from({ length: 5 }, () =>
        PlatformManager.getTouchTargetScale()
      );

      expect(scales.every(s => s === 1.5)).toBe(true);
    });
  });
});
