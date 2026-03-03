import { EmbedBuilder } from 'discord.js';
import { parsePlaceholders } from './placeholders.js';
import { parseColor } from './parseColor.js';
import { BoundedMap } from './cache.js';

/**
 * Enterprise-ready embed engine that translates a JSON configuration
 * document (typically pulled from MongoDB) into a Discord embed object.
 *
 * The engine also includes optional caching to avoid rebuilding identical
 * embeds repeatedly.
 */
export default class EmbedEngine {
  constructor(maxSize = 100) {
    this._cache = new BoundedMap(maxSize);
  }

  /**
   * Retrieve a value from cache.
   */
  get(key) {
    return this._cache.get(key);
  }

  /**
   * Store a value in cache.
   */
  set(key, value) {
    this._cache.set(key, value);
  }

  /**
   * Helper to perform caching around a builder function.
   * Accepts an async or sync builder.
   */
  async cached(key, builder) {
    if (this._cache.has(key)) {
      return this._cache.get(key);
    }
    const value = await builder();
    this._cache.set(key, value);
    return value;
  }

  /**
   * Build an embed from a configuration object.
   *
   * The config may be a legacy page-specific object (e.g. successUI) or
   * a modern "template" entry.  `pageKey` is used to choose the relevant
   * section; `overrideMessage` will replace the description if provided.
   *
   * Member context is used for placeholder parsing.
   */
  async build(config, overrideMessage = '', pageKey = '', member = null) {
    // determine template
    let template = null;

    // first look for a named template entry
    if (config.templates && Array.isArray(config.templates)) {
      template = config.templates.find((t) => t.name === pageKey);
    }

    // fallback to legacy UI section if no template found
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

    // default values
    const emb = new EmbedBuilder();
    if (template.title) emb.setTitle(template.title);
    if (overrideMessage) emb.setDescription(overrideMessage);
    else if (template.description || template.desc) emb.setDescription(template.description || template.desc);
    if (template.color) emb.setColor(parseColor(template.color, '#2ecc71'));
    if (template.author) emb.setAuthor({ name: template.author });
    if (template.footer) emb.setFooter({ text: template.footer });
    if (template.thumbnail) emb.setThumbnail(template.thumbnail);
    if (template.image && template.image.trim()) emb.setImage(template.image);

    if (template.fields && Array.isArray(template.fields)) {
      for (const f of template.fields) {
        try {
          emb.addFields({ name: f.name || '\u200b', value: f.value || '\u200b', inline: !!f.inline });
        } catch (_e) {
          // ignore malformed field
        }
      }
    }

    // parse placeholders if context available
    if (member) {
      try {
        if (emb.data.title) {
          emb.data.title = await parsePlaceholders(emb.data.title, member);
        }
        if (emb.data.description) {
          emb.data.description = await parsePlaceholders(emb.data.description, member);
        }
      } catch (e) {
        console.warn('[EmbedEngine] Placeholder parsing error:', e.message);
      }
    }

    // return plain object for compatibility with existing callers
    return emb.toJSON();
  }
}
