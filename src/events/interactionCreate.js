import { Events, InteractionType } from 'discord.js';
import { logger } from '../core/logger.js';
import gatewayModule from '../modules/gateway/index.js';

/**
 * Interaction Create Event Handler
 * Routes all interactions to appropriate handlers
 */
export default {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            // Handle slash commands
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) return;
                await command.execute(interaction);
            }
            // Handle button interactions
            else if (interaction.type === InteractionType.MessageComponent) {
                
                // Route gateway verify button to gateway module (DDD pattern)
                if (interaction.customId === 'gateway_verify_btn') {
                    const result = await gatewayModule.handleInteraction(interaction);
                    if (!result) {
                        logger.warn(`Gateway interaction handler returned false for user ${interaction.user.id}`);
                    }
                    return;
                }

                // Add other button handlers here as needed
                logger.debug(`Unhandled button interaction: ${interaction.customId}`);
            }
        } catch (error) {
            logger.error(`Interaction Error: ${error.message}`);
            
            // Attempt to send error response
            if (interaction.isRepliable()) {
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.editReply({
                            content: '❌ An error occurred processing your interaction.'
                        });
                    } else {
                        await interaction.reply({
                            content: '❌ An error occurred processing your interaction.',
                            ephemeral: true
                        });
                    }
                } catch (replyError) {
                    logger.error(`Could not send error reply: ${replyError.message}`);
                }
            }
        }
    }
};
