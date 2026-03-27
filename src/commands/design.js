import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { render as renderEmbed } from '../core/VisualEngine.js';

export default {
  data: new SlashCommandBuilder()
    .setName('design')
    .setDescription('Design and preview a lightweight embed.')
    .addSubcommand((sub) => sub.setName('create').setDescription('Open modal to define embed content.'))
    .addSubcommand((sub) => sub.setName('preview').setDescription('Show ephemeral preview with placeholder values.')),

  async execute(interaction) {
    try {
      if (!interaction.isChatInputCommand()) {
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'create') {
        const modal = new ModalBuilder().setCustomId('designCreate').setTitle('Create Embed Design');

        const titleInput = new TextInputBuilder()
          .setCustomId('designTitle')
          .setLabel('Embed Title (supports {user}, {guild}, {member_count})')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(256);

        const descriptionInput = new TextInputBuilder()
          .setCustomId('designDescription')
          .setLabel('Embed Description')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(4096);

        const footerInput = new TextInputBuilder()
          .setCustomId('designFooter')
          .setLabel('Footer Text (optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(2048);

        modal.addComponents(
          new ActionRowBuilder().addComponents(titleInput),
          new ActionRowBuilder().addComponents(descriptionInput),
          new ActionRowBuilder().addComponents(footerInput)
        );

        await interaction.showModal(modal);
        return;
      }

      if (subcommand === 'preview') {
        const previewStructure = {
          title: 'Welcome {user} to {guild}',
          description: 'You are member number {member_count}.',
          color: '#2f3136',
          footer: { text: 'Design preview mode' },
        };

        const embed = renderEmbed(previewStructure, interaction.member);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      await interaction.reply({ content: 'Unknown design subcommand.', ephemeral: true });
    } catch (err) {
      console.error('[design command] error:', err);
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: 'Failed to run /design command.' });
      } else {
        await interaction.reply({ content: 'Failed to run /design command.', ephemeral: true });
      }
    }
  },
};
