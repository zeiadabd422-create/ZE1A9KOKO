import EmbedVault from './schema.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { render, createPreview, validateEmbed } from '../../core/embedEngine.js';

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

    // New openManager() flow with live preview
    async openManager(interaction) {
      try {
        const embeds = await this.list(interaction.guildId);
        if (!embeds || embeds.length === 0) {
          return interaction.reply({
            content: 'Embed vault is empty. Create your first embed to get started!',
            components: [new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('embedvault_create')
                .setLabel('Create First Embed')
                .setStyle(ButtonStyle.Primary)
            )],
            ephemeral: true
          });
        }

        const menu = new StringSelectMenuBuilder()
          .setCustomId('embedvault_select')
          .setPlaceholder('Select an embed to manage')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(
            embeds.map(item => ({
              label: item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name,
              value: item.name,
              description: `Category: ${item.category}`,
            }))
          );

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('embedvault_create')
            .setLabel('Create New')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('embedvault_import')
            .setLabel('Import JSON')
            .setStyle(ButtonStyle.Secondary)
        );

        const menuRow = new ActionRowBuilder().addComponents(menu);

        return interaction.reply({
          content: `**Embed Manager** - ${embeds.length} embeds in vault\nSelect an embed to edit, or create a new one.`,
          components: [menuRow, actionRow],
          ephemeral: true,
        });
      } catch (err) {
        console.error('[EmbedVaultModule.openManager]', err);
        if (interaction.isRepliable()) {
          await interaction.reply({ content: 'Failed to open embed manager.', ephemeral: true });
        }
      }
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

        // Create live preview
        const previewEmbed = createPreview(embedDoc.data, { member: interaction.member });

        const menuButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`embedvault_edit:${embedDoc.name}`)
            .setLabel('Edit')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`embedvault_send:${embedDoc.name}`)
            .setLabel('Send')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`embedvault_delete:${embedDoc.name}`)
            .setLabel('Delete')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`embedvault_preview:${embedDoc.name}`)
            .setLabel('Live Preview')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          content: `**${embedDoc.name}** (Category: ${embedDoc.category})`,
          embeds: [previewEmbed],
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

          // Open visual editor with live preview
          await this.openVisualEditor(interaction, embedDoc);
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

          const rendered = render(embedDoc.data, { member: interaction.member });
          await channel.send({ embeds: [new EmbedBuilder(rendered)] });
          return interaction.reply({ content: `✅ Sent **${name}** to channel.`, ephemeral: true });
        }

        if (interaction.customId.startsWith('embedvault_delete:')) {
          const name = interaction.customId.split(':')[1];
          await this.delete(interaction.guildId, name);
          return interaction.reply({ content: `✅ Deleted **${name}** from vault.`, ephemeral: true });
        }

        if (interaction.customId.startsWith('embedvault_preview:')) {
          const name = interaction.customId.split(':')[1];
          const embedDoc = await this.getByName(interaction.guildId, name);
          if (!embedDoc) return interaction.reply({ content: 'Embed not found.', ephemeral: true });

          const previewEmbed = createPreview(embedDoc.data, { member: interaction.member });
          return interaction.reply({
            content: `**Live Preview** - ${name}`,
            embeds: [previewEmbed],
            ephemeral: true
          });
        }

        if (interaction.customId === 'embedvault_create') {
          await this.openVisualEditor(interaction);
          return;
        }

        if (interaction.customId === 'embedvault_import') {
          const modal = new ModalBuilder()
            .setCustomId('embedvault_import_modal')
            .setTitle('Import Embed JSON');

          const nameInput = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Embed Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          const categoryInput = new TextInputBuilder()
            .setCustomId('category')
            .setLabel('Category')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue('Manual');
          const jsonInput = new TextInputBuilder()
            .setCustomId('json')
            .setLabel('Embed JSON')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

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

    // New visual editor with live preview
    async openVisualEditor(interaction, embedDoc = null) {
      const isEdit = !!embedDoc;
      const modal = new ModalBuilder()
        .setCustomId(isEdit ? `embedvault_editor:${embedDoc.name}` : 'embedvault_editor_create')
        .setTitle(isEdit ? `Edit: ${embedDoc.name}` : 'Create New Embed');

      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(embedDoc?.data?.title || '');

      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setValue(embedDoc?.data?.description || '');

      const colorInput = new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Color (hex, e.g. #ff0000)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(embedDoc?.data?.color || '');

      const imageInput = new TextInputBuilder()
        .setCustomId('image')
        .setLabel('Image URL')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue((embedDoc?.data?.image?.url) || '');

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(colorInput),
        new ActionRowBuilder().addComponents(imageInput)
      );

      await interaction.showModal(modal);
    },

    async handleModalSubmit(interaction) {
      try {
        if (!interaction.isModalSubmit()) return;

        if (interaction.customId === 'embedvault_import_modal') {
          const name = interaction.fields.getTextInputValue('name').trim();
          const category = interaction.fields.getTextInputValue('category').trim();
          const jsonText = interaction.fields.getTextInputValue('json').trim();

          let parsed;
          try {
            parsed = JSON.parse(jsonText);
            if (parsed.embeds && Array.isArray(parsed.embeds)) {
              parsed = parsed.embeds[0];
            }
          } catch (e) {
            return interaction.reply({ content: 'Invalid JSON format.', ephemeral: true });
          }

          // Validate the embed
          const errors = validateEmbed(parsed);
          if (errors.length > 0) {
            return interaction.reply({
              content: `Validation errors:\n${errors.join('\n')}`,
              ephemeral: true
            });
          }

          await this.upsert(interaction.guildId, name, parsed, category);
          return interaction.reply({ content: `✅ Imported **${name}**.`, ephemeral: true });
        }

        if (interaction.customId.startsWith('embedvault_editor:')) {
          const name = interaction.customId.split(':')[1];
          const vaultItem = await this.getByName(interaction.guildId, name);
          if (!vaultItem) {
            return interaction.reply({ content: 'Embed not found.', ephemeral: true });
          }

          const title = interaction.fields.getTextInputValue('title').trim();
          const description = interaction.fields.getTextInputValue('description').trim();
          const color = interaction.fields.getTextInputValue('color').trim();
          const imageUrl = interaction.fields.getTextInputValue('image').trim();

          const updatedData = {
            ...vaultItem.data,
            title: title || undefined,
            description: description || undefined,
            color: color || undefined,
            image: imageUrl ? { url: imageUrl } : undefined,
          };

          // Remove empty fields
          if (!updatedData.title) delete updatedData.title;
          if (!updatedData.description) delete updatedData.description;
          if (!updatedData.color) delete updatedData.color;
          if (!updatedData.image) delete updatedData.image;

          // Validate
          const errors = validateEmbed(updatedData);
          if (errors.length > 0) {
            return interaction.reply({
              content: `Validation errors:\n${errors.join('\n')}`,
              ephemeral: true
            });
          }

          await this.upsert(interaction.guildId, name, updatedData, vaultItem.category);

          // Show live preview
          const previewEmbed = createPreview(updatedData, { member: interaction.member });
          return interaction.reply({
            content: `✅ Updated **${name}**`,
            embeds: [previewEmbed],
            ephemeral: true
          });
        }

        if (interaction.customId === 'embedvault_editor_create') {
          const name = interaction.fields.getTextInputValue('title').trim() || 'New Embed';
          const description = interaction.fields.getTextInputValue('description').trim();
          const color = interaction.fields.getTextInputValue('color').trim();
          const imageUrl = interaction.fields.getTextInputValue('image').trim();

          const data = {};
          if (description) data.description = description;
          if (color) data.color = color;
          if (imageUrl) data.image = { url: imageUrl };

          if (Object.keys(data).length === 0) {
            return interaction.reply({ content: 'Provide at least a description, color, or image.', ephemeral: true });
          }

          // Validate
          const errors = validateEmbed(data);
          if (errors.length > 0) {
            return interaction.reply({
              content: `Validation errors:\n${errors.join('\n')}`,
              ephemeral: true
            });
          }

          await this.upsert(interaction.guildId, name, data, 'Manual');

          // Show live preview
          const previewEmbed = createPreview(data, { member: interaction.member });
          return interaction.reply({
            content: `✅ Created **${name}**`,
            embeds: [previewEmbed],
            ephemeral: true
          });
        }
      } catch (err) {
        console.error('[EmbedVaultModule.handleModalSubmit]', err);
        if (interaction.isRepliable()) {
          await interaction.reply({ content: 'Failed to save embed.', ephemeral: true });
        }
      }
    },
  };
}
