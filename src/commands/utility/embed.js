import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import EmbedVault from '../../models/EmbedVault.js';
import { render as visualRender, getBlueprints, applyBlueprint } from '../../core/VisualEngine.js';

const BLUEPRINTS = getBlueprints();

async function autocompleteName(interaction) {
  try {
    if (!interaction.guildId) {
      await interaction.respond([]);
      return;
    }

    const entries = await EmbedVault.find({ guildId: interaction.guildId }).sort({ name: 1 }).lean();
    const value = (interaction.options.getFocused() || '').toLowerCase();

    const list = entries
      .filter((item) => item.name.toLowerCase().includes(value))
      .slice(0, 25)
      .map((item) => ({ name: item.name, value: item.name }));

    await interaction.respond(list);
  } catch (err) {
    console.error('[design autocomplete] Error', err);
    await interaction.respond([]).catch(() => {});
  }
}

function buildDesignErrorEmbed(message) {
  return new EmbedBuilder()
    .setTitle('❌ Design Command Failed')
    .setDescription(message)
    .setColor(0xff0000)
    .setTimestamp();
}

async function buildAndSendPreview(interaction, embedName) {
  const member = interaction.member; // guild member context
  const embed = await visualRender(embedName, member, { guildId: interaction.guildId });
  if (!embed) {
    const error = buildDesignErrorEmbed(`Embed not found: ${embedName}`);
    return interaction.editReply ? interaction.editReply({ embeds: [error] }) : interaction.reply({ embeds: [error], ephemeral: true });
  }
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({ embeds: [embed] });
  }
  return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
}

const blueprintsMap = {
  Gaming: {
    tier: 'Partner',
    structure: {
      title: '🎮 Welcome to {guild_name}!',
      description: 'Howdy {user_tag}. There are {member_count} warriors online.',
      color: '#8A2BE2',
      footer: { text: '{guild_name} • Gaming' },
    },
    dynamicAssets: true,
    isBlueprint: true,
  },
  Official: {
    tier: 'VIP',
    structure: {
      title: '📢 Official Announcement',
      description: 'Greetings {user_tag}, welcome to {guild_name}.',
      color: '#1e90ff',
      footer: { text: 'Official server style' },
    },
    dynamicAssets: false,
    isBlueprint: true,
  },
  Minimalist: {
    tier: 'Common',
    structure: {
      title: '✨ Hello {user}',
      description: '{guild_name} now at {member_count} members.',
      color: '#2f3136',
      footer: { text: 'Minimalist design' },
    },
    dynamicAssets: false,
    isBlueprint: true,
  },
};

