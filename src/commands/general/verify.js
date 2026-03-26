import { SlashCommandBuilder } from 'discord.js';
import GatewayConfig from '../../modules/gateway/schema.js';
import { verifyMember, createEmbed, DEFAULT_ID_CARD, startDMVerification, getLockdownResponse } from '../../modules/gateway/actions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('بدء عملية التحقق • Run the verification flow.'),
  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      const { guild, member } = interaction;
      const config = await GatewayConfig.findOne({ guildId: guild.id });
      if (!config?.enabled || !config.methods?.slash?.enabled)
        return interaction.editReply({ content: '❌ Slash verification is disabled.' });
      if (interaction.channelId !== config.methods.slash.channel)
        return interaction.editReply({ content: `❌ Only works in <#${config.methods.slash.channel}>` });

      // handle lockdown levels
      const lockdownResult = await getLockdownResponse(member, config, 'slash');
      if (lockdownResult) {
        if (lockdownResult.lockdown === 1 || lockdownResult.lockdown === 2) {
          await startDMVerification(member, config);
          return interaction.editReply({
            content: '⚠️ Security Lockdown Active. Check your DMs to complete advanced human verification.',
          });
        }
        if (lockdownResult.lockdown === 3) {
          return interaction.editReply({ content: lockdownResult.message });
        }
      }

      const result = lockdownResult && !lockdownResult.lockdown ? lockdownResult : await verifyMember(member, config, 'slash');
      if (result.processing)
        return interaction.editReply({ content: '⏳ Please wait...' });

      if (result.alreadyVerified) {
        const embed = await createEmbed(config, result.message, 'alreadyVerified', member);
        return interaction.editReply({ embeds: [embed] });
      } else if (result.success) {
        const loadingEmbed = await createEmbed(config, '🔄 Processing...', 'success', member);
        await interaction.editReply({ embeds: [loadingEmbed] });
        await new Promise(r => setTimeout(r, 2000));
        const idCardEmbed = await createEmbed(config, DEFAULT_ID_CARD, 'success', member);
        await interaction.editReply({ embeds: [idCardEmbed] });
      } else {
        await interaction.editReply({
          content: `❌ Verification failed: ${result.message}`,
        });
      }
    } catch (err) {
      console.error('[verify command] Error:', err);
      try {
        if (interaction.isRepliable() && !interaction.replied) {
          await interaction.editReply({ content: 'An error occurred while attempting verification.' });
        }
      } catch (e) {
        console.error('[verify command] Failed to send error reply:', e);
      }
    }
  },
};
