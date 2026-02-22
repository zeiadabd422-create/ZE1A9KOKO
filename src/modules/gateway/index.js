/**
 * Gateway Module - Main Entry Point
 * Handles verification for Button, Trigger, Slash, and Join-check methods
 */

import GatewayConfig from './schema.js';
import { checkTriggerWord, performVerificationCheck } from './checker.js';
import { verifyMember, sendVerificationPrompt, sendChannelEmbed, createEmbed } from './actions.js';

/**
 * Gateway Module Factory
 * @param {Client} client - Discord client
 * @returns {Object} Gateway module with handlers and commands
 */
export default function GatewayModule(client) {
  return {
    /**
     * Handle button interactions
     */
    async handleInteraction(interaction) {
      try {
        const config = await GatewayConfig.findOne({ guildId: interaction.guildId });
        if (!config || !config.enabled) return;

        if (interaction.customId === 'gateway_verify_button') {
          const result = await verifyMember(interaction.member, config, 'button');

          if (result.alreadyVerified) {
            const embed = createEmbed(config, result.message);
            await interaction.reply({ embeds: [embed], ephemeral: false });
          } else if (result.success) {
            const embed = createEmbed(config, '✅ Verification successful! Welcome to the server.');
            await interaction.reply({ embeds: [embed], ephemeral: false });
          } else {
            await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
          }
        }
      } catch (err) {
        console.error('[Gateway] Interaction handler error:', err);
        try {
          if (interaction.isRepliable() && !interaction.replied) {
            await interaction.reply({ content: 'An error occurred during verification.', ephemeral: true });
          }
        } catch (e) {
          // swallow
        }
      }
    },

    /**
     * Handle message events (for trigger word detection)
     */
    async handleMessage(message) {
      try {
        const config = await GatewayConfig.findOne({ guildId: message.guildId });
        if (!config || !config.enabled) return;

        // Handle trigger word method
        if (config.method === 'trigger') {
          // Case-insensitive, trimmed content
          const content = (message.content || '').toString().trim();
          if (!content) return;

          if (checkTriggerWord(content, config.triggerWord)) {
            // React with trigger emoji first
            try {
              const emoji = config.triggerEmoji || '✅';
              await message.react(emoji).catch(() => {});
            } catch (err) {
              console.error('[Gateway] Failed to react:', err.message);
            }

            // Verify member
            const result = await verifyMember(message.member, config, 'trigger');
            
            if (result.alreadyVerified || result.success) {
              console.log(`[Gateway] User ${message.member.user.tag} verified via trigger word`);
            }
          }
        }
      } catch (err) {
        console.error('[Gateway] Message handler error:', err);
      }
    },

    /**
     * Setup gateway for a guild
     */
    async setupCommand(guildId, method, verifiedRoleId, unverifiedRoleId, channelId, triggerWord = '', successDM = undefined, embedTitle = undefined, embedDescription = undefined, slashChannelId = '', alreadyVerifiedMsg = undefined) {
      try {
        const configData = {
          guildId,
          method,
          verifiedRole: verifiedRoleId,
          unverifiedRole: unverifiedRoleId,
          channelId,
          triggerWord,
          enabled: true,
        };

        if (successDM) configData.successDM = successDM;
        if (embedTitle) configData.embedTitle = embedTitle;
        if (embedDescription) configData.embedDescription = embedDescription;
        if (slashChannelId) configData.slashChannelId = slashChannelId;
        if (alreadyVerifiedMsg) configData.alreadyVerifiedMsg = alreadyVerifiedMsg;

        const config = await GatewayConfig.findOneAndUpdate(
          { guildId },
          configData,
          { upsert: true, new: true }
        );

        // Send verification prompt to the channel
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          const channel = guild.channels.cache.get(channelId);
          if (channel) {
            await sendVerificationPrompt(channel, config);
          }
        }

        return { success: true, config };
      } catch (err) {
        console.error('[Gateway] Setup error:', err);
        return { success: false, error: err.message };
      }
    },

    /**
     * Customize UI settings
     */
    async customizeUICommand(guildId, title, description, colorHex, imageUrl, triggerEmoji) {
      try {
        const updateData = {};
        if (title) updateData.embedTitle = title;
        if (description) updateData.embedDescription = description;
        if (colorHex) updateData.embedColor = colorHex;
        if (imageUrl) updateData.embedImage = imageUrl;
        if (triggerEmoji) updateData.triggerEmoji = triggerEmoji;

        const config = await GatewayConfig.findOneAndUpdate(
          { guildId },
          updateData,
          { new: true }
        );

        return { success: true, config };
      } catch (err) {
        console.error('[Gateway] Customize UI error:', err);
        return { success: false, error: err.message };
      }
    },

    /**
     * Customize logic/messages
     */
    async customizeLogicCommand(guildId, alreadyVerifiedMsg, successDM) {
      try {
        const updateData = {};
        if (alreadyVerifiedMsg) updateData.alreadyVerifiedMsg = alreadyVerifiedMsg;
        if (successDM) updateData.successDM = successDM;

        const config = await GatewayConfig.findOneAndUpdate(
          { guildId },
          updateData,
          { new: true }
        );

        return { success: true, config };
      } catch (err) {
        console.error('[Gateway] Customize logic error:', err);
        return { success: false, error: err.message };
      }
    },

    /**
     * Disable gateway for a guild
     */
    async disableCommand(guildId) {
      try {
        const config = await GatewayConfig.findOneAndUpdate(
          { guildId },
          { enabled: false },
          { new: true }
        );
        return { success: true, config };
      } catch (err) {
        console.error('[Gateway] Disable error:', err);
        return { success: false, error: err.message };
      }
    },
  };
}
