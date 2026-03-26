export default {
  name: 'guildDelete',
  execute(guild) {
    guild.client?.inviteTracker?.guildInvites?.delete(guild.id);
    console.log(`[InviteTracker] Memory cleaned for guild ${guild.id}`);
  }
};