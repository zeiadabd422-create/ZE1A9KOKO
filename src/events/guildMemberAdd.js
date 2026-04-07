import XPManager from '../modules/leveling/XPManager.js';
import GuildConfig from '../modules/config/GuildConfig.js';

const xpManager = new XPManager();

export default {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      if (member.partial) {
        await member.fetch();
      }

      const guildConfig = await GuildConfig.get(member.guild.id);
      const unverifiedRoleId = guildConfig.gateway?.unverifiedRoleId;
      if (unverifiedRoleId) {
        try {
          const role = member.guild.roles.cache.get(unverifiedRoleId) ||
            await member.guild.roles.fetch(unverifiedRoleId).catch(() => null);

          if (role) {
            await member.roles.add(role, 'Assign unverified role on join');
          } else {
            console.warn('[guildMemberAdd] Unverified role not found:', unverifiedRoleId);
          }
        } catch (roleError) {
          console.error('[guildMemberAdd] Failed to add unverified role:', roleError);
        }
      }

      // السلام والترحيب - جرب DMHandler أولاً
      const gateway = member.client?.container?.gateway;
      if (gateway?.dmHandler) {
        await gateway.dmHandler.sendMemberWelcome(member.user, member.guild).catch((err) => {
          console.error('[guildMemberAdd] DMHandler welcome failed:', err);
        });
      }

      // معالجة welcome module كـ fallback
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
