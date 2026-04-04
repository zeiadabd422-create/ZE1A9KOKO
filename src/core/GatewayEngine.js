import { sessionManager } from './SessionManager.js';
import { queueManager } from './QueueManager.js';
import { flowEngine } from './FlowEngine.js';
import { gatewayConfigService } from '../services/GatewayConfigService.js';
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
    this.verificationConfig = {
      maxAttempts: 3,
      sessionTimeout: 30 * 60 * 1000,
      messageCleanupDelay: 5000,
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
    // Validation checks
    if (!user || !user.id) {
      throw new Error('Invalid user provided to startVerification');
    }

    if (!guild || !guild.id) {
      throw new Error('Invalid guild provided to startVerification');
    }

    // Check if user already has active session
    if (sessionManager.hasActiveSession(user.id)) {
      throw new Error('User already has an active verification session');
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
    queueManager.startSession(user.id);
    sessionManager.updateSessionState(user.id, 'active');

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
    // Prevent double-processing
    if (sessionManager.hasProcessedInteraction(userId, interaction.id)) {
      await interaction.deferUpdate().catch(() => {});
      return { processed: false, duplicate: true };
    }

    sessionManager.markInteractionProcessed(userId, interaction.id);

    try {
      // Validate session exists
      const session = sessionManager.getSession(userId);
      if (!session) {
        await interaction.reply({
          content: '❌ Session not found. Please start verification again.',
          ephemeral: true,
        });
        return { success: false, reason: 'session_not_found' };
      }

      // Process button logic
      const result = flowEngine.processButtonClick(step, buttonAction);

      if (result.cancelled) {
        sessionManager.updateSessionState(userId, 'failed');
        await queueManager.finishSession(userId);

        // Cleanup channel if available
        if (this.channelManager) {
          await this.channelManager.deleteVerificationChannel(userId, 'User cancelled verification');
        }

        // Send failure DM
        if (this.dmHandler) {
          await this.dmHandler.sendVerificationFailure(interaction.user, 'cancelled');
        }

        sessionManager.endSession(userId);

        await interaction.reply({
          content: '❌ Verification cancelled.',
          ephemeral: true,
        });
        return { success: false, reason: 'cancelled' };
      }

      if (result.shouldAdvance) {
        sessionManager.updateStep(userId, result.nextStep);

        // Check if complete
        if (flowEngine.isFinalStep(result.nextStep)) {
          await this.completeVerification(interaction.user, interaction.guild, session);
          return { success: true, verified: true };
        }

        // Show next step button
        const nextStep = flowEngine.getStep(result.nextStep);
        const components = this.buildStepComponents(userId, nextStep);

        await interaction.reply({
          content: `Moving to next step: **${nextStep.label}**`,
          components,
          ephemeral: true,
        });

        return { success: true, advanced: true };
      } else {
        // Retry same step
        const currentStep = flowEngine.getStep(step);
        const components = this.buildStepComponents(userId, currentStep);

        await interaction.reply({
          content: `Please try again.`,
          components,
          ephemeral: true,
        });

        return { success: true, advanced: false };
      }
    } catch (error) {
      console.error('[GatewayEngine] Button handler error:', error);
      sessionManager.endSession(userId);
      await queueManager.finishSession(userId);

      if (this.channelManager) {
        await this.channelManager.deleteVerificationChannel(userId);
      }

      await interaction.reply({
        content: '❌ An error occurred during verification.',
        ephemeral: true,
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
      sessionManager.endSession(userId);
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
