import { GatewayEngine } from '../../core/GatewayEngine.js';

/**
 * GatewayController - Entry point for all gateway interactions
 * Routes interactions from interactionCreate event to appropriate handlers
 */
export class GatewayController {
  constructor(client, channelManager, roleManager, dmHandler) {
    this.client = client;
    this.engine = new GatewayEngine(client, channelManager, roleManager, dmHandler);
    this.channelManager = channelManager;
    this.roleManager = roleManager;
    this.dmHandler = dmHandler;
  }

  /**
   * Parse custom ID format: gateway:{type}:{userId}:{step}:{action}
   */
  parseCustomId(customId) {
    if (!customId.startsWith('gateway:')) {
      return null;
    }

    const parts = customId.split(':');
    if (parts.length < 4) {
      return null;
    }

    return {
      type: parts[1], // button, modal
      userId: parts[2],
      step: parts[3],
      action: parts[4] || null, // accept, reject, retry, cancel
    };
  }

  /**
   * Handle button interaction
   */
  async handleButton(interaction) {
    const parsed = this.parseCustomId(interaction.customId);
    if (!parsed || parsed.type !== 'button') {
      return false;
    }

    const { userId, step, action } = parsed;

    // Verify user
    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: '❌ This is not your verification session.',
        ephemeral: true,
      });
      return true;
    }

    // Handle button
    const result = await this.engine.handleButtonClick(
      interaction,
      userId,
      step,
      action
    );

    return result.success !== false;
  }

  /**
   * Handle modal submission
   */
  async handleModalSubmit(interaction) {
    const parsed = this.parseCustomId(interaction.customId);
    if (!parsed || parsed.type !== 'modal') {
      return false;
    }

    const { userId, step } = parsed;

    // Verify user
    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: '❌ This is not your verification session.',
        ephemeral: true,
      });
      return true;
    }

    // Extract modal data
    const modalData = {};
    interaction.fields.fields.forEach((field) => {
      modalData[field.customId] = field.value;
    });

    // Handle modal
    const result = await this.engine.handleModalSubmit(
      interaction,
      userId,
      step,
      modalData
    );

    return result.success !== false;
  }

  /**
   * Main entry point from interactionCreate
   * Returns true if handled, false if not gateway interaction
   */
  async handleInteraction(interaction) {
    // Handle buttons
    if (interaction.isButton?.()) {
      return await this.handleButton(interaction);
    }

    // Handle modals
    if (interaction.isModalSubmit?.()) {
      return await this.handleModalSubmit(interaction);
    }

    return false;
  }

  /**
   * Start verification (public API)
   */
  async startVerification(user, guild) {
    return await this.engine.startVerification(user, guild);
  }

  /**
   * Get session info (public API)
   */
  getSessionInfo(userId) {
    return this.engine.getSessionInfo(userId);
  }

  /**
   * Get queue stats (public API)
   */
  getQueueStats() {
    return this.engine.getQueueStats();
  }

  /**
   * Get channel info (public API)
   */
  getChannelInfo(userId) {
    if (!this.channelManager) return null;
    return this.channelManager.getChannelInfo(userId);
  }

  /**
   * Get gateway system status
   */
  getStatus() {
    if (!this.engine) {
      return { error: 'Gateway engine not initialized' };
    }
    return this.engine.getSystemStatus();
  }
}
