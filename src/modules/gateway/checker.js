import cache from './cache.js';
import { logger } from '../../core/logger.js';

/**
 * Gateway Verification Checker
 * DDD: Domain Layer - Business Logic
 * 
 * Checks if a user is verified and if the gateway is properly configured
 */
class GatewayChecker {
    /**
     * Check if gateway is enabled for a guild
     * @param {string} guildId - Discord Guild ID
     * @returns {Object} { enabled: boolean, reason?: string }
     */
    isGatewayEnabled(guildId) {
        const gateway = cache.getCache(guildId);

        if (!gateway) {
            return {
                enabled: false,
                reason: 'GATEWAY_NOT_CONFIGURED'
            };
        }

        if (!gateway.enabled) {
            return {
                enabled: false,
                reason: 'GATEWAY_DISABLED'
            };
        }

        return {
            enabled: true
        };
    }

    /**
     * Validate gateway configuration
     * @param {string} guildId - Discord Guild ID
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    validateGatewayConfig(guildId) {
        const gateway = cache.getCache(guildId);
        const errors = [];

        if (!gateway) {
            return {
                valid: false,
                errors: ['Gateway configuration not found']
            };
        }

        // Check required fields
        if (!gateway.roleId) {
            errors.push('Role ID not configured');
        }

        if (!gateway.channelId) {
            errors.push('Channel ID not configured');
        }

        if (!gateway.mode) {
            errors.push('Gateway mode not specified');
        }

        // Check mode-specific configuration
        switch (gateway.mode) {
            case 'BUTTON':
                if (!gateway.buttonConfig) {
                    errors.push('Button configuration missing');
                }
                break;
            case 'REACTION':
                if (!gateway.reactionConfig?.emoji) {
                    errors.push('Emoji configuration missing');
                }
                break;
            case 'TRIGGER':
                if (!gateway.triggerConfig?.triggerWord) {
                    errors.push('Trigger word not configured');
                }
                break;
            case 'SLASH':
                break; // Slash mode requires minimal config
            default:
                errors.push(`Unknown gateway mode: ${gateway.mode}`);
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Check if a user is already verified
     * @param {GuildMember} member - Discord Guild Member
     * @param {string} guildId - Discord Guild ID
     * @returns {boolean} Is user already verified
     */
    isUserVerified(member, guildId) {
        try {
            if (!member || !member.roles) {
                return false;
            }

            const gateway = cache.getCache(guildId);
            if (!gateway || !gateway.roleId) {
                return false;
            }

            const isVerified = member.roles.cache.has(gateway.roleId);
            
            if (isVerified) {
                logger.debug(`User ${member.user.id} already has verification role in guild ${guildId}`);
            }

            return isVerified;
        } catch (error) {
            logger.error(`Error checking user verification: ${error.message}`);
            return false;
        }
    }

    /**
     * Get gateway configuration for a user interaction
     * @param {string} guildId - Discord Guild ID
     * @returns {Object|null} Gateway config or null if invalid
     */
    getGatewayConfig(guildId) {
        const enabledCheck = this.isGatewayEnabled(guildId);
        
        if (!enabledCheck.enabled) {
            logger.warn(`Gateway check failed for guild ${guildId}: ${enabledCheck.reason}`);
            return null;
        }

        const validationCheck = this.validateGatewayConfig(guildId);
        
        if (!validationCheck.valid) {
            logger.warn(`Gateway validation failed for guild ${guildId}: ${validationCheck.errors.join(', ')}`);
            return null;
        }

        return cache.getCache(guildId);
    }

    /**
     * Get verification status summary for a user
     * @param {GuildMember} member - Discord Guild Member
     * @param {string} guildId - Discord Guild ID
     * @returns {Object} { verified: boolean, reason: string }
     */
    getVerificationStatus(member, guildId) {
        const gatewayConfig = this.getGatewayConfig(guildId);

        if (!gatewayConfig) {
            return {
                verified: false,
                reason: 'Gateway not properly configured'
            };
        }

        if (this.isUserVerified(member, guildId)) {
            return {
                verified: true,
                reason: 'User already verified'
            };
        }

        return {
            verified: false,
            reason: 'User not yet verified'
        };
    }
}

// Export singleton instance
export default new GatewayChecker();
