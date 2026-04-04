import { keywordEngine } from './KeywordEngine.js';

/**
 * DMHandler - Manages DM verification workflow
 * Handles initial keyword verification and user notifications
 */
export class DMHandler {
  constructor({ keywordEngine: engine = keywordEngine, gatewayEngine } = {}) {
    if (!gatewayEngine) {
      throw new Error('DMHandler requires gatewayEngine');
    }

    this.keywordEngine = engine;
    this.gatewayEngine = gatewayEngine;
    this.dmThrottling = new Map(); // userId -> lastDMTime
    this.dmThrottleMs = 2000; // 2 seconds between DM responses
  }

  /**
   * Check if user is throttled
   */
  isThrottled(userId) {
    const lastTime = this.dmThrottling.get(userId);
    if (!lastTime) return false;

    if (Date.now() - lastTime < this.dmThrottleMs) {
      return true;
    }

    this.dmThrottling.delete(userId);
    return false;
  }

  /**
   * Mark user as recently messaged
   */
  recordDMActivity(userId) {
    this.dmThrottling.set(userId, Date.now());
  }

  /**
   * Handle DM message from user
   */
  async handleDM(message) {
    if (message.author.bot) return false;

    // Throttle check
    if (this.isThrottled(message.author.id)) {
      return false; // Silent throttle
    }

    const userContent = message.content.trim();

    // Check if keyword matches
    if (!this.keywordEngine.isKeywordMatch(userContent)) {
      // Send help message
      await this.sendHelpMessage(message.author);
      this.recordDMActivity(message.author.id);
      return false;
    }

    // Keyword matched - proceed with verification
    return await this.processKeywordMatch(message);
  }

  /**
   * Send help message to user
   */
  async sendHelpMessage(user) {
    try {
      const keywords = this.keywordEngine.formatKeywordsForDisplay();

      await user.send({
        embeds: [
          {
            color: 0x3498db,
            title: '🔐 Server Verification',
            description:
              'To begin verification in the server, reply with one of the following keywords:',
            fields: [
              {
                name: 'Valid Keywords',
                value: `\`${keywords}\``,
                inline: false,
              },
              {
                name: 'Example',
                value: `Reply with: **${this.keywordEngine.getValidKeywords()[0]}**`,
                inline: false,
              },
            ],
            footer: {
              text: 'Automatic verification system',
            },
          },
        ],
      });
    } catch (error) {
      console.error(`[DMHandler] Failed to send help message:`, error);
    }
  }

  /**
   * Process successful keyword match
   */
  async processKeywordMatch(message) {
    this.recordDMActivity(message.author.id);

    try {
      // Inform user verification is starting
      await message.reply({
        embeds: [
          {
            color: 0x2ecc71,
            title: '✅ Verification Started',
            description: 'Your verification process has begun. Check your server notifications!',
            footer: { text: 'You will be guided through the verification steps' },
          },
        ],
      });

      return true;
    } catch (error) {
      console.error(`[DMHandler] Failed to process keyword match:`, error);
      return false;
    }
  }

  /**
   * Send welcome DM to new user
   */
  async sendWelcomeDM(user, guildName, keywords) {
    try {
      const keywordList = keywords.join(' / ');

      await user.send({
        embeds: [
          {
            color: 0x9b59b6,
            title: `🎉 Welcome to ${guildName}!`,
            description:
              'To access the server, you need to complete verification. Start by replying here with a keyword.',
            fields: [
              {
                name: 'How to Begin Verification',
                value: `Reply with one of these keywords:\n\`${keywordList}\``,
                inline: false,
              },
              {
                name: '💡 Tips',
                value:
                  '• This is case-insensitive\n• Spacing and punctuation are ignored\n• You have 30 minutes to complete verification',
                inline: false,
              },
            ],
            footer: {
              text: 'Automated verification system',
            },
          },
        ],
      });

      return { success: true };
    } catch (error) {
      console.error(`[DMHandler] Failed to send welcome DM:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send queue position update
   */
  async sendQueuePositionUpdate(user, position, waitEstimate) {
    try {
      const waitMinutes = Math.ceil(waitEstimate / 60);

      await user.send({
        embeds: [
          {
            color: 0xf39c12,
            title: '⏳ You\'re in the Queue',
            description: `Your position in the verification queue has been updated.`,
            fields: [
              {
                name: 'Queue Position',
                value: `#${position}`,
                inline: true,
              },
              {
                name: 'Estimated Wait',
                value: `~${waitMinutes} minutes`,
                inline: true,
              },
            ],
            footer: {
              text: 'You will be notified when it\'s your turn',
            },
          },
        ],
      });

      return { success: true };
    } catch (error) {
      console.error(`[DMHandler] Failed to send queue update:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send verification ready notification
   */
  async sendVerificationReady(user, guildName) {
    try {
      await user.send({
        embeds: [
          {
            color: 0x2ecc71,
            title: '🚀 Ready for Verification',
            description: `It's your turn! Head to ${guildName} to complete your verification.`,
            fields: [
              {
                name: 'Next Steps',
                value: 'Go back to the server and click the verification button to continue.',
                inline: false,
              },
            ],
            footer: {
              text: 'This notification was sent automatically',
            },
          },
        ],
      });

      return { success: true };
    } catch (error) {
      console.error(`[DMHandler] Failed to send ready notification:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send verification success confirmation
   */
  async sendVerificationSuccess(user, guildName) {
    try {
      await user.send({
        embeds: [
          {
            color: 0x27ae60,
            title: '✅ Verification Successful!',
            description: `Welcome to ${guildName}! Your account has been verified.`,
            fields: [
              {
                name: 'What Now?',
                value: 'You now have full access to the server. Enjoy!',
                inline: false,
              },
            ],
            footer: {
              text: 'Verification complete',
            },
          },
        ],
      });

      return { success: true };
    } catch (error) {
      console.error(`[DMHandler] Failed to send success message:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send verification failure notification
   */
  async sendVerificationFailure(user, reason = 'too many attempts') {
    try {
      await user.send({
        embeds: [
          {
            color: 0xe74c3c,
            title: '❌ Verification Failed',
            description: `Your verification has failed due to: **${reason}**`,
            fields: [
              {
                name: 'What Can You Do?',
                value: 'Contact server moderators for assistance.',
                inline: false,
              },
            ],
            footer: {
              text: 'Verification system',
            },
          },
        ],
      });

      return { success: true };
    } catch (error) {
      console.error(`[DMHandler] Failed to send failure message:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get throttle status
   */
  getThrottleStatus(userId) {
    const lastTime = this.dmThrottling.get(userId);
    if (!lastTime) return { throttled: false };

    const elapsed = Date.now() - lastTime;
    return {
      throttled: elapsed < this.dmThrottleMs,
      remainingMs: Math.max(0, this.dmThrottleMs - elapsed),
    };
  }

  /**
   * Clear throttle for user
   */
  clearThrottle(userId) {
    this.dmThrottling.delete(userId);
  }

  /**
   * Clear all throttles (for testing)
   */
  clearAllThrottles() {
    this.dmThrottling.clear();
  }
}
