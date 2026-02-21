import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { logger } from '../../core/logger.js';

/**
 * Gateway Manager Module
 * CORE logic module for handling all 4 gateway types
 * Responsible for creating Embeds and Components (Buttons/Reactions/Triggers)
 * 
 * Frozen for later - do not modify without approval
 */

/**
 * Maps button style string to Discord ButtonStyle enum
 */
function mapButtonStyle(style) {
    if (!style) return ButtonStyle.Primary;
    const s = String(style).toLowerCase();
    if (s === 'secondary') return ButtonStyle.Secondary;
    if (s === 'success') return ButtonStyle.Success;
    if (s === 'danger') return ButtonStyle.Danger;
    return ButtonStyle.Primary;
}

/**
 * Creates a gateway embed message
 */
function createGatewayEmbed(settings = {}, text = '') {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(settings.title || 'Gate Verification')
        .setDescription(text || 'Please verify to access this server.')
        .setFooter({ text: 'Guardian Bot v4.0' })
        .setTimestamp();
    
    return embed;
}

/**
 * Core Gateway Manager
 * Handles all 4 gateway types: BUTTON, REACTION, TRIGGER, SLASH
 */
const gatewayManager = {
    /**
     * Deploy gateway message to a channel
     * Main entry point for deploying gateway messages
     * 
     * @param {Guild} guild - Discord guild object
     * @param {TextChannel} channel - Discord text channel object
     * @param {string} type - Gateway type: BUTTON, REACTION, TRIGGER, SLASH
     * @param {Object} settings - Gateway settings object
     */
    async deploy(guild, channel, type, settings = {}) {
        try {
            if (!channel || !channel.send) {
                throw new Error('Invalid channel provided');
            }

            const T = String(type || '').toUpperCase();
            logger.info(`Deploying ${T} gateway to channel ${channel.name}`);

            switch (T) {
                case 'BUTTON':
                    return await this.deployButtonGateway(channel, settings);
                case 'REACTION':
                    return await this.deployReactionGateway(channel, settings);
                case 'TRIGGER':
                    return await this.deployTriggerGateway(channel, settings);
                case 'SLASH':
                    return await this.deploySlashGateway(channel, settings);
                default:
                    throw new Error(`Unknown gateway type: ${type}`);
            }
        } catch (error) {
            logger.error(`gatewayManager.deploy: ${error.message}`);
            throw error;
        }
    },

    /**
     * Deploy Button-based Gateway
     * Sends an embed with a clickable button
     */
    async deployButtonGateway(channel, settings = {}) {
        try {
            const embed = createGatewayEmbed(settings, settings.embedText || 'Click the button below to verify and gain access.');
            
            const label = settings.buttonLabel || 'Verify';
            const style = mapButtonStyle(settings.buttonStyle);
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('gateway_verify_button')
                    .setLabel(label)
                    .setStyle(style)
            );

            const msg = await channel.send({
                embeds: [embed],
                components: [row]
            });

            logger.info(`Button gateway deployed to ${channel.name}`);
            return msg;
        } catch (error) {
            logger.error(`Failed to deploy button gateway: ${error.message}`);
            throw error;
        }
    },

    /**
     * Deploy Reaction-based Gateway
     * Sends an embed and adds a reaction emoji
     */
    async deployReactionGateway(channel, settings = {}) {
        try {
            const embed = createGatewayEmbed(settings, settings.embedText || 'React with the emoji below to verify and gain access.');
            
            const msg = await channel.send({
                embeds: [embed]
            });

            const emoji = settings.emoji || '✅';
            try {
                await msg.react(emoji);
                logger.info(`Reaction gateway deployed to ${channel.name} with emoji: ${emoji}`);
            } catch (reactionError) {
                logger.warn(`Failed to add reaction to gateway message: ${reactionError.message}`);
            }

            return msg;
        } catch (error) {
            logger.error(`Failed to deploy reaction gateway: ${error.message}`);
            throw error;
        }
    },

    /**
     * Deploy Trigger-word Gateway
     * Sends an embed with instructions to type a trigger word
     */
    async deployTriggerGateway(channel, settings = {}) {
        try {
            const triggerWord = settings.triggerWord || 'verify';
            const instruction = settings.instructionText || `Type the trigger word **${triggerWord}** in this channel to verify and gain access.`;
            
            const embed = createGatewayEmbed(settings, instruction);

            const msg = await channel.send({
                embeds: [embed]
            });

            logger.info(`Trigger gateway deployed to ${channel.name} with trigger word: ${triggerWord}`);
            return msg;
        } catch (error) {
            logger.error(`Failed to deploy trigger gateway: ${error.message}`);
            throw error;
        }
    },

    /**
     * Deploy Slash Command Gateway
     * Sends an embed with instructions to use /verify command
     */
    async deploySlashGateway(channel, settings = {}) {
        try {
            const instruction = settings.instructionText || 'Please use the **/verify** command to verify and gain access to the server.';
            
            const embed = createGatewayEmbed(settings, instruction);

            const msg = await channel.send({
                embeds: [embed]
            });

            logger.info(`Slash gateway deployed to ${channel.name}`);
            return msg;
        } catch (error) {
            logger.error(`Failed to deploy slash gateway: ${error.message}`);
            throw error;
        }
    },

    /**
     * Legacy method for backwards compatibility
     * Delegates to deploy() method
     */
    async sendGatewayMessage(guild, channel, type, settings = {}) {
        return this.deploy(guild, channel, type, settings);
    }
};

export default gatewayManager;
