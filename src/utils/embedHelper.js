/**
 * Centralized Embed Helper Utility
 * Provides consistent methods for fetching, rendering, and sending embeds
 * from embedVault across all modules (Welcome, Goodbye, Partner, Boost)
 * 
 * This ensures single-source-of-truth for all automated message embeds
 */

import { render } from '../core/embedEngine.js';
import GuildConfig from '../modules/config/GuildConfig.js';

/**
 * Enum for embed types that can be fetched from vault
 */
export const EMBED_TYPES = {
  WELCOME: 'Welcome',
  GOODBYE: 'Goodbye',
  PARTNER: 'Partner',
  BOOST: 'Boost',
  MANUAL: 'Manual',
};

/**
 * Core utility class for embed management across modules
 */
export class EmbedHelper {
  constructor(client) {
    this.client = client;
  }

  /**
   * Get embed by type from embedVault with fallback to GuildConfig
   * @param {string} guildId - The guild ID
   * @param {string} type - Embed type (Welcome, Goodbye, Partner, Boost)
   * @returns {Promise<Object|null>} Vault embed document or null
   */
  async getEmbedByType(guildId, type) {
    try {
      if (!this.client?.embedVault) return null;
      return await this.client.embedVault.getByType(guildId, type);
    } catch (err) {
      console.error(`[EmbedHelper] Failed to fetch ${type} embed:`, err);
      return null;
    }
  }

  /**
   * Get embed by name from embedVault
   * @param {string} guildId - The guild ID
   * @param {string} embedName - Name of the embed
   * @returns {Promise<Object|null>} Vault embed document or null
   */
  async getEmbedByName(guildId, embedName) {
    try {
      if (!this.client?.embedVault || !embedName) return null;
      return await this.client.embedVault.getByName(guildId, embedName);
    } catch (err) {
      console.error(`[EmbedHelper] Failed to fetch embed "${embedName}":`, err);
      return null;
    }
  }

  /**
   * Get embed by linked invite code from embedVault (for partner invites)
   * @param {string} guildId - The guild ID
   * @param {string} inviteCode - The invite code
   * @returns {Promise<Object|null>} Vault embed document or null
   */
  async getEmbedByInvite(guildId, inviteCode) {
    try {
      if (!this.client?.embedVault || !inviteCode) return null;
      return await this.client.embedVault.getByLinkedInvite(guildId, inviteCode);
    } catch (err) {
      console.error(`[EmbedHelper] Failed to fetch embed for invite "${inviteCode}":`, err);
      return null;
    }
  }

  /**
   * Render and send an embed to a channel
   * @param {Channel} channel - Target Discord channel
   * @param {Object} embedData - Raw embed data object
   * @param {Object} context - Context for placeholder resolution
   * @param {string} label - Label for logging purposes
   * @returns {Promise<Message|null>} Sent message or null on error
   */
  async sendEmbed(channel, embedData, context = {}, label = 'Embed') {
    try {
      if (!channel?.isTextBased()) {
        console.warn(`[EmbedHelper] Channel is not text-based for ${label}`);
        return null;
      }

      if (!embedData) {
        console.warn(`[EmbedHelper] No embed data provided for ${label}`);
        return null;
      }

      const rendered = render(embedData, context);
      return await channel.send({ embeds: [rendered] });
    } catch (err) {
      console.error(`[EmbedHelper] Failed to send ${label}:`, err);
      return null;
    }
  }

  /**
   * Send welcome embed when member joins
   * @param {GuildMember} member - The joining member
   * @param {string|null} usedInviteCode - The invite code used (if any)
   * @param {Channel|null} channel - Optional override channel
   * @returns {Promise<boolean>} Success or failure
   */
  async sendWelcomeEmbed(member, usedInviteCode = null, channel = null) {
    try {
      const { guild } = member;
      if (!guild) return false;

      // First check for partner embed via invite code
      let embed = null;
      if (usedInviteCode) {
        embed = await this.getEmbedByInvite(guild.id, usedInviteCode);
      }

      // Fall back to generic Welcome embed
      if (!embed) {
        embed = await this.getEmbedByType(guild.id, EMBED_TYPES.WELCOME);
      }

      if (!embed?.data) return false;

      // Determine target channel
      let targetChannel = channel;
      if (!targetChannel) {
        const config = await GuildConfig.findOne({ guildId: guild.id });
        const channelId = config?.welcome?.channelId;
        targetChannel = channelId ? guild.channels.cache.get(channelId) : null;
      }

      if (!targetChannel?.isTextBased()) return false;

      // Build context with all relevant info
      let inviteUses = 0;
      if (usedInviteCode) {
        try {
          const inv = await guild.invites.fetch(usedInviteCode);
          inviteUses = inv?.uses ?? 0;
        } catch (e) {
          // silently fail
        }
      }

      const context = {
        member,
        'invite.code': usedInviteCode || '',
        'invite.uses': inviteUses.toString(),
        'partner.name': embed.name || '',
        'member': member.user.username,
        'member.name': member.user.username,
        'member.id': member.id,
        'member.mention': `<@${member.id}>`,
        'server': guild.name,
        'server.name': guild.name,
        'server.id': guild.id,
      };

      await this.sendEmbed(targetChannel, embed.data, context, `Welcome: ${member.user.tag}`);

      // Assign partner role if linked from embed
      if (embed.linkedPartnerRole && usedInviteCode) {
        try {
          const role = guild.roles.cache.get(embed.linkedPartnerRole);
          if (role && !member.roles.cache.has(role.id)) {
            await member.roles.add(role.id);
            console.log(`[EmbedHelper] Assigned partner role to ${member.user.tag}`);
          }
        } catch (roleErr) {
          console.error('[EmbedHelper] Failed to assign partner role:', roleErr);
        }
      }

      // Assign automatic role from GuildConfig welcome.autoRoleId
      try {
        const config = await GuildConfig.findOne({ guildId: guild.id });
        const autoRoleId = config?.welcome?.autoRoleId;
        if (autoRoleId) {
          const role = guild.roles.cache.get(autoRoleId);
          if (role && !member.roles.cache.has(role.id)) {
            await member.roles.add(role.id);
            console.log(`[EmbedHelper] Assigned autoRole to ${member.user.tag} (${autoRoleId})`);
          }
        }
      } catch (roleErr) {
        console.error('[EmbedHelper] Failed to assign autoRole:', roleErr);
      }

      return true;
    } catch (err) {
      console.error('[EmbedHelper] sendWelcomeEmbed failed:', err);
      return false;
    }
  }

