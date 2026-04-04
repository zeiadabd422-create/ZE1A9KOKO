import { handleInteraction } from '../core/InteractionDispatcher.js';

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      // Gateway verification handling (NEW)
      if (interaction.client.gateway) {
        const handled = await interaction.client.gateway.handleInteraction(interaction);
        if (handled) {
          return;
        }
      }

      // Existing interaction handling
      await handleInteraction(interaction);
    } catch (error) {
      console.error('[interactionCreate] Error:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred processing your interaction.',
          ephemeral: true,
        }).catch(() => {});
      }
    }
  },
};
