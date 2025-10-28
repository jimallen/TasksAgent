import { Platform } from 'obsidian';

/**
 * Platform detection and configuration management
 * Provides mobile-aware settings and constraints
 */
export class PlatformManager {
  /**
   * Detect if running on mobile platform
   */
  static isMobile(): boolean {
    return Platform.isMobile || Platform.isMobileApp;
  }

  /**
   * Get maximum number of emails to process in one batch
   * Mobile: 25 (battery/performance constrained)
   * Desktop: 500 (full processing capability)
   */
  static getMaxEmailBatch(): number {
    return this.isMobile() ? 25 : 500;
  }

  /**
   * Get maximum number of tasks for clustering operations
   * Mobile: 50 (API timeout prevention)
   * Desktop: No limit (can handle large datasets)
   */
  static getMaxClusterTasks(): number {
    return this.isMobile() ? 50 : Number.MAX_SAFE_INTEGER;
  }

  /**
   * Check if platform supports background processing
   * Mobile: Limited (OS restrictions)
   * Desktop: Full support
   */
  static supportsBackgroundProcessing(): boolean {
    return !this.isMobile();
  }

  /**
   * Get OAuth callback URL scheme
   * Mobile: Custom URL scheme
   * Desktop: Loopback IP (127.0.0.1) - Required by Google OAuth policy
   */
  static getOAuthCallbackScheme(): string {
    return this.isMobile()
      ? 'obsidian://meeting-tasks-callback'
      : 'http://127.0.0.1:3000/callback';
  }

  /**
   * Get recommended lookback time for email fetching
   * Mobile: 24 hours (reduce data transfer)
   * Desktop: User preference (can handle more)
   */
  static getDefaultLookbackTime(): string {
    return this.isMobile() ? '1d' : '3d';
  }

  /**
   * Check if platform requires network warning
   * Mobile: Warn on cellular
   * Desktop: No warnings
   */
  static shouldWarnAboutNetwork(): boolean {
    return this.isMobile();
  }

  /**
   * Get UI scale factor for touch targets
   * Mobile: 1.5x (larger touch targets)
   * Desktop: 1.0x (normal)
   */
  static getTouchTargetScale(): number {
    return this.isMobile() ? 1.5 : 1.0;
  }
}
