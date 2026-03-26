export default {
  name: 'guildCreate',
  async execute(guild) {
    if (guild.client?.inviteTracker?.refreshGuildInvites) {
      await guild.client.inviteTracker.refreshGuildInvites(guild);
      console.log(`[InviteTracker] Initialized invites for new guild ${guild.id}`);
    }
  }
};