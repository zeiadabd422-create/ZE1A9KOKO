import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } from 'discord.js';
import { VisualParser } from '../../core/VisualEngine/Parser.js';

const TEMPLATE_TYPES = ['welcome', 'verification'];

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
}

export default {
  data: new SlashCommandBuilder()
    .setName('design-engine')
    .setDescription('Design and save a VisualEngine template for Guardian Gateway V3.')
    .addStringOption((option) =>
      option
        .setName('template_type')
        .setDescription('Select the template type to save.')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName('title')
        .setDescription('Embed title text.')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('Embed description text.')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('image_url')
        .setDescription('Optional image URL for the embed.')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('color')
        .setDescription('Embed color in hex format, e.g. #0099ff.')
        .setRequired(false)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'template_type') {
      return interaction.respond([]);
    }

    return interaction.respond(
      TEMPLATE_TYPES
        .filter((type) => type.startsWith(focused.value.toLowerCase()))
        .map((type) => ({ name: type, value: type }))
    );
  },

  async execute(interaction) {
    try {
      if (!isAdmin(interaction)) {
        await interaction.reply({
          content: '❌ You need Administrator permission to use this command.',
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      const gateway = interaction.client.gateway;
      if (!gateway || typeof gateway.saveVisualTemplate !== 'function') {
        await interaction.reply({
          content: '❌ Guardian Gateway V3 is not available on this bot.',
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      const templateType = interaction.options.getString('template_type', true).toLowerCase();
      const title = interaction.options.getString('title', true);
      const description = interaction.options.getString('description', true);
      const imageUrl = interaction.options.getString('image_url') || null;
      const color = interaction.options.getString('color') || '#3498db';

      if (!TEMPLATE_TYPES.includes(templateType)) {
        throw new Error('Template type must be welcome or verification.');
      }

      const templatePayload = {
        title,
        description,
        image: imageUrl || undefined,
        color,
      };

      await gateway.saveVisualTemplate(interaction.guild.id, templateType, templatePayload);

      const parser = new VisualParser();
      const preview = parser.parse(templatePayload, {
        user: interaction.user,
        guild: interaction.guild,
        member_count: interaction.guild?.memberCount || 0,
      });

      const embed = new EmbedBuilder()
        .setTitle('✅ Template Saved to VisualEngine')
        .setDescription(`Saved **${templateType}** template successfully.`)
        .setColor(0x2ecc71)
        .setFooter({ text: 'Use this template in Gateway V3 verification flows.' });

      await interaction.reply({ embeds: [embed, ...(preview.embeds || [])], flags: [MessageFlags.Ephemeral] });
    } catch (err) {
      console.error('[design-engine] error:', err);
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: `❌ ${err.message || 'Failed to save design template.'}` });
      } else {
        await interaction.reply({ content: `❌ ${err.message || 'Failed to save design template.'}`, flags: [MessageFlags.Ephemeral] });
      }
    }
  },
};
