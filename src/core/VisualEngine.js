import { EmbedBuilder } from 'discord.js';
import EmbedVault from '../models/EmbedVault.js';
import { render as legacyRender, createPreview as legacyCreatePreview } from './embedEngine.js';

const STANDARD_TEMPLATE = {
  title: 'Standard Professional Template',
  description: 'This is a fallback embed from Guardian VisualEngine when the requested design is missing.',
  color: '#00aaff',
  footer: {
    text: 'Guardian UI Engine · Embeds 2.0',
  },
};

const BLUEPRINTS = {
  Gaming: {
    tier: 'Partner',
    isBlueprint: true,
    dynamicAssets: true,
    structure: {
      title: '🎮 Welcome to {guild_name}!',
      description: 'Howdy {user}, good luck staying alive. Server population: {member_count}.',
      color: '#8A2BE2',
      footer: { text: '{guild_name} • Gaming mode' },
      thumbnail: 'https://i.imgur.com/U3Cx0x3.png',
      image: 'https://i.imgur.com/xP7cVVX.png',
    },
  },
  Official: {
    tier: 'VIP',
    isBlueprint: true,
    dynamicAssets: false,
    structure: {
      title: '📌 Official Server Announcement',
      description: 'Hello {user_tag}, you are now in {guild_name}.',
      color: '#1e90ff',
      footer: { text: 'Official style for partners and VIPs' },
      thumbnail: 'https://i.imgur.com/v39KxX4.png',
    },
  },
  Minimalist: {
    tier: 'Common',
    isBlueprint: true,
    dynamicAssets: false,
    structure: {
      title: '✨ Welcome, {user}!',
      description: 'You joined {guild_name} ({member_count} members).',
      color: '#ffffff',
      footer: { text: '#Minimalist build' },
    },
  },
};

function safeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /^(https?:)?\/\//.test(url);
}

function resolveColor(raw) {
  if (!raw) return 0x2f3136;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const cleaned = raw.trim();
    if (cleaned.startsWith('#')) {
      const parsed = parseInt(cleaned.slice(1), 16);
      return Number.isNaN(parsed) ? 0x2f3136 : parsed;
    }
    const parsed = parseInt(cleaned, 16);
    return Number.isNaN(parsed) ? 0x2f3136 : parsed;
  }
  return 0x2f3136;
}

function buildPlaceholderContext(member, extra = {}, embedDoc = {}) {
  const result = { ...extra };

  if (member) {
    result.user = `<@${member.id}>`;
    result.user_tag = member.user?.tag || member.user?.username || 'Unknown#0000';
    result.guild_name = member.guild?.name || '';
    result.member_count = String(member.guild?.memberCount || '0');
    result['member_count'] = result.member_count;
    result.guild_name = result.guild_name;
  }

  if (embedDoc?.tier) {
    result.partner_tier = embedDoc.tier;
  }

  // Allow explicit override
  result.partner_tier = result.partner_tier || 'Common';
  result.risk_level = result.risk_level || extra.risk_level || 'low';

  return result;
}

function expandText(str, context = {}) {
  if (!str || typeof str !== 'string') return str;
  // preserve legacy token {guild_name}, etc.
  const safeContext = { ...context };

  // fallback synonyms for legacy placeholder names
  if (context.server?.name) safeContext.guild_name = safeContext.guild_name || context.server.name;

  return str.replace(/\{([^{}]+)\}/g, (full, key) => {
    const lowerKey = key.toLowerCase();
    const unqualified = key;
    if (Object.prototype.hasOwnProperty.call(safeContext, unqualified)) {
      return safeContext[unqualified] ?? '';
    }
    if (Object.prototype.hasOwnProperty.call(safeContext, lowerKey)) {
      return safeContext[lowerKey] ?? '';
    }
    return full; // keep unknown placeholder for potential secondary engine
  });
}

function normalizeStructure(structure = {}, context = {}) {
  const normalized = {
    title: expandText(structure.title || '', context),
    description: expandText(structure.description || '', context),
    color: resolveColor(structure.color || '#2f3136'),
    url: structure.url ? expandText(structure.url, context) : undefined,
    timestamp: structure.timestamp || false,
    author: {},
    footer: {},
    thumbnail: undefined,
    image: undefined,
    fields: [],
  };

  if (structure.author) {
    normalized.author.name = expandText(structure.author.name || '', context);
    if (structure.author.iconURL && safeUrl(expandText(structure.author.iconURL, context))) {
      normalized.author.iconURL = expandText(structure.author.iconURL, context);
    }
    if (structure.author.url) {
      normalized.author.url = expandText(structure.author.url, context);
    }
  }

  if (structure.footer) {
    normalized.footer.text = expandText(structure.footer.text || '', context);
    if (structure.footer.iconURL && safeUrl(expandText(structure.footer.iconURL, context))) {
      normalized.footer.iconURL = expandText(structure.footer.iconURL, context);
    }
  }

  if (structure.thumbnail && safeUrl(expandText(structure.thumbnail, context))) {
    normalized.thumbnail = expandText(structure.thumbnail, context);
  }

  if (structure.image && safeUrl(expandText(structure.image, context))) {
    normalized.image = expandText(structure.image, context);
  }

  if (Array.isArray(structure.fields)) {
    normalized.fields = structure.fields.slice(0, 25).map((field) => ({
      name: expandText(field.name || '', context),
      value: expandText(field.value || '', context),
      inline: Boolean(field.inline),
    })).filter((f) => f.name && f.value);
  }

  return normalized;
}

