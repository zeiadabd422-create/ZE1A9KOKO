import { handleInteraction } from '../core/InteractionDispatcher.js';

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      await handleInteraction(interaction);
    } catch (error) {
      console.error('[interactionCreate] Failed to handle interaction:', error);

      try {
        if (interaction.isRepliable() && !interaction.replied) {
          if (interaction.deferred) {
            await interaction.editReply({
              content: 'An error occurred while processing your interaction.',
            });
          } else {
            await interaction.reply({
              content: 'An error occurred while processing your interaction.',
              ephemeral: true,
            });
          }
        }
      } catch (replyError) {
        console.error('[interactionCreate] Failed to send error reply:', replyError);
      }
    }
  },
};
