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
import { render, createPreview, validateEmbed } from '../src/core/embedEngine.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the full data object for render/preview from a vault document.
 * Merges the flat schema fields (authorName, footerText, etc.) into the
 * data blob so embedEngine sees everything in one place.
 */
function buildFullData(doc) {
  return {
    ...doc.data,
    // Flat schema fields always win over anything buried in data
    authorName: doc.authorName || doc.data?.author?.name || '',
    authorIcon: doc.authorIcon || doc.data?.author?.iconURL || '',
    footerText: doc.footerText || doc.data?.footer?.text || '',
    footerIcon: doc.footerIcon || doc.data?.footer?.iconURL || '',
    timestamp: doc.includeTimestamp,
  };
}

/**
 * Build the editor action row for a known embed name.
 */
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

    async upsert(guildId, name, data, type = 'Manual', metadata = {}) {
      // CRITICAL FIX: use $set so Mongoose correctly writes the Mixed/Object `data` field.
      // Without $set, a plain replacement object skips Mongoose's change-detection for
      // Mixed fields, meaning image/thumbnail nested objects are silently not persisted.
      return EmbedVault.findOneAndUpdate(
        { guildId, name: name.trim() },
        {
          $set: {
            guildId,
            name:             name.trim(),
            data,             // full embed data blob including image/thumbnail
            type,
            // Empty string is a valid intentional clear — use ?? not ||
            authorName:       metadata.authorName       ?? '',
            authorIcon:       metadata.authorIcon       ?? '',
            footerText:       metadata.footerText       ?? '',
            footerIcon:       metadata.footerIcon       ?? '',
            includeTimestamp: metadata.includeTimestamp ?? false,
          },
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

    async getByType(guildId, type) {
      return EmbedVault.findOne({ guildId, type }).sort({ updatedAt: -1 }).lean();
    },

    async link(guildId, name, inviteCode) {
      const doc = await EmbedVault.findOne({ guildId, name: name.trim() });
      if (!doc) return null;
      doc.linkedInviteCode = inviteCode.trim();
      return doc.save();
    },

    // ── Manager ───────────────────────────────────────────────────────────────

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
              description: `Type: ${item.type}`,
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

    // ── Modular Editor ────────────────────────────────────────────────────────

    async openModularEditor(interaction, embedDoc = null) {
      try {
        const isEdit = !!embedDoc;

        // FIX #2 & #5 – always show "Editing: **[Name]**" and use full data for preview
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
          // FIX #2 – pass full merged data so author/footer render in preview
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

    // ── Modal: Basic Info ─────────────────────────────────────────────────────

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
            .setLabel('Type (Required)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Welcome | Goodbye | Partner | Manual')
            .setValue(isEdit ? (embedDoc?.type ?? 'Manual') : 'Manual')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('Supports {user.name}, {server}, {choose:A|B}…')
            .setValue(embedDoc?.data?.title ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder('Main text. Placeholders: {user.name}, {member_count}, …')
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

    // ── Modal: Author & Footer ────────────────────────────────────────────────

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
            .setPlaceholder('{user.name} or custom text')
            .setValue(embedDoc?.authorName ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('author_icon')
            .setLabel('Author Icon URL  (supports {user.avatar})')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('{user.avatar}  or  https://…')
            .setValue(embedDoc?.authorIcon ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('footer_text')
            .setLabel('Footer Text')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('{server} • {member_count} members')
            .setValue(embedDoc?.footerText ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('footer_icon')
            .setLabel('Footer Icon URL  (supports {server.icon})')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('https://…')
            .setValue(embedDoc?.footerIcon ?? '')
        )
      );

      await interaction.showModal(modal);
    },

    // ── Modal: Images ─────────────────────────────────────────────────────────

    async openImagesModal(interaction, embedDoc = null) {
      const isEdit = !!embedDoc;
      const modal = new ModalBuilder()
        .setCustomId(isEdit ? `embedvault_images_submit:${embedDoc.name}` : 'embedvault_images_submit_create')
        .setTitle(isEdit ? `Edit Images – ${embedDoc.name}` : 'Create – Images');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('image_url')
            .setLabel('Image URL  (supports placeholders)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('https://…  or  {user.avatar}')
            .setValue(embedDoc?.data?.image?.url ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('thumbnail_url')
            .setLabel('Thumbnail URL  (supports placeholders)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('https://…  or  {user.avatar}')
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

    // ── Live Preview ──────────────────────────────────────────────────────────

    async openLivePreviewModal(interaction, embedDoc) {
      if (!embedDoc) {
        return interaction.reply({ content: '❌ No embed data to preview.', ephemeral: true });
      }

      try {
        // FIX #4 – full merged data with real member context for accurate placeholder render
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

    // ── Select Menu ───────────────────────────────────────────────────────────

    async handleSelectMenu(interaction) {
      try {
        if (!interaction.isAnySelectMenu()) return;
        if (!interaction.customId.startsWith('embedvault_')) return;

        const selectedName = interaction.values?.[0];
        if (!selectedName) {
          return interaction.reply({ content: '❌ No embed selected.', ephemeral: true });
        }

        const embedDoc = await this.getByName(interaction.guildId, selectedName);
        if (!embedDoc) {
          return interaction.reply({ content: `❌ Embed not found: **${selectedName}**`, ephemeral: true });
        }

        // FIX #5 – openModularEditor now always shows "Editing: **[Name]**"
        await this.openModularEditor(interaction, embedDoc);
      } catch (err) {
        console.error('[EmbedVaultModule.handleSelectMenu]', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Failed to select embed.', ephemeral: true });
        }
      }
    },

    // ── Button Interactions ───────────────────────────────────────────────────

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
        if (customId === 'embedvault_preview_modal_create') {
          return interaction.reply({ content: '⚠️ Create Basic Info first, then you can preview.', ephemeral: true });
        }

        // Create
        if (customId === 'embedvault_create') {
          return this.openModularEditor(interaction);
        }

        // Import
        if (customId === 'embedvault_import') {
          const modal = new ModalBuilder()
            .setCustomId('embedvault_import_modal')
            .setTitle('Import Embed JSON');

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('name')
                .setLabel('Embed Name')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('type')
                .setLabel('Type')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue('Manual')
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('json')
                .setLabel('Embed JSON')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
            )
          );

          return interaction.showModal(modal);
        }

        // Send
        if (customId.startsWith('embedvault_send:')) {
          const name = customId.split(':')[1];
          const embedDoc = await this.getByName(interaction.guildId, name);
          if (!embedDoc) return interaction.reply({ content: '❌ Embed not found.', ephemeral: true });

          const channel = interaction.channel;
          if (!channel?.isTextBased()) {
            return interaction.reply({ content: '❌ Unable to send from this channel context.', ephemeral: true });
          }

          // FIX – render with full merged data and wrap in EmbedBuilder
          const rendered = render(buildFullData(embedDoc), { member: interaction.member });
          await channel.send({ embeds: [new EmbedBuilder(rendered)] });
          return interaction.reply({ content: `✅ Sent **${name}** to channel.`, ephemeral: true });
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

    // ── Modal Submissions ─────────────────────────────────────────────────────

    async handleModalSubmit(interaction) {
      try {
        if (!interaction.isModalSubmit()) return;
        const { customId } = interaction;

        // ── Import ────────────────────────────────────────────────────────────
        if (customId === 'embedvault_import_modal') {
          const name = interaction.fields.getTextInputValue('name').trim();
          const type = interaction.fields.getTextInputValue('type').trim();
          const jsonText = interaction.fields.getTextInputValue('json').trim();

          let parsed;
          try {
            parsed = JSON.parse(jsonText);
            if (parsed.embeds && Array.isArray(parsed.embeds)) parsed = parsed.embeds[0];
          } catch {
            return interaction.reply({ content: '❌ Invalid JSON format.', ephemeral: true });
          }

          const errors = validateEmbed(parsed);
          if (errors.length > 0) {
            return interaction.reply({
              content: `❌ Validation errors:\n${errors.map(e => `• ${e}`).join('\n')}`,
              ephemeral: true,
            });
          }

          await this.upsert(interaction.guildId, name, parsed, type);
          return interaction.reply({ content: `✅ Imported **${name}**.`, ephemeral: true });
        }

        // ── Basic Info (edit) ─────────────────────────────────────────────────
        if (customId.startsWith('embedvault_basicinfo_submit:')) {
          const originalName = customId.split(':')[1];
          const vaultItem = await this.getByName(interaction.guildId, originalName);
          if (!vaultItem) return interaction.reply({ content: '❌ Embed not found.', ephemeral: true });

          // FIX #1 – read raw values; empty string = intentional clear, not a deletion
          const newName      = interaction.fields.getTextInputValue('embed_name').trim();
          const newType      = interaction.fields.getTextInputValue('embed_type').trim().toLowerCase();
          const title        = interaction.fields.getTextInputValue('title');        // no .trim() to preserve intent
          const description  = interaction.fields.getTextInputValue('description');
          const color        = interaction.fields.getTextInputValue('color').trim();

          // Validate type
          const validTypes = ['welcome', 'goodbye', 'partner', 'manual'];
          if (!validTypes.includes(newType)) {
            return interaction.reply({
              content: `❌ Invalid type: \`${newType}\`. Must be one of: Welcome, Goodbye, Partner, Manual`,
              ephemeral: true,
            });
          }

          // Deep-copy: preserves nested objects (image, thumbnail, fields) correctly
          const updatedData = JSON.parse(JSON.stringify(vaultItem.data ?? {}));
          if (title)       updatedData.title       = title;
          else             delete updatedData.title;
          if (description) updatedData.description = description;
          else             delete updatedData.description;
          if (color)       updatedData.color        = color;
          else             delete updatedData.color;

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
            newType.charAt(0).toUpperCase() + newType.slice(1),
            {
              authorName:       vaultItem.authorName,
              authorIcon:       vaultItem.authorIcon,
              footerText:       vaultItem.footerText,
              footerIcon:       vaultItem.footerIcon,
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

        // ── Basic Info (create) ───────────────────────────────────────────────
        if (customId === 'embedvault_basicinfo_submit_create') {
          const name        = interaction.fields.getTextInputValue('embed_name').trim();
          const typeInput   = interaction.fields.getTextInputValue('embed_type').trim().toLowerCase();
          const title       = interaction.fields.getTextInputValue('title');
          const description = interaction.fields.getTextInputValue('description');
          const color       = interaction.fields.getTextInputValue('color').trim();

          if (!name) return interaction.reply({ content: '❌ Embed name is required.', ephemeral: true });

          // Validate type
          const validTypes = ['welcome', 'goodbye', 'partner', 'manual'];
          if (!validTypes.includes(typeInput)) {
            return interaction.reply({
              content: `❌ Invalid type: \`${typeInput}\`. Must be one of: Welcome, Goodbye, Partner, Manual`,
              ephemeral: true,
            });
          }

          const data = {};
          if (title)       data.title       = title;
          if (description) data.description = description;
          if (color)       data.color       = color;

          const errors = validateEmbed(data);
          if (errors.length > 0) {
            return interaction.reply({
              content: `❌ Validation errors:\n${errors.map(e => `• ${e}`).join('\n')}`,
              ephemeral: true,
            });
          }

          const finalType = typeInput.charAt(0).toUpperCase() + typeInput.slice(1);
          const created = await this.upsert(interaction.guildId, name, data, finalType);
          const previewEmbed = createPreview(buildFullData(created), { member: interaction.member });

          return interaction.reply({
            content: `## ✏️ Editing: **${created.name}**\n✅ Created! (Type: ${created.type}) Add Author/Footer and Images next.`,
            embeds: [previewEmbed],
            components: [buildEditorRow(created.name)],
            ephemeral: true,
          });
        }

        // ── Author/Footer (edit) ──────────────────────────────────────────────
        if (customId.startsWith('embedvault_authorfooter_submit:')) {
          const name = customId.split(':')[1];
          const vaultItem = await this.getByName(interaction.guildId, name);
          if (!vaultItem) return interaction.reply({ content: '❌ Embed not found.', ephemeral: true });

          // FIX #1 – empty string = intentional clear (saved as '' not undefined)
          const authorName = interaction.fields.getTextInputValue('author_name');
          const authorIcon = interaction.fields.getTextInputValue('author_icon').trim();
          const footerText = interaction.fields.getTextInputValue('footer_text');
          const footerIcon = interaction.fields.getTextInputValue('footer_icon').trim();

          const updated = await this.upsert(
            interaction.guildId,
            name,
            vaultItem.data,
            vaultItem.type,
            { authorName, authorIcon, footerText, footerIcon, includeTimestamp: vaultItem.includeTimestamp }
          );

          const previewEmbed = createPreview(buildFullData(updated), { member: interaction.member });

          return interaction.reply({
            content: `## ✏️ Editing: **${updated.name}**\n✅ Author/Footer saved!`,
            embeds: [previewEmbed],
            components: [buildEditorRow(updated.name)],
            ephemeral: true,
          });
        }

        if (customId === 'embedvault_authorfooter_submit_create') {
          return interaction.reply({
            content: '⚠️ Please create Basic Info first, then come back to set Author/Footer.',
            ephemeral: true,
          });
        }

        // ── Images (edit) ─────────────────────────────────────────────────────
        if (customId.startsWith('embedvault_images_submit:')) {
          const name = customId.split(':')[1];
          const vaultItem = await this.getByName(interaction.guildId, name);
          if (!vaultItem) return interaction.reply({ content: '❌ Embed not found.', ephemeral: true });

          const imageUrl     = interaction.fields.getTextInputValue('image_url').trim();
          const thumbnailUrl = interaction.fields.getTextInputValue('thumbnail_url').trim();
          const tsStr        = interaction.fields.getTextInputValue('include_timestamp').trim().toLowerCase();
          const timestamp    = tsStr === 'true' || tsStr === '1';

          // Deep-copy so nested objects (image, thumbnail, fields) are fresh instances.
          // This prevents Mongoose Mixed-field change-detection from silently dropping
          // nested object writes when the doc comes back from a .lean() query.
          const updatedData = JSON.parse(JSON.stringify(vaultItem.data ?? {}));

          // Explicitly assign image/thumbnail so they land in data.image.url / data.thumbnail.url
          if (imageUrl)     updatedData.image     = { url: imageUrl };
          else              delete updatedData.image;

          if (thumbnailUrl) updatedData.thumbnail = { url: thumbnailUrl };
          else              delete updatedData.thumbnail;

          const errors = validateEmbed(updatedData);
          if (errors.length > 0) {
            return interaction.reply({
              content: `❌ Validation errors:\n${errors.map(e => `• ${e}`).join('\n')}`,
              ephemeral: true,
            });
          }

          const updated = await this.upsert(
            interaction.guildId,
            name,
            updatedData,
            vaultItem.type,
            {
              authorName:       vaultItem.authorName,
              authorIcon:       vaultItem.authorIcon,
              footerText:       vaultItem.footerText,
              footerIcon:       vaultItem.footerIcon,
              includeTimestamp: timestamp,
            }
          );

          const previewEmbed = createPreview(buildFullData(updated), { member: interaction.member });

          return interaction.reply({
            content: `## ✏️ Editing: **${updated.name}**\n✅ Images & Timestamp saved!`,
            embeds: [previewEmbed],
            components: [buildEditorRow(updated.name)],
            ephemeral: true,
          });
        }

        if (customId === 'embedvault_images_submit_create') {
          return interaction.reply({
            content: '⚠️ Please create Basic Info first, then come back to set Images.',
            ephemeral: true,
          });
        }
      } catch (err) {
        console.error('[EmbedVaultModule.handleModalSubmit]', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Failed to save embed.', ephemeral: true });
        }
      }
    },

    // Legacy helper kept for any external callers
    async getEditorMenuButtons(guildId, embedName) {
      return buildEditorRow(embedName);
    },
  };
}