function createEmbedOutput(rawData) {
  const embed = new EmbedBuilder();
  if (rawData.title) embed.setTitle(rawData.title);
  if (rawData.description) embed.setDescription(rawData.description);
  if (rawData.url) embed.setURL(rawData.url);
  if (rawData.color) embed.setColor(rawData.color);
  if (rawData.timestamp) embed.setTimestamp(rawData.timestamp === true ? new Date() : rawData.timestamp);

  if (rawData.author && rawData.author.name) {
    embed.setAuthor({
      name: rawData.author.name,
      iconURL: rawData.author.iconURL,
      url: rawData.author.url,
    });
  }

  if (rawData.footer && rawData.footer.text) {
    embed.setFooter({
      text: rawData.footer.text,
      iconURL: rawData.footer.iconURL,
    });
  }

  if (rawData.thumbnail) {
    embed.setThumbnail(rawData.thumbnail);
  }

  if (rawData.image) {
    embed.setImage(rawData.image);
  }

  if (Array.isArray(rawData.fields) && rawData.fields.length) {
    embed.setFields(rawData.fields);
  }

  return embed;
}

function getDynamicBannerUrl(name, guildId) {
  const text = encodeURIComponent(name || 'Guardian');
  return `https://dummyimage.com/1024x256/222/fff.png&text=${text}+${guildId || ''}`;
}

function buildFallbackEmbed(member, context) {
  const data = {
    ...STANDARD_TEMPLATE,
    title: STANDARD_TEMPLATE.title,
    description: STANDARD_TEMPLATE.description,
    color: resolveColor('#00aaff'),
    footer: {
      text: STANDARD_TEMPLATE.footer.text,
    },
  };

  const output = createEmbedOutput(normalizeStructure(data, buildPlaceholderContext(member, context)));
  return output;
}

export async function render(embedName, member = null, context = {}) {
  if (!embedName || typeof embedName !== 'string') {
    return buildFallbackEmbed(member, context);
  }

  let embedDoc = null;
  const name = embedName.trim();

  try {
    const guildId = member?.guild?.id || context.guildId || null;
    if (!guildId) {
      return buildFallbackEmbed(member, context);
    }

    embedDoc = await EmbedVault.findOne({ guildId, name }).lean();
    if (!embedDoc && BLUEPRINTS[name]) {
      embedDoc = { ...BLUEPRINTS[name], name, guildId, isBlueprint: true };
    }

    if (!embedDoc) {
      return buildFallbackEmbed(member, context);
    }

    const source = embedDoc.structure && Object.keys(embedDoc.structure).length
      ? embedDoc.structure
      : (embedDoc.data || {});

    const filledContext = buildPlaceholderContext(member, context, embedDoc);

    // Add common optional placeholders for compatibility.
    if (member?.guild) {
      filledContext.server = { name: member.guild.name };
    }

    // Ensure main tokens are in the context
    if (!filledContext.guild_name && member?.guild?.name) {
      filledContext.guild_name = member.guild.name;
    }

    if (!filledContext.user_tag && member?.user?.tag) {
      filledContext.user_tag = member.user.tag;
    }

    const resolvedData = normalizeStructure(source, filledContext);

    // Incorporate dynamic assets (placeholder Canvas flow)
    if (embedDoc.dynamicAssets) {
      const bannerUrl = getDynamicBannerUrl(name, embedDoc.guildId);
      if (safeUrl(bannerUrl)) {
        resolvedData.image = bannerUrl;
      }
    }

    // Client may provide explicit override in context
    if (context.overrideColor) {
      resolvedData.color = resolveColor(context.overrideColor);
    }

    const output = createEmbedOutput(resolvedData);

    // Ensure at least title + description exist; fallback if empty
    if (!output.data.title && !output.data.description) {
      return buildFallbackEmbed(member, context);
    }

    return output;
  } catch (err) {
    console.error('[VisualEngine] render failed:', err);
    return buildFallbackEmbed(member, context);
  }
}

export function getBlueprints() {
  return Object.keys(BLUEPRINTS);
}

export async function applyBlueprint(guildId, name, blueprintKey) {
  const blueprint = BLUEPRINTS[blueprintKey];

  if (!blueprint) throw new Error(`Unknown blueprint ${blueprintKey}`);

  return EmbedVault.findOneAndUpdate(
    { guildId, name },
    {
      guildId,
      name,
      tier: blueprint.tier,
      structure: blueprint.structure,
      isBlueprint: true,
      dynamicAssets: blueprint.dynamicAssets,
      type: 'Manual',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export default { render, getBlueprints, applyBlueprint };
