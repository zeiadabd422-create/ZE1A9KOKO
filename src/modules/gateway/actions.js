/**
 * Gateway Actions Module
 * Core verification logic with styled embed responses
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { validateRaidShield, getAccountAgeDays } from './checker.js';
import { parsePlaceholders } from '../../utils/placeholders.js';
import EmbedEngine from '../../utils/embedEngine.js';

// engine with bounded cache so we don't hold onto forever-growing embed objects
const embedEngine = new EmbedEngine(100);

/**
 * Create a styled embed with custom config
 * @param {Object} config - Gateway config from database
 * @param {string} message - Message content
 * @param {boolean} isSuccess - Whether this is a success embed
 * @returns {Object} Embed object
 */
/**
 * Build an embed using page-specific UI
 * @param {Object} config - Gateway config from DB
 * @param {string} overrideMessage - Optional message to use for description
 * @param {string} pageKey - 'success' | 'alreadyVerified' | 'error' | 'dm' | 'prompt' | undefined
 */
export async function createEmbed(config, overrideMessage = '', pageKey = '', member = null) {
  // build a cache key so identical requests don't require reconstruction
  const gid = config.guildId || config.guild || ''; // may be undefined on some calls
  const cacheKey = `${gid}:${pageKey}:${overrideMessage}`;

  return embedEngine.cached(cacheKey, async () => {
    let page = {};
    
    // Select page object based on pageKey
    if (pageKey === 'success') page = config.successUI || {};
    else if (pageKey === 'alreadyVerified') page = config.alreadyVerifiedUI || {};
    else if (pageKey === 'error') page = config.errorUI || {};
    else if (pageKey === 'dm') page = config.dmUI || {};
    else if (pageKey === 'prompt') page = config.promptUI || {};

    // Default fallback values per page type
    let defaultTitle = '🔐 Server Verification';
    let defaultDesc = 'Verification processed.';
    let defaultColor = '#2ecc71';

    if (pageKey === 'success') {
      defaultTitle = '✅ Success';
      defaultDesc = 'You have been verified! Welcome to the server.';
      defaultColor = '#2ecc71';
    } else if (pageKey === 'alreadyVerified') {
      defaultTitle = '⏭️ Already Verified';
      defaultDesc = 'You are already verified in this server!';
      defaultColor = '#ffa500';
    } else if (pageKey === 'error') {
      defaultTitle = '❌ Error';
      defaultDesc = 'Verification failed.';
      defaultColor = '#ff0000';
    } else if (pageKey === 'dm') {
      defaultTitle = '✅ Welcome';
      defaultDesc = 'You have been verified! Welcome to the server.';
      defaultColor = '#2ecc71';
    }

    let title = page.title || defaultTitle;
    let description = overrideMessage || page.desc || defaultDesc;
    const colorHex = page.color || defaultColor;
    const color = parseInt((colorHex || '#2ecc71').replace('#', ''), 16);

    // placeholder parsing if a member/guild context was provided
    if (member) {
      try {
        title = await parsePlaceholders(title, member);
        description = await parsePlaceholders(description, member);
      } catch (e) {
        console.warn('[Gateway] Placeholder parsing error:', e.message);
      }
    }

    const embed = {
      title,
      description,
      color,
      footer: { text: 'Guardian Bot v4.0' },
    };

    const imageUrl = page.image || '';
    if (imageUrl && imageUrl.trim()) {
      embed.image = { url: imageUrl };
    }

    return embed;
  });
}

/**
 * Core verification function - handles all verification logic
 * @param {GuildMember} member - Guild member to verify
 * @param {Object} config - Gateway config from database
 * @param {string} method - Verification method (button, trigger, slash)
 * @returns {Object} { success: boolean, message: string, alreadyVerified: boolean }
 */
