import Member from '../models/Member.js';

export default {
  name: 'guildMemberRemove',
  async execute(member) {
    try {
      const { client } = member;

      // Force fetch user if member.user is null or incomplete
      if (!member.user || !member.user.tag) {
        try {
          member.user = await client.users.fetch(member.id).catch(() => null);
        } catch (fetchErr) {
          console.warn('[GuildMemberRemove] Failed to fetch user:', fetchErr);
        }
      }

      // Mark leave in DB for next cleanup cycle
      try {
        await Member.findOneAndUpdate(
          { userId: member.id, guildId: member.guild.id },
          {
            status: 'left',
            leftAt: new Date(),
            lastSeen: new Date(),
          },
          { upsert: true, new: true }
        );
      } catch (dbErr) {
        console.error('[GuildMemberRemove] DB update error:', dbErr);
      }

      // Delegate to unified EmbedHelper goodbye path
      if (client && client.embedHelper && typeof client.embedHelper.sendGoodbyeEmbed === 'function') {
        try {
          console.log(`[GuildMemberRemove] Member left: ${member.user?.tag || 'عضو غادرنا'}`);
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
