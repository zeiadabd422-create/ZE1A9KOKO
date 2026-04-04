import { handleInteraction } from '../core/InteractionDispatcher.js';

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      await handleInteraction(interaction);
    } catch (error) {
      console.error('[interactionCreate]', error);
    }
  },
};
