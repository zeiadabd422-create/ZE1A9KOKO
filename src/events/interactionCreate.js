import { buildPages } from '../commands/utility/embedHelp.js';
import GuildConfig from '../modules/config/GuildConfig.js';
import { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      const { client } = interaction;

      // ── Autocomplete ────────────────────────────────────────────────────────
      if (interaction.isAutocomplete?.()) {
        const command = client.commands.get(interaction.commandName);
        if (command?.autocomplete) {
          try {
            await command.autocomplete(interaction);
          } catch (err) {
            console.error(`[Autocomplete: ${interaction.commandName}] Error:`, err);
            await interaction.respond([]).catch(() => {});
          }
          return;
        }

        // Fallback for embed command if no command-level autocomplete is defined
        if (interaction.commandName === 'embed' && client.embedVault) {
          const focused = interaction.options.getFocused(true);
          if (focused.name === 'name') {
            const all = await client.embedVault.list(interaction.guildId).catch(() => []);
            const filtered = all
              .filter(item => item.name.toLowerCase().includes(String(focused.value).toLowerCase()))
              .slice(0, 25)
              .map(item => ({ name: item.name, value: item.name }));
            return interaction.respond(filtered);
          }
        }
        return;
      }

      // ── Slash Commands ──────────────────────────────────────────────────────
      if (interaction.isChatInputCommand()) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ ephemeral: true }).catch(() => {});
        }
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
          await command.execute(interaction);
        } catch (cmdErr) {
          console.error(`[Command: ${interaction.commandName}] Execution error:`, cmdErr);
          try {
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: '❌ An error occurred executing the command.', ephemeral: true });
            }
          } catch (replyErr) {
            console.error('[Slash Command] Failed to send error reply:', replyErr);
          }
        }
        return;
      }

      // ── Buttons ─────────────────────────────────────────────────────────────
      if (interaction.isButton()) {
        if (!interaction.customId.startsWith('embed_help_') && !interaction.deferred && !interaction.replied) {
          await interaction.deferUpdate().catch(() => {});
        }
        try {
          if (interaction.customId.startsWith('welcome_') && client.welcome?.handleButtonInteraction) {
            await client.welcome.handleButtonInteraction(interaction);
            return;
          }
          if (interaction.customId.startsWith('embedvault_') && client.embedVault?.handleButtonInteraction) {
            await client.embedVault.handleButtonInteraction(interaction);
            return;
          }
          if (interaction.customId.startsWith('embed_help_')) {
            const parts = interaction.customId.split('_');
            const action = parts[2];
            const currentPage = parseInt(parts[3] || 0);
            const pages = buildPages(interaction); // Need to import or define
            // Since it's ephemeral, and to keep simple, just show a message
            let newPage = currentPage;
            if (action === 'next') newPage = (currentPage + 1) % pages.length;
            else if (action === 'prev') newPage = (currentPage - 1 + pages.length) % pages.length;
            else if (action === 'close') {
              await interaction.update({ content: 'Help closed.', embeds: [], components: [] });
              return;
            }
            const components = [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`embed_help_prev_${newPage}`).setLabel('⬅️ Previous').setStyle(ButtonStyle.Secondary).setDisabled(newPage === 0),
                new ButtonBuilder().setCustomId(`embed_help_next_${newPage}`).setLabel('Next ➡️').setStyle(ButtonStyle.Secondary).setDisabled(newPage === pages.length - 1),
                new ButtonBuilder().setCustomId('embed_help_close').setLabel('❌ Close').setStyle(ButtonStyle.Danger)
              )
            ];
            await interaction.update({ embeds: [pages[newPage]], components });
            return;
          }
          if (interaction.customId.startsWith('system_tab_')) {
            await handleSystemTab(interaction);
            return;
          }
          if (interaction.customId.startsWith('system_partners_')) {
            await handleSystemPartnersPagination(interaction);
            return;
          }
          if (client.gateway?.handleInteraction) {
            await client.gateway.handleInteraction(interaction);
          }
        } catch (err) {
          console.error('[Button Interaction] Error:', err);
          try {
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: '❌ An error occurred processing your interaction.', ephemeral: true });
            }
          } catch (replyErr) {
            console.error('[Button] Failed to send error reply:', replyErr);
          }
        }

        // Catch-all in case no handler responded for a button interaction
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Unable to process button interaction at this time.', ephemeral: true });
        }

        return;
      }

      // ── Modal Submissions ────────────────────────────────────────────────────
      if (interaction.isModalSubmit()) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ ephemeral: true }).catch(() => {});
        }
        try {
          if (interaction.customId.startsWith('setup_partner_invite:')) {
            const parts = interaction.customId.split(':');
            const embedName = parts[1];
            const roleId = parts[2];
            const inviteLink = interaction.fields.getTextInputValue('invite_link');

            // Validate invite link
            if (!inviteLink.startsWith('https://discord.gg/') && !inviteLink.startsWith('https://discord.com/invite/')) {
              return interaction.editReply({ content: '❌ Invalid invite link. Must start with https://discord.gg/ or https://discord.com/invite/' });
            }

            // Save to GuildConfig partners array
            const partnerEntry = {
              embedName,
              roleId,
              inviteLink,
            };

            await GuildConfig.findOneAndUpdate(
              { guildId: interaction.guildId },
              { $push: { partners: partnerEntry } },
              { upsert: true, new: true }
            );

            await interaction.editReply({
              content: `✅ **Partner Setup Complete!**\n🎯 Embed: **${embedName}**\n🔑 Role: <@&${roleId}>\n🔗 Invite: ${inviteLink}`,
            });
            return;
          }
          if (interaction.customId.startsWith('welcome_modal_') && client.welcome?.handleModalSubmit) {
            await client.welcome.handleModalSubmit(interaction);
            return;
          }
          if (interaction.customId.startsWith('embedvault_') && client.embedVault?.handleModalSubmit) {
            await client.embedVault.handleModalSubmit(interaction);
            return;
          }
        } catch (err) {
          console.error('[Modal Interaction] Error:', err);
          try {
            if (interaction.isRepliable()) {
              if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ Failed to process your submission.' }).catch(() => {});
              } else {
                await interaction.reply({ content: '❌ Failed to process your submission.', ephemeral: true });
              }
            }
          } catch (replyErr) {
            console.error('[Modal] Failed to send error reply:', replyErr);
          }
        }

        // Catch-all in case no modal handler responded
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Unable to process modal submission at this time.', ephemeral: true });
        }

        return;
      }

      // ── Select Menus ─────────────────────────────────────────────────────────
      // FIX #5 – isSelectMenu() was removed in discord.js v14; use isAnySelectMenu()
      if (interaction.isAnySelectMenu()) {
        try {
          if (interaction.customId.startsWith('setup_embed_select:')) {
            const type = interaction.customId.split(':')[1];
            const embedName = interaction.values[0];

            // Save to GuildConfig
            const updatePath = `${type}.embedName`;
            await GuildConfig.findOneAndUpdate(
              { guildId: interaction.guildId },
              { $set: { [updatePath]: embedName } },
              { upsert: true, new: true }
            );

            await interaction.update({
              content: `✅ **${type.charAt(0).toUpperCase() + type.slice(1)} Setup Complete!**\n🎯 Embed: **${embedName}**`,
              components: [],
            });
            return;
          }
          if (interaction.customId === 'setup_partner_embed_select') {
            const embedName = interaction.values[0];

            // Now show role select
            const roles = interaction.guild.roles.cache
              .filter(role => role.name !== '@everyone' && !role.managed)
              .map(role => ({
                label: role.name.length > 100 ? role.name.substring(0, 97) + '...' : role.name,
                value: role.id,
              }))
              .slice(0, 25); // Discord limit

            if (roles.length === 0) {
              return interaction.update({ content: '❌ No roles available to select.', components: [] });
            }

            const roleSelect = new StringSelectMenuBuilder()
              .setCustomId(`setup_partner_role_select:${embedName}`)
              .setPlaceholder('Choose the partner role')
              .addOptions(roles);

            const row = new ActionRowBuilder().addComponents(roleSelect);

            await interaction.update({
              content: `🎯 **Partner Setup - Step 1 Complete!**\n🎯 Embed: **${embedName}**\n\n**Step 2:** Select the role to assign to partners:`,
              components: [row],
            });
            return;
          }
          if (interaction.customId.startsWith('setup_partner_role_select:')) {
            const embedName = interaction.customId.split(':')[1];
            const roleId = interaction.values[0];

            // Now show modal for invite link
            const modal = new ModalBuilder()
              .setCustomId(`setup_partner_invite:${embedName}:${roleId}`)
              .setTitle('Partner Invite Link');

            const inviteInput = new TextInputBuilder()
              .setCustomId('invite_link')
              .setLabel('Invite Link')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('https://discord.gg/...')
              .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(inviteInput);
            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);
            return;
          }
          if (interaction.customId.startsWith('embedvault_') && client.embedVault?.handleSelectMenu) {
            await client.embedVault.handleSelectMenu(interaction);
            return;
          }
          if (client.gateway?.handleInteraction) {
            await client.gateway.handleInteraction(interaction);
          }
        } catch (err) {
          console.error('[Select Menu] Error:', err);
          try {
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
            }
          } catch (replyErr) {
            console.error('[Select Menu] Failed to send error reply:', replyErr);
          }
        }
      }
    } catch (err) {
      console.error('[interactionCreate] Handler failed:', err);
      try {
        if (interaction?.isRepliable?.() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Internal error.', ephemeral: true });
        }
      } catch (e) {
        console.error('[interactionCreate] Failed to send final error reply:', e);
      }
    }
  },
};

