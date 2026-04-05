/**
 * In-memory TTL cache — lightweight caching for hot paths.
 *
 * Per vercel-react-best-practices: cache data at the data layer,
 * not the component layer. Use for:
 * - Marketplace.json responses (60s TTL)
 * - Search index metadata (30s TTL)
 * - Department template lookups (5min TTL)
 * - User session data (60s TTL)
 *
 * NOT a replacement for CDN/edge caching — this is application-level.
 * For production: replace with Redis or Vercel KV.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Generic TTL cache with automatic expiration.
 */
export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly defaultTtlMs: number;
  private readonly maxEntries: number;

  constructor(options: { ttlMs: number; maxEntries?: number }) {
    this.defaultTtlMs = options.ttlMs;
    this.maxEntries = options.maxEntries ?? 1000;
  }

  /**
   * Get a cached value, or compute and cache it if missing/expired.
   */
  async getOrSet(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (existing && existing.expiresAt > now) {
      return existing.value;
    }

    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Set a value in the cache.
   */
  set(key: string, value: T, ttlMs?: number): void {
    // Evict if at capacity (LRU-ish: delete oldest entry)
    if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  /**
   * Get a value if it exists and hasn't expired.
   */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Invalidate a specific key.
   */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix.
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Current cache size.
   */
  get size(): number {
    return this.store.size;
  }
}

// ─── Pre-configured Caches ──────────────────────────────────

/** Marketplace responses — 60s TTL */
export const marketplaceCache = new TtlCache<unknown>({ ttlMs: 60_000, maxEntries: 100 });

/** Search metadata — 30s TTL */
export const searchCache = new TtlCache<unknown>({ ttlMs: 30_000, maxEntries: 500 });

/** User/team data — 60s TTL */
export const userCache = new TtlCache<unknown>({ ttlMs: 60_000, maxEntries: 200 });

/** Department templates — 5min TTL (rarely changes) */
export const templateCache = new TtlCache<unknown>({ ttlMs: 300_000, maxEntries: 50 });
