import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';

/**
 * Manages embed selection UI with professional Select Menu interface
 * Select Menu Revolution: Single dropdown instead of button grid
 * Compliant with Discord limits (1 menu row + 1 action row = 2 rows total)
 */
export default function EmbedManagerModule() {
  return {
    embedVaultModule: null, // Will be injected by index.js

    /**
     * Display professional Select Menu dashboard for embed management
     */
    async displayManager(interaction, page = 0) {
      try {
        if (!this.embedVaultModule) {
          return interaction.reply({ content: '❌ خزنة الإمبد لم تُهيّأ.', ephemeral: true });
        }

        const embeds = await this.embedVaultModule.list(interaction.guildId);

        if (!embeds || embeds.length === 0) {
          return interaction.reply({
            content: '📦 خزنة الإمبد فارغة\nأنشئ إمبدك الأول للبدء!',
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('embedvault_create')
                  .setLabel('➕ إنشاء أول إمبد')
                  .setStyle(ButtonStyle.Primary)
              ),
            ],
            ephemeral: true,
          });
        }

        // Pagination settings - show all embeds up to 25 (Discord select menu limit)
        const itemsPerPage = 25;
        const totalPages = Math.ceil(embeds.length / itemsPerPage);
        const startIdx = page * itemsPerPage;
        const pageEmbeds = embeds.slice(startIdx, startIdx + itemsPerPage);

        // Build Select Menu with all embeds on current page
        const selectOptions = pageEmbeds.map(embed => ({
          label: embed.name.length > 100 ? embed.name.substring(0, 97) + '…' : embed.name,
          value: embed.name,
          description: embed.linkedInviteCode ? `🔗 مرتبط برمز دعوة • Linked to invite` : `📦 إمبد عام • Generic embed`,
          emoji: embed.linkedInviteCode ? '🔗' : '📦',
        }));

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('embedvault_select')
          .setPlaceholder('اختر الإيمبد الذي ترغب في إدارته....')
          .addOptions(selectOptions);

        const menuRow = new ActionRowBuilder().addComponents(selectMenu);

        // Dashboard header embed with professional colors
        const dashboardEmbed = new EmbedBuilder()
          .setColor(0xDAA520) // Professional gold color
          .setTitle('📦 لوحة تحكم الخزنة الإمبراطورية')
          .setDescription(`**${embeds.length}** إمبد في الخزنة\n**الصفحة ${page + 1}/${totalPages}** — استخدم القوائم أدناه`)
          .setFooter({ text: '⚙️ نظام إدارة الإمبد المتقدم • Advanced Embed Management System' });

        // Action select menu
        const actionOptions = [
          {
            label: '➕ إنشاء إمبد جديد',
            value: 'action_create',
            description: 'Create a new embed from scratch',
          },
          {
            label: '📥 استيراد JSON',
            value: 'action_import',
            description: 'Import embed from JSON data',
          },
        ];

        if (page > 0) {
          actionOptions.push({
            label: '⬅️ الصفحة السابقة',
            value: `action_prev:${page}`,
            description: 'Go to previous page',
          });
        }

        if (page < totalPages - 1) {
          actionOptions.push({
            label: 'الصفحة التالية ➡️',
            value: `action_next:${page}`,
            description: 'Go to next page',
          });
        }

        const actionMenu = new StringSelectMenuBuilder()
          .setCustomId('embedvault_action')
          .setPlaceholder('اختر الإجراء....')
          .addOptions(actionOptions);

        const actionRow = new ActionRowBuilder().addComponents(actionMenu);

        return interaction.reply({
          embeds: [dashboardEmbed],
          components: [actionRow, menuRow],
          ephemeral: true,
        });
      } catch (err) {
        console.error('[EmbedManager.displayManager] Error:', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ فشل تحميل لوحة التحكم.',
            ephemeral: true,
          });
        }
      }
    },

    /**
     * Handle embed selection from Select Menu
     */
    async handleSelectEmbed(interaction, embedName) {
      try {
        await interaction.deferUpdate();
        
        if (!this.embedVaultModule) {
          return await interaction.editReply({ content: '❌ خزنة الإمبد لم تُهيّأ.', components: [] });
        }

        const embedDoc = await this.embedVaultModule.getByName(interaction.guildId, embedName);
        if (!embedDoc) {
          return await interaction.editReply({
            content: `❌ لم يتم العثور على الإمبد **${embedName}**.`,
            components: [],
          });
        }

        // Open the modular editor
        await this.embedVaultModule.openModularEditor(interaction, embedDoc);
      } catch (err) {
        console.error('[EmbedManager.handleSelectEmbed] Error:', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ فشل اختيار الإمبد.',
            ephemeral: true,
          });
        }
      }
    },

    /**
     * Update embed manager dashboard with Select Menu (safe for pagination)
     */
    async updateManager(interaction, page = 0) {
      try {
        if (!this.embedVaultModule) {
          return await interaction.editReply({ content: '❌ خزنة الإمبد لم تُهيّأ.', components: [] });
        }

        const embeds = await this.embedVaultModule.list(interaction.guildId);

        if (!embeds || embeds.length === 0) {
          return await interaction.editReply({
            content: '📦 خزنة الإمبد فارغة\nأنشئ إمبدك الأول للبدء!',
            components: [
              new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                  .setCustomId('embedvault_action')
                  .setPlaceholder('اختر الإجراء....')
                  .addOptions([
                    {
                      label: '➕ إنشاء أول إمبد',
                      value: 'action_create',
                      description: 'Create your first embed',
                    },
                  ])
              ),
            ],
          });
        }

        // Pagination settings - 25 items per page (Discord select menu limit)
        const itemsPerPage = 25;
        const totalPages = Math.ceil(embeds.length / itemsPerPage);
        const startIdx = page * itemsPerPage;
        const pageEmbeds = embeds.slice(startIdx, startIdx + itemsPerPage);

        // Build Select Menu with embeds on current page
        const selectOptions = pageEmbeds.map(embed => ({
          label: embed.name.length > 100 ? embed.name.substring(0, 97) + '…' : embed.name,
          value: embed.name,
          description: embed.linkedInviteCode ? `🔗 مرتبط برمز دعوة • Linked to invite` : `📦 إمبد عام • Generic embed`,
          emoji: embed.linkedInviteCode ? '🔗' : '📦',
        }));

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('embedvault_select')
          .setPlaceholder('اختر الإيمبد الذي ترغب في إدارته....')
          .addOptions(selectOptions);

        const menuRow = new ActionRowBuilder().addComponents(selectMenu);

        // Dashboard header embed with Arabic title and professional colors
        const dashboardEmbed = new EmbedBuilder()
          .setColor(0xDAA520) // Professional gold color (#DAA520)
          .setTitle('📦 لوحة تحكم الخزنة الإمبراطورية')
          .setDescription(`**${embeds.length}** إمبد في الخزنة\n**الصفحة ${page + 1}/${totalPages}** — استخدم القوائم أدناه`)
          .setThumbnail('https://cdn.discordapp.com/emojis/1234567890123456789.png') // Alya logo/placeholder
          .setFooter({ text: '⚙️ نظام إدارة الإمبد المتقدم • Advanced Embed Management System' });

        // Action select menu
        const actionOptions = [
          {
            label: '➕ إنشاء إمبد جديد',
            value: 'action_create',
            description: 'Create a new embed from scratch',
          },
          {
            label: '📥 استيراد JSON',
            value: 'action_import',
            description: 'Import embed from JSON data',
          },
        ];

        if (page > 0) {
          actionOptions.push({
            label: '⬅️ الصفحة السابقة',
            value: `action_prev:${page}`,
            description: 'Go to previous page',
          });
        }

        if (page < totalPages - 1) {
          actionOptions.push({
            label: 'الصفحة التالية ➡️',
            value: `action_next:${page}`,
            description: 'Go to next page',
          });
        }

        const actionMenu = new StringSelectMenuBuilder()
          .setCustomId('embedvault_action')
          .setPlaceholder('اختر الإجراء....')
          .addOptions(actionOptions);

        const actionRow = new ActionRowBuilder().addComponents(actionMenu);

        return await interaction.editReply({
          embeds: [dashboardEmbed],
          components: [actionRow, menuRow],
        });
      } catch (err) {
        console.error('[EmbedManager.updateManager] Error:', err);
      }
    },

    /**
     * Handle pagination requests with proper deferUpdate
     */
    async handlePagination(interaction, direction, currentPage) {
      try {
        await interaction.deferUpdate();
        
        if (!this.embedVaultModule) {
          return await interaction.editReply({ content: '❌ خزنة الإمبد لم تُهيّأ.', components: [] });
        }

        const embeds = await this.embedVaultModule.list(interaction.guildId);
        const itemsPerPage = 25;
        const totalPages = Math.ceil(embeds.length / itemsPerPage);

        let newPage = currentPage;
        if (direction === 'next') {
          newPage = Math.min(currentPage + 1, totalPages - 1);
        } else if (direction === 'prev') {
          newPage = Math.max(currentPage - 1, 0);
        }

        // Update manager with new page using editReply (safe after defer)
        await this.updateManager(interaction, newPage);
      } catch (err) {
        console.error('[EmbedManager.handlePagination] Error:', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ خطأ في الترقيم.',
            ephemeral: true,
          });
        }
      }
    },
  };
}

