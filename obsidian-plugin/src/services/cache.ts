/**
 * Cache Service for Meeting Tasks Plugin
 * Provides offline support and performance optimization
 */

import { App, TFile, normalizePath } from 'obsidian';
import { MeetingNote, ExtractedTask } from '../api/types';

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Cache statistics
 */
interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  entries: number;
}

/**
 * Cache service for offline support
 */
export class CacheService {
  private app: App;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cacheFile: TFile | null = null;
  private expiryTime: number;
  private enabled: boolean;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    entries: 0,
  };

  constructor(app: App, expiryTime: number = 3600000, enabled: boolean = true) {
    this.app = app;
    this.expiryTime = expiryTime;
    this.enabled = enabled;
  }

  /**
   * Initialize cache from storage
   */
  async initialize(): Promise<void> {
    if (!this.enabled) return;

    try {
      const cachePath = normalizePath('.obsidian/plugins/meeting-tasks/cache.json');
      this.cacheFile = this.app.vault.getAbstractFileByPath(cachePath) as TFile;
      
      if (this.cacheFile) {
        const content = await this.app.vault.read(this.cacheFile);
        const data = JSON.parse(content);
        
        // Load cache entries
        for (const [key, entry] of Object.entries(data.cache || {})) {
          if (this.isValid(entry as CacheEntry<any>)) {
            this.cache.set(key, entry as CacheEntry<any>);
          }
        }
        
        // Load stats
        if (data.stats) {
          this.stats = data.stats;
        }
      }
      
      // Clean expired entries
      this.cleanExpired();
      
    } catch (error) {
      console.error('Failed to initialize cache:', error);
    }
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    if (!this.enabled) return null;

    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    if (!this.isValid(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    if (!this.enabled) return;

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      expiresAt: Date.now() + (ttl || this.expiryTime),
    };
    
    this.cache.set(key, entry);
    this.stats.entries = this.cache.size;
    
    // Update size estimate
    this.updateSize();
    
    // Save to disk async
    this.save();
  }

  /**
   * Delete from cache
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      this.stats.entries = this.cache.size;
      this.updateSize();
      this.save();
    }
    return result;
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      entries: 0,
    };
    
    if (this.cacheFile) {
      await this.app.vault.delete(this.cacheFile);
      this.cacheFile = null;
    }
  }

  /**
   * Check if entry is valid
   */
  private isValid(entry: CacheEntry<any>): boolean {
    return entry.expiresAt > Date.now();
  }

  /**
   * Clean expired entries
   */
  private cleanExpired(): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        toDelete.push(key);
      }
    }
    
    for (const key of toDelete) {
      this.cache.delete(key);
    }
    
    if (toDelete.length > 0) {
      this.stats.entries = this.cache.size;
      this.updateSize();
      this.save();
    }
  }

  /**
   * Update size estimate
   */
  private updateSize(): void {
    // Rough estimate of cache size in bytes
    let size = 0;
    for (const entry of this.cache.values()) {
      size += JSON.stringify(entry).length;
    }
    this.stats.size = size;
  }

  /**
   * Save cache to disk
   */
  private async save(): Promise<void> {
    if (!this.enabled) return;

    try {
      const data = {
        cache: Object.fromEntries(this.cache),
        stats: this.stats,
        savedAt: Date.now(),
      };
      
      const content = JSON.stringify(data, null, 2);
      const cachePath = normalizePath('.obsidian/plugins/meeting-tasks/cache.json');
      
      if (!this.cacheFile) {
        // Ensure directory exists
        const dir = normalizePath('.obsidian/plugins/meeting-tasks');
        const folder = this.app.vault.getAbstractFileByPath(dir);
        if (!folder) {
          await this.app.vault.createFolder(dir);
        }
        
        this.cacheFile = await this.app.vault.create(cachePath, content);
      } else {
        await this.app.vault.modify(this.cacheFile, content);
      }
    } catch (error) {
      console.error('Failed to save cache:', error);
    }
  }

  /**
   * Cache meeting note
   */
  cacheMeeting(meeting: MeetingNote): void {
    this.set(`meeting:${meeting.id}`, meeting);
    
    // Also cache by email ID if available
    if (meeting.sourceEmail) {
      this.set(`email:${meeting.sourceEmail}`, meeting.id);
    }
  }

  /**
   * Get cached meeting
   */
  getCachedMeeting(id: string): MeetingNote | null {
    return this.get<MeetingNote>(`meeting:${id}`);
  }

  /**
   * Get meeting by email ID
   */
  getMeetingByEmail(emailId: string): MeetingNote | null {
    const meetingId = this.get<string>(`email:${emailId}`);
    if (meetingId) {
      return this.getCachedMeeting(meetingId);
    }
    return null;
  }

  /**
   * Cache task list
   */
  cacheTasks(meetingId: string, tasks: ExtractedTask[]): void {
    this.set(`tasks:${meetingId}`, tasks);
  }

  /**
   * Get cached tasks
   */
  getCachedTasks(meetingId: string): ExtractedTask[] | null {
    return this.get<ExtractedTask[]>(`tasks:${meetingId}`);
  }

  /**
   * Cache API response
   */
  cacheApiResponse(endpoint: string, params: any, response: any): void {
    const key = `api:${endpoint}:${JSON.stringify(params)}`;
    this.set(key, response, 300000); // 5 minutes TTL for API responses
  }

  /**
   * Get cached API response
   */
  getCachedApiResponse(endpoint: string, params: any): any | null {
    const key = `api:${endpoint}:${JSON.stringify(params)}`;
    return this.get(key);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get hit rate
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    // Save final state
    this.save();
    
    // Clear in-memory cache
    this.cache.clear();
  }
}