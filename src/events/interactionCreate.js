export default {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      const { client } = interaction;
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
        return;
      }

      // Route other component interactions to modules if present
      if (interaction.isButton() || interaction.isSelectMenu()) {
        // Modules may attach handlers on client (e.g., client.gateway)
        // We attempt a safe dispatch: prefer specific module APIs if present
        if (interaction.customId && client.gateway && typeof client.gateway.handleInteraction === 'function') {
          try {
            await client.gateway.handleInteraction(interaction);
          } catch (err) {
            console.error('Module interaction handler error:', err);
            if (interaction.isRepliable() && !interaction.replied) {
              await interaction.reply({ content: 'An error occurred.', ephemeral: true });
            }
          }
        }
      }
    } catch (err) {
      console.error('interactionCreate handler failed:', err);
      try {
        if (interaction && interaction.isRepliable && interaction.isRepliable() && !interaction.replied) {
          await interaction.reply({ content: 'Internal error.', ephemeral: true });
        }
      } catch (e) {
        // swallow
      }
    }
  },
};
