import XPManager from '../modules/leveling/XPManager.js';

const xpManager = new XPManager();

export default {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      const gateway = member.client?.gateway;
      if (gateway?.handleMemberAdd) {
        await gateway.handleMemberAdd(member);
      }

      const welcomeModule = member.client?.welcome;
      if (welcomeModule?.handleMemberAdd) {
        await welcomeModule.handleMemberAdd(member).catch((err) =>
          console.error('[guildMemberAdd] Welcome module failed:', err)
        );
      }
    } catch (error) {
      console.error('[guildMemberAdd] Failed to process member join:', error);

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
