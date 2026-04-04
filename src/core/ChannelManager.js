/**
 * ChannelManager - Manages private verification channels
 * Creates, tracks, and auto-deletes verification channels
 */
export class ChannelManager {
  constructor(client) {
    this.client = client;
    this.activeChannels = new Map(); // userId -> { channelId, guildId, createdAt }
    this.maxConcurrentChannels = 5;
    this.channelTimeout = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Create a private verification channel
   */
  async createVerificationChannel(user, guild) {
    // Check if user already has active channel
    if (this.activeChannels.has(user.id)) {
      throw new Error(`User ${user.id} already has an active verification channel`);
    }

    // Check concurrent limit
    if (this.activeChannels.size >= this.maxConcurrentChannels) {
      return {
        created: false,
        reason: 'at_capacity',
        message: `The system is at capacity. There are ${this.activeChannels.size}/${this.maxConcurrentChannels} verification channels active.`,
      };
    }

    try {
      // Create private channel
      const channel = await guild.channels.create({
        name: `verify-${user.username.toLowerCase().replace(/\s+/g, '-')}`,
        type: 0, // Text channel
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            deny: ['ViewChannel'],
          },
          {
            id: user.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
          },
          {
            id: this.client.user.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'],
          },
        ],
        reason: `Verification channel for ${user.tag}`,
      });

      // Track channel
      this.activeChannels.set(user.id, {
        channelId: channel.id,
        guildId: guild.id,
        createdAt: Date.now(),
        userId: user.id,
      });

      // Setup auto-deletion on timeout
      this.setupChannelTimeout(user.id, channel.id);

      return {
        created: true,
        channel,
      };
    } catch (error) {
      console.error(`[ChannelManager] Failed to create channel for ${user.tag}:`, error);
      throw error;
    }
  }

  /**
   * Get verification channel for user
   */
  getVerificationChannel(userId) {
    return this.activeChannels.get(userId);
  }

  /**
   * Setup auto-deletion timeout
   */
  setupChannelTimeout(userId, channelId) {
    setTimeout(async () => {
      const channelData = this.activeChannels.get(userId);

      if (channelData && channelData.channelId === channelId) {
        try {
          const channel = this.client.channels.cache.get(channelId);
          if (channel) {
            await channel.delete('Verification channel timeout');
            console.log(`[ChannelManager] Deleted expired verification channel: ${channelId}`);
          }

          this.activeChannels.delete(userId);
        } catch (error) {
          console.error(`[ChannelManager] Failed to delete channel ${channelId}:`, error);
          this.activeChannels.delete(userId);
        }
      }
    }, this.channelTimeout);
  }

  /**
   * Delete verification channel
   */
  async deleteVerificationChannel(userId, reason = 'Verification complete') {
    const channelData = this.activeChannels.get(userId);
    if (!channelData) {
      return false;
    }

    try {
      const channel = this.client.channels.cache.get(channelData.channelId);
      if (channel) {
        await channel.delete(reason);
      }

      this.activeChannels.delete(userId);
      return true;
    } catch (error) {
      console.error(`[ChannelManager] Failed to delete channel:`, error);
      this.activeChannels.delete(userId);
      return false;
    }
  }

  /**
   * Send message to verification channel
   */
  async sendChannelMessage(userId, content, options = {}) {
    const channelData = this.activeChannels.get(userId);
    if (!channelData) {
      return null;
    }

    try {
      const channel = this.client.channels.cache.get(channelData.channelId);
      if (!channel) {
        return null;
      }

      return await channel.send({
        content,
        ...options,
      });
    } catch (error) {
      console.error(`[ChannelManager] Failed to send message:`, error);
      return null;
    }
  }

  /**
   * Get active channel count
   */
  getActiveChannelCount() {
    return this.activeChannels.size;
  }

  /**
   * Check if at capacity
   */
  isAtCapacity() {
    return this.activeChannels.size >= this.maxConcurrentChannels;
  }

  /**
   * Get channel info
   */
  getChannelInfo(userId) {
    const data = this.activeChannels.get(userId);
    if (!data) return null;

    return {
      ...data,
      minutesActive: Math.floor((Date.now() - data.createdAt) / 60000),
      timeoutMinutes: Math.floor(this.channelTimeout / 60000),
    };
  }

  /**
   * Cleanup expired channels
   */
  async cleanupExpiredChannels() {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, channelData] of this.activeChannels.entries()) {
      if (now - channelData.createdAt > this.channelTimeout) {
        try {
          const channel = this.client.channels.cache.get(channelData.channelId);
          if (channel) {
            await channel.delete('Cleanup: Expired verification channel');
          }

          this.activeChannels.delete(userId);
          cleaned++;
        } catch (error) {
          console.error(`[ChannelManager] Cleanup error:`, error);
          this.activeChannels.delete(userId);
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  /**
   * Set max concurrent channels
   */
  setMaxConcurrentChannels(max) {
    this.maxConcurrentChannels = max;
  }

  /**
   * Clear all channels (for testing)
   */
  async clearAll() {
    for (const [userId, channelData] of this.activeChannels.entries()) {
      try {
        const channel = this.client.channels.cache.get(channelData.channelId);
        if (channel) {
          await channel.delete('System reset');
        }
      } catch (error) {
        console.error(`[ChannelManager] Clear error:`, error);
      }
    }

    this.activeChannels.clear();
  }
}
