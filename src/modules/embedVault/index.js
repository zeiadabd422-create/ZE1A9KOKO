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

function buildEditorRow(embedName) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`embedvault_basicinfo:${embedName}`)
      .setLabel('✏️ معلومات أساسية')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`embedvault_authorfooter:${embedName}`)
      .setLabel('👤 المؤلف/التذييل')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`embedvault_images:${embedName}`)
      .setLabel('🖼️ الصور')
      .setStyle(ButtonStyle.Primary),
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
  );
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
      try {
        const embeds = await this.list(interaction.guildId);

        if (!embeds || embeds.length === 0) {
          return interaction.reply({
            content: '📦 خزنة الإمبد فارغة. أنشئ إمبدك الأول!',
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

        // Premium Button Grid System
        const buttonsPerPage = 6;
        const totalPages = Math.ceil(embeds.length / buttonsPerPage);
        const startIdx = page * buttonsPerPage;
        const pageEmbeds = embeds.slice(startIdx, startIdx + buttonsPerPage);

        // Create button grid (3 columns x 2 rows max)
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

        // Add pagination and action buttons with Arabic labels
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

        return interaction.reply({
          content: `## 📦 مدير الإمبد\n✨ **${embeds.length}** إمبد(s) في الخزنة\n\n**الصفحة ${page + 1}/${totalPages}** — انقر على إمبد للإدارة.`,
          components: rows,
          ephemeral: true,
        });
      } catch (err) {
        console.error('[EmbedVaultModule.openManager]', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ فشل فتح مدير الإمبد.', ephemeral: true });
        }
      }
    },

    async openModularEditor(interaction, embedDoc = null) {
      try {
        const isEdit = !!embedDoc;

        const content = isEdit
          ? `## ✏️ جاري التعديل: **${embedDoc.name}**\nانقر على قسم لتعديله. سيتم حفظ التغييرات فوراً.`
          : '## ➕ إنشاء إمبد جديد\nملء كل قسم. ابدأ بـ **المعلومات الأساسية**.';

        const components = isEdit ? [buildEditorRow(embedDoc.name)] : [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('embedvault_basicinfo_create')
              .setLabel('✏️ معلومات أساسية')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('embedvault_authorfooter_create')
              .setLabel('👤 المؤلف/التذييل')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('embedvault_images_create')
              .setLabel('🖼️ الصور')
              .setStyle(ButtonStyle.Primary),
          ),
        ];

        if (isEdit) {
          const previewEmbed = createPreview(buildFullData(embedDoc), { member: interaction.member });
          
          // Check if interaction was deferred - if so, use editReply instead of reply
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
          await interaction.reply({ content: '❌ فشل فتح محرر الإمبد المرئي.', ephemeral: true });
        }
      }
    },

    async openBasicInfoModal(interaction, embedDoc = null) {
      const isEdit = !!embedDoc;
      const modal = new ModalBuilder()
        .setCustomId(isEdit ? `embedvault_basicinfo_submit:${embedDoc.name}` : 'embedvault_basicinfo_submit_create')
        .setTitle(isEdit ? `تعديل المعلومات الأساسية – ${embedDoc.name}` : 'إنشاء – المعلومات الأساسية');

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
      try {
        await interaction.deferUpdate();
        
        if (!interaction.isStringSelectMenu()) return;
        if (interaction.customId !== 'embedvault_select') return;

        const selectedName = interaction.values?.[0];
        if (!selectedName) {
          return await interaction.editReply({ content: '❌ لم يتم تحديد إمبد.', components: [] });
        }

        const embedDoc = await this.getByName(interaction.guildId, selectedName);
        if (!embedDoc) {
          return await interaction.editReply({ content: `❌ لم يتم العثور على الإمبد: **${selectedName}**`, components: [] });
        }

        // Open modular editor - this will use reply which is safe after deferUpdate
        await this.openModularEditor(interaction, embedDoc);
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

        // Manager Pagination - use manager.updateManager after deferUpdate
        if (customId.startsWith('embedvault_manager_prev:')) {
          await interaction.deferUpdate();
          const page = Math.max(0, parseInt(customId.split(':')[1]) - 1);
          manager.embedVaultModule = this;
          return manager.updateManager(interaction, page);
        }

        if (customId.startsWith('embedvault_manager_next:')) {
          await interaction.deferUpdate();
          const page = parseInt(customId.split(':')[1]) + 1;
          manager.embedVaultModule = this;
          return manager.updateManager(interaction, page);
        }

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
          const title = interaction.fields.getTextInputValue('title');
          const description = interaction.fields.getTextInputValue('description');
          const color = interaction.fields.getTextInputValue('color').trim();

          if (!name) return interaction.editReply({ content: '❌ اسم الإمبد مطلوب.' });

          const validTypes = ['Welcome', 'Goodbye', 'Partner', 'Manual'];
          if (!validTypes.includes(type)) {
            return interaction.editReply({
              content: `❌ نوع غير صحيح. يجب أن يكون أحد: Welcome, Goodbye, Partner, Manual`,
            });
          }

          const data = {};
          if (title) data.title = title;
          if (description) data.description = description;
          if (color) data.color = color;

          const errors = validateEmbed(data);
          if (errors.length > 0) {
            return interaction.editReply({
              content: `❌ أخطاء في الصحة:\n${errors.map(e => `• ${e}`).join('\n')}`,
            });
          }

          const created = await this.upsert(interaction.guildId, name, data, type);
          const previewEmbed = createPreview(buildFullData(created), { member: interaction.member });

          return interaction.editReply({
            content: `## ✏️ جاري التعديل: **${created.name}**\n✅ تم الإنشاء! (النوع: ${created.type}) أضف المؤلف/التذييل والصور بعد ذلك.`,
            embeds: [previewEmbed],
            components: [buildEditorRow(created.name)],
          });
        }

        // ── Basic Info (edit) ─────────────────────────────────────────────────
        if (customId.startsWith('embedvault_basicinfo_submit:')) {
          await interaction.deferReply({ ephemeral: true });
          
          const originalName = customId.split(':')[1];
          const vaultItem = await this.getByName(interaction.guildId, originalName);
          if (!vaultItem) return interaction.editReply({ content: '❌ لم يتم العثور على الإمبد.' });

          const newName = interaction.fields.getTextInputValue('embed_name').trim();
          const newType = interaction.fields.getTextInputValue('embed_type').trim();
          const title = interaction.fields.getTextInputValue('title');
          const description = interaction.fields.getTextInputValue('description');
          const color = interaction.fields.getTextInputValue('color').trim();

          const validTypes = ['Welcome', 'Goodbye', 'Partner', 'Manual'];
          if (!validTypes.includes(newType)) {
            return interaction.editReply({
              content: `❌ نوع غير صحيح. يجب أن يكون أحد: Welcome, Goodbye, Partner, Manual`,
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
            components: [buildEditorRow(updated.name)],
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
          
          const embedName = customId.split(':')[1];
          const vaultItem = await this.getByName(interaction.guildId, embedName);
          if (!vaultItem) return interaction.editReply({ content: '❌ لم يتم العثور على الإمبد.' });

          const authorName = interaction.fields.getTextInputValue('author_name') || '';
          const authorIcon = interaction.fields.getTextInputValue('author_icon') || '';
          const footerText = interaction.fields.getTextInputValue('footer_text') || '';
          const footerIcon = interaction.fields.getTextInputValue('footer_icon') || '';

          const updated = await this.upsert(
            interaction.guildId,
            embedName,
            vaultItem.data,
            vaultItem.type,
            {
              linkedInviteCode: vaultItem.linkedInviteCode,
              linkedPartnerRole: vaultItem.linkedPartnerRole,
              authorName,
              authorIcon,
              footerText,
              footerIcon,
              includeTimestamp: vaultItem.includeTimestamp,
            }
          );

          const previewEmbed = createPreview(buildFullData(updated), { member: interaction.member });

          return interaction.editReply({
            content: `## ✏️ جاري التعديل: **${updated.name}**\n✅ تم حفظ المؤلف/التذييل!`,
            embeds: [previewEmbed],
            components: [buildEditorRow(updated.name)],
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
          
          const embedName = customId.split(':')[1];
          const vaultItem = await this.getByName(interaction.guildId, embedName);
          if (!vaultItem) return interaction.editReply({ content: '❌ لم يتم العثور على الإمبد.' });

          const imageUrl = interaction.fields.getTextInputValue('image_url') || '';
          const thumbnailUrl = interaction.fields.getTextInputValue('thumbnail_url') || '';
          const includeTimestampStr = interaction.fields.getTextInputValue('include_timestamp') || 'false';
          const includeTimestamp = includeTimestampStr.toLowerCase() === 'true';

          const updatedData = JSON.parse(JSON.stringify(vaultItem.data ?? {}));
          if (imageUrl) {
            updatedData.image = { url: imageUrl };
          } else {
            delete updatedData.image;
          }
          if (thumbnailUrl) {
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
            components: [buildEditorRow(updated.name)],
          });
        }

        // ── Send Embed (modal submit) ─────────────────────────────────────────
        if (customId.startsWith('embedvault_send_submit:')) {
          await interaction.deferReply({ ephemeral: true });
          
          const embedName = customId.split(':')[1];
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
              .setColor(renderedEmbed.color || 0x2f3136)
              .setTitle(renderedEmbed.title || '')
              .setDescription(renderedEmbed.description || '')
              .setAuthor(
                renderedEmbed.author
                  ? { name: renderedEmbed.author.name, iconURL: renderedEmbed.author.iconURL }
                  : null
              )
              .setFooter(
                renderedEmbed.footer
                  ? { text: renderedEmbed.footer.text, iconURL: renderedEmbed.footer.iconURL }
                  : null
              );

            if (renderedEmbed.image) embedToSend.setImage(renderedEmbed.image.url);
            if (renderedEmbed.thumbnail) embedToSend.setThumbnail(renderedEmbed.thumbnail.url);
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
            if (!importedData.name) {
              return interaction.editReply({ content: '❌ بيانات JSON يجب أن تحتوي على حقل "name".' });
            }

            const errors = validateEmbed(importedData);
            if (errors.length > 0) {
              return interaction.editReply({
                content: `❌ أخطاء في الصحة:\n${errors.map(e => `• ${e}`).join('\n')}`,
              });
            }

            const created = await this.upsert(
              interaction.guildId,
              importedData.name,
              importedData,
              importedData.type || 'Manual'
            );

            const previewEmbed = createPreview(buildFullData(created), { member: interaction.member });

            return interaction.editReply({
              content: `## ✏️ جاري التعديل: **${created.name}**\n✅ تم استيراد الإمبد بنجاح!`,
              embeds: [previewEmbed],
              components: [buildEditorRow(created.name)],
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
      const modal = new ModalBuilder()
        .setCustomId(isEdit ? `embedvault_authorfooter_submit:${embedDoc.name}` : 'embedvault_authorfooter_submit_create')
        .setTitle(isEdit ? `تعديل المؤلف/التذييل – ${embedDoc.name}` : 'إنشاء – المؤلف/التذييل');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('author_name')
            .setLabel('اسم المؤلف')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('من يتحدث؟ `{user.name}` أم صرخة البجعة الحكيمة؟')
            .setValue(embedDoc?.authorName ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('author_icon')
            .setLabel('أيقونة المؤلف')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('`{user.avatar}` لصورة المستخدم أو رابط صورة....') 
            .setValue(embedDoc?.authorIcon ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('footer_text')
            .setLabel('نص التذييل')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('كلمة تودع القارئ: `{server}` • `{member_count}` أعضاء يتوقعونك....') 
            .setValue(embedDoc?.footerText ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('footer_icon')
            .setLabel('أيقونة التذييل')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('شعار الإمبراطورية: `{server.icon}` أو رابط فريد....)
            .setValue(embedDoc?.footerIcon ?? '')
        )
      );

      await interaction.showModal(modal);
    },

    async openImagesModal(interaction, embedDoc = null) {
      const isEdit = !!embedDoc;
      const modal = new ModalBuilder()
        .setCustomId(isEdit ? `embedvault_images_submit:${embedDoc.name}` : 'embedvault_images_submit_create')
        .setTitle(isEdit ? `تعديل الصور – ${embedDoc.name}` : 'إنشاء – الصور');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('image_url')
            .setLabel('رابط الصورة الرئيسية')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('اختر صورة ترمز لقوة إمبراطوريتك: `{user.avatar}` أم صورة فريدة؟')
            .setValue(embedDoc?.data?.image?.url ?? '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('thumbnail_url')
            .setLabel('رابط الصورة المصغّرة')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('صورة جانبية صغيرة: `{user.avatar}` أم شعار جانبي؟')
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
      const modal = new ModalBuilder()
        .setCustomId(`embedvault_send_submit:${embedDoc.name}`)
        .setTitle(`إرسال الإمبد – ${embedDoc.name}`);

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
