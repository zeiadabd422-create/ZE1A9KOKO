import { sessionManager } from './SessionManager.js';
import { queueManager } from './QueueManager.js';
import { flowEngine } from './FlowEngine.js';
import { gatewayConfigService } from '../services/GatewayConfigService.js';
import { GuildConfigService } from '../services/GuildConfigService.js';
import { AntiAbuseService } from '../services/AntiAbuseService.js';
import { gatewayLogger } from '../utils/GatewayLogger.js';
import GuildConfig from '../modules/config/GuildConfig.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

/**
 * GatewayEngine - Orchestrates the entire verification process
 * Coordinates SessionManager, QueueManager, FlowEngine with new managers
 */
export class GatewayEngine {
  constructor(client, channelManager = null, roleManager = null, dmHandler = null) {
    this.client = client;
    this.channelManager = channelManager;
    this.roleManager = roleManager;
    this.dmHandler = dmHandler;
    this.sessionManager = sessionManager;
    this.verificationConfig = {
      maxAttempts: 3,
      sessionTimeout: 30 * 60 * 1000,
      messageCleanupDelay: 5000,
    };

    sessionManager.onSessionExpired = async (userId, guildId) => {
      try {
        gatewayLogger.log('SESSION:CLEANUP', null, 'Starting session cleanup', { userId, guildId });
        await queueManager.finishSession(userId);
        GuildConfigService.endSession(guildId);

        if (this.channelManager) {
          await this.channelManager.deleteVerificationChannel(userId, 'Timeout').catch(err => {
            gatewayLogger.error(null, err, { context: 'channel_delete', userId });
          });
        }

        sessionManager.endSession(userId);
        gatewayLogger.log('SESSION:CLEANUP', null, 'Session cleanup completed', { userId });
      } catch (error) {
        gatewayLogger.error(null, error, { context: 'session_expired_handler' });
      }
    };
  }

  /**
   * Attach DM handler after engine creation
   */
  setDMHandler(dmHandler) {
    this.dmHandler = dmHandler;
  }

  /**
   * Start verification for a user
   */
  async startVerification(user, guild, interaction = null) {
    // Anti-abuse check
    if (AntiAbuseService.isOnCooldown(user.id)) {
      throw new Error('Slow down a bit...');
    }

    // Validation checks
    if (!user || !user.id) {
      throw new Error('Invalid user provided to startVerification');
    }

    if (!guild || !guild.id) {
      throw new Error('Invalid guild provided to startVerification');
    }

    if (!GuildConfigService.canVerify(guild.id)) {
      throw new Error('Daily verification limit reached for this server.');
    }

    if (!GuildConfigService.canStartSession(guild.id)) {
      throw new Error('Server is busy, try again later.');
    }

    // Check queue capacity
    if (!queueManager.canStartSession()) {
      const position = queueManager.enqueue(user.id);
      const waitEstimate = queueManager.getWaitEstimate(user.id);

      // Send DM about queue
      if (this.dmHandler) {
        await this.dmHandler.sendQueuePositionUpdate(user, position, waitEstimate);
      }

      // Register callback for when it's user's turn
      if (this.dmHandler) {
        queueManager.registerNotification(user.id, async () => {
          try {
            await this.dmHandler.sendVerificationReady(user, guild.name);
          } catch (error) {
            console.error(`[GatewayEngine] Failed to notify user:`, error);
          }
        });
      }

      return {
        queued: true,
        position,
        waitEstimate,
      };
    }

    // Create channel if manager available
    let verificationChannel = null;
    if (this.channelManager) {
      const result = await this.channelManager.createVerificationChannel(user, guild);
      if (!result.created) {
        throw new Error(result.message || 'Failed to create verification channel');
      }
      verificationChannel = result.channel;
    }

    // Create new session
    const session = sessionManager.createSession(user.id, guild.id);
    if (!session) {
      throw new Error('Session already exists');
    }
    queueManager.startSession(user.id);
    sessionManager.updateSessionState(user.id, 'active');

    GuildConfigService.startSession(guild.id);

    GuildConfigService.incrementUsage(guild.id);

    // Send initial verification message with first step
    if (verificationChannel) {
      try {
        const startStep = flowEngine.getStep('start');
        const components = this.buildStepComponents(user.id, startStep);

        await verificationChannel.send({
          content: `${user.toString()} • Welcome to **Server Verification**!`,
          embeds: [
            {
              color: 0x3498db,
              title: '🔐 ' + startStep.label,
              description: 'Click the button below to continue with verification.',
            },
          ],
          components,
        });
      } catch (error) {
        console.error('[GatewayEngine] Failed to send initial verification message:', error);
      }
    }

    return {
      queued: false,
      session,
      channel: verificationChannel,
      success: true,
    };
  }

