import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } from 'discord.js';

const ALLOWED_MODES = ['EASY', 'NORMAL', 'HARD'];
const ALLOWED_THRESHOLDS = ['lowToMedium', 'mediumToHigh'];

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
}

export default {
  data: new SlashCommandBuilder()
    .setName('gateway-manage')
    .setDescription('Guardian Gateway V3 configuration panel for server owners.')
    .addSubcommand((sub) =>
      sub
        .setName('show')
        .setDescription('Show the current Guardian Gateway configuration.'))
    .addSubcommand((sub) =>
      sub
        .setName('set-mode')
        .setDescription('Set the default verification mode for new flows.')
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('Verification mode to apply.')
            .setRequired(true)
            .setAutocomplete(true)
        ))
    .addSubcommand((sub) =>
      sub
        .setName('set-timeout')
        .setDescription('Update the verification timeout for a selected mode.')
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('Verification mode to update.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('seconds')
            .setDescription('Timeout in seconds (10-900).')
            .setRequired(true)
            .setMinValue(10)
            .setMaxValue(900)
        ))
    .addSubcommand((sub) =>
      sub
        .setName('set-threshold')
        .setDescription('Adjust the risk threshold boundaries.')
        .addStringOption((option) =>
          option
            .setName('threshold')
            .setDescription('Risk threshold field to adjust.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('value')
            .setDescription('Value for the threshold (1-99).')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(99)
        )),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const choices = [];

    if (focused.name === 'mode') {
      return interaction.respond(
        ALLOWED_MODES.filter((mode) => mode.toLowerCase().startsWith(focused.value.toLowerCase())).map((mode) => ({ name: mode, value: mode }))
      );
    }

    if (focused.name === 'threshold') {
      return interaction.respond(
        ALLOWED_THRESHOLDS.filter((value) => value.toLowerCase().startsWith(focused.value.toLowerCase())).map((value) => ({ name: value, value }))
      );
    }

    return interaction.respond(choices);
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
      if (!gateway || typeof gateway.loadConfig !== 'function') {
        await interaction.reply({
          content: '❌ Guardian Gateway V3 is not available on this bot.',
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const config = await gateway.loadConfig(interaction.guild.id);

      if (subcommand === 'show') {
        const embed = new EmbedBuilder()
          .setTitle('Guardian Gateway V3 Configuration')
          .setColor(0x3498db)
          .addFields(
            { name: 'Enabled', value: String(config.enabled), inline: true },
            { name: 'Default Mode', value: config.defaultMode || 'EASY', inline: true },
            { name: 'Low → Medium', value: String(config.riskThresholds?.lowToMedium ?? 34), inline: true },
            { name: 'Medium → High', value: String(config.riskThresholds?.mediumToHigh ?? 67), inline: true },
            {
              name: 'Easy Timeout',
              value: `${config.verification?.easy?.timeoutSeconds ?? 240}s`,
              inline: true,
            },
            {
              name: 'Normal Timeout',
              value: `${config.verification?.normal?.timeoutSeconds ?? 120}s`,
              inline: true,
            },
            {
              name: 'Hard Timeout',
              value: `${config.verification?.hard?.timeoutSeconds ?? 90}s`,
              inline: true,
            }
          )
          .setFooter({ text: 'Use /gateway-manage set-mode or set-timeout to update values instantly.' });

        await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
        return;
      }

      if (subcommand === 'set-mode') {
        const mode = interaction.options.getString('mode', true).toUpperCase();
        if (!ALLOWED_MODES.includes(mode)) {
          throw new Error('Invalid mode selection.');
        }
        config.defaultMode = mode;
        await config.save();

        await interaction.reply({
          content: `✅ Default verification mode updated to **${mode}**.`,
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      if (subcommand === 'set-timeout') {
        const mode = interaction.options.getString('mode', true).toUpperCase();
        const seconds = interaction.options.getInteger('seconds', true);
        if (!ALLOWED_MODES.includes(mode)) {
          throw new Error('Invalid mode selection.');
        }

        config.verification = config.verification || {};
        config.verification[mode.toLowerCase()] = config.verification[mode.toLowerCase()] || { enabled: true, timeoutSeconds: seconds, retries: mode === 'HARD' ? 1 : mode === 'NORMAL' ? 2 : 3 };
        config.verification[mode.toLowerCase()].timeoutSeconds = seconds;
        await config.save();

        await interaction.reply({
          content: `✅ Updated **${mode}** timeout to **${seconds}s**.`,
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      if (subcommand === 'set-threshold') {
        const threshold = interaction.options.getString('threshold', true);
        const value = interaction.options.getInteger('value', true);
        if (!ALLOWED_THRESHOLDS.includes(threshold)) {
          throw new Error('Invalid threshold selection.');
        }

        config.riskThresholds = config.riskThresholds || { lowToMedium: 34, mediumToHigh: 67 };
        config.riskThresholds[threshold] = value;

        if ((threshold === 'lowToMedium' && value >= (config.riskThresholds.mediumToHigh || 67)) ||
            (threshold === 'mediumToHigh' && value <= (config.riskThresholds.lowToMedium || 34))) {
          throw new Error('Thresholds must maintain lowToMedium < mediumToHigh.');
        }

        await config.save();

        await interaction.reply({
          content: `✅ Risk threshold **${threshold}** updated to **${value}**.`,
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }

      await interaction.reply({ content: '❌ Unknown subcommand.', flags: [MessageFlags.Ephemeral] });
    } catch (err) {
      console.error('[gateway-manage] error:', err);
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: `❌ ${err.message || 'Failed to update gateway config.'}` });
      } else {
        await interaction.reply({ content: `❌ ${err.message || 'Failed to update gateway config.'}`, flags: [MessageFlags.Ephemeral] });
      }
    }
  },
};