// ── System Dashboard Handlers ──────────────────────────────────────────────
async function handleSystemTab(interaction) {
  await interaction.deferUpdate();

  const { client, guild } = interaction;
  const config = await GuildConfig.findOne({ guildId: guild.id });

  let embed;
  let components;

  if (interaction.customId === 'system_tab_events') {
    embed = await createEventsMapEmbed(client, config);
    components = createSystemTabButtons('events');
  } else if (interaction.customId === 'system_tab_partners') {
    embed = await createPartnersEmbed(client, config, 0);
    components = createSystemTabButtons('partners', config?.partners?.length || 0);
  } else if (interaction.customId === 'system_tab_permissions') {
    embed = await createPermissionsEmbed(client, guild);
    components = createSystemTabButtons('permissions');
  }

  await interaction.editReply({ embeds: [embed], components });
}

async function handleSystemPartnersPagination(interaction) {
  await interaction.deferUpdate();

  const { client, guild } = interaction;
  const config = await GuildConfig.findOne({ guildId: guild.id });

  const parts = interaction.customId.split('_');
  const action = parts[2]; // prev or next
  const currentPage = parseInt(parts[3] || 0);

  const partners = config?.partners || [];
  const itemsPerPage = 5;
  const totalPages = Math.ceil(partners.length / itemsPerPage);

  let newPage = currentPage;
  if (action === 'prev') {
    newPage = Math.max(0, currentPage - 1);
  } else if (action === 'next') {
    newPage = Math.min(totalPages - 1, currentPage + 1);
  }

  const embed = await createPartnersEmbed(client, config, newPage);
  const components = createSystemTabButtons('partners', partners.length, newPage);

  await interaction.editReply({ embeds: [embed], components });
}

