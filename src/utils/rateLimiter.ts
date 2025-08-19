import { logDebug, logWarn, logInfo } from './logger';

export interface RateLimitConfig {
  maxRequests: number;      // Maximum requests allowed
  windowMs: number;         // Time window in milliseconds
  maxBurst?: number;        // Maximum burst requests (optional)
  retryAfterMs?: number;    // Wait time when rate limited
}

export interface RateLimitState {
  requests: number;
  windowStart: number;
  queue: Array<() => void>;
  isProcessing: boolean;
}

export class RateLimiter {
  private state: Map<string, RateLimitState> = new Map();
  private defaultConfig: RateLimitConfig = {
    maxRequests: 10,
    windowMs: 1000,
    maxBurst: 15,
    retryAfterMs: 1000,
  };

  /**
   * Gmail API Quotas (as of 2024):
   * - Per-user rate limit: 250 quota units per user per second
   * - Daily quota: 1,000,000,000 quota units per day
   * 
   * Common operations:
   * - messages.list: 5 units
   * - messages.get: 5 units
   * - messages.modify: 5 units
   * - messages.attachments.get: 5 units
   */
  private gmailQuotas: Record<string, RateLimitConfig> = {
    'gmail.search': {
      maxRequests: 10,  // 10 searches per second (50 quota units)
      windowMs: 1000,
      maxBurst: 15,
      retryAfterMs: 2000,
    },
    'gmail.read': {
      maxRequests: 20,  // 20 reads per second (100 quota units)
      windowMs: 1000,
      maxBurst: 30,
      retryAfterMs: 1500,
    },
    'gmail.modify': {
      maxRequests: 10,  // 10 modifications per second (50 quota units)
      windowMs: 1000,
      maxBurst: 15,
      retryAfterMs: 2000,
    },
    'gmail.attachment': {
      maxRequests: 10,  // 10 attachment downloads per second
      windowMs: 1000,
      maxBurst: 15,
      retryAfterMs: 2000,
    },
    'gmail.daily': {
      maxRequests: 10000,  // Conservative daily limit
      windowMs: 24 * 60 * 60 * 1000,  // 24 hours
      retryAfterMs: 60 * 60 * 1000,  // 1 hour
    },
  };

  /**
   * Execute function with rate limiting
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    customConfig?: RateLimitConfig
  ): Promise<T> {
    const config = customConfig || this.gmailQuotas[key] || this.defaultConfig;
    
    // Initialize state if not exists
    if (!this.state.has(key)) {
      this.state.set(key, {
        requests: 0,
        windowStart: Date.now(),
        queue: [],
        isProcessing: false,
      });
    }

    const state = this.state.get(key)!;
    
    // Check if we need to reset the window
    const now = Date.now();
    if (now - state.windowStart >= config.windowMs) {
      state.requests = 0;
      state.windowStart = now;
    }

    // Check if we're within limits
    if (state.requests < config.maxRequests) {
      state.requests++;
      logDebug(`Rate limit ${key}: ${state.requests}/${config.maxRequests} requests`);
      return await fn();
    }

    // Check burst limit if configured
    if (config.maxBurst && state.requests < config.maxBurst) {
      state.requests++;
      logWarn(`Rate limit ${key}: Using burst capacity ${state.requests}/${config.maxBurst}`);
      return await fn();
    }

    // We're rate limited, need to wait
    const waitTime = config.retryAfterMs || (config.windowMs - (now - state.windowStart));
    logWarn(`Rate limited for ${key}. Waiting ${waitTime}ms before retry`);

    return new Promise<T>((resolve, reject) => {
      state.queue.push(async () => {
        try {
          const result = await this.execute(key, fn, config);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      // Process queue after wait time
      if (!state.isProcessing) {
        state.isProcessing = true;
        setTimeout(() => {
          this.processQueue(key);
        }, waitTime);
      }
    });
  }

  /**
   * Process queued requests
   */
  private processQueue(key: string): void {
    const state = this.state.get(key);
    if (!state || state.queue.length === 0) {
      if (state) {
        state.isProcessing = false;
      }
      return;
    }

    const fn = state.queue.shift();
    if (fn) {
      fn();
    }

    // Continue processing queue
    if (state.queue.length > 0) {
      const config = this.gmailQuotas[key] || this.defaultConfig;
      setTimeout(() => {
        this.processQueue(key);
      }, Math.floor(config.windowMs / config.maxRequests));
    } else {
      state.isProcessing = false;
    }
  }

