// ── High-Speed Caching Layer (In-Memory LRU with TTL) ──
// Designed to absorb 95%+ of catalog and configuration reads at 100k+ customer scale.

class FastCache {
  constructor(options = {}) {
    this.maxItems = options.maxItems || 2000;
    this.defaultTtl = (options.defaultTtlSeconds || 300) * 1000; // 5 mins default
    this.store = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }

    // Refresh access order (LRU)
    this.store.delete(key);
    this.store.set(key, item);
    this.stats.hits++;
    return item.value;
  }

  set(key, value, ttlSeconds) {
    const ttl = (ttlSeconds ? ttlSeconds * 1000 : this.defaultTtl);
    const expiresAt = Date.now() + ttl;

    // Evict expired entries first, or evict oldest if still at capacity
    if (this.store.size >= this.maxItems && !this.store.has(key)) {
      const now = Date.now();
      let pruned = false;
      for (const [k, v] of this.store.entries()) {
        if (now > v.expiresAt) {
          this.store.delete(k);
          pruned = true;
          break;
        }
      }
      if (!pruned) {
        const oldestKey = this.store.keys().next().value;
        if (oldestKey) this.store.delete(oldestKey);
      }
    }

    this.store.set(key, { value, expiresAt });
    this.stats.sets++;
  }

  del(key) {
    const deleted = this.store.delete(key);
    if (deleted) this.stats.deletes++;
    return deleted;
  }

  delPrefix(prefix) {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    this.stats.deletes += count;
    return count;
  }

  // Active sweep to prevent inactive expired entries from holding memory
  pruneExpired() {
    const now = Date.now();
    let count = 0;
    for (const [key, item] of this.store.entries()) {
      if (now > item.expiresAt) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  clear() {
    this.store.clear();
  }

  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests * 100).toFixed(2) + '%' : '0%';
    return {
      keys: this.store.size,
      maxItems: this.maxItems,
      ...this.stats,
      totalRequests,
      hitRate,
    };
  }
}

export const cache = new FastCache({
  maxItems: 500,
  defaultTtlSeconds: 180, // 3 minutes
});

// Periodic sweeper unref'd so it never keeps Node alive on shutdown
const pruneInterval = setInterval(() => {
  cache.pruneExpired();
}, 60000);
if (pruneInterval.unref) {
  pruneInterval.unref();
}

export default cache;
