/**
 * Gateway Actions Module
 * Core verification logic with styled embed responses
 */

import { validateRaidShield, getAccountAgeDays } from './checker.js';

/**
 * Create a styled embed with custom config
 * @param {Object} config - Gateway config from database
 * @param {string} message - Message content
 * @param {boolean} isSuccess - Whether this is a success embed
 * @returns {Object} Embed object
 */
export function createEmbed(config, message, isSuccess = true) {
  const embedColor = config.embedColor ? parseInt(config.embedColor.replace('#', ''), 16) : 0x2ecc71;
  
  const embed = {
    title: config.embedTitle || '🔐 Server Verification',
    description: message || config.embedDescription || 'Verification processed.',
    color: embedColor,
    footer: { text: 'Guardian Bot v4.0' },
  };

  if (config.embedImage && config.embedImage.trim()) {
    embed.image = { url: config.embedImage };
  }

  return embed;
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

    // Check if member is already verified
    const hasVerifiedRole = member.roles.cache.has(config.verifiedRole);
    if (hasVerifiedRole) {
      return { 
        success: false, 
        message: config.alreadyVerifiedMsg || 'You are already verified in this server!',
        alreadyVerified: true 
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

    // Step 1: Add verified role
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

    // Step 2: Remove unverified role
    try {
      const unverifiedRole = member.guild.roles.cache.get(config.unverifiedRole);
      if (unverifiedRole && member.roles.cache.has(config.unverifiedRole)) {
        await member.roles.remove(config.unverifiedRole);
      }
    } catch (err) {
      console.error('[Gateway] Failed to remove unverified role:', err.message);
      // Non-fatal error
    }

    // Step 3: Send styled DM with Chic UI (robust error handling)
    let dmFailed = false;
    try {
      const dmMessage = config.successDM || 'You have been verified! Welcome to the server.';
      const dmEmbed = createEmbed(config, dmMessage, true);

      // Prefer sending via user object to avoid member cache issues
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
          // Non-fatal: DM failure shouldn't prevent verification
          dmFailed = true;
          const dmCode = dmErr && (dmErr.code || dmErr.httpStatus) ? (dmErr.code || dmErr.httpStatus) : 'UNKNOWN';
          const dmReason = dmErr && dmErr.code === 50007 ? 'User has DMs disabled' : (dmErr && dmErr.message ? dmErr.message : JSON.stringify(dmErr));
          console.error(`[Gateway] DM delivery failed for ${user.tag || user.id} (Code: ${dmCode}): ${dmReason}`);
        }
      }
    } catch (embedErr) {
      console.error('[Gateway] Failed to create DM embed:', embedErr && embedErr.message ? embedErr.message : embedErr);
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
export async function sendChannelEmbed(channel, config, message) {
  try {
    if (!channel || !channel.send) {
      return { success: false, message: 'Invalid channel' };
    }

    const embed = createEmbed(config, message);
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
 * @returns {Object} { success: boolean, message: string }
 */
export async function sendVerificationPrompt(channel, config) {
  try {
    if (!channel || !channel.send) {
      return { success: false, message: 'Invalid channel' };
    }

    const message = config.embedDescription || 'Click the button below to verify your account and gain access to the server.';
    const embed = createEmbed(config, message);

    const payload = {
      embeds: [embed],
    };

    // For button method, create a button
    if (config.method === 'button') {
      payload.components = [
        {
          type: 1, // ActionRow
          components: [
            {
              type: 2, // Button
              style: 1, // Primary
              label: 'Verify',
              custom_id: 'gateway_verify_button',
            },
          ],
        },
      ];
    }

    // For trigger method, add instructions
    if (config.method === 'trigger') {
      embed.description += `\n\n**Type this to verify:** \`${config.triggerWord}\``;
    }

    await channel.send(payload);

    return { success: true, message: 'Verification prompt sent' };
  } catch (err) {
    return { success: false, message: `Failed to send prompt: ${err.message}` };
  }
}