  /**
   * Handle button interaction
   */
  async handleButtonClick(interaction, userId, step, buttonAction) {
    // 🔴 TRACE POINT 5: Engine received button
    console.log('[TRACE-5] ✅ GatewayEngine.handleButtonClick CALLED');
    console.log('[TRACE-5] - userId:', userId, 'step:', step, 'action:', buttonAction);
    console.log('ACTION:', buttonAction); // Log the action as requested
    
    // Prevent double-processing
    if (sessionManager.hasProcessedInteraction(userId, interaction.id)) {
      console.log('[TRACE-5] 🔄 Duplicate interaction blocked');
      gatewayLogger.log('DUPLICATE', null, 'Duplicate interaction blocked', { userId, interactionId: interaction.id });
      await interaction.deferUpdate().catch(() => {});
      return { processed: false, duplicate: true };
    }

    sessionManager.markInteractionProcessed(userId, interaction.id);
    const session = sessionManager.getSession(userId);
    console.log('[TRACE-5] - Session lookup result:', !!session);

    try {
      // Validate session exists
      if (!session) {
        console.log('[TRACE-5] ❌ NO SESSION FOUND - cannot process button');
        gatewayLogger.log('ERROR:NO_SESSION', null, 'Session not found', { userId });
        await interaction.editReply({
          content: '❌ Session not found. Please start verification again.',
        });
        return { success: false, reason: 'session_not_found' };
      }

      console.log('[TRACE-5] ✅ Session found - processing button logic');
      gatewayLogger.step(session.id, step, buttonAction, session.state);

      // Get guild config to access verified role
      const guildConfig = await GuildConfig.get(interaction.guild.id);
      const verifiedRoleId = guildConfig.gateway?.verifiedRoleId;

      if (!verifiedRoleId) {
        console.log('[TRACE-5] ❌ No verified role configured');
        await interaction.editReply({
          content: '❌ Verification system not properly configured. Please contact an administrator.',
        });
        return { success: false, reason: 'no_verified_role' };
      }

      // Process button action directly
      switch (buttonAction) {
        case 'accept':
          console.log('[TRACE-5] 🎯 Processing ACCEPT action - Sending Challenge');
          console.log('[STEP]:', step);
          console.log('[ACTION]:', buttonAction);
          
          try {
            // Logical challenge (NOT random) - Always "Blue" button is correct
            const correctAnswer = 'correct'; // The blue button
            
            // Store correct answer in session
            sessionManager.updateSessionData(userId, 'correctAnswer', correctAnswer);
            sessionManager.updateStep(userId, 'challenge');
            
            console.log('[CHALLENGE] Challenge type: "Press the blue button"');
            console.log('[CHALLENGE] Correct answer:', correctAnswer);
            
            // Create challenge buttons with clear colors
            const challengeRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`gateway:button:${userId}:${step}:challenge_correct`)
                .setLabel('🔵 Blue Button')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId(`gateway:button:${userId}:${step}:challenge_wrong`)
                .setLabel('🔴 Red Button')
                .setStyle(ButtonStyle.Danger)
            );
            
            // Send challenge
            await interaction.editReply({
              content: `🎯 **تحدي التحقق - Press the BLUE button to continue**\n\n**اختر الزر الأزرق فقط:**`,
              components: [challengeRow],
            });

            gatewayLogger.log('CHALLENGE:STARTED', session.id, 'Logical challenge sent: Press blue button', { 
              userId, 
              challengeType: 'blue_button'
            });
            
            console.log('[SUCCESS]: Challenge sent');
            return { success: true, challengeSent: true };
          } catch (error) {
            console.log('[TRACE-5] ❌ Error in accept action:', error.message);
            await interaction.editReply({
              content: '❌ Failed to send challenge. Please try again or contact an administrator.',
            });
            return { success: false, reason: 'challenge_send_failed' };
          }

        case 'challenge_correct':
        case 'challenge_wrong':
          console.log('[TRACE-5] 🎯 Processing CHALLENGE answer:', buttonAction);
          console.log('[STEP]:', step);
          console.log('[ACTION]:', buttonAction);
          
          try {
            const userAnswer = buttonAction === 'challenge_correct' ? 'correct' : 'wrong';
            const correctAnswer = session.data?.correctAnswer;
            
            if (!correctAnswer) {
              await interaction.editReply({
                content: '❌ Challenge session expired. Please try again.',
              });
              return { success: false, reason: 'challenge_expired' };
            }

            if (userAnswer === correctAnswer) {
              // ✅ CORRECT - Grant role and complete verification
              console.log('[TRACE-5] ✅ Challenge PASSED!');
              console.log('[STEP]:', step);
              console.log('[ACTION]:', buttonAction);
              console.log('[SUCCESS]: true');
              
              let roleGranted = false;

              try {
                // Fetch member
                const member = await interaction.guild.members.fetch(userId);
                console.log(`[ROLE] Fetched member: ${member.user.tag}`);

                // Check bot permissions
                const botMember = interaction.guild.members.me;
                if (!botMember.permissions.has('ManageRoles')) {
                  console.error('[ROLE] ❌ Bot lacks ManageRoles permission');
                  throw new Error('Bot lacks ManageRoles permission');
                }
                console.log('[ROLE] ✅ Bot has ManageRoles permission');

                // Check if bot role is above verified role
                const verifiedRole = interaction.guild.roles.cache.get(verifiedRoleId);
                if (!verifiedRole) {
                  console.error(`[ROLE] ❌ Verified role not found: ${verifiedRoleId}`);
                  throw new Error(`Verified role not found: ${verifiedRoleId}`);
                }

                if (botMember.roles.highest.comparePositionTo(verifiedRole) <= 0) {
                  console.error('[ROLE] ❌ Bot role is not above verified role');
                  throw new Error('Bot role is not positioned above verified role');
                }
                console.log('[ROLE] ✅ Bot role is above verified role');

                // Add verified role
                await member.roles.add(verifiedRoleId);
                roleGranted = true;
                console.log(`[ROLE] ✅ ROLE GIVEN: ${verifiedRoleId} to ${member.user.tag}`);

                // Remove unverified role if exists
                if (guildConfig.gateway?.unverifiedRoleId) {
                  await member.roles.remove(guildConfig.gateway.unverifiedRoleId).catch((err) => {
                    console.warn('[ROLE] Could not remove unverified role:', err.message);
                  });
                  console.log(`[ROLE] ✅ Removed unverified role: ${guildConfig.gateway.unverifiedRoleId}`);
                }

              } catch (roleError) {
                console.error('[ROLE] ❌ Role assignment failed:', roleError.message);
                await interaction.editReply({
                  content: `❌ **خطأ** - فشل منح الرول\n\n${roleError.message}\n\nتواصل مع الإدارة.`,
                });
                return { success: false, reason: 'role_assignment_failed' };
              }

              // Complete verification
              sessionManager.endSession(userId);
              GuildConfigService.endSession(interaction.guild.id);
              await queueManager.finishSession(userId);

              // Send success reply
              await interaction.editReply({
                content: '✅ **تم التحقق بنجاح!** ✔️\n\nYou passed the challenge! Role granted.',
              });

              // Delete channel only on success
              if (roleGranted) {
                setTimeout(() => {
                  interaction.channel?.delete().catch((err) => {
                    console.error('[CLEANUP] Failed to delete channel:', err.message);
                  });
                }, 5000);
              }

              gatewayLogger.log('VERIFY:COMPLETE', session.id, 'Verification completed after challenge', { userId, roleGranted });
              return { success: true, verified: true, roleGranted };
            } else {
              // ❌ INCORRECT - Show failure with retry option
              console.log('[TRACE-5] ❌ Challenge FAILED!');
              console.log('[STEP]:', step);
              console.log('[ACTION]:', buttonAction);
              console.log('[SUCCESS]: false');
              
              // DO NOT end session - allow retry
              sessionManager.incrementAttempts(userId);
              console.log(`[RETRY] User attempts: ${session.attempts}`);

              // Create retry button
              const retryRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`gateway:button:${userId}:${step}:retry`)
                  .setLabel('🔄 Try Again')
                  .setStyle(ButtonStyle.Secondary)
              );

              // Send failure reply WITHOUT deleting channel
              await interaction.editReply({
                content: `❌ **الإجابة خاطئة** ❌\n\n**Wrong button!** Please press the BLUE button only.\n\nحاول مرة أخرى:`,
                components: [retryRow],
              });

              gatewayLogger.log('CHALLENGE:FAILED', session.id, 'User failed the challenge - retry available', { 
                userId, 
                userAnswer, 
                correctAnswer,
                attempts: session.attempts
              });
              
              return { success: false, reason: 'challenge_failed', verified: false, retryAvailable: true };
            }
          } catch (error) {
            console.log('[TRACE-5] ❌ Error in challenge action:', error.message);
            await interaction.editReply({
              content: '❌ Error processing challenge. Please try again or contact an administrator.',
            });
            return { success: false, reason: 'challenge_process_failed' };
          }

        case 'retry':
          console.log('[TRACE-5] 🔄 Processing RETRY action');
          console.log('[STEP]:', step);
          console.log('[ACTION]:', buttonAction);
          
          try {
            // Reset state for new challenge
            sessionManager.updateStep(userId, 'challenge');
            
            // Logical challenge (NOT random) - Always "Blue" button is correct
            const correctAnswer = 'correct'; // The blue button
            
            // Update correct answer in session
            sessionManager.updateSessionData(userId, 'correctAnswer', correctAnswer);
            
            console.log('[CHALLENGE] Retry - Challenge type: "Press the blue button"');
            console.log('[CHALLENGE] Correct answer:', correctAnswer);
            
            // Create challenge buttons with clear colors
            const challengeRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`gateway:button:${userId}:${step}:challenge_correct`)
                .setLabel('🔵 Blue Button')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId(`gateway:button:${userId}:${step}:challenge_wrong`)
                .setLabel('🔴 Red Button')
                .setStyle(ButtonStyle.Danger)
            );
            
            // Send challenge again
            await interaction.editReply({
              content: `🎯 **تحدي التحقق - Press the BLUE button to continue**\n\n**اختر الزر الأزرق فقط:**`,
              components: [challengeRow],
            });

            gatewayLogger.log('CHALLENGE:RETRY', session.id, 'Challenge retry sent to user', { userId });
            
            console.log('[SUCCESS]: Retry challenge sent');
            return { success: true, retrying: true };
          } catch (error) {
            console.log('[TRACE-5] ❌ Error in retry action:', error.message);
            await interaction.editReply({
              content: '❌ Failed to load challenge retry. Please try again or contact an administrator.',
            });
            return { success: false, reason: 'retry_failed' };
          }

        case 'cancel':
          console.log('[TRACE-5] ❌ Processing CANCEL action');
          
          // Cancel verification
          sessionManager.updateSessionState(userId, 'failed');
          sessionManager.endSession(userId);
          GuildConfigService.endSession(interaction.guild.id);
          await queueManager.finishSession(userId);

          // Cleanup channel
          if (this.channelManager) {
            await this.channelManager.deleteVerificationChannel(userId, 'User cancelled verification');
          }

          // Send failure DM
          if (this.dmHandler) {
            await this.dmHandler.sendVerificationFailure(interaction.user, 'cancelled');
          }

          await interaction.editReply({
            content: '❌ Verification cancelled.',
          });
          
          gatewayLogger.log('VERIFY:CANCELLED', session.id, 'User cancelled verification via button', { userId });
          return { success: false, reason: 'cancelled' };

        default:
          console.log('[TRACE-5] ❓ Unknown action:', buttonAction);
          await interaction.editReply({
            content: '❓ Unknown action. Please try again.',
          });
          return { success: false, reason: 'unknown_action' };
      }

    } catch (error) {
      console.log('[TRACE-5] ❌ ERROR:', error.message);
      gatewayLogger.error(session?.id || null, error, { context: 'button_handler', userId, step });
      
      // Cleanup on error
      sessionManager.cancelSession(userId);
      GuildConfigService.endSession(interaction.guild.id);
      await queueManager.finishSession(userId);

      if (this.channelManager) {
        await this.channelManager.deleteVerificationChannel(userId);
      }

      await interaction.editReply({
        content: '❌ An error occurred during verification.',
      }).catch(() => {});

      return { success: false, error: error.message };
    }
  }

  /**
   * Handle modal submission
   */
  async handleModalSubmit(interaction, userId, step, modalData) {
    // Prevent double-processing
    if (sessionManager.hasProcessedInteraction(userId, interaction.id)) {
      await interaction.deferUpdate().catch(() => {});
      return { processed: false, duplicate: true };
    }

    sessionManager.markInteractionProcessed(userId, interaction.id);

    try {
      // Validate session
      const session = sessionManager.getSession(userId);
      if (!session) {
        await interaction.reply({
          content: '❌ Session not found.',
          ephemeral: true,
        });
        return { success: false, reason: 'session_not_found' };
      }

      // Check attempt limit
      if (session.attempts >= session.maxAttempts) {
        sessionManager.updateSessionState(userId, 'failed');
        await queueManager.finishSession(userId);

        if (this.channelManager) {
          await this.channelManager.deleteVerificationChannel(userId, 'Max attempts exceeded');
        }

        if (this.dmHandler) {
          await this.dmHandler.sendVerificationFailure(interaction.user, 'max_attempts');
        }

        // Assign failure role if configured
        if (this.roleManager && interaction.member && interaction.guild) {
          const guildConfig = await gatewayConfigService.getConfig(interaction.guild.id);
          const failureRoleId = guildConfig.roles?.failureRoleId;
          if (failureRoleId) {
            await this.roleManager.assignFailureRole(interaction.member, failureRoleId);
          }
        }

        sessionManager.endSession(userId);

        await interaction.reply({
          content: '❌ Max attempts exceeded. Verification failed.',
          ephemeral: true,
        });
        return { success: false, reason: 'max_attempts' };
      }

      // Process modal logic
      const result = flowEngine.processModalSubmission(step, modalData);

      if (result.shouldAdvance) {
        // Save modal data
        sessionManager.updateSessionData(userId, 'verificationResponse', result.data);
        sessionManager.updateStep(userId, result.nextStep);

        // Check if complete
        if (flowEngine.isFinalStep(result.nextStep)) {
          await this.completeVerification(interaction.user, interaction.guild, session);
          return { success: true, verified: true };
        }

        // Show next step
        const nextStep = flowEngine.getStep(result.nextStep);
        const components = this.buildStepComponents(userId, nextStep);

        await interaction.reply({
          content: `Next: **${nextStep.label}**`,
          components,
          ephemeral: true,
        });

        return { success: true, advanced: true };
      } else {
        // Retry
        sessionManager.incrementAttempts(userId);
        const currentStep = flowEngine.getStep(step);
        const components = this.buildStepComponents(userId, currentStep);

        await interaction.reply({
          content: `${result.reason ? `❌ ${result.reason}. ` : ''}Please try again.`,
          components,
          ephemeral: true,
        });

        return { success: true, advanced: false };
      }
    } catch (error) {
      console.error('[GatewayEngine] Modal handler error:', error);
      sessionManager.cancelSession(userId);
      GuildConfigService.endSession(interaction.guild.id);
      await queueManager.finishSession(userId);

      if (this.channelManager) {
        await this.channelManager.deleteVerificationChannel(userId);
      }

      await interaction.reply({
        content: '❌ Error processing submission.',
        ephemeral: true,
      }).catch(() => {});

      return { success: false, error: error.message };
    }
  }

  /**
   * Complete verification successfully
   */
  async completeVerification(user, guild, session) {
    sessionManager.updateSessionState(user.id, 'completed');
    await queueManager.finishSession(user.id);

    // Delete verification channel
    if (this.channelManager) {
      await this.channelManager.deleteVerificationChannel(user.id, 'Verification complete');
    }

    // Assign success role
    if (this.roleManager && guild) {
      try {
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (member) {
          const guildConfig = await gatewayConfigService.getConfig(guild.id);
          const successRoleId = guildConfig.roles?.successRoleId;
          if (successRoleId) {
            await this.roleManager.assignSuccessRole(member, successRoleId);
          }
        }
      } catch (error) {
        console.error('[GatewayEngine] Failed to assign role:', error);
      }
    }

    // Send success DM
    if (this.dmHandler) {
      await this.dmHandler.sendVerificationSuccess(user, guild.name);
    }

    sessionManager.endSession(user.id);
    GuildConfigService.endSession(guild.id);
  }

  /**
   * Build Discord components for a step
   */
  buildStepComponents(userId, step) {
    if (step.type === 'button') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`gateway:button:${userId}:${step.id}:accept`)
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`gateway:button:${userId}:${step.id}:retry`)
          .setLabel('Retry')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`gateway:button:${userId}:${step.id}:cancel`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      );
      return [row];
    }

    return [];
  }

  /**
   * Build verification modal
   */
  buildVerificationModal(userId, step) {
    const modal = new ModalBuilder()
      .setCustomId(`gateway:modal:${userId}:${step.id}`)
      .setTitle('Verification Required')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('verification_response')
            .setLabel('Your verification response')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter your response here...')
            .setMinLength(10)
            .setMaxLength(1000)
            .setRequired(true)
        )
      );

    return modal;
  }

  /**
   * Get session info
   */
  getSessionInfo(userId) {
    return sessionManager.getSession(userId);
  }

  /**
   * Get queue stats
   */
  getQueueStats() {
    return queueManager.getStats();
  }

  /**
   * Cleanup expired sessions
   */
  cleanupSessions() {
    return sessionManager.cleanupExpiredSessions();
  }

  /**
   * Get system status (for admin commands)
   */
  getSystemStatus() {
    const sessions = sessionManager.getAllSessions();
    const stats = queueManager.getStats();
    return {
      sessions: sessions.length,
      activeSessions: stats.activeCount,
      waiting: stats.waitingCount,
      utilization: stats.utilizationPercent,
    };
  }
}
