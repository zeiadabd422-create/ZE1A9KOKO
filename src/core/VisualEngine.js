import { EmbedBuilder } from 'discord.js';

function interpolate(text, tokens = {}) {
  if (typeof text !== 'string') return text;
  return text.replace(/\{(user|guild|member_count)\}/g, (_, key) => {
    const value = tokens[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

function buildEmbed(structure = {}, member = null) {
  const guildName = member?.guild?.name || 'Unknown Guild';
  const userDisplay = member?.user ? `<@${member.user.id}>` : 'Unknown User';
  const memberCount = member?.guild?.memberCount ?? 0;

  const tokens = {
    user: userDisplay,
    guild: guildName,
    member_count: memberCount,
  };

  const embed = new EmbedBuilder();

  const title = interpolate(structure.title || '', tokens);
  const description = interpolate(structure.description || '', tokens);

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);

  if (structure.color) {
    try {
      embed.setColor(structure.color);
    } catch (e) {
      // ignore invalid color and continue
    }
  }

  if (structure.url) {
    embed.setURL(interpolate(structure.url, tokens));
  }

  if (structure.footer) {
    const footerText = interpolate(structure.footer.text || '', tokens);
    if (footerText) {
      embed.setFooter({ text: footerText });
    }
  }

  if (structure.thumbnail) {
    embed.setThumbnail(structure.thumbnail);
  }

  if (structure.image) {
    embed.setImage(structure.image);
  }

  if (Array.isArray(structure.fields)) {
    const fields = structure.fields
      .slice(0, 25)
      .map((field) => ({
        name: interpolate(field.name || '', tokens),
        value: interpolate(field.value || '', tokens),
        inline: Boolean(field.inline),
      }))
      .filter((f) => f.name && f.value);

    if (fields.length) embed.setFields(fields);
  }

  return embed;
}

function createFallbackEmbed(member = null) {
  return buildEmbed(
    {
      title: 'Welcome to {guild}',
      description: 'Hello {user}! We now have {member_count} members.',
      color: '#00aaff',
      footer: { text: 'Fallback welcome embed' },
    },
    member
  );
}

export async function render(embedDocOrName = null, member = null) {
  try {
    const structure =
      typeof embedDocOrName === 'object' && embedDocOrName !== null
        ? embedDocOrName.structure || embedDocOrName
        : {};    

    if (Object.keys(structure).length === 0) {
      return createFallbackEmbed(member);
    }

    return buildEmbed(structure, member);
  } catch (error) {
    console.error('[VisualEngine] render failed:', error);
    return createFallbackEmbed(member);
  }
}
