import EmbedVault from './schema.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

export default function EmbedVaultModule(client) {
  return {
    async list(guildId) {
      return EmbedVault.find({ guildId }).sort({ name: 1 }).lean();
    },

    async getByName(guildId, name) {
      return EmbedVault.findOne({ guildId, name: name.trim() }).lean();
    },

    async upsert(guildId, name, data, category = 'Manual') {
      return EmbedVault.findOneAndUpdate(
        { guildId, name: name.trim() },
        { guildId, name: name.trim(), data, category },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    },

    async delete(guildId, name) {
      return EmbedVault.findOneAndDelete({ guildId, name: name.trim() });
    },

    async getByLinkedInvite(guildId, inviteCode) {
      if (!inviteCode) return null;
      return EmbedVault.findOne({ guildId, linkedInviteCode: inviteCode.trim() }).lean();
    },

    async getByCategory(guildId, category) {
      return EmbedVault.findOne({ guildId, category }).sort({ updatedAt: -1 }).lean();
    },

    async link(guildId, name, inviteCode) {
      const doc = await EmbedVault.findOne({ guildId, name: name.trim() });
      if (!doc) return null;
      doc.linkedInviteCode = inviteCode.trim();
      return doc.save();
    },

    async handleSelectMenu(interaction) {
      try {
        if (!interaction.isAnySelectMenu()) return;
        if (!interaction.customId.startsWith('embedvault_')) return;

        const selectedName = interaction.values?.[0];
        if (!selectedName) {
          return interaction.reply({ content: 'No embed selected.', ephemeral: true });
        }

        const embedDoc = await this.getByName(interaction.guildId, selectedName);
        if (!embedDoc) {
          return interaction.reply({ content: `Embed not found: ${selectedName}`, ephemeral: true });
        }

        const menuButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`embedvault_edit:${embedDoc.name}`)
            .setLabel('Edit Embed')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`embedvault_send:${embedDoc.name}`)
            .setLabel('Send Embed')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`embedvault_delete:${embedDoc.name}`)
            .setLabel('Delete Embed')
            .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
          content: `Selected vault item: **${embedDoc.name}** (Category: ${embedDoc.category})`,
          embeds: [embedDoc.data],
          components: [menuButtons],
          ephemeral: true,
        });
      } catch (err) {
        console.error('[EmbedVaultModule.handleSelectMenu]', err);
        if (interaction.isRepliable()) {
          await interaction.reply({ content: 'Failed to select embed.', ephemeral: true });
        }
      }
    },

    async handleButtonInteraction(interaction) {
      try {
        if (!interaction.isButton()) return;

        if (interaction.customId.startsWith('embedvault_edit:')) {
          const name = interaction.customId.split(':')[1];
          const embedDoc = await this.getByName(interaction.guildId, name);
          if (!embedDoc) return interaction.reply({ content: 'Embed not found.', ephemeral: true });

          const modal = new ModalBuilder().setCustomId(`embedvault_modal:${name}`).setTitle(`Edit Vault: ${name}`);

          const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(embedDoc.data?.title || '');

          const descInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setValue(embedDoc.data?.description || '');

          const imageInput = new TextInputBuilder()
            .setCustomId('image')
            .setLabel('Image URL')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue((embedDoc.data?.image && embedDoc.data.image.url) || embedDoc.data?.image || '');

          modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descInput),
            new ActionRowBuilder().addComponents(imageInput)
          );

          await interaction.showModal(modal);
          return;
        }

        if (interaction.customId.startsWith('embedvault_send:')) {
          const name = interaction.customId.split(':')[1];
          const embedDoc = await this.getByName(interaction.guildId, name);
          if (!embedDoc) return interaction.reply({ content: 'Embed not found.', ephemeral: true });

          const channel = interaction.channel;
          if (!channel || !channel.isTextBased()) {
            return interaction.reply({ content: 'Unable to send from this channel context.', ephemeral: true });
          }

          await channel.send({ embeds: [embedDoc.data] });
          return interaction.reply({ content: `Embed **${name}** sent to channel.`, ephemeral: true });
        }

        if (interaction.customId.startsWith('embedvault_delete:')) {
          const name = interaction.customId.split(':')[1];
          await this.delete(interaction.guildId, name);
          return interaction.reply({ content: `Embed **${name}** deleted from vault.`, ephemeral: true });
        }

        if (interaction.customId === 'embedvault_create') {
          const modal = new ModalBuilder().setCustomId('embedvault_modal_create').setTitle('Create New Embed');

          const nameInput = new TextInputBuilder().setCustomId('name').setLabel('Embed Name').setStyle(TextInputStyle.Short).setRequired(true);
          const categoryInput = new TextInputBuilder().setCustomId('category').setLabel('Category (Welcome/Leave/Boost/Manual)').setStyle(TextInputStyle.Short).setRequired(true);
          const titleInput = new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setRequired(false);
          const descInput = new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(false);
          const imageInput = new TextInputBuilder().setCustomId('image').setLabel('Image URL').setStyle(TextInputStyle.Short).setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(categoryInput),
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descInput),
            new ActionRowBuilder().addComponents(imageInput)
          );

          await interaction.showModal(modal);
          return;
        }

        if (interaction.customId === 'embedvault_import') {
          const modal = new ModalBuilder().setCustomId('embedvault_modal_import').setTitle('Import JSON Embed');

          const nameInput = new TextInputBuilder().setCustomId('name').setLabel('Embed Name').setStyle(TextInputStyle.Short).setRequired(true);
          const categoryInput = new TextInputBuilder().setCustomId('category').setLabel('Category (Welcome/Leave/Boost/Manual)').setStyle(TextInputStyle.Short).setRequired(true);
          const jsonInput = new TextInputBuilder().setCustomId('json').setLabel('Embed JSON').setStyle(TextInputStyle.Paragraph).setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(categoryInput),
            new ActionRowBuilder().addComponents(jsonInput)
          );

          await interaction.showModal(modal);
          return;
        }
      } catch (err) {
        console.error('[EmbedVaultModule.handleButtonInteraction]', err);
        if (interaction.isRepliable()) {
          await interaction.reply({ content: 'Embed button action failed.', ephemeral: true });
        }
      }
    },

    async handleModalSubmit(interaction) {
      try {
        if (!interaction.isModalSubmit()) return;

        if (interaction.customId === 'embedvault_modal_create') {
          const name = interaction.fields.getTextInputValue('name').trim();
          const category = interaction.fields.getTextInputValue('category').trim();
          const title = interaction.fields.getTextInputValue('title').trim();
          const description = interaction.fields.getTextInputValue('description').trim();
          const imageUrl = interaction.fields.getTextInputValue('image').trim();

          const data = {
            ...(title ? { title } : {}),
            ...(description ? { description } : {}),
            ...(imageUrl ? { image: { url: imageUrl } } : {}),
          };

          if (Object.keys(data).length === 0) {
            return interaction.reply({ content: 'Provide at least one of title/description/image.', ephemeral: true });
          }

          await this.upsert(interaction.guildId, name, data, category || 'Manual');
          return interaction.reply({ content: `✅ Embed **${name}** created.`, ephemeral: true });
        }

        if (interaction.customId === 'embedvault_modal_import') {
          const name = interaction.fields.getTextInputValue('name').trim();
          const category = interaction.fields.getTextInputValue('category').trim();
          const jsonText = interaction.fields.getTextInputValue('json').trim();

          let parsed;
          try {
            parsed = JSON.parse(jsonText);
          } catch (e) {
            return interaction.reply({ content: 'Invalid JSON format.', ephemeral: true });
          }

          await this.upsert(interaction.guildId, name, parsed, category || 'Manual');
          return interaction.reply({ content: `✅ Embed **${name}** imported.`, ephemeral: true });
        }

        if (!interaction.customId.startsWith('embedvault_modal:')) return;

        const name = interaction.customId.split(':')[1];
        const vaultItem = await this.getByName(interaction.guildId, name);
        if (!vaultItem) {
          return interaction.reply({ content: 'Embed slot not found.', ephemeral: true });
        }

        const title = interaction.fields.getTextInputValue('title').trim();
        const description = interaction.fields.getTextInputValue('description').trim();
        const imageUrl = interaction.fields.getTextInputValue('image').trim();

        const updatedData = {
          ...vaultItem.data,
          title: title || vaultItem.data.title || undefined,
          description: description || vaultItem.data.description || undefined,
        };

        if (imageUrl) {
          updatedData.image = { url: imageUrl };
        } else {
          delete updatedData.image;
        }

        await this.upsert(interaction.guildId, name, updatedData, vaultItem.category);

        if (interaction.isRepliable()) {
          await interaction.reply({ content: `✅ Embed **${name}** updated.`, ephemeral: true });
        }
      } catch (err) {
        console.error('[EmbedVaultModule.handleModalSubmit]', err);
        if (interaction.isRepliable()) {
          await interaction.reply({ content: 'Failed to update embed slot.', ephemeral: true });
        }
      }
    },
  };
}
