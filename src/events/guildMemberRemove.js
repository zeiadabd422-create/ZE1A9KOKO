export default {
  name: 'guildMemberRemove',
  async execute(member) {
    try {
      const { client } = member;

      // Delegate to unified EmbedHelper goodbye path
      if (client && client.embedHelper && typeof client.embedHelper.sendGoodbyeEmbed === 'function') {
        try {
          console.log(`[GuildMemberRemove] Member left: ${member.user.tag}`);
          await client.embedHelper.sendGoodbyeEmbed(member);
        } catch (err) {
          console.error('[EmbedHelper] sendGoodbyeEmbed error:', err);
        }
        return;
      }
    } catch (err) {
      console.error('[guildMemberRemove] Handler failed:', err);
    }
  },
};
