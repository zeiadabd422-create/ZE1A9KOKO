import { EmbedBuilder } from 'discord.js';
import { parseColor } from './parseColor.js';
import { BoundedMap } from './cache.js';
import { render as renderJson } from '../core/embedEngine.js';

/**
 * Legacy wrapper that adds caching and Discord builder conversion on top of
 * the pure JSON engine living in `src/core/embedEngine.js`.  The core
 * engine is responsible only for transforming a template object into a
 * plain data structure with placeholders resolved; this helper then
 * converts to the Discord.js classes for backwards compatibility.
 */
export default class EmbedEngine {
  constructor(maxSize = 100) {
    this._cache = new BoundedMap(maxSize);
  }

  get(key) {
    return this._cache.get(key);
  }

  set(key, value) {
    this._cache.set(key, value);
  }

  async cached(key, builder) {
    if (this._cache.has(key)) {
      return this._cache.get(key);
    }
    const value = await builder();
    this._cache.set(key, value);
    return value;
  }

  /**
   * Build an EmbedBuilder-compatible object from configuration data.
   * This is mostly unchanged; the hard work is delegated to the JSON
   * engine which handles nested fields, placeholders, etc.
   */
  async build(config, overrideMessage = '', pageKey = '', member = null) {
    // select the correct template (same logic as before)
    let template = null;
    if (config.templates && Array.isArray(config.templates)) {
      template = config.templates.find((t) => t.name === pageKey);
    }
    if (!template) {
      const map = {
        success: config.successUI,
        alreadyVerified: config.alreadyVerifiedUI,
        error: config.errorUI,
        dm: config.dmUI,
        prompt: config.promptUI,
      };
      template = map[pageKey] || {};
    }

    // let core engine render the JSON and resolve placeholders
    const data = await renderJson(template, member);
    if (data && data.error === 'EMBED_DESCRIPTION_TOO_LONG') {
      throw new Error('EMBED_DESCRIPTION_TOO_LONG');
    }

    // override description if requested
    if (overrideMessage) {
      data.description = overrideMessage;
    }

    // apply default color parsing if necessary
    if (data.color) {
      try {
        data.color = parseColor(data.color, '#2ecc71');
      } catch (_e) {
        // leave as-is if parsing failed
      }
    }

    // now build the Discord.js EmbedBuilder for compatibility
    const emb = new EmbedBuilder(data);
    return emb;  }
}
