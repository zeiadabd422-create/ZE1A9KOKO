import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

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

function buildPages(interaction) {
  // ── Page 1: intro + User + Member ─────────────────────────────────────────
  const p1 = new EmbedBuilder()
    .setColor(COLOR.user)
    .setTitle('📖 Embed Vault — Placeholder Reference')
    .setDescription(
      'Placeholders are replaced with **live data** when an embed is sent or previewed.\n' +
      'They work in **every** text field, URL field, author name, footer text, ' +
      'image URL, thumbnail URL, and inside field names & values.\n\u200b'
    )
    .addFields(
      { name: '👤 User',   value: fmt(PLACEHOLDERS.user),   inline: false },
      { name: '\u200b',    value: '\u200b',                  inline: false },
      { name: '🎖️ Member', value: fmt(PLACEHOLDERS.member), inline: false }
    )
    .setFooter(pageFooter(interaction, 1, 3));

  // ── Page 2: Server + Channel + Special ────────────────────────────────────
  const p2 = new EmbedBuilder()
    .setColor(COLOR.server)
    .setTitle('📖 Placeholder Reference — Server, Channel & Special')
    .addFields(
      { name: '🏠 Server',   value: fmt(PLACEHOLDERS.server),  inline: false },
      { name: '\u200b',      value: '\u200b',                   inline: false },
      { name: '💬 Channel',  value: fmt(PLACEHOLDERS.channel), inline: false },
      { name: '\u200b',      value: '\u200b',                   inline: false },
      { name: '✨ Special',  value: fmt(PLACEHOLDERS.special), inline: false }
    )
    .setFooter(pageFooter(interaction, 2, 3));

  // ── Page 3: Copy-paste examples ───────────────────────────────────────────
  const p3 = new EmbedBuilder()
    .setColor(COLOR.example)
    .setTitle('📖 Placeholder Reference — Examples')
    .setDescription('Copy-paste ready. Every line below works in any field of the embed editor.\n\u200b')
    .addFields(
      {
        name:  '👋 Welcome title',
        value: '```\nWelcome to {server}, {user.name}!\n```',
        inline: false,
      },
      {
        name:  '📝 Description with random greeting',
        value: '```\n{choose:Hey|Hello|Welcome back}, {user}!\nYou are member #{member_count} and your account is {account_age} days old.\n```',
        inline: false,
      },
      {
        name:  '👤 Author line with live avatar',
        value: '**Name →** `{user.name}`\n**Icon URL →** `{user.avatar}`',
        inline: false,
      },
      {
        name:  '🏠 Footer with server icon',
        value: '**Text →** `{server} • {member_count} members`\n**Icon URL →** `{server.icon}`',
        inline: false,
      },
      {
        name:  '🖼️ Image showing the user\'s avatar',
        value: '**Image URL →** `{user.avatar}`',
        inline: false,
      },
      {
        name:  '⏱️ Live relative timestamp',
        value: '```\nYou joined {timestamp} — welcome!\n```\n*Renders as a live "X minutes ago" clock in Discord.*',
        inline: false,
      },
      {
        name:  '🎲 Fully random pick',
        value: "```\n{choose:You're amazing!|Glad you're here!|The legend arrives.}\n```",
        inline: false,
      },
      {
        name:  '📋 Field with join date',
        value: '**Field Name →** `Joined`\n**Field Value →** `{joined_at}  (position #{join_pos})`',
        inline: false,
      },
      {
        name:  '🌐 Channel mention in description',
        value: '```\nHead over to {channel.mention} to get started!\n```',
        inline: false,
      },
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
    return interaction.reply({
      embeds: buildPages(interaction),
      ephemeral: true,
    });
  },
};