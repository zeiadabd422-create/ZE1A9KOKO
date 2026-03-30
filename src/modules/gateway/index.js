import GatewayConfig from './schema.js';
import { checkTriggerWord } from './checker.js';
import { verifyMember, createEmbed, startDMVerification, startStrictGauntlet, DEFAULT_ID_CARD, getLockdownResponse, sendVerificationPrompt } from './actions.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';

export default function GatewayModule(client) {
  return {
    // message-based trigger word handler (legacy method)
    async handleMessage(message) {
      try {
        const config = await GatewayConfig.findOne({ guildId: message.guildId });
        if (!config?.enabled || !config.methods?.trigger?.enabled) return;
        if (message.channelId !== config.methods.trigger.channel) return;

        const content = message.content.trim().toLowerCase();
        const tw = config.methods.trigger.triggerWord ?? '';
        if (!checkTriggerWord(content, tw.toLowerCase())) return;

        // lockdown levels replace the old boolean flag
        const lockdownResult = await getLockdownResponse(message.member, config, 'trigger');
        if (lockdownResult) {
          if (lockdownResult.queueFull) {
            // too many users in queue
            if (message.channel && message.channel.send) {
              await message.channel.send('⚠️ Wait a moment, the queue is full.');
            }
            if (message.deletable) await message.delete().catch(() => {});
            return;
          }
          if (lockdownResult.dmFailed) {
            if (message.channel && message.channel.send) {
              await message.channel.send("❌ I cannot DM you. Please enable 'Allow Direct Messages' in your privacy settings and try again.");
            }
            if (message.deletable) await message.delete().catch(() => {});
            return;
          }
          if (lockdownResult.already) {
            // already running gauntlet; ignore
            if (message.deletable) await message.delete().catch(() => {});
            return;
          }
          if (lockdownResult.lockdown === 1 || lockdownResult.lockdown === 2) {
            if (message.channel && message.channel.send) {
              await message.channel.send('⚠️ Security Lockdown Active. Check your DMs to complete advanced human verification.');
            }
            if (message.deletable) await message.delete().catch(() => {});
            return;
          } else if (lockdownResult.lockdown === 3) {
            if (message.channel && message.channel.send) {
              await message.channel.send(lockdownResult.message);
            }
            if (message.deletable) await message.delete().catch(() => {});
            return;
          }
        }
        const result = await verifyMember(message.member, config, 'trigger');
        if (result.processing) return;

        if (result.alreadyVerified) {
          const alreadyEmbed = await createEmbed(config, result.message, 'alreadyVerified', message.member);
          return message.channel.send({ embeds: [alreadyEmbed] });
        }

        if (result.success) {
          const loadingEmbed = await createEmbed(config, '🔄 Processing...', 'success', message.member);
          const loadingMsg = await message.channel.send({ embeds: [loadingEmbed] });
          if (message.deletable) await message.delete().catch(() => {});
          await new Promise(r => setTimeout(r, 2000));
          const idCardEmbed = await createEmbed(config, DEFAULT_ID_CARD, 'success', message.member);
          await message.channel.send({ embeds: [idCardEmbed] });
          if (loadingMsg?.deletable) await loadingMsg.delete().catch(() => {});

          // Auto-Stick: Delete old prompt and re-send
          if (config.methods?.trigger?.promptMessageId) {
            try {
              const oldMsg = await message.channel.messages.fetch(config.methods.trigger.promptMessageId).catch(() => null);
              if (oldMsg && oldMsg.deletable) await oldMsg.delete().catch(() => {});
            } catch (_e) {}
            const newPrompt = await sendVerificationPrompt(message.channel, config, 'trigger');
            if (newPrompt.success && newPrompt.message?.id) {
              config.methods.trigger.promptMessageId = newPrompt.message.id;
              await config.save();
            }
          }

          return;
        }

        // DM failure handling for closed DMs
        if (result.dmFailed && result.dmErrorCode === 50007) {
          if (message.channel && message.channel.send) {
            await message.channel.send("❌ I cannot DM you. Please enable 'Allow Direct Messages' in your privacy settings and try again.");
          }
          if (message.deletable) await message.delete().catch(() => {});
          return;
        }

        // failure case
        const errorEmbed = await createEmbed(config, result.message || 'Verification failed.', 'error', message.member);
        return message.channel.send({ embeds: [errorEmbed] });
      } catch (err) {
        console.error('[GatewayModule.handleMessage] Error:', err);
      }
    },

    // handle button/select interactions for verification
    async handleInteraction(interaction) {
      try {
        const config = await GatewayConfig.findOne({ guildId: interaction.guildId });
        if (!config?.enabled) return;

        let method = null;
        if (interaction.isButton() || interaction.isAnySelectMenu()) {
          method = 'button';
          if (!config.methods?.button?.enabled) return;
          if (interaction.channelId !== config.methods.button.channel) return;
        } else {
          return; // not relevant
        }

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const lockdownResult = await getLockdownResponse(interaction.member, config, method);
        if (lockdownResult) {
          if (lockdownResult.queueFull) {
            if (interaction.isRepliable()) {
              await interaction.followUp({ content: '⚠️ Wait a moment, the queue is full.', flags: [MessageFlags.Ephemeral] });
            }
            return;
          }
          if (lockdownResult.dmFailed) {
            if (interaction.isRepliable()) {
              await interaction.followUp({
                content: "❌ I cannot DM you. Please enable 'Allow Direct Messages' in your privacy settings and try again.",
                flags: [MessageFlags.Ephemeral],
              });
            }
            return;
          }
          if (lockdownResult.already) {
            // already running gauntlet; reply with message
            if (interaction.isRepliable()) {
              await interaction.followUp({ content: "⏳ لديك عملية توثيق نشطة بالفعل في الخاص، يرجى إكمالها.", flags: [MessageFlags.Ephemeral] });
            }
            return;
          }
          if (lockdownResult.lockdown === 1 || lockdownResult.lockdown === 2) {
            if (lockdownResult.lockdown === 2) {
              // Level 2: strict gauntlet, reply with token
              if (interaction.isRepliable()) {
                await interaction.followUp({ content: `🔐 Security Lockdown Active. Check your DMs to complete advanced human verification.\n\n**Token:** \`${lockdownResult.token}\`\n⚠️ تنبيه: هذا الرمز ينتهي خلال 90 ثانية.`, flags: [MessageFlags.Ephemeral] });
              }
            } else {
              // Level 1: simple gauntlet
              startDMVerification(interaction.member, config).catch(err => console.error('[Gateway] lockdown DM flow error', err));
              if (interaction.isRepliable()) {
                await interaction.followUp({ content: '⚠️ Security Lockdown Active. Check your DMs to complete advanced human verification.', flags: [MessageFlags.Ephemeral] });
              }
            }
            return;
          } else if (lockdownResult.lockdown === 3) {
            if (interaction.isRepliable()) {
              await interaction.followUp({ content: lockdownResult.message, flags: [MessageFlags.Ephemeral] });
            }
            return;
          }
        }
        const result = await verifyMember(interaction.member, config, method);
        if (result.processing) {
          if (interaction.isRepliable()) {
            await interaction.followUp({ content: '⏳ Please wait...', flags: [MessageFlags.Ephemeral] }).catch(() => {});
          }
          return;
        }

        if (result.alreadyVerified) {
          const embed = await createEmbed(config, result.message, 'alreadyVerified', interaction.member);
          return interaction.followUp({ embeds: [embed] });
        }

        if (result.success) {
          return;
        }

        // DM failure handling
        if (result.dmFailed && result.dmErrorCode === 50007) {
          if (interaction.isRepliable()) {
            await interaction.followUp({
              content: "❌ I cannot DM you. Please enable 'Allow Direct Messages' in your privacy settings and try again.",
              flags: [MessageFlags.Ephemeral],
            });
          }
          return;
        }

        const errorEmbed = await createEmbed(config, result.message || 'Verification failed.', 'error', interaction.member);
        await interaction.followUp({ embeds: [errorEmbed], flags: [MessageFlags.Ephemeral] });
      } catch (err) {
        console.error('[GatewayModule.handleInteraction] Error:', err);
      }
    },

    // admin helper: configure or update a verification method
    async setupMethod(
      guildId,
      method,
      channelId = '',
      triggerWord = '',
      verifiedRoleId,
      unverifiedRoleId,
      methodVerifiedRoleId = '',
      methodUnverifiedRoleId = ''
    ) {
      try {
        const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
        let cfg = await GatewayConfig.findOneAndUpdate({ guildId }, { guildId }, opts);
        if (!cfg) cfg = new GatewayConfig({ guildId });

        if (verifiedRoleId) cfg.verifiedRole = verifiedRoleId;
        if (unverifiedRoleId) cfg.unverifiedRole = unverifiedRoleId;

        if (!cfg.methods) cfg.methods = {};
        if (!cfg.methods[method]) cfg.methods[method] = {};

        cfg.methods[method].enabled = true;
        if (channelId) cfg.methods[method].channel = channelId;
        if (method === 'trigger' && triggerWord !== undefined) {
          cfg.methods.trigger.triggerWord = triggerWord;
        }
        if (methodVerifiedRoleId) cfg.methods[method].verifiedRole = methodVerifiedRoleId;
        if (methodUnverifiedRoleId) cfg.methods[method].unverifiedRole = methodUnverifiedRoleId;

        cfg.enabled = true;
        await cfg.save();

        // send initial prompt message if channel provided
        if (channelId && client.channels) {
          try {
            const chan = await client.channels.fetch(channelId).catch(() => null);
            if (chan && chan.isTextBased()) {
              const result = await sendVerificationPrompt(chan, cfg, method);
              if (result.success && result.message?.id) {
                cfg.methods[method].promptMessageId = result.message.id;
                await cfg.save();
              }
            }
          } catch (_e) {}
        }

        return { success: true, config: cfg };
      } catch (err) {
        console.error('[GatewayModule.setupMethod] Error:', err);
        return { success: false, error: err.message || 'Failed to set up method' };
      }
    },

    async customizePageCommand(guildId, page, title, description, color, imageUrl) {
      try {
        const cfg = await GatewayConfig.findOneAndUpdate(
          { guildId },
          { guildId },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        const key = `${page}UI`;
        if (!cfg[key]) cfg[key] = {};

        if (title !== undefined && title !== null) cfg[key].title = title;
        if (description !== undefined && description !== null) cfg[key].desc = description;
        if (color !== undefined && color !== null) cfg[key].color = color;
        if (imageUrl !== undefined && imageUrl !== null) cfg[key].image = imageUrl;

        await cfg.save();
        return { success: true, config: cfg };
      } catch (err) {
        console.error('[GatewayModule.customizePageCommand] Error:', err);
        return { success: false, error: err.message || 'Unable to customize page' };
      }
    },

    async customizeInitialMessageCommand(guildId, method, promptTitle, promptDesc) {
      try {
        const cfg = await GatewayConfig.findOneAndUpdate(
          { guildId },
          { guildId },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        if (!cfg.initialMessage) cfg.initialMessage = {};
        if (!cfg.initialMessage[method]) cfg.initialMessage[method] = {};

        if (promptTitle !== undefined && promptTitle !== null) cfg.initialMessage[method].title = promptTitle;
        if (promptDesc !== undefined && promptDesc !== null) cfg.initialMessage[method].desc = promptDesc;

        await cfg.save();
        return { success: true };
      } catch (err) {
        console.error('[GatewayModule.customizeInitialMessageCommand] Error:', err);
        return { success: false, error: err.message || 'Unable to update initial message' };
      }
    },
  };
}

// Export additional functions for backward compatibility
export { verifyMember, createEmbed, startStrictGauntlet, DEFAULT_ID_CARD, getLockdownResponse, sendVerificationPrompt, startDMVerification } from './actions.js';
export { GatewayManager } from './GatewayManager.js';
export { calculateRiskScore, getRiskLevel, getRiskColor } from './RiskEngine.js';
