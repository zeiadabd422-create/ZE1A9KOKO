// guildMemberAdd event now delegates to the welcome module by default.
// Older versions stored gateway settings under `modules.gateway`, which led to
// confusion when the architecture was refactored.  We intentionally reference
// the gateway module via `client.gateway` and, if necessary, the DB document
// (`config.gateway`) so future changes remain consistent with the naming
// conventions used elsewhere.

import GatewayConfig from '../modules/gateway/schema.js';

export default {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      const { client } = member;

      let usedInviteCode = null;
      if (client?.inviteTracker && typeof client.inviteTracker.detectUsedInvite === 'function') {
        usedInviteCode = await client.inviteTracker.detectUsedInvite(member.guild).catch((err) => {
          console.error('[GuildMemberAdd] inviteTracker detect error:', err);
          return null;
        });
      }

      // Delegate to unified EmbedHelper welcome path
      if (client && client.embedHelper && typeof client.embedHelper.sendWelcomeEmbed === 'function') {
        try {
          console.log(`[GuildMemberAdd] New member: ${member.user.tag} (invite: ${usedInviteCode || 'unknown'})`);
          await client.embedHelper.sendWelcomeEmbed(member, usedInviteCode);
        } catch (err) {
          console.error('[EmbedHelper] sendWelcomeEmbed error:', err);
        }
        return;
      }

      // Fallback for legacy gateway join path
      try {
        const cfg = await GatewayConfig.findOne({ guildId: member.guild.id });
        if (cfg && cfg.methods?.join?.enabled && client.gateway && typeof client.gateway.handleMemberAdd === 'function') {
          console.log('[GuildMemberAdd] Legacy gateway join enabled, delegating');
          await client.gateway.handleMemberAdd(member);
        }
      } catch (legacyErr) {
        // quietly ignore
      }

      // otherwise nothing to do (welcome module has taken over)
    } catch (err) {
      console.error('[guildMemberAdd] Handler failed:', err);
    }
  },
};
