import { BoundedMap } from './cache.js';

/**
 * Simple embed engine with built‑in caching to avoid rebuilding identical
 * embeds.  Uses a FIFO-bounded map to prevent memory leak.
 */
export default class EmbedEngine {
  constructor(maxSize = 100) {
    this._cache = new BoundedMap(maxSize);
  }

  /**
   * Try to retrieve an embed from cache using `key`.
   */
  get(key) {
    return this._cache.get(key);
  }

  /**
   * Store an embed in the cache under `key`.
   */
  set(key, embed) {
    this._cache.set(key, embed);
  }

  /**
   * Helper that will call `builder()` only when a cached value is missing.
   * The builder can be sync or async.
   */
  async cached(key, builder) {
    if (this._cache.has(key)) {
      return this._cache.get(key);
    }
    const value = await builder();
    this._cache.set(key, value);
    return value;
  }
}
