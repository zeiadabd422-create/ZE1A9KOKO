import { GatewayEngine } from '../../core/GatewayEngine.js';
import { gatewayLogger } from '../../utils/GatewayLogger.js';

/**
 * GatewayController - Entry point for all gateway interactions
 * Routes interactions from interactionCreate event to appropriate handlers
 */
export class GatewayController {
  constructor(client, channelManager, roleManager, gatewayEngine, dmHandler) {
    if (!gatewayEngine) {
      throw new Error('GatewayController requires a GatewayEngine instance');
    }

    this.client = client;
    this.engine = gatewayEngine;
    this.channelManager = channelManager;
    this.roleManager = roleManager;
    this.dmHandler = dmHandler;
    this.verificationFlow = gatewayEngine;
  }

  /**
   * Parse custom ID format: gateway:{type}:{userId}:{step}:{action}
   */
  parseCustomId(id) {
      console.log('[TRACE-PARSE] Parsing customId:', id);
      
      if (!id.startsWith('gateway:')) {
        console.log('[TRACE-PARSE] ❌ Does not start with "gateway:"');
        gatewayLogger.log('WARN', null, 'Invalid customId format', { customId: id });
        return null;
      }

      console.log('[TRACE-PARSE] ✅ Starts with "gateway:"');
        const p = id.split(':');
        console.log('[TRACE-PARSE] Parts:', p, 'length:', p.length);
        
          if (p.length < 5) {
            console.log('[TRACE-PARSE] ❌ Not enough parts (need 5)');
            gatewayLogger.log('WARN', null, 'Invalid customId parts', { customId: id, parts: p.length });
            return null;
          }

          console.log('[TRACE-PARSE] ✅ Parsing result:');
            return {
                    type: p[1],
                        userId: p[2],
                            step: p[3],
                                action: p[4]
            };
}

  /**
   * Handle button interaction
   */
  async handleButton(interaction) {
    console.log("🎯 CONTROLLER HIT");
    
    // 🔴 TRACE POINT 4: handleButton called
    console.log('[TRACE-4] ✅ GatewayController.handleButton CALLED');
    console.log('[TRACE-4] - customId:', interaction.customId);
    
    try {
      // Defer reply immediately to prevent timeout
      await interaction.deferReply({ ephemeral: true });
      
      gatewayLogger.interaction(null, interaction);
      const parsed = this.parseCustomId(interaction.customId);
      console.log('[TRACE-4] - parseCustomId result:', parsed);
      
      if (!parsed || parsed.type !== 'button') {
        console.log('[TRACE-4] ❌ ParseCustomId failed or not button type');
        await interaction.editReply({
          content: '❌ Invalid button interaction.',
        });
        return false;
      }

      console.log('[TRACE-4] ✅ CustomId parsed successfully');
      gatewayLogger.parsed(null, parsed);
      const { userId, step, action } = parsed;

      // Get session for context
      const session = this.engine.sessionManager?.getSession(userId);
      const sessionId = session?.id;
      console.log('[TRACE-4] - Session found:', !!session, 'userId:', userId);

      // Verify user
      if (interaction.user.id !== userId) {
        console.log('[TRACE-4] ❌ User mismatch', interaction.user.id, '!==', userId);
        gatewayLogger.log('WARN', sessionId, 'User mismatch in button', {
          expectedUserId: userId,
          actualUserId: interaction.user.id
        });
        await interaction.editReply({
          content: '❌ This is not your verification session.',
        });
        return true;
      }

      // Handle button
      console.log('[TRACE-4] 🎯 Calling engine.handleButtonClick');
      gatewayLogger.step(sessionId, step, action, 'pending');
      const result = await this.engine.handleButtonClick(
        interaction,
        userId,
        step,
        action
      );

      console.log('[TRACE-4] ✅ Engine returned:', result);
      gatewayLogger.log('SUCCESS', sessionId, 'Button handled', { action, success: result.success });
      
      // The engine already replies or edits the button response.
      return result.success !== false;
    } catch (error) {
      console.log('[TRACE-4] ❌ ERROR:', error.message);
      gatewayLogger.error(null, error, { type: 'button_handler' });
      
      // Ensure we always respond
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ 
            content: '❌ An error occurred while processing the button.', 
            ephemeral: true 
          });
        } else {
          await interaction.editReply({
            content: '❌ An error occurred while processing the button.',
          });
        }
      } catch (replyError) {
        console.error('[TRACE-4] Failed to send error reply:', replyError);
      }
      
      return false;
    }
  }

  /**
   * Handle modal submission
   */
  async handleModalSubmit(interaction) {
    console.log('[GatewayTest] Modal received: ' + interaction.customId);
    const parsed = this.parseCustomId(interaction.customId);
    if (!parsed || parsed.type !== 'modal') {
      console.log('[GatewayTest] Modal parse failed or not modal type');
      return false;
    }

    const { userId, step } = parsed;

    // Verify user
    if (interaction.user.id !== userId) {
      console.log('[GatewayTest] User verification failed for modal');
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

    console.log(`[GatewayTest] Modal data: ${JSON.stringify(modalData)}`);

    // Handle modal
    console.log('[GatewayTest] Calling engine for modal');
    const result = await this.engine.handleModalSubmit(
      interaction,
      userId,
      step,
      modalData
    );

    console.log('[GatewayTest] Engine handled modal, result: ' + result.success);
    return result.success !== false;
  }

  /**
   * Main entry point from interactionCreate
   * Returns true if handled, false if not gateway interaction
   */
  async handleInteraction(interaction) {
    // 🔴 TRACE POINT 3: Gateway controller received
    console.log('[TRACE-3] ✅ GatewayController.handleInteraction CALLED');
    console.log('[TRACE-3] - customId:', interaction.customId);
    console.log('[TRACE-3] - isButton.call:', interaction.isButton?.());
    
    // Handle buttons
    if (interaction.isButton?.()) {
      console.log('[TRACE-3] 🎯 IS BUTTON - calling handleButton');
      return await this.handleButton(interaction);
    }

    console.log('[TRACE-3] - Not a button type');

    // Handle modals
    if (interaction.isModalSubmit?.()) {
      console.log('[TRACE-3] 🎯 IS MODAL - calling handleModalSubmit');
      return await this.handleModalSubmit(interaction);
    }

    console.log('[TRACE-3] ❌ No handler matched - returning false');
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
