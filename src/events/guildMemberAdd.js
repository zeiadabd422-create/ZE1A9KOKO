import { GatewayManager } from '../modules/gateway/GatewayManager.js';
import XPManager from '../modules/leveling/XPManager.js';

const gatewayManager = new GatewayManager();
const xpManager = new XPManager();

export default {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      // Calculate and save risk score
      const { calculateRiskScore } = await import('../modules/gateway/RiskEngine.js');
      const riskScore = calculateRiskScore(member);

      // Save risk score to database
      await xpManager.setRiskScore(member, riskScore);

      // Send welcome embed through the welcome module first, if available
      const welcomeModule = member.client?.welcome;
      if (welcomeModule?.handleMemberAdd) {
        await welcomeModule.handleMemberAdd(member).catch((err) =>
          console.error('[guildMemberAdd] Welcome module failed:', err)
        );
      }

      // Render gateway verification message
      const gatewayResponse = await gatewayManager.render(member, riskScore);

      // Send to member via DM if possible, otherwise to system channel
      try {
        await member.send(gatewayResponse);
      } catch (dmError) {
        // DM failed, send to system channel
        console.log(`[guildMemberAdd] DM failed for ${member.user.tag}, sending to channel`);

        const channel =
          member.guild.systemChannel ||
          member.guild.channels.cache.find(
            (c) => c.isTextBased() && c.permissionsFor(member.guild.members.me).has('SendMessages')
          );

        if (channel) {
          await channel.send({
            content: `${member.user}, please verify yourself:`,
            ...gatewayResponse,
          });
        } else {
          console.warn('[guildMemberAdd] No available channel to send gateway message.');
        }
      }

    } catch (error) {
      console.error('[guildMemberAdd] Failed to process member join:', error);

      // Fallback: simple welcome message
      try {
        const channel =
          member.guild.systemChannel ||
          member.guild.channels.cache.find(
            (c) => c.isTextBased() && c.permissionsFor(member.guild.members.me).has('SendMessages')
          );

        if (channel) {
          await channel.send({
            content: `Welcome ${member.user}! Please contact an administrator for verification.`,
          });
        }
      } catch (fallbackError) {
        console.error('[guildMemberAdd] Fallback message failed:', fallbackError);
      }
    }
  },
};
