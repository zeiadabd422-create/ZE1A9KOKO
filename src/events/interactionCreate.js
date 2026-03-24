import { buildPages } from '../commands/utility/embedHelp.js';
import GuildConfig from '../modules/config/GuildConfig.js';
import { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

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
        try {
          if (interaction.customId.startsWith('setup_partner_invite:')) {
            const parts = interaction.customId.split(':');
            const embedName = parts[1];
            const roleId = parts[2];
            const inviteLink = interaction.fields.getTextInputValue('invite_link');

            // Validate invite link
            if (!inviteLink.startsWith('https://discord.gg/') && !inviteLink.startsWith('https://discord.com/invite/')) {
              return interaction.reply({ content: '❌ Invalid invite link. Must start with https://discord.gg/ or https://discord.com/invite/', ephemeral: true });
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

            await interaction.reply({
              content: `✅ **Partner Setup Complete!**\n🎯 Embed: **${embedName}**\n🔑 Role: <@&${roleId}>\n🔗 Invite: ${inviteLink}`,
              ephemeral: true,
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
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: '❌ Failed to process your submission.', ephemeral: true });
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