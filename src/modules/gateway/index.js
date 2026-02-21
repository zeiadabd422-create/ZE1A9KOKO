import cache from './cache.js';
import checker from './checker.js';
import actions from './actions.js';
import GatewayModel from './schema.js';
import { logger } from '../../core/logger.js';

/**
 * Gateway Module - Index
 * DDD: Coordinator/Facade Pattern
 * 
 * Main entry point for the gateway verification system
 * Handles all gateway-related interactions and operations
 */

class GatewayModule {
    constructor() {
        this.cache = cache;
        this.checker = checker;
        this.actions = actions;
        this.model = GatewayModel;
    }

    /**
     * Initialize gateway module
     * Called during bot startup after database connection
     */
    async init(client) {
        try {
            logger.info('Initializing Gateway Module...');
            
            // Initialize in-memory cache from database
            await this.cache.initCache();
            
            logger.info('✓ Gateway Module initialized successfully');
            return true;
        } catch (error) {
            logger.error(`Failed to initialize Gateway Module: ${error.message}`);
            return false;
        }
    }

    /**
     * Main interaction handler for gateway verify button
     * Called when user clicks the verify button
     * 
     * @param {Interaction} interaction - Discord interaction object
     * @returns {Promise<boolean>} Success status
     */
    async handleInteraction(interaction) {
        try {
            // Only handle button interactions with our custom ID
            if (!interaction.isButton() || interaction.customId !== 'gateway_verify_btn') {
                return false;
            }

            // Defer reply immediately (ephemeral)
            await interaction.deferReply({ ephemeral: true });

            const { guild, user, member } = interaction;

            // Validate context
            if (!guild || !user || !member) {
                await interaction.editReply({
                    content: '❌ Could not access guild or user information.'
                });
                return false;
            }

            logger.info(`Gateway verify button clicked by ${user.id} in guild ${guild.id}`);

            // 1. Check if gateway is configured
            const gatewayConfig = this.checker.getGatewayConfig(guild.id);

            if (!gatewayConfig) {
                await interaction.editReply({
                    content: '❌ Gateway is not properly configured. Please contact an admin.'
                });
                return false;
            }

            // 2. Check if user is already verified
            if (this.checker.isUserVerified(member, guild.id)) {
                await interaction.editReply({
                    content: '✓ You are already verified. Welcome back!'
                });
                logger.info(`User ${user.id} already verified in guild ${guild.id}`);
                return true;
            }

            // 3. Perform verification
            const result = await this.actions.performVerification(
                guild,
                member,
                user,
                gatewayConfig,
                'BUTTON'
            );

            // 4. Send response
            if (result.success) {
                await interaction.editReply({
                    content: `✓ ${result.message}`
                });
                logger.info(`✓ User ${user.id} verified in guild ${guild.id}`);
                return true;
            } else {
                await interaction.editReply({
                    content: `❌ ${result.message}`
                });
                logger.error(`Verification failed for user ${user.id}: ${result.error}`);
                return false;
            }
        } catch (error) {
            logger.error(`Gateway interaction handler error: ${error.message}`);
            
            try {
                await interaction.editReply({
                    content: '❌ An unexpected error occurred. Please try again later.'
                });
            } catch (replyError) {
                logger.error(`Could not send error reply: ${replyError.message}`);
            }

            return false;
        }
    }

    /**
     * Save gateway configuration to database AND cache
     * Used by setup-gateway command
     * 
     * @param {string} guildId - Discord Guild ID
     * @param {Object} configData - Configuration data to save
     * @returns {Promise<Object>} { success: boolean, data?: Object, error?: string }
     */
    async saveConfiguration(guildId, configData) {
        try {
            if (!guildId) {
                throw new Error('Guild ID is required');
            }

            logger.info(`Saving gateway configuration for guild ${guildId}`);

            // Save to database
            const updated = await this.model.findOneAndUpdate(
                { guildId },
                { $set: { ...configData, lastUpdated: new Date() } },
                { new: true, upsert: true }
            ).lean();

            if (!updated) {
                throw new Error('Failed to save to database');
            }

            // Instantly update cache (no restart needed)
            this.cache.setCache(guildId, updated);

            logger.info(`✓ Gateway configuration saved for guild ${guildId}`);

            return {
                success: true,
                data: updated
            };
        } catch (error) {
            logger.error(`Failed to save gateway configuration: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get gateway configuration for a guild
     * 
     * @param {string} guildId - Discord Guild ID
     * @returns {Promise<Object|null>} Gateway configuration or null
     */
    async getConfiguration(guildId) {
        try {
            // Try cache first
            const cached = this.cache.getCache(guildId);
            if (cached) {
                return cached;
            }

            // Fallback to database if not cached
            const fromDb = await this.model.findOne({ guildId }).lean();
            
            if (fromDb) {
                this.cache.setCache(guildId, fromDb);
            }

            return fromDb || null;
        } catch (error) {
            logger.error(`Failed to get gateway configuration: ${error.message}`);
            return null;
        }
    }

    /**
     * Delete gateway configuration
     * 
     * @param {string} guildId - Discord Guild ID
     * @returns {Promise<Object>} { success: boolean, error?: string }
     */
    async deleteConfiguration(guildId) {
        try {
            await this.model.deleteOne({ guildId });
            this.cache.deleteCache(guildId);

            logger.info(`✓ Gateway configuration deleted for guild ${guildId}`);

            return { success: true };
        } catch (error) {
            logger.error(`Failed to delete gateway configuration: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get cache statistics
     * Useful for monitoring and debugging
     * 
     * @returns {Object} Cache stats
     */
    getCacheStats() {
        return this.cache.getStats();
    }

    /**
     * Check if module is ready
     * 
     * @returns {boolean} Is cache initialized and ready
     */
    isReady() {
        return this.cache.isReady();
    }
}

// Export coordinator instance
export default new GatewayModule();
