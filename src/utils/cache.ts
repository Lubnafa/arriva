type Entry<V> = {
  value: V;
  expiresAt: number;
  insertedAt: number;
};

/**
 * In-memory TTL cache with optional max size and LRU-style eviction of oldest inserts.
 */
export class TTLCache<K, V> {
  private readonly ttlMs: number;

  private readonly maxSize?: number;

  private readonly store = new Map<K, Entry<V>>();

  public constructor(ttlMs: number, maxSize?: number) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  /** Returns the cached value or undefined on miss/expiry (never throws). */
  public get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /** Inserts or replaces a key with fresh TTL. */
  public set(key: K, value: V): void {
    const now = Date.now();
    if (this.maxSize !== undefined && !this.store.has(key) && this.store.size >= this.maxSize) {
      this.evictOldest();
    }
    this.store.set(key, {
      value,
      expiresAt: now + this.ttlMs,
      insertedAt: now,
    });
  }

  /** Removes a single key if present. */
  public delete(key: K): void {
    this.store.delete(key);
  }

  /** Clears all entries. */
  public clear(): void {
    this.store.clear();
  }

  /** Number of keys currently held (including possibly expired until next access). */
  public size(): number {
    return this.store.size;
  }

  private evictOldest(): void {
    let oldestKey: K | undefined;
    let oldestTime = Number.POSITIVE_INFINITY;
    for (const [k, e] of this.store.entries()) {
      if (e.insertedAt < oldestTime) {
        oldestTime = e.insertedAt;
        oldestKey = k;
      }
    }
    if (oldestKey !== undefined) {
      this.store.delete(oldestKey);
    }
  }
}