  /**
   * Get current state for monitoring
   */
  getState(key: string): RateLimitState | undefined {
    return this.state.get(key);
  }

  /**
   * Reset rate limit state
   */
  reset(key?: string): void {
    if (key) {
      this.state.delete(key);
      logDebug(`Reset rate limit state for ${key}`);
    } else {
      this.state.clear();
      logDebug('Reset all rate limit states');
    }
  }

  /**
   * Check if currently rate limited
   */
  isRateLimited(key: string): boolean {
    const state = this.state.get(key);
    if (!state) return false;

    const config = this.gmailQuotas[key] || this.defaultConfig;
    const now = Date.now();

    // Check if window has expired
    if (now - state.windowStart >= config.windowMs) {
      return false;
    }

    return state.requests >= config.maxRequests;
  }

  /**
   * Get remaining requests in current window
   */
  getRemainingRequests(key: string): number {
    const state = this.state.get(key);
    if (!state) {
      const config = this.gmailQuotas[key] || this.defaultConfig;
      return config.maxRequests;
    }

    const config = this.gmailQuotas[key] || this.defaultConfig;
    const now = Date.now();

    // Check if window has expired
    if (now - state.windowStart >= config.windowMs) {
      return config.maxRequests;
    }

    return Math.max(0, config.maxRequests - state.requests);
  }

  /**
   * Create a rate-limited wrapper for a function
   */
  wrap<T extends (...args: any[]) => Promise<any>>(
    key: string,
    fn: T,
    customConfig?: RateLimitConfig
  ): T {
    return (async (...args: Parameters<T>) => {
      return this.execute(key, () => fn(...args), customConfig);
    }) as T;
  }
}

/**
 * Batch processor with rate limiting
 */
export class BatchProcessor<T, R> {
  private rateLimiter: RateLimiter;
  private batchSize: number;
  private delayBetweenBatches: number;

  constructor(
    rateLimiter: RateLimiter,
    batchSize: number = 10,
    delayBetweenBatches: number = 1000
  ) {
    this.rateLimiter = rateLimiter;
    this.batchSize = batchSize;
    this.delayBetweenBatches = delayBetweenBatches;
  }

  /**
   * Process items in batches with rate limiting
   */
  async processBatch(
    items: T[],
    processor: (item: T) => Promise<R>,
    rateLimitKey: string
  ): Promise<R[]> {
    const results: R[] = [];
    const batches = this.createBatches(items);

    logInfo(`Processing ${items.length} items in ${batches.length} batches`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch) continue;
      logDebug(`Processing batch ${i + 1}/${batches.length} with ${batch.length} items`);

      // Process batch items with rate limiting
      const batchPromises = batch.map(item =>
        this.rateLimiter.execute(rateLimitKey, () => processor(item))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Delay between batches (except for last batch)
      if (i < batches.length - 1) {
        await this.delay(this.delayBetweenBatches);
      }
    }

    return results;
  }

  /**
   * Create batches from items
   */
  private createBatches<T>(items: T[]): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += this.batchSize) {
      batches.push(items.slice(i, i + this.batchSize));
    }
    return batches;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Exponential backoff retry with rate limiting
 */
export class RetryWithBackoff {
  private maxRetries: number;
  private baseDelay: number;
  private maxDelay: number;
  private factor: number;

  constructor(
    maxRetries: number = 3,
    baseDelay: number = 1000,
    maxDelay: number = 30000,
    factor: number = 2
  ) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.factor = factor;
  }

  /**
   * Execute function with exponential backoff retry
   */
  async execute<T>(
    fn: () => Promise<T>,
    isRetriableError?: (error: any) => boolean
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Check if error is retriable
        if (isRetriableError && !isRetriableError(error)) {
          throw error;
        }

        if (attempt < this.maxRetries) {
          const delay = Math.min(
            this.baseDelay * Math.pow(this.factor, attempt),
            this.maxDelay
          );
          
          logWarn(`Retry attempt ${attempt + 1}/${this.maxRetries} after ${delay}ms`, { error });
          await this.delay(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instances
export const rateLimiter = new RateLimiter();
export const batchProcessor = new BatchProcessor(rateLimiter);
export const retryWithBackoff = new RetryWithBackoff();