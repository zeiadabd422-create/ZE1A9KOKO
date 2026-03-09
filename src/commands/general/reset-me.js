import { SlashCommandBuilder } from 'discord.js';
import GatewayConfig from '../../modules/gateway/schema.js';

export default {
  data: new SlashCommandBuilder()
    .setName('reset-me')
    .setDescription('Reset your verification status for testing purposes.'),

  async execute(interaction) {
    try {
      const { guild, member } = interaction;

      if (!guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
      }

      const config = await GatewayConfig.findOne({ guildId: guild.id });
      if (!config) {
        await interaction.reply({ content: 'Gateway not configured for this server.', ephemeral: true });
        return;
      }

      // Remove verified role if present
      if (config.verifiedRole && member.roles.cache.has(config.verifiedRole)) {
        try {
          await member.roles.remove(config.verifiedRole);
          console.log(`[Reset] Removed verified role from ${member.user.tag}`);
        } catch (err) {
          console.error(`[Reset] Failed to remove verified role: ${err.message}`);
        }
      }

      // Add unverified role if not present and configured
      if (config.unverifiedRole && !member.roles.cache.has(config.unverifiedRole)) {
        try {
          await member.roles.add(config.unverifiedRole);
          console.log(`[Reset] Added unverified role to ${member.user.tag}`);
        } catch (err) {
          console.error(`[Reset] Failed to add unverified role: ${err.message}`);
        }
      }

      // Clear userStates entry
      if (config.userStates && config.userStates[member.id]) {
        try {
          await GatewayConfig.updateOne(
            { guildId: guild.id },
            { $unset: { [`userStates.${member.id}`]: 1 } }
          );
          console.log(`[Reset] Cleared userStates for ${member.user.tag}`);
        } catch (err) {
          console.error(`[Reset] Failed to clear userStates: ${err.message}`);
        }
      }

      await interaction.reply({
        content: '✅ Your verification status has been reset. You can now verify again.',
        ephemeral: true
      });

    } catch (err) {
      console.error('[reset-me command] Error:', err);
      try {
        if (interaction.isRepliable() && !interaction.replied) {
          await interaction.reply({ content: 'An error occurred while resetting.', ephemeral: true });
        }
      } catch (e) {
        console.error('[reset-me command] Failed to send error reply:', e);
      }
    }
  },
};