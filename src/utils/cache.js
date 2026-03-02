// Simple FIFO-capable bounded map
// When the size exceeds `maxSize`, the oldest entry is removed automatically.

export class BoundedMap extends Map {
  constructor(maxSize = 100, entries) {
    super(entries);
    this.maxSize = maxSize;
  }

  set(key, value) {
    // if the key already exists, just update it and move it to the back
    if (this.has(key)) {
      super.delete(key);
    }

    // remove oldest entry if at capacity
    if (this.size >= this.maxSize) {
      const firstKey = this.keys().next().value;
      if (firstKey !== undefined) {
        super.delete(firstKey);
      }
    }

    return super.set(key, value);
  }

  // convenience helper to get-or-set
  getOrSet(key, defaultValue) {
    if (this.has(key)) return this.get(key);
    this.set(key, defaultValue);
    return defaultValue;
  }
}
