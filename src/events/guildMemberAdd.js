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
      // fallback: previously gateway handled joins; no-op now to avoid duplicate handling
    } catch (err) {
      console.error('[guildMemberAdd] Handler failed:', err);
    }
  },
};
