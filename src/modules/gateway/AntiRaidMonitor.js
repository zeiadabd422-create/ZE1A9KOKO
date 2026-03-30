export default class AntiRaidMonitor {
  constructor(client) {
    this.client = client;
    this.joinHistory = new Map();
    this.messageHistory = new Map();
  }

  trackJoin(member) {
    const guildId = member.guild?.id;
    if (!guildId) return { joinRate: 0, adjustment: 0, isRaid: false };

    const now = Date.now();
    const windowMs = 60_000;
    const history = this.joinHistory.get(guildId) || [];
    const recent = history.filter((ts) => ts > now - windowMs);
    recent.push(now);
    this.joinHistory.set(guildId, recent);

    const joinRate = recent.length;
    const isRaid = joinRate >= 4;
    const adjustment = Math.max(0, joinRate - 1) * 6;

    if (isRaid && this.client?.channels) {
      const logChannelId = this.client?.gateway?.config?.antiRaid?.logChannel;
      if (logChannelId) {
        this.client.channels.fetch(logChannelId).then((channel) => {
          if (channel?.isTextBased()) {
            channel.send(`⚠️ Guardian Gateway detected a burst of ${joinRate} joins in the last minute.`).catch(() => {});
          }
        }).catch(() => {});
      }
    }

    return {
      joinRate,
      adjustment,
      isRaid,
    };
  }

  async observeMessage(message) {
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;
    const authorId = message.author.id;
    const now = Date.now();
    const config = this.client?.gateway?.config;
    const windowMs = (config?.antiRaid?.spamWindowSeconds || 15) * 1000;
    const threshold = config?.antiRaid?.spamThreshold || 5;

    const key = `${guildId}:${authorId}`;
    const entry = this.messageHistory.get(key) || { timestamps: [], lastWarnAt: 0 };
    entry.timestamps = entry.timestamps.filter((ts) => ts > now - windowMs);
    entry.timestamps.push(now);
    this.messageHistory.set(key, entry);

    if (entry.timestamps.length >= threshold && now - entry.lastWarnAt > windowMs) {
      entry.lastWarnAt = now;
      this.messageHistory.set(key, entry);

      try {
        await message.reply({
          content: '⚠️ Guardian Gateway has detected rapid messages. Please slow down and wait a moment before sending more.',
          allowedMentions: { repliedUser: false },
        });
      } catch (error) {
        console.warn('[AntiRaidMonitor] Failed to warn user about spam:', error.message || error);
      }
    }
  }
}
