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

      // Forward member join to welcome handler if present
      if (client && client.welcome && typeof client.welcome.handleMemberAdd === 'function') {
        try {
          console.log(`[GuildMemberAdd] New member: ${member.user.tag}`);
          await client.welcome.handleMemberAdd(member);
        } catch (err) {
          console.error('[Welcome] Member add handler error:', err);
        }
        return;
      }

      // As a safety net, if a guild still uses the legacy gateway join method
      // we check the database rather than expecting a `modules.gateway`
      // property.
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
