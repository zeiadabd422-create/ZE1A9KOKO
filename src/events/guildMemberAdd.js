import Member from '../models/Member.js';

// guildMemberAdd event now delegates to the welcome module by default.
// Older versions stored gateway settings under `modules.gateway`, which led to
// confusion when the architecture was refactored.  We intentionally reference
// the gateway module via `client.gateway` and, if necessary, the DB document
// (`config.gateway`) so future changes remain consistent with the naming
// conventions used elsewhere.

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

      // Upsert member record in DB (join memory)
      try {
        const changeHash = Member.computeChangeHash(member.user);
        await Member.findOneAndUpdate(
          { userId: member.id, guildId: member.guild.id },
          {
            userId: member.id,
            guildId: member.guild.id,
            lastSeen: new Date(),
            isVerified: false,
            changeHash,
            status: 'active',
            inviteCode: usedInviteCode?.code || null,
            leftAt: null,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (dbErr) {
        console.error('[GuildMemberAdd] DB upsert error:', dbErr);
      }

      // Delegate to unified EmbedHelper welcome path
      if (client && client.embedHelper && typeof client.embedHelper.sendWelcomeEmbed === 'function') {
        try {
          console.log(`[GuildMemberAdd] New member: ${member.user?.tag || 'Unknown'} (invite: ${usedInviteCode?.code || 'unknown'})`);
          await client.embedHelper.sendWelcomeEmbed(member, usedInviteCode);
        } catch (err) {
          console.error('[EmbedHelper] sendWelcomeEmbed error:', err);
        }
        return;
      }

      // otherwise nothing to do (welcome module has taken over)
    } catch (err) {
      console.error('[guildMemberAdd] Handler failed:', err);
    }
  },
};