export async function verifyMember(member, config, method) {
  try {
    if (!member || !member.user || !member.roles) {
      return { success: false, message: 'Invalid member object' };
    }

    // Gateway should only act when the member currently has the configured unverified role
    if (!config.unverifiedRole) {
      return { success: false, message: 'Unverified role not configured' };
    }

    const hasUnverified = member.roles.cache.has(config.unverifiedRole);
    const hasVerifiedRole = member.roles.cache.has(config.verifiedRole);

    // If the member does not have the unverified role, do not run gateway flows
    if (!hasUnverified) {
      return { 
        success: false, 
        message: config.alreadyVerifiedMsg || 'You are already verified in this server!',
        alreadyVerified: true,
      };
    }

    // Step 0: Check Raid Shield (Account Age)
    if (config.raidMode) {
      const raidShieldCheck = validateRaidShield(member.user, config);
      if (!raidShieldCheck.passed) {
        console.log(`[Gateway] Raid Shield blocked ${member.user.tag}: ${raidShieldCheck.reason}`);
        return { 
          success: false, 
          message: raidShieldCheck.reason,
          alreadyVerified: false 
        };
      }
    }

    // Step 1: Add verified role first (ensures user ends up with the correct role even
    // if removal of the unverified role fails)
    try {
      const verifiedRole = member.guild.roles.cache.get(config.verifiedRole);
      if (!verifiedRole) {
        return { success: false, message: `Verified role not found` };
      }
      if (!member.roles.cache.has(config.verifiedRole)) {
        await member.roles.add(config.verifiedRole);
      }
    } catch (err) {
      return { success: false, message: `Failed to add verified role: ${err.message}` };
    }

    // Step 2: Remove unverified role after successful addition
    try {
      const unverifiedRole = member.guild.roles.cache.get(config.unverifiedRole);
      if (unverifiedRole && member.roles.cache.has(config.unverifiedRole)) {
        await member.roles.remove(config.unverifiedRole);
      }
    } catch (err) {
      console.error('[Gateway] Failed to remove unverified role:', err.message);
      // non-fatal
    }

    // Step 3: Send styled DM with Chic UI (robust error handling)
    let dmFailed = false;
    try {
      const dmEmbed = await createEmbed(config, '', 'dm', member);

      let user = member && member.user ? member.user : null;
      if (!user && member && member.client) {
        try {
          user = await member.client.users.fetch(member.id);
        } catch (fetchErr) {
          console.error('[Gateway] Failed to fetch user for DM:', fetchErr.message || fetchErr);
        }
      }

      if (!user) {
        dmFailed = true;
        console.error('[Gateway] Unable to resolve user object for DM delivery');
      } else {
        try {
          await user.send({ embeds: [dmEmbed] });
          console.log(`[Gateway] DM sent successfully to ${user.tag || user.id}`);
        } catch (dmErr) {
          dmFailed = true;
          const dmCode = dmErr && (dmErr.code || dmErr.httpStatus) ? (dmErr.code || dmErr.httpStatus) : 'UNKNOWN';
          const dmReason = dmErr && dmErr.code === 50007 ? 'User has DMs disabled' : (dmErr && dmErr.message ? dmErr.message : JSON.stringify(dmErr));
          console.error(`[Gateway] DM delivery failed for ${user.tag || user.id} (Code: ${dmCode}): ${dmReason}`);
        }
      }
    } catch (embedErr) {
      console.error('[Gateway] Failed to create DM embed:', embedErr && embedErr.message ? embedErr.message : embedErr);
      dmFailed = true;
    }

    return { 
      success: true, 
      message: 'Verification successful',
      alreadyVerified: false,
      dmFailed
    };
  } catch (err) {
    return { success: false, message: `Verification error: ${err.message}` };
  }
}

/**
 * Send an embed response in a channel
 * @param {TextChannel} channel - Channel to send to
 * @param {Object} config - Gateway config
 * @param {string} message - Message to display
 * @returns {Object} { success: boolean, message: string }
 */
export async function sendChannelEmbed(channel, config, message, member = null) {
  try {
    if (!channel || !channel.send) {
      return { success: false, message: 'Invalid channel' };
    }

    const embed = await createEmbed(config, message, '', member);
    await channel.send({ embeds: [embed] });
    return { success: true, message: 'Embed sent' };
  } catch (err) {
    return { success: false, message: `Failed to send embed: ${err.message}` };
  }
}

/**
 * Send verification prompt to channel
 * @param {TextChannel} channel - Channel to send to
 * @param {Object} config - Gateway config
 * @param {string} method - The method being used (button, trigger, slash, join)
 * @returns {Object} { success: boolean, message: string }
 */
export async function sendVerificationPrompt(channel, config, method) {
  try {
    if (!channel || !channel.send) {
      return { success: false, message: 'Invalid channel' };
    }

    // Get initial message customization for this method, fall back to defaults
    const methodInitial = config.initialMessage?.[method] || {};
    let title = methodInitial.title || '🔐 Server Verification';
    let desc = methodInitial.desc || 'Click the button below to verify your account.';
    const image = methodInitial.image || '';

    // For prompt customization override
    if (config.promptUI?.title) title = config.promptUI.title;
    if (config.promptUI?.desc) desc = config.promptUI.desc;

    // parse placeholders using guild context only (no specific member yet)
    try {
      const fakeMember = { guild: channel.guild };
      title = await parsePlaceholders(title, fakeMember);
      desc = await parsePlaceholders(desc, fakeMember);
    } catch (e) {
      // ignore placeholder errors
    }

    const embed = {
      title,
      description: desc,
      color: parseInt((config.promptUI?.color || '#2ecc71').replace('#', ''), 16),
      footer: { text: 'Guardian Bot v4.0' },
    };

    if (image && image.trim()) {
      embed.image = { url: image };
    }
    if (config.promptUI?.image && config.promptUI.image.trim()) {
      embed.image = { url: config.promptUI.image };
    }

    const payload = {
      embeds: [embed],
    };

    // For button method, attach button
    if (method === 'button') {
      const button = new ButtonBuilder()
        .setCustomId('gateway_verify_button')
        .setLabel('Verify')
        .setStyle(ButtonStyle.Primary);

      const actionRow = new ActionRowBuilder()
        .addComponents(button);

      payload.components = [actionRow];
    }

    // For trigger method, add instructions
    if (method === 'trigger') {
      embed.description += `\n\n**Trigger Word:** \`${config.methods.trigger.triggerWord}\``;
    }

    await channel.send(payload);

    return { success: true, message: 'Verification prompt sent' };
  } catch (err) {
    return { success: false, message: `Failed to send prompt: ${err.message}` };
  }
}