function createSystemTabButtons(activeTab, partnersCount = 0, partnersPage = 0) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('system_tab_events')
      .setLabel('خرائط الأحداث')
      .setStyle(activeTab === 'events' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeTab === 'events'),
    new ButtonBuilder()
      .setCustomId('system_tab_partners')
      .setLabel('شبكة الشركاء')
      .setStyle(activeTab === 'partners' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeTab === 'partners'),
    new ButtonBuilder()
      .setCustomId('system_tab_permissions')
      .setLabel('فحص الصلاحيات')
      .setStyle(activeTab === 'permissions' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeTab === 'permissions')
  );

  if (activeTab === 'partners' && partnersCount > 5) {
    const itemsPerPage = 5;
    const totalPages = Math.ceil(partnersCount / itemsPerPage);
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`system_partners_prev_${partnersPage}`)
        .setLabel('⬅️ السابق')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(partnersPage === 0),
      new ButtonBuilder()
        .setCustomId(`system_partners_next_${partnersPage}`)
        .setLabel('التالي ➡️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(partnersPage >= totalPages - 1)
    );
    return [row1, row2];
  }

  return [row1];
}

// Import the embed creation functions from system.js
async function createEventsMapEmbed(client, config) {
  const { EmbedBuilder } = await import('discord.js');
  const embed = new EmbedBuilder()
    .setTitle('🗺️ خرائط الأحداث الإمبراطورية')
    .setColor(0xDAA520)
    .setDescription('حالة الإيمبد المرتبطة بالأحداث الرئيسية')
    .setFooter({ text: 'نظام الرادار الإمبراطوري • Imperial Radar System' });

  // Welcome
  const welcomeEmbed = config?.welcome?.embedName || 'غير محدد';
  const welcomeRole = config?.welcome?.autoRoleId ? `<@&${config.welcome.autoRoleId}>` : 'لا يوجد';
  embed.addFields({
    name: '👋 رسالة الترحيب',
    value: `**إمبد:** ${welcomeEmbed}\n**دور تلقائي:** ${welcomeRole}`,
    inline: true,
  });

  // Goodbye
  const goodbyeEmbed = config?.goodbye?.embedName || 'غير محدد';
  embed.addFields({
    name: '👋 رسالة الوداع',
    value: `**إمبد:** ${goodbyeEmbed}`,
    inline: true,
  });

  // Boost
  const boostEmbed = config?.boost?.embedName || 'غير محدد';
  embed.addFields({
    name: '🚀 تعزيز الخادم',
    value: `**إمبد:** ${boostEmbed}`,
    inline: true,
  });

  return embed;
}

