import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';

/**
 * Manages embed selection UI with proper interaction handling
 * No timeout collectors - uses persistent button routing through interactionCreate event
 */
export default function EmbedManagerModule() {
  return {
    embedVaultModule: null, // Will be injected by index.js

    /**
     * Display premium button grid for embed selection
     */
    async displayManager(interaction, page = 0) {
      try {
        if (!this.embedVaultModule) {
          return interaction.reply({ content: '❌ Embed vault not initialized.', ephemeral: true });
        }

        const embeds = await this.embedVaultModule.list(interaction.guildId);

        if (!embeds || embeds.length === 0) {
          return interaction.reply({
            content: '📦 **Embed Vault Empty**\nCreate your first embed to get started!',
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('embedvault_create')
                  .setLabel('➕ Create First Embed')
                  .setStyle(ButtonStyle.Primary)
              ),
            ],
            ephemeral: true,
          });
        }

        // Pagination settings
        const buttonsPerPage = 6;
        const totalPages = Math.ceil(embeds.length / buttonsPerPage);
        const startIdx = page * buttonsPerPage;
        const pageEmbeds = embeds.slice(startIdx, startIdx + buttonsPerPage);

        // Build button grid (3 columns, 2 rows max)
        const rows = [];
        for (let i = 0; i < pageEmbeds.length; i += 3) {
          const rowButtons = pageEmbeds.slice(i, i + 3).map(embed => {
            const label = embed.name.length > 15 ? embed.name.substring(0, 12) + '…' : embed.name;
            const icon = embed.linkedInviteCode ? '🔗' : '📦';
            return new ButtonBuilder()
              .setCustomId(`embedvault_select:${embed.name}`)
              .setLabel(`${icon} ${label}`)
              .setStyle(ButtonStyle.Secondary);
          });
          rows.push(new ActionRowBuilder().addComponents(rowButtons));
        }

        // Premium header embed
        const headerEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('📦 Embed Manager – Premium Interface')
          .setDescription(`**${embeds.length}** embed(s) in vault\n**Page ${page + 1}/${totalPages}** — Select an embed to manage`)
          .setFooter({ text: '✨ Click an embed to edit • Use pagination to browse' });

        // Pagination + action buttons
        const paginationRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`embedvault_manager_prev:${page}`)
            .setLabel('⬅️ Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId('embedvault_create')
            .setLabel('➕ New')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('embedvault_import')
            .setLabel('📥 Import')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`embedvault_manager_next:${page}`)
            .setLabel('Next ➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1)
        );

        rows.push(paginationRow);

        return interaction.reply({
          embeds: [headerEmbed],
          components: rows,
          ephemeral: true,
        });
      } catch (err) {
        console.error('[EmbedManager.displayManager] Error:', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Failed to load embed manager.',
            ephemeral: true,
          });
        }
      }
    },

    /**
     * Handle embed selection from button grid
     */
    async handleSelectEmbed(interaction, embedName) {
      try {
        if (!this.embedVaultModule) {
          return interaction.reply({ content: '❌ Embed vault not initialized.', ephemeral: true });
        }

        const embedDoc = await this.embedVaultModule.getByName(interaction.guildId, embedName);
        if (!embedDoc) {
          return interaction.reply({
            content: `❌ Embed **${embedName}** not found.`,
            ephemeral: true,
          });
        }

        // Open the modular editor
        await this.embedVaultModule.openModularEditor(interaction, embedDoc);
      } catch (err) {
        console.error('[EmbedManager.handleSelectEmbed] Error:', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Failed to select embed.',
            ephemeral: true,
          });
        }
      }
    },

    /**
     * Update embed manager by editing the existing reply (safe for pagination)
     */
    async updateManager(interaction, page = 0) {
      try {
        if (!this.embedVaultModule) {
          return await interaction.editReply({ content: '❌ Embed vault not initialized.', components: [] });
        }

        const embeds = await this.embedVaultModule.list(interaction.guildId);

        if (!embeds || embeds.length === 0) {
          return await interaction.editReply({
            content: '📦 **Embed Vault Empty**\nCreate your first embed to get started!',
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('embedvault_create')
                  .setLabel('➕ إنشاء أول إمبد')
                  .setStyle(ButtonStyle.Primary)
              ),
            ],
          });
        }

        // Pagination settings
        const buttonsPerPage = 6;
        const totalPages = Math.ceil(embeds.length / buttonsPerPage);
        const startIdx = page * buttonsPerPage;
        const pageEmbeds = embeds.slice(startIdx, startIdx + buttonsPerPage);

        // Build button grid (3 columns, 2 rows max)
        const rows = [];
        for (let i = 0; i < pageEmbeds.length; i += 3) {
          const rowButtons = pageEmbeds.slice(i, i + 3).map(embed => {
            const label = embed.name.length > 15 ? embed.name.substring(0, 12) + '…' : embed.name;
            const icon = embed.linkedInviteCode ? '🔗' : '📦';
            return new ButtonBuilder()
              .setCustomId(`embedvault_select:${embed.name}`)
              .setLabel(`${icon} ${label}`)
              .setStyle(ButtonStyle.Secondary);
          });
          rows.push(new ActionRowBuilder().addComponents(rowButtons));
        }

        // Premium header embed
        const headerEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('📦 مدير الإيمبد – واجهة البريميوم')
          .setDescription(`**${embeds.length}** إيمبد(s) في الخزنة\n**الصفحة ${page + 1}/${totalPages}** — اختر إيمبد للإدارة`)
          .setFooter({ text: '✨ انقر على إيمبد للتعديل • استخدم الترقيم للتصفح' });

        // Pagination + action buttons
        const paginationRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`embedvault_manager_prev:${page}`)
            .setLabel('⬅️ السابق')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId('embedvault_create')
            .setLabel('➕ جديد')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('embedvault_import')
            .setLabel('📥 استيراد')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`embedvault_manager_next:${page}`)
            .setLabel('التالي ➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1)
        );

        rows.push(paginationRow);

        return await interaction.editReply({
          embeds: [headerEmbed],
          components: rows,
        });
      } catch (err) {
        console.error('[EmbedManager.updateManager] Error:', err);
      }
    },

    /**
     * Handle pagination requests
     */
    async handlePagination(interaction, direction, currentPage) {
      try {
        if (!this.embedVaultModule) {
          return interaction.reply({ content: '❌ Embed vault not initialized.', ephemeral: true });
        }

        const embeds = await this.embedVaultModule.list(interaction.guildId);
        const buttonsPerPage = 6;
        const totalPages = Math.ceil(embeds.length / buttonsPerPage);

        let newPage = currentPage;
        if (direction === 'next') {
          newPage = Math.min(currentPage + 1, totalPages - 1);
        } else if (direction === 'prev') {
          newPage = Math.max(currentPage - 1, 0);
        }

        // Defer update, then use updateManager to edit reply safely
        await interaction.deferUpdate();
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