  /**
   * Send goodbye/leave embed when member leaves
   * @param {GuildMember} member - The leaving member
   * @param {Channel|null} channel - Optional override channel
   * @returns {Promise<boolean>} Success or failure
   */
  async sendGoodbyeEmbed(member, channel = null) {
    try {
      const { guild } = member;
      if (!guild) return false;

      const embed = await this.getEmbedByType(guild.id, EMBED_TYPES.GOODBYE);
      if (!embed?.data) return false;

      // Determine target channel
      let targetChannel = channel;
      if (!targetChannel) {
        const config = await GuildConfig.findOne({ guildId: guild.id });
        const channelId = config?.goodbye?.channelId;
        targetChannel = channelId ? guild.channels.cache.get(channelId) : null;
      }

      if (!targetChannel?.isTextBased()) return false;

      const context = {
        member,
        'member': member.user.username,
        'member.name': member.user.username,
        'member.id': member.id,
        'member.mention': `<@${member.id}>`,
        'server': guild.name,
        'server.name': guild.name,
        'server.id': guild.id,
      };

      await this.sendEmbed(targetChannel, embed.data, context, `Goodbye: ${member.user.tag}`);
      return true;
    } catch (err) {
      console.error('[EmbedHelper] sendGoodbyeEmbed failed:', err);
      return false;
    }
  }

  /**
   * Send boost embed when guild is boosted
   * @param {Guild} guild - The guild that received a boost
   * @param {Channel|null} channel - Optional override channel
   * @returns {Promise<boolean>} Success or failure
   */
  async sendBoostEmbed(guild, channel = null) {
    try {
      if (!guild) return false;

      const embed = await this.getEmbedByType(guild.id, EMBED_TYPES.BOOST);
      if (!embed?.data) return false;

      // Determine target channel
      let targetChannel = channel;
      if (!targetChannel) {
        const config = await GuildConfig.findOne({ guildId: guild.id });
        const channelId = config?.boost?.channelId;
        targetChannel = channelId ? guild.channels.cache.get(channelId) : null;
      }

      if (!targetChannel?.isTextBased()) return false;

      const context = {
        guild,
        'boost_level': (guild.premiumTier ?? 0).toString(),
        'boost_count': (guild.premiumSubscriptionCount ?? 0).toString(),
        'server': guild.name,
        'server.name': guild.name,
        'server.id': guild.id,
        'server.icon': guild.iconURL?.({ extension: 'png', size: 256 }) ?? '',
        'member_count': (guild.memberCount ?? 0).toString(),
      };

      await this.sendEmbed(targetChannel, embed.data, context, `Boost: ${guild.name}`);
      return true;
    } catch (err) {
      console.error('[EmbedHelper] sendBoostEmbed failed:', err);
      return false;
    }
  }

  /**
   * Verify that embed name matches expected type in database
   * @param {string} guildId - The guild ID
   * @param {string} embedName - The embed name
   * @param {string} expectedType - Expected embed type
   * @returns {Promise<boolean>} True if types match
   */
  async verifyEmbedType(guildId, embedName, expectedType) {
    try {
      const embed = await this.getEmbedByName(guildId, embedName);
      if (!embed) {
        console.warn(`[EmbedHelper] Embed "${embedName}" not found for verification`);
        return false;
      }

      const matches = embed.type === expectedType;
      if (!matches) {
        console.warn(
          `[EmbedHelper] Embed type mismatch: "${embedName}" is "${embed.type}", ` +
          `expected "${expectedType}"`
        );
      }
      return matches;
    } catch (err) {
      console.error('[EmbedHelper] verifyEmbedType failed:', err);
      return false;
    }
  }
}

/**
 * Initialize embed helper for a client instance
 * Should be called after embedVault module is loaded
 */
export function initializeEmbedHelper(client) {
  if (!client.embedHelper) {
    client.embedHelper = new EmbedHelper(client);
    console.log('[EmbedHelper] Initialized successfully');
  }
  return client.embedHelper;
}
