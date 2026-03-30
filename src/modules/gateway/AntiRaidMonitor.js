export default class AntiRaidMonitor {
  constructor(client) {
    this.client = client;
    this.joinHistory = new Map();
    this.messageHistory = new Map();
    this.raidState = new Map();
    this.lockdown = false;
    this.lockdownAt = null;
  }

  trackJoin(member, config = {}) {
    const guildId = member.guild?.id;
    if (!guildId) return { joinRate: 0, adjustment: 0, isRaid: false, level: 'LOW', forceHardMode: false, lockdown: false };

    const now = Date.now();
    const windowMs = (config?.antiRaid?.joinWindowSeconds || 60) * 1000;
    const maxBurst = config?.antiRaid?.maxJoinBurst || 4;
    const history = this.joinHistory.get(guildId) || [];
    const recent = history.filter((ts) => ts > now - windowMs);
    recent.push(now);
    this.joinHistory.set(guildId, recent);

    const joinRate = recent.length;
    const isRaid = joinRate >= maxBurst;
    const level = isRaid ? (joinRate >= maxBurst * 2 ? 'HIGH' : 'MEDIUM') : 'LOW';
    const forceHardMode = isRaid;
    const adjustment = Math.max(0, joinRate - 1) * 6;

    if (isRaid) {
      this.lockdown = true;
      this.lockdownAt = now;
    } else if (this.lockdown && this.lockdownAt && now - this.lockdownAt > windowMs * 2) {
      this.lockdown = false;
    }

    const state = {
      active: isRaid,
      level,
      joinRate,
      forceHardMode,
      lockdown: this.lockdown,
      timestamp: now,
    };
    this.raidState.set(guildId, state);

    if (isRaid && config?.antiRaid?.logChannel) {
      this.client.channels.fetch(config.antiRaid.logChannel).then((channel) => {
        if (channel?.isTextBased()) {
          channel.send(`⚠️ Guardian Gateway detected a burst of ${joinRate} joins in the last ${config.antiRaid.joinWindowSeconds || 60} seconds.`).catch(() => {});
        }
      }).catch(() => {});
    }

    return {
      joinRate,
      adjustment,
      isRaid,
      level,
      forceHardMode,
      lockdown: this.lockdown,
    };
  }

  getRaidStatus(guildId) {
    return this.raidState.get(guildId) || { active: false, level: 'LOW', joinRate: 0, forceHardMode: false, lockdown: this.lockdown };
  }

  isRaidActive(guildId) {
    return this.getRaidStatus(guildId).active;
  }

  getRaidLevel(guildId) {
    return this.getRaidStatus(guildId).level;
  }

  async observeMessage(message) {
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;
    const authorId = message.author.id;
    const now = Date.now();
    const config = this.client?.gateway?.configCache?.get(guildId) || this.client?.gateway?.config;
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