export default {
  data: new SlashCommandBuilder()
    .setName('design')
    .setDescription('Embeds 2.0 design command (replaces /embed)')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new embed via modal')
    )
    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setDescription('Edit existing embed via modal')
        .addStringOption((opt) => opt
          .setName('name')
          .setDescription('Embed name')
          .setRequired(true)
          .setAutocomplete(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('visuals')
        .setDescription('Quick update of color/image/thumbnail')
        .addStringOption((opt) => opt.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true))
        .addStringOption((opt) => opt.setName('color').setDescription('Hex color, e.g. #00ff00').setRequired(false))
        .addStringOption((opt) => opt.setName('image').setDescription('Image URL').setRequired(false))
        .addStringOption((opt) => opt.setName('thumbnail').setDescription('Thumbnail URL').setRequired(false))
        .addBooleanOption((opt) => opt.setName('dynamic_assets').setDescription('Enable dynamic canvas assets').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('preview')
        .setDescription('Preview design by name')
        .addStringOption((opt) => opt.setName('name').setDescription('Embed name').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('blueprint')
        .setDescription('Apply a blueprint style')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Embed name (create/update)').setRequired(true))
        .addStringOption((opt) =>
          opt.setName('template').setDescription('Blueprint template').setRequired(true)
            .addChoices(...Object.entries(blueprintsMap).map(([k]) => ({ name: k, value: k }))))
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'name') {
      await autocompleteName(interaction);
    }
  },

  async execute(interaction) {
    try {
      if (!interaction.isChatInputCommand()) return;
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      if (!interaction.memberPermissions?.has('Administrator')) {
        return interaction.editReply({ embeds: [buildDesignErrorEmbed('Administrator permission required.')], flags: [MessageFlags.Ephemeral] });
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'create') {
        const modal = new ModalBuilder()
          .setCustomId('design_create_modal')
          .setTitle('Design Engine - Create Embed');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('embed_name').setLabel('Embed Name').setStyle(TextInputStyle.Short).setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('embed_tier').setLabel('Tier (Common/Partner/VIP)').setStyle(TextInputStyle.Short).setRequired(true).setValue('Common'),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('embed_title').setLabel('Title').setStyle(TextInputStyle.Short).setRequired(false),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('embed_description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(false),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('embed_color').setLabel('Color (hex)').setStyle(TextInputStyle.Short).setRequired(false).setValue('#2f3136'),
          )
        );

        return interaction.showModal(modal);
      }

      if (sub === 'edit') {
        const embedName = interaction.options.getString('name').trim();
        const doc = await EmbedVault.findOne({ guildId: interaction.guildId, name: embedName });
        if (!doc) {
          return interaction.editReply({ embeds: [buildDesignErrorEmbed(`Embed not found: ${embedName}`)] });
        }

        const modal = new ModalBuilder()
          .setCustomId(`design_edit_modal:${encodeURIComponent(embedName)}`)
          .setTitle(`Edit Embed: ${embedName}`);

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('embed_title').setLabel('Title').setStyle(TextInputStyle.Short).setRequired(false).setValue(doc.structure?.title || doc.data?.title || ''),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('embed_description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(doc.structure?.description || doc.data?.description || ''),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('embed_color').setLabel('Color (hex)').setStyle(TextInputStyle.Short).setRequired(false).setValue(doc.structure?.color || doc.data?.color || '#2f3136'),
          )
        );

        return interaction.showModal(modal);
      }

      if (sub === 'visuals') {
        const name = interaction.options.getString('name').trim();
        const color = interaction.options.getString('color');
        const image = interaction.options.getString('image');
        const thumbnail = interaction.options.getString('thumbnail');
        const dynamicAssets = interaction.options.getBoolean('dynamic_assets');

        const doc = await EmbedVault.findOne({ guildId: interaction.guildId, name });
        if (!doc) {
          return interaction.editReply({ embeds: [buildDesignErrorEmbed(`Embed not found: ${name}`)] });
        }

        const structure = { ...(doc.structure || doc.data || {}) };
        if (color) structure.color = color;
        if (image) structure.image = image;
        if (thumbnail) structure.thumbnail = thumbnail;

        doc.structure = structure;
        if (dynamicAssets != null) doc.dynamicAssets = dynamicAssets;
        await doc.save();

        const successEmbed = new EmbedBuilder().setDescription(`✅ Updated visuals for **${name}**`).setColor(0x00ff00);
        return interaction.editReply({ embeds: [successEmbed] });
      }

      if (sub === 'preview') {
        const name = interaction.options.getString('name').trim();
        const built = await visualRender(name, interaction.member, { guildId: interaction.guildId });
        if (!built) {
          return interaction.editReply({ embeds: [buildDesignErrorEmbed(`Embed not found: ${name}`)] });
        }
        return interaction.editReply({ embeds: [built] });
      }

      if (sub === 'blueprint') {
        const name = interaction.options.getString('name').trim();
        const template = interaction.options.getString('template');

        if (!blueprintsMap[template]) {
          return interaction.editReply({ embeds: [buildDesignErrorEmbed(`Unknown blueprint: ${template}`)] });
        }

        const blueprint = blueprintsMap[template];
        const payload = {
          guildId: interaction.guildId,
          name,
          tier: blueprint.tier,
          structure: blueprint.structure,
          isBlueprint: true,
          dynamicAssets: blueprint.dynamicAssets,
        };

        await EmbedVault.findOneAndUpdate(
          { guildId: interaction.guildId, name },
          payload,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const confirm = new EmbedBuilder().setDescription(`✅ Blueprint **${template}** applied to **${name}**`).setColor(0x00ff00);
        return interaction.editReply({ embeds: [confirm] });
      }

      return interaction.editReply({ embeds: [buildDesignErrorEmbed('Unknown subcommand.')] });
    } catch (err) {
      console.error('[design command] Error:', err);
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ embeds: [buildDesignErrorEmbed('Internal error occurred.')] });
      }
      return interaction.reply({ embeds: [buildDesignErrorEmbed('Internal error occurred.')], flags: [MessageFlags.Ephemeral] });
    }
  },

  async handleModalSubmit(interaction) {
    try {
      let modalType = interaction.customId;
      if (modalType === 'design_create_modal') {
        const name = interaction.fields.getTextInputValue('embed_name').trim();
        const tier = (interaction.fields.getTextInputValue('embed_tier') || 'Common').trim();
        const title = interaction.fields.getTextInputValue('embed_title');
        const description = interaction.fields.getTextInputValue('embed_description');
        const color = interaction.fields.getTextInputValue('embed_color') || '#2f3136';

        await EmbedVault.findOneAndUpdate(
          { guildId: interaction.guildId, name },
          {
            guildId: interaction.guildId,
            name,
            tier,
            structure: { title, description, color },
            isBlueprint: false,
            dynamicAssets: false,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        return interaction.reply({ content: `✅ Embed created: **${name}**`, flags: [MessageFlags.Ephemeral] });
      }

      if (modalType.startsWith('design_edit_modal:')) {
        const embedName = decodeURIComponent(modalType.split(':')[1]);
        const title = interaction.fields.getTextInputValue('embed_title');
        const description = interaction.fields.getTextInputValue('embed_description');
        const color = interaction.fields.getTextInputValue('embed_color') || '#2f3136';

        const doc = await EmbedVault.findOne({ guildId: interaction.guildId, name: embedName });
        if (!doc) {
          return interaction.reply({ content: `❌ Embed not found: ${embedName}`, flags: [MessageFlags.Ephemeral] });
        }

        const structure = { ...(doc.structure || doc.data || {}), title, description, color };
        doc.structure = structure;
        await doc.save();

        return interaction.reply({ content: `✅ Embed updated: **${embedName}**`, flags: [MessageFlags.Ephemeral] });
      }

      return interaction.reply({ content: '❌ Unexpected modal result.', flags: [MessageFlags.Ephemeral] });
    } catch (err) {
      console.error('[design modal] Error:', err);
      return interaction.reply({ content: '❌ Modal processing failed.', flags: [MessageFlags.Ephemeral] });
    }
  },
};
