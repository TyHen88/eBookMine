/**
 * High-performance in-memory Cache for eBookMine database queries.
 * Provides instant (< 2ms) data responses for public library and dashboard data.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();

  /**
   * Retrieve item from cache if not expired.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set item in cache with TTL in seconds.
   */
  set<T>(key: string, data: T, ttlSeconds: number = 60): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { data, expiresAt });
  }

  /**
   * Invalidate specific key or keys matching a prefix.
   */
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.store.clear();
      return;
    }

    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
      }
    }
  }
}

export const memoryCache = new MemoryCache();
