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

    async upsert(guildId, name, data, category = 'Manual', metadata = {}) {
      return EmbedVault.findOneAndUpdate(
        { guildId, name: name.trim() },
        { 
          guildId, 
          name: name.trim(), 
          data, 
          category,
          authorName: metadata.authorName || '',
          authorIcon: metadata.authorIcon || '',
          footerText: metadata.footerText || '',
          footerIcon: metadata.footerIcon || '',
          includeTimestamp: metadata.includeTimestamp || false,
        },
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

    // Main embed manager
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

    // Modular editor main menu
    async openModularEditor(interaction, embedDoc = null) {
      try {
        const isEdit = !!embedDoc;
        
        const basicInfoButton = new ButtonBuilder()
          .setCustomId(isEdit ? `embedvault_basicinfo:${embedDoc.name}` : 'embedvault_basicinfo_create')
          .setLabel('Basic Info')
          .setStyle(ButtonStyle.Primary);

        const authorButton = new ButtonBuilder()
          .setCustomId(isEdit ? `embedvault_authorfooter:${embedDoc.name}` : 'embedvault_authorfooter_create')
          .setLabel('Author/Footer')
          .setStyle(ButtonStyle.Primary);

        const imagesButton = new ButtonBuilder()
          .setCustomId(isEdit ? `embedvault_images:${embedDoc.name}` : 'embedvault_images_create')
          .setLabel('Images')
          .setStyle(ButtonStyle.Primary);

        const previewButton = new ButtonBuilder()
          .setCustomId(isEdit ? `embedvault_preview_modal:${embedDoc.name}` : 'embedvault_preview_modal_create')
          .setLabel('Preview')
          .setStyle(ButtonStyle.Secondary);

        const menuRow = new ActionRowBuilder().addComponents(basicInfoButton, authorButton, imagesButton, previewButton);

        const title = isEdit ? `Edit: ${embedDoc.name}` : 'Create New Embed';
        const content = isEdit 
          ? `**${embedDoc.name}** - Click a button to edit a section.`
          : '**Create New Embed** - Fill in the sections below to create your embed.';

        if (isEdit) {
          const previewEmbed = createPreview(embedDoc.data, { member: interaction.member });
          return interaction.reply({
            content,
            embeds: [previewEmbed],
            components: [menuRow],
            ephemeral: true,
          });
        } else {
          return interaction.reply({
            content,
            components: [menuRow],
            ephemeral: true,
          });
        }
      } catch (err) {
        console.error('[EmbedVaultModule.openModularEditor]', err);
        if (interaction.isRepliable()) {
          await interaction.reply({ content: 'Failed to open modular editor.', ephemeral: true });
        }
      }
    },

    // Modal: Basic Info
    async openBasicInfoModal(interaction, embedDoc = null) {
      const isEdit = !!embedDoc;
      const modal = new ModalBuilder()
        .setCustomId(isEdit ? `embedvault_basicinfo_submit:${embedDoc.name}` : 'embedvault_basicinfo_submit_create')
        .setTitle(isEdit ? 'Edit: Basic Info' : 'Create: Basic Info');

      const embedNameInput = new TextInputBuilder()
        .setCustomId('embed_name')
        .setLabel('Embed Name')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('e.g., Welcome Card')
        .setValue(isEdit ? embedDoc.name : '');

      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('Supports placeholders: {user}, {server}, etc.')
        .setValue(embedDoc?.data?.title || '');

      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder('Main embed text. Supports {choose:option1|option2}')
        .setValue(embedDoc?.data?.description || '');

      const colorInput = new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Color (hex, e.g. #FF5733)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(embedDoc?.data?.color || '#2f3136');

      modal.addComponents(
        new ActionRowBuilder().addComponents(embedNameInput),
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(colorInput)
      );

      await interaction.showModal(modal);
    },

    // Modal: Author & Footer
    async openAuthorFooterModal(interaction, embedDoc = null) {
      const isEdit = !!embedDoc;
      const modal = new ModalBuilder()
        .setCustomId(isEdit ? `embedvault_authorfooter_submit:${embedDoc.name}` : 'embedvault_authorfooter_submit_create')
        .setTitle(isEdit ? 'Edit: Author & Footer' : 'Create: Author & Footer');

      const authorNameInput = new TextInputBuilder()
        .setCustomId('author_name')
        .setLabel('Author Name')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('e.g., {user.name} or Bot Name')
        .setValue(embedDoc?.authorName || '');

      const authorIconInput = new TextInputBuilder()
        .setCustomId('author_icon')
        .setLabel('Author Icon URL')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('e.g., {user.avatar} or https://...')
        .setValue(embedDoc?.authorIcon || '');

      const footerTextInput = new TextInputBuilder()
        .setCustomId('footer_text')
        .setLabel('Footer Text')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('e.g., {server} • {member_count} members')
        .setValue(embedDoc?.footerText || '');

      const footerIconInput = new TextInputBuilder()
        .setCustomId('footer_icon')
        .setLabel('Footer Icon URL')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('https://...')
        .setValue(embedDoc?.footerIcon || '');

      modal.addComponents(
        new ActionRowBuilder().addComponents(authorNameInput),
        new ActionRowBuilder().addComponents(authorIconInput),
        new ActionRowBuilder().addComponents(footerTextInput),
        new ActionRowBuilder().addComponents(footerIconInput)
      );

      await interaction.showModal(modal);
    },

    // Modal: Images
    async openImagesModal(interaction, embedDoc = null) {
      const isEdit = !!embedDoc;
      const modal = new ModalBuilder()
        .setCustomId(isEdit ? `embedvault_images_submit:${embedDoc.name}` : 'embedvault_images_submit_create')
        .setTitle(isEdit ? 'Edit: Images' : 'Create: Images');

      const imageInput = new TextInputBuilder()
        .setCustomId('image_url')
        .setLabel('Image URL (Main Image)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('https://...')
        .setValue((embedDoc?.data?.image?.url) || '');

      const thumbnailInput = new TextInputBuilder()
        .setCustomId('thumbnail_url')
        .setLabel('Thumbnail URL (Small image)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('https://...')
        .setValue((embedDoc?.data?.thumbnail?.url) || '');

      const timestampInput = new TextInputBuilder()
        .setCustomId('include_timestamp')
        .setLabel('Include Timestamp? (true/false)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('true or false')
        .setValue(embedDoc?.includeTimestamp ? 'true' : 'false');

      modal.addComponents(
        new ActionRowBuilder().addComponents(imageInput),
        new ActionRowBuilder().addComponents(thumbnailInput),
        new ActionRowBuilder().addComponents(timestampInput)
      );

      await interaction.showModal(modal);
    },

    // Live preview modal
    async openLivePreviewModal(interaction, embedDoc = null) {
      if (!embedDoc) {
        return interaction.reply({ content: 'No embed data to preview.', ephemeral: true });
      }

      try {
        // Build complete data object from schema and data
        const fullData = {
          ...embedDoc.data,
          authorName: embedDoc.authorName || embedDoc.data?.author?.name,
          authorIcon: embedDoc.authorIcon || embedDoc.data?.author?.iconURL,
          footerText: embedDoc.footerText || embedDoc.data?.footer?.text,
          footerIcon: embedDoc.footerIcon || embedDoc.data?.footer?.iconURL,
          timestamp: embedDoc.includeTimestamp,
        };

        const previewEmbed = createPreview(fullData, { member: interaction.member });

        return interaction.reply({
          content: `**Live Preview** - ${embedDoc.name}`,
          embeds: [previewEmbed],
          ephemeral: true
        });
      } catch (err) {
        console.error('[EmbedVaultModule.openLivePreviewModal]', err);
        return interaction.reply({ content: 'Failed to generate preview.', ephemeral: true });
      }
    },

    // Handle select menu
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

        // Open modular editor
        await this.openModularEditor(interaction, embedDoc);
      } catch (err) {
        console.error('[EmbedVaultModule.handleSelectMenu]', err);
        if (interaction.isRepliable()) {
          await interaction.reply({ content: 'Failed to select embed.', ephemeral: true });
        }
      }
    },

    // Handle button interactions
    async handleButtonInteraction(interaction) {
      try {
        if (!interaction.isButton()) return;

        // Basic Info button
        if (interaction.customId.startsWith('embedvault_basicinfo:')) {
          const name = interaction.customId.split(':')[1];
          const embedDoc = await this.getByName(interaction.guildId, name);
          if (!embedDoc) return interaction.reply({ content: 'Embed not found.', ephemeral: true });
          await this.openBasicInfoModal(interaction, embedDoc);
          return;
        }

        if (interaction.customId === 'embedvault_basicinfo_create') {
          await this.openBasicInfoModal(interaction);
          return;
        }

        // Author/Footer button
        if (interaction.customId.startsWith('embedvault_authorfooter:')) {
          const name = interaction.customId.split(':')[1];
          const embedDoc = await this.getByName(interaction.guildId, name);
          if (!embedDoc) return interaction.reply({ content: 'Embed not found.', ephemeral: true });
          await this.openAuthorFooterModal(interaction, embedDoc);
          return;
        }

        if (interaction.customId === 'embedvault_authorfooter_create') {
          await this.openAuthorFooterModal(interaction);
          return;
        }

        // Images button
        if (interaction.customId.startsWith('embedvault_images:')) {
          const name = interaction.customId.split(':')[1];
          const embedDoc = await this.getByName(interaction.guildId, name);
          if (!embedDoc) return interaction.reply({ content: 'Embed not found.', ephemeral: true });
          await this.openImagesModal(interaction, embedDoc);
          return;
        }

        if (interaction.customId === 'embedvault_images_create') {
          await this.openImagesModal(interaction);
          return;
        }

        // Preview button
        if (interaction.customId.startsWith('embedvault_preview_modal:')) {
          const name = interaction.customId.split(':')[1];
          const embedDoc = await this.getByName(interaction.guildId, name);
          if (!embedDoc) return interaction.reply({ content: 'Embed not found.', ephemeral: true });
          await this.openLivePreviewModal(interaction, embedDoc);
          return;
        }

        if (interaction.customId === 'embedvault_preview_modal_create') {
          return interaction.reply({ content: 'Create/fill at least Basic Info first!', ephemeral: true });
        }

        // Create button
        if (interaction.customId === 'embedvault_create') {
          await this.openModularEditor(interaction);
          return;
        }

        // Import button
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

        // Send button
        if (interaction.customId.startsWith('embedvault_send:')) {
          const name = interaction.customId.split(':')[1];
          const embedDoc = await this.getByName(interaction.guildId, name);
          if (!embedDoc) return interaction.reply({ content: 'Embed not found.', ephemeral: true });

          const channel = interaction.channel;
          if (!channel || !channel.isTextBased()) {
            return interaction.reply({ content: 'Unable to send from this channel context.', ephemeral: true });
          }

          const fullData = {
            ...embedDoc.data,
            author: embedDoc.authorName || embedDoc.data?.author ? {
              name: embedDoc.authorName || embedDoc.data?.author?.name,
              iconURL: embedDoc.authorIcon || embedDoc.data?.author?.iconURL,
            } : undefined,
            footer: embedDoc.footerText || embedDoc.data?.footer ? {
              text: embedDoc.footerText || embedDoc.data?.footer?.text,
              iconURL: embedDoc.footerIcon || embedDoc.data?.footer?.iconURL,
            } : undefined,
            timestamp: embedDoc.includeTimestamp,
          };

          const rendered = render(fullData, { member: interaction.member });
          await channel.send({ embeds: [new EmbedBuilder(rendered)] });
          return interaction.reply({ content: `✅ Sent **${name}** to channel.`, ephemeral: true });
        }

        // Delete button
        if (interaction.customId.startsWith('embedvault_delete:')) {
          const name = interaction.customId.split(':')[1];
          await this.delete(interaction.guildId, name);
          return interaction.reply({ content: `✅ Deleted **${name}** from vault.`, ephemeral: true });
        }
      } catch (err) {
        console.error('[EmbedVaultModule.handleButtonInteraction]', err);
        if (interaction.isRepliable()) {
          await interaction.reply({ content: 'Embed button action failed.', ephemeral: true });
        }
      }
    },

    // Live update handler - modal submissions with re-render
    async handleModalSubmit(interaction) {
      try {
        if (!interaction.isModalSubmit()) return;

        // Import modal
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

        // Basic Info Submit
        if (interaction.customId.startsWith('embedvault_basicinfo_submit:')) {
          const name = interaction.customId.split(':')[1];
          const vaultItem = await this.getByName(interaction.guildId, name);
          if (!vaultItem) {
            return interaction.reply({ content: 'Embed not found.', ephemeral: true });
          }

          const newName = interaction.fields.getTextInputValue('embed_name').trim();
          const title = interaction.fields.getTextInputValue('title').trim();
          const description = interaction.fields.getTextInputValue('description').trim();
          const color = interaction.fields.getTextInputValue('color').trim();

          const updatedData = {
            ...vaultItem.data,
            title: title || undefined,
            description: description || undefined,
            color: color || undefined,
          };

          if (!updatedData.title) delete updatedData.title;
          if (!updatedData.description) delete updatedData.description;
          if (!updatedData.color) delete updatedData.color;

          const errors = validateEmbed(updatedData);
          if (errors.length > 0) {
            return interaction.reply({
              content: `Validation errors:\n${errors.join('\n')}`,
              ephemeral: true
            });
          }

          const updated = await this.upsert(
            interaction.guildId, 
            newName !== name ? newName : name, 
            updatedData, 
            vaultItem.category,
            {
              authorName: vaultItem.authorName,
              authorIcon: vaultItem.authorIcon,
              footerText: vaultItem.footerText,
              footerIcon: vaultItem.footerIcon,
              includeTimestamp: vaultItem.includeTimestamp,
            }
          );

          // Live preview
          const previewEmbed = createPreview(updated.data, { member: interaction.member });
          const menuButtons = await this.getEditorMenuButtons(interaction.guildId, updated.name);
          
          return interaction.reply({
            content: `✅ Updated **${updated.name}** - Basic Info saved! Edit other sections or preview.`,
            embeds: [previewEmbed],
            components: [menuButtons],
            ephemeral: true
          });
        }

        if (interaction.customId === 'embedvault_basicinfo_submit_create') {
          const name = interaction.fields.getTextInputValue('embed_name').trim();
          const title = interaction.fields.getTextInputValue('title').trim();
          const description = interaction.fields.getTextInputValue('description').trim();
          const color = interaction.fields.getTextInputValue('color').trim();

          const data = {};
          if (title) data.title = title;
          if (description) data.description = description;
          if (color) data.color = color;

          const errors = validateEmbed(data);
          if (errors.length > 0) {
            return interaction.reply({
              content: `Validation errors:\n${errors.join('\n')}`,
              ephemeral: true
            });
          }

          const created = await this.upsert(interaction.guildId, name, data, 'Manual');

          const previewEmbed = createPreview(created.data, { member: interaction.member });
          const menuButtons = await this.getEditorMenuButtons(interaction.guildId, created.name);

          return interaction.reply({
            content: `✅ Created **${created.name}** - Basic Info saved! Add other sections.`,
            embeds: [previewEmbed],
            components: [menuButtons],
            ephemeral: true
          });
        }

        // Author/Footer Submit
        if (interaction.customId.startsWith('embedvault_authorfooter_submit:')) {
          const name = interaction.customId.split(':')[1];
          const vaultItem = await this.getByName(interaction.guildId, name);
          if (!vaultItem) {
            return interaction.reply({ content: 'Embed not found.', ephemeral: true });
          }

          const authorName = interaction.fields.getTextInputValue('author_name').trim();
          const authorIcon = interaction.fields.getTextInputValue('author_icon').trim();
          const footerText = interaction.fields.getTextInputValue('footer_text').trim();
          const footerIcon = interaction.fields.getTextInputValue('footer_icon').trim();

          const updated = await this.upsert(
            interaction.guildId,
            name,
            vaultItem.data,
            vaultItem.category,
            {
              authorName,
              authorIcon,
              footerText,
              footerIcon,
              includeTimestamp: vaultItem.includeTimestamp,
            }
          );

          // Live preview
          const fullData = {
            ...updated.data,
            authorName: updated.authorName,
            authorIcon: updated.authorIcon,
            footerText: updated.footerText,
            footerIcon: updated.footerIcon,
            timestamp: updated.includeTimestamp,
          };
          const previewEmbed = createPreview(fullData, { member: interaction.member });
          const menuButtons = await this.getEditorMenuButtons(interaction.guildId, updated.name);

          return interaction.reply({
            content: `✅ Updated **${updated.name}** - Author/Footer saved!`,
            embeds: [previewEmbed],
            components: [menuButtons],
            ephemeral: true
          });
        }

        if (interaction.customId === 'embedvault_authorfooter_submit_create') {
          const authorName = interaction.fields.getTextInputValue('author_name').trim();
          const authorIcon = interaction.fields.getTextInputValue('author_icon').trim();
          const footerText = interaction.fields.getTextInputValue('footer_text').trim();
          const footerIcon = interaction.fields.getTextInputValue('footer_icon').trim();

          // For new embeds, need at least basic info first
          return interaction.reply({
            content: '⚠️ Please create Basic Info first, then come back to set Author/Footer.',
            ephemeral: true
          });
        }

        // Images Submit
        if (interaction.customId.startsWith('embedvault_images_submit:')) {
          const name = interaction.customId.split(':')[1];
          const vaultItem = await this.getByName(interaction.guildId, name);
          if (!vaultItem) {
            return interaction.reply({ content: 'Embed not found.', ephemeral: true });
          }

          const imageUrl = interaction.fields.getTextInputValue('image_url').trim();
          const thumbnailUrl = interaction.fields.getTextInputValue('thumbnail_url').trim();
          const timestampStr = interaction.fields.getTextInputValue('include_timestamp').trim().toLowerCase();
          const timestamp = timestampStr === 'true' || timestampStr === '1';

          const updatedData = { ...vaultItem.data };
          if (imageUrl) updatedData.image = { url: imageUrl };
          if (thumbnailUrl) updatedData.thumbnail = { url: thumbnailUrl };

          const errors = validateEmbed(updatedData);
          if (errors.length > 0) {
            return interaction.reply({
              content: `Validation errors:\n${errors.join('\n')}`,
              ephemeral: true
            });
          }

          const updated = await this.upsert(
            interaction.guildId,
            name,
            updatedData,
            vaultItem.category,
            {
              authorName: vaultItem.authorName,
              authorIcon: vaultItem.authorIcon,
              footerText: vaultItem.footerText,
              footerIcon: vaultItem.footerIcon,
              includeTimestamp: timestamp,
            }
          );

          // Live preview
          const fullData = {
            ...updated.data,
            authorName: updated.authorName,
            authorIcon: updated.authorIcon,
            footerText: updated.footerText,
            footerIcon: updated.footerIcon,
            timestamp: updated.includeTimestamp,
          };
          const previewEmbed = createPreview(fullData, { member: interaction.member });
          const menuButtons = await this.getEditorMenuButtons(interaction.guildId, updated.name);

          return interaction.reply({
            content: `✅ Updated **${updated.name}** - Images & Timestamp saved!`,
            embeds: [previewEmbed],
            components: [menuButtons],
            ephemeral: true
          });
        }

        if (interaction.customId === 'embedvault_images_submit_create') {
          return interaction.reply({
            content: '⚠️ Please create Basic Info first, then come back to set Images.',
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

    // Helper: Get editor menu buttons
    async getEditorMenuButtons(guildId, embedName) {
      const basicInfoButton = new ButtonBuilder()
        .setCustomId(`embedvault_basicinfo:${embedName}`)
        .setLabel('Basic Info')
        .setStyle(ButtonStyle.Primary);

      const authorButton = new ButtonBuilder()
        .setCustomId(`embedvault_authorfooter:${embedName}`)
        .setLabel('Author/Footer')
        .setStyle(ButtonStyle.Primary);

      const imagesButton = new ButtonBuilder()
        .setCustomId(`embedvault_images:${embedName}`)
        .setLabel('Images')
        .setStyle(ButtonStyle.Primary);

      const previewButton = new ButtonBuilder()
        .setCustomId(`embedvault_preview_modal:${embedName}`)
        .setLabel('Preview')
        .setStyle(ButtonStyle.Secondary);

      return new ActionRowBuilder().addComponents(basicInfoButton, authorButton, imagesButton, previewButton);
    },
  };
}
