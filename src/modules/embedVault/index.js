import EmbedVault from './schema.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { render, createPreview, validateEmbed } from '../../core/embedEngine.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFullData(doc) {
  return {
    ...doc.data,
    authorName: doc.authorName || doc.data?.author?.name || '',
    authorIcon: doc.authorIcon || doc.data?.author?.iconURL || '',
    footerText: doc.footerText || doc.data?.footer?.text || '',
    footerIcon: doc.footerIcon || doc.data?.footer?.iconURL || '',
    timestamp: doc.includeTimestamp,
  };
}

function buildEditorRow(embedName) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`embedvault_basicinfo:${embedName}`)
      .setLabel('✏️ Basic Info')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`embedvault_authorfooter:${embedName}`)
      .setLabel('👤 Author/Footer')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`embedvault_images:${embedName}`)
      .setLabel('🖼️ Images')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`embedvault_preview_modal:${embedName}`)
      .setLabel('👁️ Preview')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`embedvault_send:${embedName}`)
      .setLabel('📤 Send')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`embedvault_delete:${embedName}`)
      .setLabel('🗑️ Delete')
      .setStyle(ButtonStyle.Danger),
  );
}

// ─── Module ───────────────────────────────────────────────────────────────────

export default function EmbedVaultModule(client) {
  return {
    async list(guildId) {
      return EmbedVault.find({ guildId }).sort({ name: 1 }).lean();
    },

    async getByName(guildId, name) {
      return EmbedVault.findOne({ guildId, name: name.trim() }).lean();
    },

    async getByType(guildId, type) {
      return EmbedVault.findOne({ guildId, type }).sort({ updatedAt: -1 }).lean();
    },

    async getByLinkedInvite(guildId, inviteCode) {
      if (!inviteCode) return null;
      return EmbedVault.findOne({ guildId, linkedInviteCode: inviteCode.trim() }).lean();
    },

    async upsert(guildId, name, data, type = 'Manual', metadata = {}) {
      return EmbedVault.findOneAndUpdate(
        { guildId, name: name.trim() },
        {
          $set: {
            guildId,
            name: name.trim(),
            data,
            type,
            linkedInviteCode: metadata.linkedInviteCode ?? '',
            linkedPartnerRole: metadata.linkedPartnerRole ?? '',
            authorName: metadata.authorName ?? '',
            authorIcon: metadata.authorIcon ?? '',
            footerText: metadata.footerText ?? '',
            footerIcon: metadata.footerIcon ?? '',
            includeTimestamp: metadata.includeTimestamp ?? false,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    },

    async delete(guildId, name) {
      return EmbedVault.findOneAndDelete({ guildId, name: name.trim() });
    },

    async bindInvite(guildId, name, inviteCode) {
      const doc = await EmbedVault.findOne({ guildId, name: name.trim() });
      if (!doc) return null;
      doc.linkedInviteCode = inviteCode.trim();
      return doc.save();
    },

    async bindInviteWithRole(guildId, name, inviteCode, partnerRoleId) {
      const doc = await EmbedVault.findOne({ guildId, name: name.trim() });
      if (!doc) return null;
      doc.linkedInviteCode = inviteCode.trim();
      if (partnerRoleId) {
        doc.linkedPartnerRole = partnerRoleId;
      }
      return doc.save();
    },

    async openManager(interaction) {
      try {
        const embeds = await this.list(interaction.guildId);

        if (!embeds || embeds.length === 0) {
          return interaction.reply({
            content: '📦 Embed vault is empty. Create your first embed!',
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

        const menu = new StringSelectMenuBuilder()
          .setCustomId('embedvault_select')
          .setPlaceholder('Select an embed to manage…')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(
            embeds.map(item => ({
              label: item.name.length > 25 ? item.name.substring(0, 22) + '…' : item.name,
              value: item.name,
              description: `Type: ${item.type}${item.linkedInviteCode ? ' 🔗' : ''}`,
            }))
          );

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('embedvault_create')
            .setLabel('➕ Create New')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('embedvault_import')
            .setLabel('📥 Import JSON')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
          content: `## 📦 Embed Manager\n${embeds.length} embed(s) in vault — select one to edit, or create a new one.`,
          components: [new ActionRowBuilder().addComponents(menu), actionRow],
          ephemeral: true,
        });
      } catch (err) {
        console.error('[EmbedVaultModule.openManager]', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Failed to open embed manager.', ephemeral: true });
        }
      }
    },

    async openModularEditor(interaction, embedDoc = null) {
      try {
        const isEdit = !!embedDoc;

        const content = isEdit
          ? `## ✏️ Editing: **${embedDoc.name}**\nClick a section to edit it. Changes are saved immediately.`
          : '## ➕ Create New Embed\nFill in each section. Start with **Basic Info**.';

        const components = isEdit ? [buildEditorRow(embedDoc.name)] : [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('embedvault_basicinfo_create')
              .setLabel('✏️ Basic Info')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('embedvault_authorfooter_create')
              .setLabel('👤 Author/Footer')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('embedvault_images_create')
              .setLabel('🖼️ Images')
              .setStyle(ButtonStyle.Primary),
          ),
        ];

        if (isEdit) {
          const previewEmbed = createPreview(buildFullData(embedDoc), { member: interaction.member });
          return interaction.reply({
            content,
            embeds: [previewEmbed],
            components,
            ephemeral: true,
          });
        }

        return interaction.reply({ content, components, ephemeral: true });
      } catch (err) {
        console.error('[EmbedVaultModule.openModularEditor]', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Failed to open modular editor.', ephemeral: true });
        }
      }
    },

    async openBasicInfoModal(interaction, embedDoc = null) {
      const isEdit = !!embedDoc;
      const modal = new ModalBuilder()
        .setCustomId(isEdit ? `embedvault_basicinfo_submit:${embedDoc.name}` : 'embedvault_basicinfo_submit_create')
        .setTitle(isEdit ? `Edit Basic Info – ${embedDoc.name}` : 'Create – Basic Info');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embed_name')
            .setLabel('Embed Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('e.g., Welcome Card')
            .setValue(isEdit ? embedDoc.name : '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embed_type')
            .setLabel('Type (Welcome/Goodbye/Partner/Manual)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(isEdit ? embedDoc.type : 'Manual')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('Supports `{user.name}`, `{server}`, `{choose:A|B}`…')
            .setValue(embedDoc?.data?.title ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder('Main text. Placeholders: `{user.name}`, `{member_count}`, …')
            .setValue(embedDoc?.data?.description ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('color')
            .setLabel('Color (hex, e.g. #FF5733)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(embedDoc?.data?.color ?? '#2f3136')
        )
      );

      await interaction.showModal(modal);
    },

    async handleSelectMenu(interaction) {
      try {
        if (!interaction.isStringSelectMenu()) return;
        if (interaction.customId !== 'embedvault_select') return;

        const selectedName = interaction.values?.[0];
        if (!selectedName) {
          return interaction.reply({ content: '❌ No embed selected.', ephemeral: true });
        }

        const embedDoc = await this.getByName(interaction.guildId, selectedName);
        if (!embedDoc) {
          return interaction.reply({ content: `❌ Embed not found: **${selectedName}**`, ephemeral: true });
        }

        await this.openModularEditor(interaction, embedDoc);
      } catch (err) {
        console.error('[EmbedVaultModule.handleSelectMenu]', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Failed to select embed.', ephemeral: true });
        }
      }
    },

    async handleButtonInteraction(interaction) {
      try {
        if (!interaction.isButton()) return;
        const { customId } = interaction;

        // Basic Info
        if (customId.startsWith('embedvault_basicinfo:')) {
          const name = customId.split(':')[1];
          const embedDoc = await this.getByName(interaction.guildId, name);
          if (!embedDoc) return interaction.reply({ content: '❌ Embed not found.', ephemeral: true });
          return this.openBasicInfoModal(interaction, embedDoc);
        }
        if (customId === 'embedvault_basicinfo_create') {
          return this.openBasicInfoModal(interaction);
        }

        // Author/Footer
        if (customId.startsWith('embedvault_authorfooter:')) {
          const name = customId.split(':')[1];
          const embedDoc = await this.getByName(interaction.guildId, name);
          if (!embedDoc) return interaction.reply({ content: '❌ Embed not found.', ephemeral: true });
          return this.openAuthorFooterModal(interaction, embedDoc);
        }
        if (customId === 'embedvault_authorfooter_create') {
          return this.openAuthorFooterModal(interaction);
        }

        // Images
        if (customId.startsWith('embedvault_images:')) {
          const name = customId.split(':')[1];
          const embedDoc = await this.getByName(interaction.guildId, name);
          if (!embedDoc) return interaction.reply({ content: '❌ Embed not found.', ephemeral: true });
          return this.openImagesModal(interaction, embedDoc);
        }
        if (customId === 'embedvault_images_create') {
          return this.openImagesModal(interaction);
        }

        // Preview
        if (customId.startsWith('embedvault_preview_modal:')) {
          const name = customId.split(':')[1];
          const embedDoc = await this.getByName(interaction.guildId, name);
          if (!embedDoc) return interaction.reply({ content: '❌ Embed not found.', ephemeral: true });
          return this.openLivePreviewModal(interaction, embedDoc);
        }

        // Create
        if (customId === 'embedvault_create') {
          return this.openModularEditor(interaction);
        }

        // Delete
        if (customId.startsWith('embedvault_delete:')) {
          const name = customId.split(':')[1];
          await this.delete(interaction.guildId, name);
          return interaction.reply({ content: `✅ Deleted **${name}** from vault.`, ephemeral: true });
        }

      } catch (err) {
        console.error('[EmbedVaultModule.handleButtonInteraction]', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Embed button action failed.', ephemeral: true });
        }
      }
    },

    async handleModalSubmit(interaction) {
      try {
        if (!interaction.isModalSubmit()) return;
        const { customId } = interaction;

        // ── Basic Info (create) ───────────────────────────────────────────────
        if (customId === 'embedvault_basicinfo_submit_create') {
          const name = interaction.fields.getTextInputValue('embed_name').trim();
          const type = interaction.fields.getTextInputValue('embed_type').trim();
          const title = interaction.fields.getTextInputValue('title');
          const description = interaction.fields.getTextInputValue('description');
          const color = interaction.fields.getTextInputValue('color').trim();

          if (!name) return interaction.reply({ content: '❌ Embed name is required.', ephemeral: true });

          const validTypes = ['Welcome', 'Goodbye', 'Partner', 'Manual'];
          if (!validTypes.includes(type)) {
            return interaction.reply({
              content: `❌ Invalid type. Must be one of: Welcome, Goodbye, Partner, Manual`,
              ephemeral: true,
            });
          }

          const data = {};
          if (title) data.title = title;
          if (description) data.description = description;
          if (color) data.color = color;

          const errors = validateEmbed(data);
          if (errors.length > 0) {
            return interaction.reply({
              content: `❌ Validation errors:\n${errors.map(e => `• ${e}`).join('\n')}`,
              ephemeral: true,
            });
          }

          const created = await this.upsert(interaction.guildId, name, data, type);
          const previewEmbed = createPreview(buildFullData(created), { member: interaction.member });

          return interaction.reply({
            content: `## ✏️ Editing: **${created.name}**\n✅ Created! (Type: ${created.type}) Add Author/Footer and Images next.`,
            embeds: [previewEmbed],
            components: [buildEditorRow(created.name)],
            ephemeral: true,
          });
        }

        // ── Basic Info (edit) ─────────────────────────────────────────────────
        if (customId.startsWith('embedvault_basicinfo_submit:')) {
          const originalName = customId.split(':')[1];
          const vaultItem = await this.getByName(interaction.guildId, originalName);
          if (!vaultItem) return interaction.reply({ content: '❌ Embed not found.', ephemeral: true });

          const newName = interaction.fields.getTextInputValue('embed_name').trim();
          const newType = interaction.fields.getTextInputValue('embed_type').trim();
          const title = interaction.fields.getTextInputValue('title');
          const description = interaction.fields.getTextInputValue('description');
          const color = interaction.fields.getTextInputValue('color').trim();

          const validTypes = ['Welcome', 'Goodbye', 'Partner', 'Manual'];
          if (!validTypes.includes(newType)) {
            return interaction.reply({
              content: `❌ Invalid type. Must be one of: Welcome, Goodbye, Partner, Manual`,
              ephemeral: true,
            });
          }

          const updatedData = JSON.parse(JSON.stringify(vaultItem.data ?? {}));
          if (title) updatedData.title = title;
          else delete updatedData.title;
          if (description) updatedData.description = description;
          else delete updatedData.description;
          if (color) updatedData.color = color;
          else delete updatedData.color;

          const errors = validateEmbed(updatedData);
          if (errors.length > 0) {
            return interaction.reply({
              content: `❌ Validation errors:\n${errors.map(e => `• ${e}`).join('\n')}`,
              ephemeral: true,
            });
          }

          const finalName = newName || originalName;
          const updated = await this.upsert(
            interaction.guildId,
            finalName,
            updatedData,
            newType,
            {
              linkedInviteCode: vaultItem.linkedInviteCode,
              linkedPartnerRole: vaultItem.linkedPartnerRole,
              authorName: vaultItem.authorName,
              authorIcon: vaultItem.authorIcon,
              footerText: vaultItem.footerText,
              footerIcon: vaultItem.footerIcon,
              includeTimestamp: vaultItem.includeTimestamp,
            }
          );

          const previewEmbed = createPreview(buildFullData(updated), { member: interaction.member });

          return interaction.reply({
            content: `## ✏️ Editing: **${updated.name}**\n✅ Basic Info saved! (Type: ${updated.type})`,
            embeds: [previewEmbed],
            components: [buildEditorRow(updated.name)],
            ephemeral: true,
          });
        }
      } catch (err) {
        console.error('[EmbedVaultModule.handleModalSubmit]', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Embed operation failed.', ephemeral: true });
        }
      }
    },

    async openAuthorFooterModal(interaction, embedDoc = null) {
      const isEdit = !!embedDoc;
      const modal = new ModalBuilder()
        .setCustomId(isEdit ? `embedvault_authorfooter_submit:${embedDoc.name}` : 'embedvault_authorfooter_submit_create')
        .setTitle(isEdit ? `Edit Author/Footer – ${embedDoc.name}` : 'Create – Author/Footer');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('author_name')
            .setLabel('Author Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('`{user.name}` or custom text')
            .setValue(embedDoc?.authorName ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('author_icon')
            .setLabel('Author Icon URL (supports `{user.avatar}`)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('`{user.avatar}` or https://…')
            .setValue(embedDoc?.authorIcon ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('footer_text')
            .setLabel('Footer Text')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('`{server}` • `{member_count}` members')
            .setValue(embedDoc?.footerText ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('footer_icon')
            .setLabel('Footer Icon URL (supports `{server.icon}`)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('https://…')
            .setValue(embedDoc?.footerIcon ?? '')
        )
      );

      await interaction.showModal(modal);
    },

    async openImagesModal(interaction, embedDoc = null) {
      const isEdit = !!embedDoc;
      const modal = new ModalBuilder()
        .setCustomId(isEdit ? `embedvault_images_submit:${embedDoc.name}` : 'embedvault_images_submit_create')
        .setTitle(isEdit ? `Edit Images – ${embedDoc.name}` : 'Create – Images');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('image_url')
            .setLabel('Image URL (supports placeholders)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('https://… or `{user.avatar}`')
            .setValue(embedDoc?.data?.image?.url ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('thumbnail_url')
            .setLabel('Thumbnail URL (supports placeholders)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('https://… or `{user.avatar}`')
            .setValue(embedDoc?.data?.thumbnail?.url ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('include_timestamp')
            .setLabel('Include Timestamp? (true / false)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('true or false')
            .setValue(embedDoc?.includeTimestamp ? 'true' : 'false')
        )
      );

      await interaction.showModal(modal);
    },

    async openLivePreviewModal(interaction, embedDoc) {
      if (!embedDoc) {
        return interaction.reply({ content: '❌ No embed data to preview.', ephemeral: true });
      }

      try {
        const previewEmbed = createPreview(buildFullData(embedDoc), { member: interaction.member });

        return interaction.reply({
          content: `## 👁️ Live Preview — **${embedDoc.name}**\n*Placeholders rendered with your account data.*`,
          embeds: [previewEmbed],
          ephemeral: true,
        });
      } catch (err) {
        console.error('[EmbedVaultModule.openLivePreviewModal]', err);
        return interaction.reply({ content: '❌ Failed to generate preview.', ephemeral: true });
      }
    },
  };
}
