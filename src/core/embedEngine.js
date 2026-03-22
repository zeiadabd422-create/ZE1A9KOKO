/**
 * ─── src/core/embedEngine.js ──────────────────────────────────────────────────
 * UNIFIED EMBED RENDERER & LOGIC ENGINE - VISUAL & LIVE-UPDATING SYSTEM
 * Core engine for placeholder resolution, embed rendering, and live preview
 */

import { EmbedBuilder } from 'discord.js';

// Placeholder resolver with enhanced logic
function applyRandomChoices(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/\{choose:([^}]+)\}/g, (_match, list) => {
    const parts = list.split('|');
    if (parts.length === 0) return '';
    const pick = parts[Math.floor(Math.random() * parts.length)];
    return pick;
  });
}

function resolvePlaceholders(text, placeholders = {}) {
  if (!text || typeof text !== 'string') return text;
  let out = text;

  // Apply random choices first
  out = applyRandomChoices(out);

  // Enhanced placeholder resolution
  const ph = { ...placeholders };

  // Auto-inject member context if available
  if (placeholders.member) {
    const member = placeholders.member;
    ph['user'] = `<@${member.id}>`;
    ph['user.name'] = member.user?.username || 'Unknown';
    ph['user.avatar'] = member.displayAvatarURL?.({ extension: 'png', size: 256, forceStatic: false }) || '';
    ph['user.mention'] = `<@${member.id}>`;
    ph['user.id'] = member.id;
    ph['user.discriminator'] = member.user?.discriminator || '0000';

    if (member.joinedAt) {
      ph['joined_at'] = member.joinedAt.toLocaleDateString();
      // Dynamic join_pos: use passed value or try to extract from member cache
      ph['join_pos'] = placeholders.join_pos || '?';
    }

    if (member.user?.createdAt) {
      const ageDays = Math.floor((Date.now() - member.user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      ph['account_age'] = ageDays.toString();
    }

    // Guild-only context: ensure guild exists before resolving guild-related placeholders
    if (member.guild) {
      ph['server'] = member.guild.name;
      ph['server.name'] = member.guild.name;
      ph['member_count'] = member.guild.memberCount?.toString() || '0';
    }
  }

  // Resolve all placeholders
  for (const [key, value] of Object.entries(ph)) {
    const replacement = value !== null && value !== undefined ? String(value) : '';
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\{${escapedKey}\\}`, 'g'), replacement);
  }

  return out;
}

// Color resolver
function resolveColor(color) {
  if (!color) return 0x2f3136;
  if (typeof color === 'string' && color.startsWith('#')) {
    return parseInt(color.replace('#', ''), 16);
  }
  if (typeof color === 'number') return color;
  return 0x2f3136;
}

// Main render function
export function render(data = {}, placeholders = {}) {
  const out = {};

  // Process basic fields with placeholder resolution
  if (data.title) out.title = resolvePlaceholders(data.title, placeholders);
  if (data.description) out.description = resolvePlaceholders(data.description, placeholders);
  if (data.url) out.url = data.url;
  out.color = resolveColor(data.color);

  if (data.timestamp) {
    out.timestamp = data.timestamp === true ? new Date().toISOString() : data.timestamp;
  }

  // Author
  if (data.author && data.author.name) {
    out.author = {
      name: resolvePlaceholders(data.author.name, placeholders),
      iconURL: data.author.iconURL ? resolvePlaceholders(data.author.iconURL, placeholders) : undefined,
      url: data.author.url,
    };
  }

  // Thumbnail
  if (data.thumbnail && (data.thumbnail.url || typeof data.thumbnail === 'string')) {
    const thumbUrl = typeof data.thumbnail === 'string' ? data.thumbnail : data.thumbnail.url;
    out.thumbnail = { url: resolvePlaceholders(thumbUrl, placeholders) };
  }

  // Image
  if (data.image && (data.image.url || typeof data.image === 'string')) {
    const imgUrl = typeof data.image === 'string' ? data.image : data.image.url;
    out.image = { url: resolvePlaceholders(imgUrl, placeholders) };
  }

  // Footer
  if (data.footer && data.footer.text) {
    out.footer = {
      text: resolvePlaceholders(data.footer.text, placeholders),
      iconURL: data.footer.iconURL ? resolvePlaceholders(data.footer.iconURL, placeholders) : undefined,
    };
  }

  // Fields
  if (data.fields && Array.isArray(data.fields) && data.fields.length > 0) {
    out.fields = data.fields
      .filter(f => f.name && f.value)
      .map(f => ({
        name: resolvePlaceholders(f.name, placeholders),
        value: resolvePlaceholders(f.value, placeholders),
        inline: !!f.inline,
      }));
  }

  return out;
}

// Live preview function for visual editing
export function createPreview(data = {}, placeholders = {}) {
  const rendered = render(data, placeholders);
  return new EmbedBuilder(rendered);
}

// Validation function
export function validateEmbed(data = {}) {
  const errors = [];

  if (data.title && data.title.length > 256) {
    errors.push('Title must be 256 characters or less');
  }

  if (data.description && data.description.length > 4096) {
    errors.push('Description must be 4096 characters or less');
  }

  if (data.fields) {
    if (data.fields.length > 25) {
      errors.push('Cannot have more than 25 fields');
    }
    data.fields.forEach((field, index) => {
      if (field.name && field.name.length > 256) {
        errors.push(`Field ${index + 1} name must be 256 characters or less`);
      }
      if (field.value && field.value.length > 1024) {
        errors.push(`Field ${index + 1} value must be 1024 characters or less`);
      }
    });
  }

  if (data.author?.name && data.author.name.length > 256) {
    errors.push('Author name must be 256 characters or less');
  }

  if (data.footer?.text && data.footer.text.length > 2048) {
    errors.push('Footer text must be 2048 characters or less');
  }

  return errors;
}

export default { render, createPreview, validateEmbed };
