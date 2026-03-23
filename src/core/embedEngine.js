/**
 * ─── src/core/embedEngine.js ──────────────────────────────────────────────────
 * EMBED ENGINE V3 — UNIFIED RENDERER, PLACEHOLDER SYSTEM & VALIDATOR
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  PLACEHOLDER REFERENCE                                                  │
 * ├──────────────────┬──────────────────────────────────────────────────────┤
 * │  USER            │                                                      │
 * │  {user}          │  @mention  (<@id>)                                   │
 * │  {user.mention}  │  alias for {user}                                    │
 * │  {user.name}     │  plain username                                      │
 * │  {user.tag}      │  username#discriminator  (legacy tag format)         │
 * │  {user.id}       │  numeric user ID                                     │
 * │  {user.avatar}   │  avatar URL  (PNG 256px) — safe in URL fields        │
 * │  {user.discriminator} │ 4-digit tag or "0"                              │
 * │  {user.created_at}│  account creation date  (locale string)            │
 * │  {account_age}   │  account age in days                                 │
 * ├──────────────────┬──────────────────────────────────────────────────────┤
 * │  MEMBER          │                                                      │
 * │  {joined_at}     │  date member joined the server                       │
 * │  {join_pos}      │  join position (pass via placeholders.join_pos)      │
 * │  {user.roles}    │  comma-separated list of role names (excl. @everyone)│
 * │  {user.top_role} │  highest role name                                   │
 * ├──────────────────┬──────────────────────────────────────────────────────┤
 * │  SERVER          │                                                      │
 * │  {server}        │  server name                                         │
 * │  {server.name}   │  alias for {server}                                  │
 * │  {server.id}     │  guild ID                                            │
 * │  {server.icon}   │  guild icon URL — safe in URL fields                 │
 * │  {server.owner_id} │ owner user ID                                      │
 * │  {server.created_at} │ server creation date (locale string)             │
 * │  {member_count}  │  total member count                                  │
 * │  {boost_count}   │  active boosts count                                 │
 * │  {boost_level}   │  boost tier  (0–3)                                   │
 * ├──────────────────┬──────────────────────────────────────────────────────┤
 * │  CHANNEL         │                                                      │
 * │  {channel.name}  │  channel name (no #)                                 │
 * │  {channel.id}    │  channel ID                                          │
 * │  {channel.mention} │ <#id> mention                                      │
 * ├──────────────────┬──────────────────────────────────────────────────────┤
 * │  SPECIAL         │                                                      │
 * │  {timestamp}     │  current time as Discord dynamic timestamp           │
 * │  {choose:A|B|C}  │  random pick from pipe-separated list                │
 * └──────────────────┴──────────────────────────────────────────────────────┘
 */

import { EmbedBuilder } from 'discord.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if a string is a safe, resolvable URL that Discord will accept
 * in image/icon fields (must start with http/https or //).
 */
function isSafeUrl(str) {
  if (!str || typeof str !== 'string') return false;
  return str.startsWith('https://') ||
         str.startsWith('http://')  ||
         str.startsWith('//');
}

/**
 * Parses a hex color string or number into an integer Discord accepts.
 * Falls back to Discord's default dark color on any invalid input.
 */
function resolveColor(color) {
  if (color == null) return 0x2f3136;
  if (typeof color === 'number') return color;
  if (typeof color === 'string') {
    const hex = color.startsWith('#') ? color.slice(1) : color;
    const n   = parseInt(hex, 16);
    if (!isNaN(n)) return n;
  }
  return 0x2f3136;
}

// ─── Placeholder resolution ───────────────────────────────────────────────────

/**
 * Replaces {choose:A|B|C} patterns with a random option.
 * Runs before the main replacement loop so it can't interfere with keyed lookups.
 */
function applyRandomChoices(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/\{choose:([^}]+)\}/g, (_match, list) => {
    const parts = list.split('|').filter(Boolean);
    if (!parts.length) return '';
    return parts[Math.floor(Math.random() * parts.length)];
  });
}

/**
 * Replaces {timestamp} with a Discord dynamic timestamp (<t:unix:R>).
 */
function applyTimestampPlaceholder(str) {
  if (!str || typeof str !== 'string') return str;
  const unix = Math.floor(Date.now() / 1000);
  return str.replace(/\{timestamp\}/g, `<t:${unix}:R>`);
}

/**
 * Builds a flat key→value placeholder map from the context object and
 * then performs a single-pass replacement on the input string.
 *
 * @param {string} text
 * @param {object} ctx  – { member?, channel?, join_pos?, …extra flat keys }
 * @returns {string}
 */
