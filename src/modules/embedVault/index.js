import EmbedVault from './schema.js';
import EmbedManagerModule from './manager.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
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

// Build compliant component rows (max 5 buttons per row, max 5 rows per message)
function buildEditorRows(embedName) {
  return [
    // Row 1: Edit operations (Title/Description/Color, Author/Footer, Images)
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`embedvault_basicinfo:${embedName}`)
        .setLabel('✏️ معلومات')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`embedvault_authorfooter:${embedName}`)
        .setLabel('👤 مؤلف/تذييل')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`embedvault_images:${embedName}`)
        .setLabel('🖼️ صور')
        .setStyle(ButtonStyle.Primary),
    ),
    // Row 2: Actions (Preview, Send, Delete)
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`embedvault_preview_modal:${embedName}`)
        .setLabel('👁️ معاينة')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`embedvault_send:${embedName}`)
        .setLabel('📤 إرسال')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`embedvault_delete:${embedName}`)
        .setLabel('🗑️ حذف')
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

// ─── Module ───────────────────────────────────────────────────────────────────

export default function EmbedVaultModule(client) {
  const manager = EmbedManagerModule(null); // Will be used as namespace for UI operations
  
  const vaultMethods = {
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

    async openManager(interaction, page = 0) {
      // Deploy Select Menu version from manager.js
      return manager.displayManager.call({ embedVaultModule: this }, interaction, page);
    },

    async openModularEditor(interaction, embedDoc = null) {
      try {
        const isEdit = !!embedDoc;

        const content = isEdit
          ? `## ✏️ جاري التعديل: **${embedDoc.name}**\nانقر على قسم لتعديله.`
          : '## ➕ إنشاء إمبد جديد\nملء كل قسم. ابدأ بـ **المعلومات الأساسية**.';

        const components = isEdit ? buildEditorRows(embedDoc.name) : [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('embedvault_basicinfo_create')
              .setLabel('✏️ معلومات')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('embedvault_authorfooter_create')
              .setLabel('👤 مؤلف/تذييل')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('embedvault_images_create')
              .setLabel('🖼️ صور')
              .setStyle(ButtonStyle.Primary),
          ),
        ];

        if (isEdit) {
          const previewEmbed = createPreview(buildFullData(embedDoc), { member: interaction.member });
          
          // MUST use editReply if deferred to avoid "Error occurred" message
          if (interaction.deferred) {
            return await interaction.editReply({
              content,
              embeds: [previewEmbed],
              components,
            });
          }
          
          return interaction.reply({
            content,
            embeds: [previewEmbed],
            components,
            ephemeral: true,
          });
        }

        if (interaction.deferred) {
          return await interaction.editReply({ content, components });
        }
        
        return interaction.reply({ content, components, ephemeral: true });
      } catch (err) {
        console.error('[EmbedVaultModule.openModularEditor]', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ فشل فتح محرر الإمبد.', ephemeral: true });
        }
      }
    },

    async openBasicInfoModal(interaction, embedDoc = null) {
      const isEdit = !!embedDoc;
      // Fix #1: Keep modal title under 45 characters
      const truncatedName = embedDoc?.name ? embedDoc.name.slice(0, 20) : '';
      const modalTitle = isEdit 
        ? `تعديل: ${truncatedName}` 
        : 'إنشاء الإمبد – معلومات';
      
      const modal = new ModalBuilder()
        .setCustomId(isEdit ? `embedvault_basicinfo_submit:${embedDoc.name}` : 'embedvault_basicinfo_submit_create')
        .setTitle(modalTitle);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embed_name')
            .setLabel('اسم الإمبد')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('أعطِ إمبدك اسماً يليق بعظمة إمبراطوريتك....')
            .setValue(isEdit ? embedDoc.name : '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embed_type')
            .setLabel('النوع (Welcome/Goodbye/Partner/Manual)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('حدد غرض الإمبد: ترحيب أم وداع أم شراكة....')
            .setValue(isEdit ? embedDoc.type : 'Manual')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('title')
            .setLabel('العنوان')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('مثال: مرحباً {user.name} في {server}! اكتب عنواناً مهيباً....')
            .setValue(embedDoc?.data?.title ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('الوصف')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder('اكتب هنا الترحيب الذي يليق بأعضاء إمبراطوريتك. دع روحك تتحدث....')
            .setValue(embedDoc?.data?.description ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('color')
            .setLabel('اللون (hex، مثل #DAA520 للذهب)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('#DAA520 (ذهبي رفيع) أو #9ACD32 (أخضر فستق)')
            .setValue(embedDoc?.data?.color ?? '#DAA520')
        )
      );

      await interaction.showModal(modal);
    },

    async handleSelectMenu(interaction) {
      // CRITICAL: Defer immediately to prevent "Error occurred" message
      if (interaction.isSelectMenu && !interaction.deferred) {
        await interaction.deferUpdate();
      }
      
      try {
        if (!interaction.isStringSelectMenu()) return;
        const { customId } = interaction;
        const selectedValue = interaction.values?.[0];

        if (customId === 'embedvault_select') {
          if (!selectedValue) {
            return await interaction.editReply({ content: '❌ لم يتم تحديد إمبد.', components: [] });
          }

          const embedDoc = await this.getByName(interaction.guildId, selectedValue);
          if (!embedDoc) {
            return await interaction.editReply({ content: `❌ لم يتم العثور على الإمبد: **${selectedValue}**`, components: [] });
          }

          // Open modular editor - will use editReply due to deferUpdate
          await this.openModularEditor(interaction, embedDoc);
        } else if (customId === 'embedvault_action') {
          if (!selectedValue) return;

          if (selectedValue === 'action_create') {
            await this.openVisualEditor(interaction);
          } else if (selectedValue === 'action_import') {
            await this.openImportModal(interaction);
          } else if (selectedValue.startsWith('action_prev:')) {
            const page = Math.max(0, parseInt(selectedValue.split(':')[1]) - 1);
            manager.embedVaultModule = this;
            return manager.updateManager(interaction, page);
          } else if (selectedValue.startsWith('action_next:')) {
            const page = parseInt(selectedValue.split(':')[1]) + 1;
            manager.embedVaultModule = this;
            return manager.updateManager(interaction, page);
          }
        }
      } catch (err) {
        console.error('[EmbedVaultModule.handleSelectMenu]', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ فشل اختيار الإمبد.', ephemeral: true });
        }
      }
    },

    async handleButtonInteraction(interaction) {
      try {
        if (!interaction.isButton()) return;
        const { customId } = interaction;

        // Embed Selection (New Premium Button System)
        if (customId.startsWith('embedvault_select:')) {
          const name = customId.split(':')[1];
          const embedDoc = await this.getByName(interaction.guildId, name);
          if (!embedDoc) return interaction.reply({ content: '❌ Embed not found.', ephemeral: true });
          return this.openModularEditor(interaction, embedDoc);
        }

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

        // Send Embed to Channel
        if (customId.startsWith('embedvault_send:')) {
          const name = customId.split(':')[1];
          const embedDoc = await this.getByName(interaction.guildId, name);
          if (!embedDoc) return interaction.reply({ content: '❌ Embed not found.', ephemeral: true });
          return this.openSendModal(interaction, embedDoc);
        }

        // Import Embed from JSON
        if (customId === 'embedvault_import') {
          return this.openImportModal(interaction);
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
          await interaction.deferReply({ ephemeral: true });
          
          const name = interaction.fields.getTextInputValue('embed_name').trim();
          const type = interaction.fields.getTextInputValue('embed_type').trim();
          const title = interaction.fields.getTextInputValue('title') || undefined;
          const description = interaction.fields.getTextInputValue('description') || undefined;
          const color = interaction.fields.getTextInputValue('color').trim() || undefined;

          if (!name) return interaction.editReply({ content: '❌ اسم الإمبد مطلوب.' });

          const validTypes = ['Welcome', 'Goodbye', 'Partner', 'Manual'];
          if (!validTypes.includes(type)) {
            return interaction.editReply({
              content: `❌ نوع غير صحيح. يجب أن يكون أحد: Welcome, Goodbye, Partner, Manual`,
            });
          }

          const data = {};
          // Fix #2: Use !== undefined to allow clearing fields
          if (title !== undefined) data.title = title;
          if (description !== undefined) data.description = description;
          if (color !== undefined) data.color = color;

          const errors = validateEmbed(data);
          if (errors.length > 0) {
            return interaction.editReply({
              content: `❌ أخطاء في الصحة:\n${errors.map(e => `• ${e}`).join('\n')}`,
            });
          }

          const created = await this.upsert(interaction.guildId, name, data, type);
          const previewEmbed = createPreview(buildFullData(created), { member: interaction.member });

          return interaction.editReply({
            content: `## ✏️ جاري التعديل: **${created.name}**\n✅ تم الإنشاء! (النوع: ${created.type}) أضف المؤلف/التذييل والصور.`,
            embeds: [previewEmbed],
            components: buildEditorRows(created.name),
          });
        }

        // ── Basic Info (edit) ─────────────────────────────────────────────────
        if (customId.startsWith('embedvault_basicinfo_submit:')) {
          await interaction.deferReply({ ephemeral: true });
          
          // Fix #4: Use .split(':').slice(1).join(':') to support names with colons
          const originalName = customId.split(':').slice(1).join(':');
          const vaultItem = await this.getByName(interaction.guildId, originalName);
          if (!vaultItem) return interaction.editReply({ content: '❌ لم يتم العثور على الإمبد.' });

          const newName = interaction.fields.getTextInputValue('embed_name').trim();
          const newType = interaction.fields.getTextInputValue('embed_type').trim();
          const titleInput = interaction.fields.getTextInputValue('title').trim();
          const title = titleInput ? titleInput : undefined;
          const descriptionInput = interaction.fields.getTextInputValue('description').trim();
          const description = descriptionInput ? descriptionInput : undefined;
          const color = interaction.fields.getTextInputValue('color').trim() || undefined;

          const validTypes = ['Welcome', 'Goodbye', 'Partner', 'Manual'];
          if (!validTypes.includes(newType)) {
            return interaction.editReply({
              content: `❌ نوع غير صحيح. يجب أن يكون أحد: Welcome, Goodbye, Partner, Manual`,
            });
          }

          const updatedData = JSON.parse(JSON.stringify(vaultItem.data ?? {}));
          // Fix #2: Use !== undefined for proper field clearing
          if (title !== undefined) updatedData.title = title;
          else delete updatedData.title;
          if (description !== undefined) updatedData.description = description;
          else delete updatedData.description;
          if (color !== undefined) updatedData.color = color;
          else delete updatedData.color;

          const errors = validateEmbed(updatedData);
          if (errors.length > 0) {
            return interaction.editReply({
              content: `❌ أخطاء في الصحة:\n${errors.map(e => `• ${e}`).join('\n')}`,
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

          return interaction.editReply({
            content: `## ✏️ جاري التعديل: **${updated.name}**\n✅ تم حفظ المعلومات الأساسية! (النوع: ${updated.type})`,
            embeds: [previewEmbed],
            components: buildEditorRows(updated.name),
          });
        }

        // ── Author/Footer (create) ────────────────────────────────────────────
        if (customId === 'embedvault_authorfooter_submit_create') {
          await interaction.deferReply({ ephemeral: true });
          
          const authorName = interaction.fields.getTextInputValue('author_name') || '';
          const authorIcon = interaction.fields.getTextInputValue('author_icon') || '';
          const footerText = interaction.fields.getTextInputValue('footer_text') || '';
          const footerIcon = interaction.fields.getTextInputValue('footer_icon') || '';

          return interaction.editReply({
            content: '❌ لم يتم العثور على إمبد نشط. ابدأ من إنشاء إمبد أولاً.',
          });
        }

        // ── Author/Footer (edit) ──────────────────────────────────────────────
        if (customId.startsWith('embedvault_authorfooter_submit:')) {
          await interaction.deferReply({ ephemeral: true });
          
          // Fix #4: Use .split(':').slice(1).join(':') to support names with colons
          const embedName = customId.split(':').slice(1).join(':');
          const vaultItem = await this.getByName(interaction.guildId, embedName);
          if (!vaultItem) return interaction.editReply({ content: '❌ لم يتم العثور على الإمبد.' });

          const authorName = interaction.fields.getTextInputValue('author_name') || undefined;
          const authorIcon = interaction.fields.getTextInputValue('author_icon') || undefined;
          const footerText = interaction.fields.getTextInputValue('footer_text') || undefined;
          const footerIcon = interaction.fields.getTextInputValue('footer_icon') || undefined;

          const updated = await this.upsert(
            interaction.guildId,
            embedName,
            vaultItem.data,
            vaultItem.type,
            {
              linkedInviteCode: vaultItem.linkedInviteCode,
              linkedPartnerRole: vaultItem.linkedPartnerRole,
              // Fix #3: Only set if data exists, don't set empty strings
              authorName: authorName !== undefined && authorName ? authorName : (vaultItem.authorName || ''),
              authorIcon: authorIcon !== undefined && authorIcon ? authorIcon : (vaultItem.authorIcon || ''),
              footerText: footerText !== undefined && footerText ? footerText : (vaultItem.footerText || ''),
              footerIcon: footerIcon !== undefined && footerIcon ? footerIcon : (vaultItem.footerIcon || ''),
              includeTimestamp: vaultItem.includeTimestamp,
            }
          );

          const previewEmbed = createPreview(buildFullData(updated), { member: interaction.member });

          return interaction.editReply({
            content: `## ✏️ جاري التعديل: **${updated.name}**\n✅ تم حفظ المؤلف/التذييل!`,
            embeds: [previewEmbed],
            components: buildEditorRows(updated.name),
          });
        }

        // ── Images (create) ───────────────────────────────────────────────────
        if (customId === 'embedvault_images_submit_create') {
          await interaction.deferReply({ ephemeral: true });
          
          return interaction.editReply({
            content: '❌ لم يتم العثور على إمبد نشط. ابدأ من إنشاء إمبد أولاً.',
          });
        }

        // ── Images (edit) ─────────────────────────────────────────────────────
        if (customId.startsWith('embedvault_images_submit:')) {
          await interaction.deferReply({ ephemeral: true });
          
          // Fix #4: Use .split(':').slice(1).join(':') to support names with colons
          const embedName = customId.split(':').slice(1).join(':');
          const vaultItem = await this.getByName(interaction.guildId, embedName);
          if (!vaultItem) return interaction.editReply({ content: '❌ لم يتم العثور على الإمبد.' });

          const imageUrlInput = interaction.fields.getTextInputValue('image_url').trim();
          const imageUrl = imageUrlInput ? imageUrlInput : undefined;
          const thumbnailUrlInput = interaction.fields.getTextInputValue('thumbnail_url').trim();
          const thumbnailUrl = thumbnailUrlInput ? thumbnailUrlInput : undefined;
          const includeTimestampStr = interaction.fields.getTextInputValue('include_timestamp') || 'false';
          const includeTimestamp = includeTimestampStr.toLowerCase() === 'true';

          const updatedData = JSON.parse(JSON.stringify(vaultItem.data ?? {}));
          // Fix #3: Only set if data exists
          if (imageUrl !== undefined && imageUrl) {
            updatedData.image = { url: imageUrl };
          } else {
            delete updatedData.image;
          }
          if (thumbnailUrl !== undefined && thumbnailUrl) {
            updatedData.thumbnail = { url: thumbnailUrl };
          } else {
            delete updatedData.thumbnail;
          }

          const updated = await this.upsert(
            interaction.guildId,
            embedName,
            updatedData,
            vaultItem.type,
            {
              linkedInviteCode: vaultItem.linkedInviteCode,
              linkedPartnerRole: vaultItem.linkedPartnerRole,
              authorName: vaultItem.authorName,
              authorIcon: vaultItem.authorIcon,
              footerText: vaultItem.footerText,
              footerIcon: vaultItem.footerIcon,
              includeTimestamp,
            }
          );

          const previewEmbed = createPreview(buildFullData(updated), { member: interaction.member });

          return interaction.editReply({
            content: `## ✏️ جاري التعديل: **${updated.name}**\n✅ تم حفظ الصور!`,
            embeds: [previewEmbed],
            components: buildEditorRows(updated.name),
          });
        }

        // ── Send Embed (modal submit) ─────────────────────────────────────────
        if (customId.startsWith('embedvault_send_submit:')) {
          await interaction.deferReply({ ephemeral: true });
          
          // Fix #4: Use .split(':').slice(1).join(':') to support names with colons
          const embedName = customId.split(':').slice(1).join(':');
          const channelId = interaction.fields.getTextInputValue('channel_id').trim();
          
          const vaultItem = await this.getByName(interaction.guildId, embedName);
          if (!vaultItem) return interaction.editReply({ content: '❌ لم يتم العثور على الإمبد.' });

          try {
            const channel = await interaction.guild.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
              return interaction.editReply({ content: '❌ القناة غير صحيحة أو ليست قناة نصية.' });
            }

            const renderedEmbed = render(buildFullData(vaultItem), { member: interaction.member });
            const embedToSend = new EmbedBuilder()
              .setColor(renderedEmbed.color || 0xDAA520);
            
            // Fix #3: Only set if data exists
            if (renderedEmbed.title) embedToSend.setTitle(renderedEmbed.title);
            if (renderedEmbed.description) embedToSend.setDescription(renderedEmbed.description);
            if (renderedEmbed.author?.name) {
              embedToSend.setAuthor({ 
                name: renderedEmbed.author.name, 
                iconURL: renderedEmbed.author.iconURL 
              });
            }
            if (renderedEmbed.footer?.text) {
              embedToSend.setFooter({ 
                text: renderedEmbed.footer.text, 
                iconURL: renderedEmbed.footer.iconURL 
              });
            }
            if (renderedEmbed.image?.url) embedToSend.setImage(renderedEmbed.image.url);
            if (renderedEmbed.thumbnail?.url) embedToSend.setThumbnail(renderedEmbed.thumbnail.url);
            if (renderedEmbed.timestamp) embedToSend.setTimestamp();

            await channel.send({ embeds: [embedToSend] });

            return interaction.editReply({
              content: `✅ تم إرسال الإمبد **${embedName}** إلى قناة <#${channelId}> بنجاح!`,
            });
          } catch (err) {
            console.error('[Send Embed Error]', err);
            return interaction.editReply({
              content: `❌ فشل في إرسال الإمبد: ${err.message}`,
            });
          }
        }

        // ── Import Embed (modal submit) ───────────────────────────────────────
        if (customId === 'embedvault_import_submit') {
          await interaction.deferReply({ ephemeral: true });
          
          const jsonString = interaction.fields.getTextInputValue('json_data').trim();
          
          try {
            const importedData = JSON.parse(jsonString);
            
            // Fix #3: Reliable import logic - parse embed name from JSON
            if (!importedData.name || typeof importedData.name !== 'string' || !importedData.name.trim()) {
              return interaction.editReply({ 
                content: '❌ بيانات JSON يجب أن تحتوي على حقل "name" غير فارغ.' 
              });
            }

            // Ensure we have valid data structure
            const dataToImport = importedData.data || importedData;
            const errors = validateEmbed(dataToImport);
            if (errors.length > 0) {
              return interaction.editReply({
                content: `❌ أخطاء في الصحة:\n${errors.map(e => `• ${e}`).join('\n')}`,
              });
            }

            const created = await this.upsert(
              interaction.guildId,
              importedData.name.trim(),
              dataToImport,
              importedData.type || 'Manual'
            );

            const previewEmbed = createPreview(buildFullData(created), { member: interaction.member });

            return interaction.editReply({
              content: `## ✏️ جاري التعديل: **${created.name}**\n✅ تم استيراد الإمبد بنجاح!`,
              embeds: [previewEmbed],
              components: buildEditorRows(created.name),
            });
          } catch (err) {
            console.error('[Import Error]', err);
            return interaction.editReply({
              content: `❌ فشل في تحليل JSON: ${err.message}`,
            });
          }
        }
      } catch (err) {
        console.error('[EmbedVaultModule.handleModalSubmit]', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ فشلت عملية الإمبد.', ephemeral: true });
        } else if (interaction.deferred && !interaction.replied) {
          await interaction.editReply({ content: '❌ فشلت عملية الإمبد.' });
        }
      }
    },

    async openAuthorFooterModal(interaction, embedDoc = null) {
      const isEdit = !!embedDoc;
      // Fix #1: Keep modal title under 45 characters
      const truncatedName = embedDoc?.name ? embedDoc.name.slice(0, 15) : '';
      const modalTitle = isEdit 
        ? `تعديل: ${truncatedName}` 
        : 'إنشاء – مؤلف/تذييل';
      
      const modal = new ModalBuilder()
        .setCustomId(isEdit ? `embedvault_authorfooter_submit:${embedDoc.name}` : 'embedvault_authorfooter_submit_create')
        .setTitle(modalTitle);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('author_name')
            .setLabel('اسم المؤلف')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("من يتحدث؟ `{user.name}` أو أيقونة")
            .setValue(embedDoc?.authorName ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('author_icon')
            .setLabel('أيقونة المؤلف')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("`{user.avatar}` أو رابط صورة")
            .setValue(embedDoc?.authorIcon ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('footer_text')
            .setLabel('نص التذييل')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("كلمة التودع: `{server}` • `{member_count}`")
            .setValue(embedDoc?.footerText ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('footer_icon')
            .setLabel('أيقونة التذييل')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("`{server.icon}` أو رابط فريد")
            .setValue(embedDoc?.footerIcon ?? '')
        )
      );

      await interaction.showModal(modal);
    },

    async openImagesModal(interaction, embedDoc = null) {
      const isEdit = !!embedDoc;
      // Fix #1: Keep modal title under 45 characters  
      const truncatedName = embedDoc?.name ? embedDoc.name.slice(0, 20) : '';
      const modalTitle = isEdit 
        ? `تعديل: ${truncatedName}` 
        : 'إنشاء – صور الإمبد';
      
      const modal = new ModalBuilder()
        .setCustomId(isEdit ? `embedvault_images_submit:${embedDoc.name}` : 'embedvault_images_submit_create')
        .setTitle(modalTitle);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('image_url')
            .setLabel('رابط الصورة الرئيسية')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("`{user.avatar}` أو رابط صورة فريد")
            .setValue(embedDoc?.data?.image?.url ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('thumbnail_url')
            .setLabel('رابط الصورة المصغّرة')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("`{user.avatar}` أو شعار جانبي")
            .setValue(embedDoc?.data?.thumbnail?.url ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('include_timestamp')
            .setLabel('هل تريد ختماً زمنياً؟ (true / false)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('true لإظهار الوقت، false للخفاء')
            .setValue(embedDoc?.includeTimestamp ? 'true' : 'false')
        )
      );

      await interaction.showModal(modal);
    },

    async openSendModal(interaction, embedDoc) {
      // Fix #1: Keep modal title under 45 characters
      const truncatedName = embedDoc.name.slice(0, 15);
      const modal = new ModalBuilder()
        .setCustomId(`embedvault_send_submit:${embedDoc.name}`)
        .setTitle(`إرسال: ${truncatedName}`);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('channel_id')
            .setLabel('معرّف القناة أو رابطها')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('أين تريد أن يُسمع صوت إمبراطوريتك؟ ضع معرّف القناة هنا....')
        )
      );

      await interaction.showModal(modal);
    },

    async openImportModal(interaction) {
      const modal = new ModalBuilder()
        .setCustomId('embedvault_import_submit')
        .setTitle('استيراد إمبد من JSON');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('json_data')
            .setLabel('بيانات JSON المُصدّرة')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('الصق البيانات المُصدّرة لإمبد آخر هنا. دع الإمبراطورية تتوسع بالاستيراد....')
        )
      );

      await interaction.showModal(modal);
    },

    async openLivePreviewModal(interaction, embedDoc) {
      if (!embedDoc) {
        return interaction.reply({ content: '❌ لا توجد بيانات إمبد للمعاينة.', ephemeral: true });
      }

      try {
        const previewEmbed = createPreview(buildFullData(embedDoc), { member: interaction.member });

        return interaction.reply({
          content: `## 👁️ معاينة مباشرة — **${embedDoc.name}**\n*الدوال المشروطة مرسومة ببيانات حسابك.*`,
          embeds: [previewEmbed],
          ephemeral: true,
        });
      } catch (err) {
        console.error('[EmbedVaultModule.openLivePreviewModal]', err);
        return interaction.reply({ content: '❌ فشل في إنشاء المعاينة.', ephemeral: true });
      }
    },

    // Manager UI methods (for premium embed selection interface)
    async displayManager(interaction, page = 0) {
      return manager.displayManager(interaction, page);
    },

    async handleSelectEmbed(interaction, embedName) {
      manager.embedVaultModule = this; // Inject reference for manager
      return manager.handleSelectEmbed(interaction, embedName);
    },

    async handlePagination(interaction, direction, currentPage) {
      manager.embedVaultModule = this; // Inject reference for manager
      return manager.handlePagination(interaction, direction, currentPage);
    },

    async openManager(interaction, page = 0) {
      return this.displayManager(interaction, page);
    },
  };

  // Bind vaultMethods' context to manager
  manager.embedVaultModule = vaultMethods;
  return {
    ...vaultMethods,
    manager,
  };
}
