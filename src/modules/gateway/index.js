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
        if (!config || !config.enabled) {
          console.log(`[Gateway] Button interaction ignored: config not found or disabled`);
          return;
        }

        if (interaction.customId === 'gateway_verify_button') {
          console.log(`[Gateway] Button pressed by ${interaction.user.tag}`);
          const result = await verifyMember(interaction.member, config, 'button');

          if (result.alreadyVerified) {
            const embed = createEmbed(config, result.message, 'alreadyVerified');
            await interaction.reply({ embeds: [embed], ephemeral: false });
          } else if (result.success) {
            const embed = createEmbed(config, '✅ Verification successful! Welcome to the server.', 'success');
            await interaction.reply({ embeds: [embed], ephemeral: false });
            
            // If DM failed, send ephemeral notification
            if (result.dmFailed) {
              try {
                await interaction.followUp({
                  content: `⚠️ I couldn't send you a verification DM. Please open your Privacy Settings and try again.`,
                  ephemeral: true,
                });
              } catch (followUpErr) {
                console.error('[Gateway] Failed to send DM failure notification:', followUpErr.message);
              }
            }
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
        if (!config || !config.enabled) {
          console.log(`[Gateway] Message handler: no config or disabled for guild ${message.guildId}`);
          return;
        }

        // STRICT CHANNEL RESTRICTION: Only respond to trigger words in the designated verification channel
        if (message.channelId !== config.channelId) {
          console.log(`[Gateway] Message in wrong channel: ${message.channelId} (expected ${config.channelId}), ignoring`);
          return;
        }

        // Handle trigger word method
        if (config.method === 'trigger') {
          // Case-insensitive, trimmed content
          const content = (message.content || '').toString().trim().toLowerCase();
          const triggerWordLower = (config.triggerWord || '').toString().trim().toLowerCase();
          
          console.log(`[Gateway] Checking trigger in correct channel: content="${content}" vs trigger="${triggerWordLower}"`);
          
          if (!content) {
            console.log('[Gateway] Empty message content, skipping');
            return;
          }

          if (checkTriggerWord(content, triggerWordLower)) {
            console.log(`[Gateway] Trigger word matched for ${message.author.tag} in verification channel`);
            // React with trigger emoji first (public response in verification channel)
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

              // Send channel embed using page-specific UI
              try {
                const pageKey = result.alreadyVerified ? 'alreadyVerified' : 'success';
                const msg = result.alreadyVerified ? (result.message || '') : '✅ Verification successful! Welcome to the server.';
                const channelEmbed = createEmbed(config, msg, pageKey);
                await message.channel.send({ embeds: [channelEmbed] });
              } catch (sendErr) {
                console.error('[Gateway] Failed to send channel embed after verification:', sendErr.message || sendErr);
              }

              // If DM failed, notify the user in-channel (public) with guidance
              if (result.dmFailed) {
                try {
                  await message.reply({
                    content: `❌ ${message.member.user.toString()}, I couldn't send you a DM. Please open your Privacy Settings and try again or use /verify.`,
                  });
                } catch (replyErr) {
                  console.error('[Gateway] Failed to send DM failure notification:', replyErr.message);
                }
              }
            } else {
              console.log(`[Gateway] Verification failed for ${message.author.tag}: ${result.message}`);
              try {
                const errEmbed = createEmbed(config, result.message || 'Verification failed.', 'error');
                await message.channel.send({ embeds: [errEmbed] });
              } catch (errSend) {
                console.error('[Gateway] Failed to send error embed:', errSend.message || errSend);
              }
            }
          } else {
            console.log('[Gateway] Trigger word NOT matched');
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
        // set theme defaults if provided
        configData.theme = configData.theme || {};
        if (embedTitle) configData.theme.title = embedTitle;
        if (embedDescription) configData.theme.description = embedDescription;
        if (slashChannelId) configData.slashChannelId = slashChannelId;
        if (alreadyVerifiedMsg) configData.alreadyVerifiedMsg = alreadyVerifiedMsg;

        const config = await GatewayConfig.findOneAndUpdate(
          { guildId },
          configData,
          { upsert: true, new: true }
        );

        console.log(`[Gateway] Setup command executed for guild ${guildId}, method: ${method}, channel: ${channelId}`);

        // Send verification prompt to the channel
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          const channel = guild.channels.cache.get(channelId);
          if (channel) {
            console.log(`[Gateway] Sending verification prompt to channel ${channel.name}`);
            const promptResult = await sendVerificationPrompt(channel, config);
            console.log(`[Gateway] Prompt result:`, promptResult);
          } else {
            console.warn(`[Gateway] Channel ${channelId} not found in guild ${guildId}`);
          }
        } else {
          console.warn(`[Gateway] Guild ${guildId} not found in client cache`);
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
        if (title) updateData['theme.title'] = title;
        if (description) updateData['theme.description'] = description;
        if (colorHex) updateData['theme.color'] = colorHex;
        if (imageUrl) updateData['theme.image'] = imageUrl;
        if (triggerEmoji) updateData.triggerEmoji = triggerEmoji;

        const config = await GatewayConfig.findOneAndUpdate(
          { guildId },
          { $set: updateData },
          { new: true }
        );

        return { success: true, config };
      } catch (err) {
        console.error('[Gateway] Customize UI error:', err);
        return { success: false, error: err.message };
      }
    },

    /**
     * Customize a specific page (success / alreadyVerified / error)
     */
    async customizePageCommand(guildId, page, title, description, colorHex, imageUrl) {
      try {
        const updateData = {};
        const allowed = ['success', 'alreadyVerified', 'error'];
        if (!allowed.includes(page)) {
          return { success: false, error: 'Invalid page' };
        }

        const fieldPrefix = page === 'success' ? 'successUI' : (page === 'alreadyVerified' ? 'alreadyVerifiedUI' : 'errorUI');

        if (title !== undefined && title !== null) updateData[`${fieldPrefix}.title`] = title;
        if (description !== undefined && description !== null) updateData[`${fieldPrefix}.desc`] = description;
        if (colorHex !== undefined && colorHex !== null) updateData[`${fieldPrefix}.color`] = colorHex;
        if (imageUrl !== undefined && imageUrl !== null) updateData[`${fieldPrefix}.image`] = imageUrl;

        const config = await GatewayConfig.findOneAndUpdate(
          { guildId },
          { $set: updateData },
          { new: true }
        );

        return { success: true, config };
      } catch (err) {
        console.error('[Gateway] Customize page error:', err);
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