function resolvePlaceholders(text, ctx = {}) {
  if (!text || typeof text !== 'string') return text;

  // Order matters: random choices and timestamp tokens first
  let out = applyRandomChoices(text);
  out     = applyTimestampPlaceholder(out);

  // Build flat map
  const ph = {};

  // ── User / Member ──────────────────────────────────────────────────────────
  if (ctx.member) {
    const member = ctx.member;
    const user   = member.user;
    const guild  = member.guild;

    ph['user']                = `<@${member.id}>`;
    ph['user.mention']        = `<@${member.id}>`;
    ph['user.id']             = member.id;
    ph['user.name']           = user?.username ?? 'Unknown';
    ph['user.discriminator']  = user?.discriminator ?? '0';
    ph['user.tag']            = user?.discriminator && user.discriminator !== '0'
                                  ? `${user.username}#${user.discriminator}`
                                  : user?.username ?? 'Unknown';

    // Avatar: prefer member display avatar (server avatar support), fall back to user global avatar
    ph['user.avatar'] =
      member.displayAvatarURL?.({ extension: 'png', size: 256, forceStatic: false }) ??
      user?.displayAvatarURL?.({ extension: 'png', size: 256 }) ??
      '';

    if (user?.createdAt) {
      ph['user.created_at'] = user.createdAt.toLocaleDateString();
      ph['account_age']     = Math.floor(
        (Date.now() - user.createdAt.getTime()) / 86_400_000
      ).toString();
    }

    if (member.joinedAt) {
      ph['joined_at'] = member.joinedAt.toLocaleDateString();
    }

    // join_pos must be provided externally (e.g. from guildMemberAdd handler)
    ph['join_pos'] = ctx.join_pos != null ? String(ctx.join_pos) : '?';

    // Roles: exclude @everyone, sort by position descending (highest first)
    if (member.roles?.cache) {
      const roles = [...member.roles.cache.values()]
        .filter(r => r.name !== '@everyone')
        .sort((a, b) => b.position - a.position);

      ph['user.roles']    = roles.length ? roles.map(r => r.name).join(', ') : 'None';
      ph['user.top_role'] = roles.length ? roles[0].name : 'None';
    }

    // ── Guild ────────────────────────────────────────────────────────────────
    if (guild) {
      ph['server']             = guild.name;
      ph['server.name']        = guild.name;
      ph['server.id']          = guild.id;
      ph['server.owner_id']    = guild.ownerId ?? '';
      ph['server.created_at']  = guild.createdAt?.toLocaleDateString() ?? '';
      ph['server.icon']        = guild.iconURL?.({ extension: 'png', size: 256 }) ?? '';
      ph['member_count']       = guild.memberCount?.toString() ?? '0';
      ph['boost_count']        = guild.premiumSubscriptionCount?.toString() ?? '0';
      ph['boost_level']        = guild.premiumTier?.toString() ?? '0';
    }
  }

  // ── Channel ────────────────────────────────────────────────────────────────
  if (ctx.channel) {
    const ch = ctx.channel;
    ph['channel.name']    = ch.name ?? '';
    ph['channel.id']      = ch.id   ?? '';
    ph['channel.mention'] = `<#${ch.id}>`;
  }

  // ── Any extra flat keys passed directly (e.g. { 'custom_key': 'value' }) ──
  for (const [k, v] of Object.entries(ctx)) {
    if (['member', 'channel', 'join_pos'].includes(k)) continue; // already handled above
    if (!(k in ph)) ph[k] = v != null ? String(v) : '';
  }

  // ── Single-pass replacement ────────────────────────────────────────────────
  for (const [key, value] of Object.entries(ph)) {
    const safe      = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const replacement = value != null ? String(value) : '';
    out = out.replace(new RegExp(`\\{${safe}\\}`, 'g'), replacement);
  }

  return out;
}

// ─── Render ───────────────────────────────────────────────────────────────────

/**
 * Transforms raw embed data + context into a resolved plain object ready for
 * `new EmbedBuilder(result)`.  Every string field — including all URL fields —
 * is run through the placeholder engine.
 *
 * The `ctx` object accepts:
 *   ctx.member   – GuildMember  (provides all user/server placeholders)
 *   ctx.channel  – TextChannel  (provides channel.* placeholders)
 *   ctx.join_pos – number|string (member join position for welcome messages)
 *   ctx.*        – any extra flat key/value pairs
 *
 * Flat schema fields on the data object (authorName, authorIcon, footerText,
 * footerIcon) take priority over nested author.*/footer.* equivalents so that
 * the EmbedVault module's storage format is fully supported.
 */
