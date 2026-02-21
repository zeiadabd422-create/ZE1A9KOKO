import { ChannelType, EmbedBuilder } from 'discord.js';
import { updateUserConfig } from '../../core/database.js';
import { logger } from '../../core/logger.js';
import GatewayModel from './schema.js';
import cache from './cache.js';

/**
 * Gateway Actions
 * DDD: Application Layer - Business Operations
 * 
 * Handles verification actions: role assignment, logging, notifications
 */
class GatewayActions {
    /**
     * Assign verification role to a member
     * @param {GuildMember} member - Discord Guild Member
     * @param {string} guildId - Discord Guild ID
     * @param {string} roleId - Role ID to assign
     * @param {string} reason - Audit log reason
     * @returns {Promise<Object>} { success: boolean, error?: string }
     */
    async assignRole(member, guildId, roleId, reason = 'Gateway verification') {
        try {
            if (!member || !member.roles) {
                throw new Error('Invalid member object');
            }

            if (!roleId) {
                throw new Error('Role ID not provided');
            }

            // Check if user already has the role
            if (member.roles.cache.has(roleId)) {
                logger.info(`User ${member.user.id} already has role ${roleId}`);
                return {
                    success: true,
                    alreadyHad: true,
                    message: 'User already verified'
                };
            }

            // Assign the role
            await member.roles.add(roleId, reason);

            logger.info(`✓ Role ${roleId} assigned to ${member.user.id} in guild ${guildId}`);

            return {
                success: true,
                alreadyHad: false,
                message: 'Role assigned successfully'
            };
        } catch (error) {
            logger.error(`Failed to assign role ${roleId} to user ${member?.user?.id}: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send verification success message to user
     * @param {User} user - Discord User
     * @param {string} guildName - Guild name for context
     * @returns {Promise<Object>} { success: boolean, error?: string }
     */
    async sendSuccessMessage(user, guildName) {
        try {
            const embed = new EmbedBuilder()
                .setColor(0x00AA00)
                .setTitle('✓ Verification Successful')
                .setDescription(`You have been successfully verified in **${guildName}**.`)
                .addFields(
                    { name: 'Status', value: 'Verified', inline: true },
                    { name: 'Time', value: new Date().toLocaleString(), inline: true }
                )
                .setFooter({ text: 'Guardian Bot v4.0' })
                .setTimestamp();

            await user.send({ embeds: [embed] });

            logger.info(`✓ Success message sent to user ${user.id}`);

            return {
                success: true,
                message: 'DM sent'
            };
        } catch (error) {
            // DMs might be disabled, don't fail the verification
            logger.info(`Could not send DM to user ${user.id}: ${error.message}`);
            return {
                success: false,
                error: 'DM failed (user may have DMs disabled)',
                dmFailed: true
            };
        }
    }

    /**
     * Log verification action to guild's configured log channel
     * @param {Guild} guild - Discord Guild
     * @param {string} logChannelId - Channel ID to log to
     * @param {User} user - User who was verified
     * @param {string} mode - Verification mode (BUTTON, REACTION, TRIGGER, SLASH)
     * @returns {Promise<Object>} { success: boolean, error?: string }
     */
    async logVerificationAction(guild, logChannelId, user, mode = 'UNKNOWN') {
        try {
            if (!logChannelId) {
                logger.debug(`No log channel configured for guild ${guild.id}`);
                return {
                    success: false,
                    reason: 'No log channel configured'
                };
            }

            const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);

            if (!logChannel || logChannel.type !== ChannelType.GuildText) {
                logger.warn(`Log channel ${logChannelId} not found or is not a text channel`);
                return {
                    success: false,
                    error: 'Invalid log channel'
                };
            }

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('User Verification Logged')
                .addFields(
                    { name: 'User', value: `<@${user.id}> (${user.id})`, inline: true },
                    { name: 'Mode', value: mode, inline: true },
                    { name: 'Timestamp', value: new Date().toISOString(), inline: false },
                    { name: 'Username', value: user.username, inline: true },
                    { name: 'Guild', value: guild.name, inline: true }
                )
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ text: 'Guardian Bot v4.0' })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });

            logger.info(`✓ Verification logged for user ${user.id} in guild ${guild.id}`);

            return {
                success: true,
                message: 'Logged to channel'
            };
        } catch (error) {
            logger.error(`Failed to log verification action: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Perform complete verification action (assign role + send message + log)
     * @param {Guild} guild - Discord Guild
     * @param {GuildMember} member - Guild Member
     * @param {User} user - Discord User
     * @param {Object} gatewayConfig - Gateway configuration from cache/DB
     * @param {string} mode - Verification mode
     * @returns {Promise<Object>} Complete verification result
     */
    async performVerification(guild, member, user, gatewayConfig, mode = 'UNKNOWN') {
        try {
            if (!gatewayConfig || !gatewayConfig.roleId) {
                throw new Error('Invalid gateway configuration');
            }

            // 1. Assign role
            const roleResult = await this.assignRole(member, guild.id, gatewayConfig.roleId, `Gateway: ${mode}`);

            if (!roleResult.success) {
                throw new Error(`Failed to assign role: ${roleResult.error}`);
            }

            // 2. Send ephemeral success message
            const message = roleResult.alreadyHad 
                ? 'You are already verified.' 
                : 'Verification successful! Welcome!';

            // 3. Send DM notification (non-fatal if fails)
            await this.sendSuccessMessage(user, guild.name);

            // 4. Log verification action (if log channel configured)
            await this.logVerificationAction(guild, gatewayConfig.logChannelId, user, mode);

            // 5. Update user config in database
            try {
                await updateUserConfig(user.id, guild.id, {
                    'gateway.isVerified': true,
                    'gateway.verifiedAt': new Date(),
                    'gateway.verificationMode': mode
                });
            } catch (dbError) {
                logger.warn(`Could not update user config: ${dbError.message}`);
            }

            // 6. Increment verification count
            try {
                await GatewayModel.findOneAndUpdate(
                    { guildId: guild.id },
                    { $inc: { verificationCount: 1 } }
                );
                
                // Update cache
                const updated = await GatewayModel.findOne({ guildId: guild.id }).lean();
                if (updated) {
                    cache.setCache(guild.id, updated);
                }
            } catch (countError) {
                logger.warn(`Could not update verification count: ${countError.message}`);
            }

            return {
                success: true,
                already: roleResult.alreadyHad,
                message: message,
                mode: mode
            };
        } catch (error) {
            logger.error(`Verification failed for user ${user?.id}: ${error.message}`);
            return {
                success: false,
                error: error.message,
                message: 'Verification failed. Please contact an admin.'
            };
        }
    }
}

// Export singleton instance
export default new GatewayActions();
