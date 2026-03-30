import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } from 'discord.js';

const MODES = ['EASY', 'NORMAL', 'HARD'];

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
}

export default {
  data: new SlashCommandBuilder()
    .setName('test-flow')
    .setDescription('Simulate Guardian Gateway V3 verification as a manager.')
    .addStringOption((option) =>
      option
        .setName('mode')
        .setDescription('Verification mode to simulate.')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('adjustment')
        .setDescription('Optional risk score adjustment for the simulation.')
        .setRequired(false)
        .setMinValue(-50)
        .setMaxValue(50)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'mode') {
      return interaction.respond([]);
    }

    return interaction.respond(
      MODES.filter((mode) => mode.startsWith(focused.value.toUpperCase())).map((mode) => ({ name: mode, value: mode }))
    );
  },

  async execute(interaction) {
    try {
      if (!isAdmin(interaction)) {
        await interaction.reply({
          content: '❌ You need Administrator permission to run this simulation.',
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      const gateway = interaction.client.gateway;
      if (!gateway || typeof gateway.simulateFlow !== 'function') {
        await interaction.reply({
          content: '❌ Guardian Gateway V3 is not available on this bot.',
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      const mode = interaction.options.getString('mode', true).toUpperCase();
      const adjustment = interaction.options.getInteger('adjustment') || 0;

      if (!MODES.includes(mode)) {
        throw new Error('Invalid mode provided.');
      }

      const simulation = await gateway.simulateFlow(interaction, mode, adjustment);
      const preview = simulation.payload;
      const risk = simulation.risk;

      const summaryEmbed = new EmbedBuilder()
        .setTitle('🔧 Guardian Gateway Simulation')
        .setColor(0x9b59b6)
        .setDescription(`Simulated as **${interaction.user.tag}** with **${mode}** mode.`)
        .addFields(
          { name: 'Risk Score', value: String(risk.score), inline: true },
          { name: 'Risk Level', value: risk.level, inline: true },
          { name: 'Timeout', value: `${simulation.flow.timeoutAt - Date.now() > 0 ? Math.round((simulation.flow.timeoutAt - Date.now()) / 1000) : 0}s`, inline: true }
        )
        .setFooter({ text: 'This is a preview only; no active flow is stored.' });

      await interaction.reply({ embeds: [summaryEmbed, ...(preview.embeds || [])], components: preview.components || [], flags: [MessageFlags.Ephemeral] });
    } catch (err) {
      console.error('[test-flow] error:', err);
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: `❌ ${err.message || 'Failed to simulate flow.'}` });
      } else {
        await interaction.reply({ content: `❌ ${err.message || 'Failed to simulate flow.'}`, flags: [MessageFlags.Ephemeral] });
      }
    }
  },
};
