import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default class DashboardManager {
  constructor(client, sessionManager, antiRaidMonitor, gateway) {
    this.client = client;
    this.sessionManager = sessionManager;
    this.antiRaidMonitor = antiRaidMonitor;
    this.gateway = gateway;
    this.failedAttempts = new Map();
    this.trackedGuilds = new Set();
    this.lastPayloadHash = new Map();
    this.maxTrackedGuilds = 50;
    this.intervalMs = 8_000;
    this.interval = setInterval(() => this.syncDashboards(), this.intervalMs);
    if (typeof this.interval.unref === 'function') {
      this.interval.unref();
    }
  }

  trackGuild(guildId) {
    if (!guildId) return;
    if (this.trackedGuilds.has(guildId)) return;
    if (this.trackedGuilds.size >= this.maxTrackedGuilds) {
      const oldest = this.trackedGuilds.values().next().value;
      this.trackedGuilds.delete(oldest);
    }
    this.trackedGuilds.add(guildId);
  }

  recordFailedAttempt(guildId) {
    if (!guildId) return;
    this.failedAttempts.set(guildId, (this.failedAttempts.get(guildId) || 0) + 1);
    this.trackGuild(guildId);
  }

  async syncDashboards() {
    const guilds = Array.from(this.trackedGuilds);
    for (const guildId of guilds) {
      try {
        await this.updateDashboard(guildId);
      } catch (error) {
        console.error('[DashboardManager] Failed to update dashboard for', guildId, error);
      }
    }
  }

  async updateDashboard(guildId) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) {
      this.trackedGuilds.delete(guildId);
      return;
    }

    const config = await this.gateway.loadConfig(guildId);
    if (!config?.enabled) {
      this.trackedGuilds.delete(guildId);
      return;
    }

    const adminChannelId = config.antiRaid?.logChannel;
    if (!adminChannelId) return;

    const channel = guild.channels.cache.get(adminChannelId) || (await guild.channels.fetch(adminChannelId).catch(() => null));
    if (!channel || !channel.isTextBased()) return;

    const payload = this.buildPayload(guildId, config);
    if (!payload) return;

    let dashboardMessage = null;
    if (config.antiRaid?.dashboardMessageId) {
      dashboardMessage = await channel.messages.fetch(config.antiRaid.dashboardMessageId).catch(() => null);
    }

    const payloadHash = JSON.stringify(payload);
    if (dashboardMessage) {
      const lastHash = this.lastPayloadHash.get(guildId);
      if (lastHash === payloadHash) return;
      await dashboardMessage.edit(payload).catch(() => {});
      this.lastPayloadHash.set(guildId, payloadHash);
      return;
    }

    dashboardMessage = await channel.send(payload).catch(() => null);
    if (!dashboardMessage) return;
    config.antiRaid = config.antiRaid || {};
    config.antiRaid.dashboardMessageId = dashboardMessage.id;
    await config.save().catch(() => {});
    this.lastPayloadHash.set(guildId, payloadHash);
  }

  buildPayload(guildId, config) {
    const activeVerifications = this.sessionManager.getActiveSessionCount();
    const failedAttempts = this.failedAttempts.get(guildId) || 0;
    const raidState = this.antiRaidMonitor.getRaidStatus(guildId);
    const isRaid = raidState.active;

    const embed = new EmbedBuilder()
      .setTitle('Guardian Gateway Live Dashboard')
      .setDescription('Real-time verification and raid protection status for this server.')
      .addFields(
        { name: 'Active Verifications', value: String(activeVerifications), inline: true },
        { name: 'Failed Attempts', value: String(failedAttempts), inline: true },
        { name: 'Raid Status', value: isRaid ? 'ACTIVE' : 'Stable', inline: true },
        { name: 'Raid Level', value: raidState.level || 'LOW', inline: true }
      )
      .setColor(isRaid ? 0xe74c3c : 0x2ecc71)
      .setTimestamp();

    const controls = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('gateway_dashboard_lockdown')
        .setLabel('Lockdown')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('gateway_dashboard_unlock')
        .setLabel('Unlock')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('gateway_dashboard_forcehard')
        .setLabel('Force Hard Mode')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('gateway_dashboard_reset')
        .setLabel('Reset Stats')
        .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [controls] };
  }

  async handleControlAction(interaction) {
    const guildId = interaction.guild?.id;
    if (!guildId) return false;

    const hasManage = interaction.member?.permissions?.has?.('ManageGuild');
    if (!hasManage) {
      await interaction.reply({ content: 'You do not have permission to use Gateway dashboard controls.', ephemeral: true });
      return true;
    }

    const action = interaction.customId.replace(/^gateway_dashboard_/, '');
    await this.gateway.handleDashboardAction(interaction, action);
    await this.updateDashboard(guildId);
    return true;
  }
}
