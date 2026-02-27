export default {
  name: 'guildMemberRemove',
  async execute(member) {
    try {
      const { client } = member;

      // Forward member removal to welcome handler if present
      if (client && client.welcome && typeof client.welcome.handleMemberRemove === 'function') {
        try {
          console.log(`[GuildMemberRemove] Member left: ${member.user.tag}`);
          await client.welcome.handleMemberRemove(member);
        } catch (err) {
          console.error('[Welcome] Member remove handler error:', err);
        }
        return;
      }
    } catch (err) {
      console.error('[guildMemberRemove] Handler failed:', err);
    }
  },
};
