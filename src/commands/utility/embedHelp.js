import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// ─── Colour palette ───────────────────────────────────────────────────────────
const COLOR = {
  user:    0x5865F2,
  server:  0xFEE75C,
  example: 0x2f3136,
};

// ─── Placeholder data (single source of truth) ───────────────────────────────
const PLACEHOLDERS = {
  user: [
    { ph: '{user}',               desc: '@mention — `<@id>`' },
    { ph: '{user.mention}',       desc: 'Alias for `{user}`' },
    { ph: '{user.name}',          desc: 'Plain username' },
    { ph: '{user.tag}',           desc: '`username#0000`  (legacy discriminator format)' },
    { ph: '{user.id}',            desc: 'Numeric Discord user ID' },
    { ph: '{user.discriminator}', desc: '4-digit tag or `0` for new usernames' },
    { ph: '{user.avatar}',        desc: 'Avatar URL  *(PNG 256px — works in Image / Thumbnail / Icon URL fields)*' },
    { ph: '{user.created_at}',    desc: 'Account creation date  *(locale string)*' },
    { ph: '{account_age}',        desc: 'Account age in **days**' },
  ],
  member: [
    { ph: '{joined_at}',     desc: 'Date the member joined this server  *(locale string)*' },
    { ph: '{join_pos}',      desc: 'Join position  *(e.g. 42 — provided by the welcome event)*' },
    { ph: '{user.roles}',    desc: 'Comma-separated list of role names  *(highest first, excludes @everyone)*' },
    { ph: '{user.top_role}', desc: "Name of the member's highest role" },
  ],
  server: [
    { ph: '{server}',            desc: 'Server name' },
    { ph: '{server.name}',       desc: 'Alias for `{server}`' },
    { ph: '{server.id}',         desc: 'Numeric guild ID' },
    { ph: '{server.icon}',       desc: 'Server icon URL  *(PNG 256px — works in Icon URL fields)*' },
    { ph: '{server.owner_id}',   desc: 'User ID of the server owner' },
    { ph: '{server.created_at}', desc: 'Server creation date  *(locale string)*' },
    { ph: '{member_count}',      desc: 'Total member count' },
    { ph: '{boost_count}',       desc: 'Number of active boosts' },
    { ph: '{boost_level}',       desc: 'Boost tier  `0` `1` `2` `3`' },
  ],
  channel: [
    { ph: '{channel.name}',    desc: 'Channel name  *(no # prefix)*' },
    { ph: '{channel.id}',      desc: 'Numeric channel ID' },
    { ph: '{channel.mention}', desc: 'Clickable channel mention  `<#id>`' },
  ],
  special: [
    { ph: '{timestamp}',    desc: 'Current time as a **live** Discord relative timestamp  `<t:unix:R>`' },
    { ph: '{choose:A|B|C}', desc: 'Randomly picks one option — add as many pipe-separated options as you want' },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(list) {
  return list.map(({ ph, desc }) => `\`${ph}\`\n↳ ${desc}`).join('\n\n');
}

function pageFooter(interaction, page, total) {
  return {
    text: `Page ${page}/${total}  •  /embed manager to open the editor`,
    iconURL: interaction.guild?.iconURL({ extension: 'png', size: 64 }) ?? undefined,
  };
}

// ─── Page builders ────────────────────────────────────────────────────────────

export function buildPages(interaction) {
  // ── Page 1: Basic Placeholders (User/Server) ───────────────────────────────
  const p1 = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📖 Basic Placeholders (User/Server)')
    .setDescription(
      'Placeholders are replaced with **live data** when an embed is sent or previewed.\n' +
      'They work in **every** text field, URL field, author name, footer text, ' +
      'image URL, thumbnail URL, and inside field names & values.\n\u200b'
    )
    .addFields(
      { name: '👤 User',   value: fmt(PLACEHOLDERS.user),   inline: false },
      { name: '\u200b',    value: '\u200b',                  inline: false },
      { name: '🏠 Server', value: fmt(PLACEHOLDERS.server), inline: false }
    )
    .setFooter(pageFooter(interaction, 1, 3));

  // ── Page 2: Advanced Data (Join Position, Account Age, Timestamps) ───────
  const p2 = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📖 Advanced Data (Join Position, Account Age, Timestamps)')
    .addFields(
      { name: '🎖️ Member', value: fmt(PLACEHOLDERS.member), inline: false },
      { name: '\u200b',    value: '\u200b',                  inline: false },
      { name: '⏰ Timestamps', value: fmt([{ ph: '{timestamp}', desc: 'Current time as a **live** Discord relative timestamp  `<t:unix:R>`' }]), inline: false }
    )
    .setFooter(pageFooter(interaction, 2, 3));

  // ── Page 3: Dynamic Logic (Random Choice {choose}) ───────────────────────
  const p3 = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📖 Dynamic Logic (Random Choice {choose})')
    .setDescription('Copy-paste ready examples with dynamic placeholders.\n\u200b')
    .addFields(
      {
        name:  '🎲 Random Choice',
        value: fmt([{ ph: '{choose:A|B|C}', desc: 'Randomly picks one option — add as many pipe-separated options as you want' }]),
        inline: false,
      },
      {
        name:  '📝 Example Description',
        value: '```\n{choose:Hey|Hello|Welcome back}, {user}!\nYou are member #{member_count} and your account is {account_age} days old.\n```',
        inline: false,
      }
    )
    .setFooter(pageFooter(interaction, 3, 3));

  return [p1, p2, p3];
}

// ─── Command ──────────────────────────────────────────────────────────────────

export default {
  data: new SlashCommandBuilder()
    .setName('embed_help')
    .setDescription('Shows every placeholder supported by Embed Engine V3.'),

  async execute(interaction) {
    const pages = buildPages(interaction);
    const currentPage = 0;
    const components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`embed_help_prev_${currentPage}`).setLabel('⬅️ Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`embed_help_next_${currentPage}`).setLabel('Next ➡️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('embed_help_close').setLabel('❌ Close').setStyle(ButtonStyle.Danger)
      )
    ];
    return interaction.reply({
      embeds: [pages[currentPage]],
      components,
      ephemeral: true,
    });
  },
};