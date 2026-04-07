import { handleInteraction } from '../core/InteractionDispatcher.js';

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      console.log('🔥 INTERACTION EVENT FIRED');
      console.log('TYPE:', interaction.type, 'IS BUTTON:', interaction.isButton?.());

      if (interaction.isChatInputCommand?.()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (command) {
          return await command.execute(interaction);
        }
      }

      if (interaction.isButton?.()) {
        console.log('BUTTON CLICKED:', interaction.customId);
        return await handleInteraction(interaction);
      }

      if (interaction.isModalSubmit?.()) {
        console.log('MODAL SUBMIT:', interaction.customId);
        return await handleInteraction(interaction);
      }

      console.log('Unhandled interaction type:', interaction.type);
    } catch (error) {
      console.error('INTERACTION ERROR:', error);
      if (interaction.isRepliable?.() && !interaction.replied) {
        await interaction.reply({ content: '❌ INTERACTION ERROR', ephemeral: true }).catch(() => {});
      }
    }
  },
};