export function render(data = {}, ctx = {}) {
  const out = {};

  // ── Basic text fields ──────────────────────────────────────────────────────
  if (data.title)       out.title       = resolvePlaceholders(data.title,       ctx);
  if (data.description) out.description = resolvePlaceholders(data.description, ctx);
  if (data.url)         out.url         = resolvePlaceholders(data.url,         ctx);

  out.color = resolveColor(data.color);

  // ── Timestamp ──────────────────────────────────────────────────────────────
  // data.timestamp === true  → current ISO time
  // data.timestamp === false / undefined → omit
  // data.includeTimestamp    → same as true (EmbedVault schema alias)
  if (data.timestamp === true || data.includeTimestamp === true) {
    out.timestamp = new Date().toISOString();
  } else if (data.timestamp && data.timestamp !== false) {
    // Accept an explicit ISO string or Date object stored in data
    out.timestamp = data.timestamp instanceof Date
      ? data.timestamp.toISOString()
      : data.timestamp;
  }

  // ── Author ─────────────────────────────────────────────────────────────────
  // Flat fields (authorName / authorIcon) take priority over nested author.*
  const authorName = data.authorName || data.author?.name;
  const authorIcon = data.authorIcon || data.author?.iconURL;
  const authorUrl  = data.author?.url;

  if (authorName) {
    const resolvedIcon = authorIcon
      ? resolvePlaceholders(authorIcon, ctx)
      : undefined;

    out.author = {
      name: resolvePlaceholders(authorName, ctx),
      // Guard: Discord rejects non-http strings in iconURL
      iconURL: resolvedIcon && isSafeUrl(resolvedIcon) ? resolvedIcon : undefined,
      url:     authorUrl,
    };
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footerText = data.footerText || data.footer?.text;
  const footerIcon = data.footerIcon || data.footer?.iconURL;

  if (footerText) {
    const resolvedIcon = footerIcon
      ? resolvePlaceholders(footerIcon, ctx)
      : undefined;

    out.footer = {
      text:    resolvePlaceholders(footerText, ctx),
      iconURL: resolvedIcon && isSafeUrl(resolvedIcon) ? resolvedIcon : undefined,
    };
  }

  // ── Thumbnail ──────────────────────────────────────────────────────────────
  if (data.thumbnail) {
    const raw      = typeof data.thumbnail === 'string' ? data.thumbnail : data.thumbnail?.url;
    const resolved = raw ? resolvePlaceholders(raw, ctx) : null;
    // Allow both already-resolved http URLs and unresolved placeholders that
    // DID resolve to a URL.  If a placeholder failed to resolve (still contains
    // a brace), drop it rather than send a broken URL to Discord.
    if (resolved && isSafeUrl(resolved)) {
      out.thumbnail = { url: resolved };
    }
  }

  // ── Image ──────────────────────────────────────────────────────────────────
  if (data.image) {
    const raw      = typeof data.image === 'string' ? data.image : data.image?.url;
    const resolved = raw ? resolvePlaceholders(raw, ctx) : null;
    if (resolved && isSafeUrl(resolved)) {
      out.image = { url: resolved };
    }
  }

  // ── Fields ─────────────────────────────────────────────────────────────────
  if (Array.isArray(data.fields) && data.fields.length > 0) {
    out.fields = data.fields
      .filter(f => f?.name && f?.value)
      .slice(0, 25) // Discord hard limit
      .map(f => ({
        name:   resolvePlaceholders(f.name,  ctx),
        value:  resolvePlaceholders(f.value, ctx),
        inline: !!f.inline,
      }));
  }

  return out;
}

// ─── Preview ──────────────────────────────────────────────────────────────────

/**
 * Renders data and wraps the result in an EmbedBuilder instance.
 * Use this everywhere a live preview is needed (editor, /embed_preview, etc.).
 */
export function createPreview(data = {}, ctx = {}) {
  return new EmbedBuilder(render(data, ctx));
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates raw embed data against Discord API limits.
 * Returns an array of error strings (empty = valid).
 * Call BEFORE saving or sending — does not resolve placeholders.
 */
export function validateEmbed(data = {}) {
  const errors = [];

  if (data.title && data.title.length > 256)
    errors.push('Title must be 256 characters or less.');

  if (data.description && data.description.length > 4096)
    errors.push('Description must be 4096 characters or less.');

  if (data.fields) {
    if (!Array.isArray(data.fields)) {
      errors.push('Fields must be an array.');
    } else {
      if (data.fields.length > 25)
        errors.push('Cannot have more than 25 fields.');

      data.fields.forEach((f, i) => {
        if (!f.name)              errors.push(`Field ${i + 1}: name is required.`);
        if (!f.value)             errors.push(`Field ${i + 1}: value is required.`);
        if (f.name?.length  > 256)  errors.push(`Field ${i + 1} name exceeds 256 chars.`);
        if (f.value?.length > 1024) errors.push(`Field ${i + 1} value exceeds 1024 chars.`);
      });
    }
  }

  const authorName = data.authorName || data.author?.name;
  if (authorName && authorName.length > 256)
    errors.push('Author name must be 256 characters or less.');

  const footerText = data.footerText || data.footer?.text;
  if (footerText && footerText.length > 2048)
    errors.push('Footer text must be 2048 characters or less.');

  // Discord total embed character limit
  const total = [
    data.title,
    data.description,
    authorName,
    footerText,
    ...(data.fields ?? []).flatMap(f => [f.name, f.value]),
  ].reduce((sum, s) => sum + (s?.length ?? 0), 0);

  if (total > 6000)
    errors.push('Total embed character count exceeds the 6000-character Discord limit.');

  return errors;
}

export default { render, createPreview, validateEmbed };