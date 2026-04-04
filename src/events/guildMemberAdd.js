import XPManager from '../modules/leveling/XPManager.js';

const xpManager = new XPManager();

export default {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      if (member.partial) {
        await member.fetch();
      }

      // معالجة welcome module
      if (member.client?.welcome?.handleMemberAdd) {
        await member.client.welcome.handleMemberAdd(member).catch((err) => {
          console.error('[guildMemberAdd] Welcome module failed:', err);
        });
      }
    } catch (error) {
      console.error('[guildMemberAdd] Failed to process member join:', error);

      // Fallback notification
      try {
        const channel =
          member.guild.systemChannel ||
          member.guild.channels.cache.find(
            (c) => c.isTextBased() && c.permissionsFor(member.guild.members.me)?.has('SendMessages')
          );

        if (channel) {
          await channel.send({
            content: `مرحباً ${member.user}, يرجى الاتصال بالمسؤول للتحقق.`,
          });
        }
      } catch (fallbackError) {
        console.error('[guildMemberAdd] Fallback message failed:', fallbackError);
      }
    }
  },
};