async function createPartnersEmbed(client, config, page = 0) {
  const { EmbedBuilder } = await import('discord.js');
  const embed = new EmbedBuilder()
    .setTitle('🤝 شبكة الشركاء الإمبراطورية')
    .setColor(0xDAA520)
    .setDescription('روابط الدعوة المرتبطة بالإيمبد والأدوار')
    .setFooter({ text: 'نظام الرادار الإمبراطوري • Imperial Radar System' });

  const partners = config?.partners || [];
  const itemsPerPage = 5;
  const totalPages = Math.ceil(partners.length / itemsPerPage);
  const startIdx = page * itemsPerPage;
  const pagePartners = partners.slice(startIdx, startIdx + itemsPerPage);

  if (pagePartners.length === 0) {
    embed.setDescription('لا توجد شراكات محددة');
  } else {
    pagePartners.forEach((partner, index) => {
      const globalIndex = startIdx + index + 1;
      const inviteLink = partner.inviteLink || 'غير محدد';
      const embedName = partner.embedName || 'غير محدد';
      const role = partner.roleId ? `<@&${partner.roleId}>` : 'لا يوجد';
      embed.addFields({
        name: `🤝 الشريك ${globalIndex}`,
        value: `**رابط الدعوة:** ${inviteLink}\n**إمبد مرتبط:** ${embedName}\n**دور معطى:** ${role}`,
        inline: false,
      });
    });

    embed.setFooter({ text: `الصفحة ${page + 1}/${totalPages} • نظام الرادار الإمبراطوري` });
  }

  return embed;
}

async function createPermissionsEmbed(client, guild) {
  const { EmbedBuilder } = await import('discord.js');
  const embed = new EmbedBuilder()
    .setTitle('🔍 فحص صلاحيات النظام')
    .setColor(0xDAA520)
    .setDescription('تشخيص صلاحيات البوت في الخادم')
    .setFooter({ text: 'نظام الرادار الإمبراطوري • Imperial Radar System' });

  const botMember = guild.members.me;
  const permissions = botMember.permissions.toArray();

  const keyPermissions = [
    'Administrator',
    'ManageGuild',
    'ManageRoles',
    'ManageChannels',
    'KickMembers',
    'BanMembers',
    'ViewAuditLog',
    'SendMessages',
    'EmbedLinks',
    'AttachFiles',
    'UseExternalEmojis',
    'AddReactions',
  ];

  const permStatus = keyPermissions.map(perm => {
    const has = permissions.includes(perm);
    return `${has ? '✅' : '❌'} ${perm}`;
  }).join('\n');

  embed.addFields({
    name: '🔑 الصلاحيات الرئيسية',
    value: permStatus,
    inline: false,
  });

  // Check channels
  const channels = guild.channels.cache;
  const textChannels = channels.filter(c => c.isTextBased());
  const accessibleChannels = textChannels.filter(c => c.permissionsFor(botMember).has('SendMessages'));

  embed.addFields({
    name: '📢 قنوات النص',
    value: `إجمالي: ${textChannels.size}\nيمكن الكتابة: ${accessibleChannels.size}`,
    inline: true,
  });

  return embed;
}