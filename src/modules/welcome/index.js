import GuildConfigModel from '../../models/GuildConfig.js';
import { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import { VisualParser } from '../../core/VisualEngine/Parser.js';

class WelcomeModule {
  constructor(client) {
    this.client = client;
    this.parser = new VisualParser();
  }

  getContext(member) {
    return {
      user: member?.user ? `<@${member.user.id}>` : 'Unknown User',
      guild: member?.guild?.name || 'Unknown Guild',
      member_count: member?.guild?.memberCount ?? 0,
      joined_at: member?.joinedAt ? member.joinedAt.toDateString() : 'Unknown',
    };
  }

  async buildEmbed(embedConfig, member) {
    const fallback = {
      title: embedConfig?.title || 'Welcome',
      description:
        embedConfig?.description || `Welcome to ${member.guild.name}, ${member.user.username}!`,
      color: embedConfig?.color || '#2ecc71',
      footer:
        embedConfig?.footer && typeof embedConfig.footer === 'string'
          ? { text: embedConfig.footer }
          : embedConfig?.footer || undefined,
      image: embedConfig?.image || undefined,
    };

    const parsed = await this.parser.parse(fallback, this.getContext(member));
    return parsed.embeds[0];
  }

  async handleMemberAdd(member) {
    try {
      const config = await GuildConfigModel.findOne({ guildId: member.guild.id });
      if (!config?.welcome?.channelId) return;

      const channel = await member.guild.channels.fetch(config.welcome.channelId).catch(() => null);
      if (!channel?.isTextBased()) return;

      const embed = await this.buildEmbed(config.welcome, member);
      if (embed) await channel.send({ embeds: [embed] });

      const autoRoleId = config?.welcome?.autoRoleId;
      if (autoRoleId) {
        const role = member.guild.roles.cache.get(autoRoleId);
        if (role && !member.roles.cache.has(role.id)) {
          await member.roles.add(role.id).catch((err) => console.error('[WelcomeModule] Auto role assignment failed:', err));
        }
      }
    } catch (err) {
      console.error('[WelcomeModule.handleMemberAdd]', err);
    }
  }

  async handleMemberRemove(member) {
    try {
      const config = await GuildConfigModel.findOne({ guildId: member.guild.id });
      if (!config?.goodbye?.channelId) return;

      const channel = await member.guild.channels.fetch(config.goodbye.channelId).catch(() => null);
      if (!channel?.isTextBased()) return;

      const embed = await this.buildEmbed(config.goodbye, member);
      if (embed) await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[WelcomeModule.handleMemberRemove]', err);
    }
  }

  async handleModalSubmit(interaction) {
    try {
      return interaction.reply({
        content: '⚠️ Deprecated welcome modal submission path. Please use the new unified configuration.',
        flags: [MessageFlags.Ephemeral],
      });
    } catch (err) {
      console.error('[WelcomeModule.handleModalSubmit]', err);
    }
  }

  async handleButtonInteraction(interaction, section, embedConfig) {
    try {
      const modal = new ModalBuilder()
        .setCustomId(`embed_config_${section}`)
        .setTitle(`Configure ${section.charAt(0).toUpperCase() + section.slice(1)} Section`);

      if (section === 'basic') {
        const titleInput = new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Title')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(embedConfig.title || '');
        const descInput = new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setValue(embedConfig.description || '');
        const colorInput = new TextInputBuilder()
          .setCustomId('color')
          .setLabel('Color (hex)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(embedConfig.color || '');
        const thumbInput = new TextInputBuilder()
          .setCustomId('thumbnail_url')
          .setLabel('Thumbnail URL')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(embedConfig.thumbnail_url || '');

        modal.addComponents(
          new ActionRowBuilder().addComponents(titleInput),
          new ActionRowBuilder().addComponents(descInput),
          new ActionRowBuilder().addComponents(colorInput),
          new ActionRowBuilder().addComponents(thumbInput)
        );
      } else if (section === 'author') {
        const nameInput = new TextInputBuilder()
          .setCustomId('author_name')
          .setLabel('Author Name')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(embedConfig.author_name || '');
        const iconInput = new TextInputBuilder()
          .setCustomId('author_icon')
          .setLabel('Author Icon URL')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(embedConfig.author_icon || '');

        modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(iconInput));
      } else if (section === 'footer') {
        const textInput = new TextInputBuilder()
          .setCustomId('footer_text')
          .setLabel('Footer Text')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(embedConfig.footer_text || '');
        const iconInput = new TextInputBuilder()
          .setCustomId('footer_image_url')
          .setLabel('Footer Icon URL')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(embedConfig.footer_image_url || '');

        modal.addComponents(new ActionRowBuilder().addComponents(textInput), new ActionRowBuilder().addComponents(iconInput));
      } else if (section === 'images') {
        const imgInput = new TextInputBuilder()
          .setCustomId('image_url')
          .setLabel('Image URL')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(embedConfig.image_url || '');

        modal.addComponents(new ActionRowBuilder().addComponents(imgInput));
      }

      await interaction.showModal(modal);
    } catch (err) {
      console.error('[WelcomeModule.handleButtonInteraction]', err);
    }
  }

  async setup(guildId, channelId, autoRoleId) {
    try {
      const cfg = await GuildConfigModel.findOneAndUpdate(
        { guildId },
        {
          guildId,
          'welcome.channelId': channelId,
          'welcome.autoRoleId': autoRoleId,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return { success: true, config: cfg };
    } catch (err) {
      console.error('[WelcomeModule.setup] Error:', err);
      return { success: false, error: err.message || 'Setup failed' };
    }
  }

  async setupGoodbye(guildId, channelId) {
    try {
      const cfg = await GuildConfigModel.findOneAndUpdate(
        { guildId },
        { 'goodbye.channelId': channelId },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return { success: true, config: cfg };
    } catch (err) {
      console.error('[WelcomeModule.setupGoodbye] Error:', err);
      return { success: false, error: err.message || 'Setup failed' };
    }
  }
}

export default (client) => new WelcomeModule(client);
