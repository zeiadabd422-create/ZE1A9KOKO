/**
 * Centralized Embed Helper Utility
 * Provides consistent methods for fetching, rendering, and sending embeds
 * from embedVault across all modules (Welcome, Goodbye, Partner, Boost)
 * 
 * This ensures single-source-of-truth for all automated message embeds
 */

import { EmbedBuilder } from 'discord.js';
import { render as visualRender } from '../core/VisualEngine.js';
import { render as legacyRender } from '../core/embedEngine.js';
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

      let rendered;
      if (typeof embedData === 'string') {
        rendered = await visualRender(embedData, context.member || null, context);
      } else if (embedData && embedData.name && embedData.guildId) {
        rendered = await visualRender(embedData.name, context.member || null, context);
      } else {
        const resolved = legacyRender(embedData, context);
        rendered = new EmbedBuilder(resolved);
      }

      return await channel.send({ embeds: [rendered] });
    } catch (err) {
      console.error(`[EmbedHelper] Failed to send ${label}:`, err);
      return null;
    }
  }

  /**
   * Send welcome embed when member joins
   * @param {GuildMember} member - The joining member
   * @param {Object|null} inviteInfo - The invite info { code, uses } or null
   * @param {Channel|null} channel - Optional override channel
   * @returns {Promise<boolean>} Success or failure
   */
  async sendWelcomeEmbed(member, inviteInfo = null, channel = null) {
    try {
      // Move variable definition to TOP to avoid ReferenceError (TDZ)
      const usedInviteCode = inviteInfo?.code || null;

      const { guild } = member;
      if (!guild) return false;

      // First check GuildConfig for assigned embedName
      const config = await GuildConfig.findOne({ guildId: guild.id });
      if (!config) {
        console.warn('[EmbedHelper] Welcome: missing guild config');
        return false;
      }
      const embedName = config?.welcome?.embedName;
      let embed = null;
      if (embedName) {
        embed = await this.getEmbedByName(guild.id, embedName);
        console.log(`[EmbedHelper] Welcome: config embed "${embedName}" found: ${!!embed}`);
      }

      // Check partners array for matching invite
      if (!embed && inviteInfo?.code) {
        const partner = config?.partners?.find(p => p.inviteLink.split('/').pop() === inviteInfo.code);
        if (partner) {
          console.log(`[EmbedHelper] Welcome: partner found for invite "${inviteInfo.code}": ${partner.embedName}`);
          embed = await this.getEmbedByName(guild.id, partner.embedName);
          console.log(`[EmbedHelper] Welcome: partner embed found: ${!!embed}`);
        }
      }

      // Fall back to partner embed via invite code (legacy)
      if (!embed && usedInviteCode) {
        embed = await this.getEmbedByInvite(guild.id, usedInviteCode);
        console.log(`[EmbedHelper] Welcome: legacy invite embed for "${usedInviteCode}" found: ${!!embed}`);
      }

      // Fall back to generic Welcome embed by type
      if (!embed) {
        embed = await this.getEmbedByType(guild.id, EMBED_TYPES.WELCOME);
        console.log(`[EmbedHelper] Welcome: generic welcome embed found: ${!!embed}`);
      }

      if (!embed) {
        console.log(`[EmbedHelper] Welcome: no embed found, skipping send`);
        return false;
      }

      // Determine target channel
      let targetChannel = channel;
      if (!targetChannel) {
        const channelId = config?.welcome?.channelId;
        targetChannel = channelId ? guild.channels.cache.get(channelId) : null;
      }

      if (!targetChannel?.isTextBased()) {
        console.log(`[EmbedHelper] Welcome: no valid channel found, skipping send`);
        return false;
      }

      console.log(`[EmbedHelper] Welcome: sending embed "${embed.name}" to channel ${targetChannel.name}`);

      // Build context with all relevant info
      let inviteUses = inviteInfo?.uses || 0;

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

      const renderedWelcome = await visualRender(embed.name, member, context);
      if (renderedWelcome && targetChannel?.isTextBased()) {
        await targetChannel.send({ embeds: [renderedWelcome] });
      }

      // Assign partner role from partners array or legacy linked role
      if (usedInviteCode) {
        let partnerRoleId = null;
        if (config?.partners) {
          const partner = config.partners.find(p => p.inviteLink.split('/').pop() === usedInviteCode);
          if (partner) {
            partnerRoleId = partner.roleId;
          }
        }
        if (!partnerRoleId && embed?.linkedPartnerRole) {
          partnerRoleId = embed.linkedPartnerRole;
        }
        if (partnerRoleId) {
          try {
            const role = guild.roles.cache.get(partnerRoleId);
            if (role && !member.roles.cache.has(role.id)) {
              await member.roles.add(role.id);
              console.log(`[EmbedHelper] Assigned partner role to ${member.user.tag}`);
            }
          } catch (roleErr) {
            console.error('[EmbedHelper] Failed to assign partner role:', roleErr);
          }
        }
      }

      // Assign automatic role from GuildConfig welcome.autoRoleId
      try {
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

      // Check GuildConfig for assigned embedName
      const config = await GuildConfig.findOne({ guildId: guild.id });
      const embedName = config?.goodbye?.embedName;
      let embed = null;
      if (embedName) {
        embed = await this.getEmbedByName(guild.id, embedName);
      }

      // Fall back to generic Goodbye embed by type
      if (!embed) {
        embed = await this.getEmbedByType(guild.id, EMBED_TYPES.GOODBYE);
      }

      if (!embed?.data) return false;

      // Determine target channel
      let targetChannel = channel;
      if (!targetChannel) {
        const channelId = config?.goodbye?.channelId;
        targetChannel = channelId ? guild.channels.cache.get(channelId) : null;
      }

      if (!targetChannel?.isTextBased()) return false;

      const context = {
        member,
        'member': member.user?.username || 'Unknown',
        'member.name': member.user?.username || 'Unknown',
        'member.id': member.id,
        'member.tag': member.user?.tag || 'عضو غادرنا',
        'member.avatar': member.user?.displayAvatarURL() || this.client.user.displayAvatarURL(),
        'member.mention': `<@${member.id}>`,
        'server': guild.name,
        'server.name': guild.name,
        'server.id': guild.id,
      };

      const renderedGoodbye = await visualRender(embed.name, member, context);
      if (renderedGoodbye && targetChannel?.isTextBased()) {
        await targetChannel.send({ embeds: [renderedGoodbye] });
      }
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

      // Check GuildConfig for assigned embedName
      const config = await GuildConfig.findOne({ guildId: guild.id });
      const embedName = config?.boost?.embedName;
      let embed = null;
      if (embedName) {
        embed = await this.getEmbedByName(guild.id, embedName);
      }

      // Fall back to generic Boost embed by type
      if (!embed) {
        embed = await this.getEmbedByType(guild.id, EMBED_TYPES.BOOST);
      }

      if (!embed?.data) return false;

      // Determine target channel
      let targetChannel = channel;
      if (!targetChannel) {
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

      const renderedBoost = await visualRender(embed.name, null, context);
      if (renderedBoost && targetChannel?.isTextBased()) {
        await targetChannel.send({ embeds: [renderedBoost] });
      }
      return true;
    } catch (err) {
      console.error('[EmbedHelper] sendBoostEmbed failed:', err);
      return false;
    }
  }

  /**
   * Get system map embed showing embed assignments
   * @param {string} guildId - The guild ID
   * @returns {Promise<Object>} Embed data object
   */
  async getSystemMap(guildId) {
    try {
      const config = await GuildConfig.findOne({ guildId });

      const fields = [];

      // Welcome
      const welcomeEmbed = config?.welcome?.embedName || 'None';
      fields.push({
        name: '👋 Welcome Message',
        value: welcomeEmbed,
        inline: true,
      });

      // Goodbye
      const goodbyeEmbed = config?.goodbye?.embedName || 'None';
      fields.push({
        name: '👋 Goodbye Message',
        value: goodbyeEmbed,
        inline: true,
      });

      // Boost
      const boostEmbed = config?.boost?.embedName || 'None';
      fields.push({
        name: '🚀 Server Boost',
        value: boostEmbed,
        inline: true,
      });

      // Partners
      if (config?.partners && config.partners.length > 0) {
        config.partners.forEach((partner, index) => {
          fields.push({
            name: `🤝 Partner ${index + 1}: ${partner.inviteLink}`,
            value: partner.embedName || 'None',
            inline: false,
          });
        });
      } else {
        fields.push({
          name: '🤝 Partner Invites',
          value: 'None configured',
          inline: false,
        });
      }

      return {
        title: '🗺️ Empire System Map',
        description: 'Current embed assignments across the server',
        color: 0xDAA520, // Gold
        fields,
        footer: { text: 'Embed Vault Integration' },
      };
    } catch (err) {
      console.error('[EmbedHelper] getSystemMap failed:', err);
      return {
        title: '🗺️ Empire System Map',
        description: 'Error loading system map',
        color: 0xFF0000,
      };
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
