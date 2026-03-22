export default {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      const { client } = interaction;

      if (interaction.isAutocomplete && interaction.isAutocomplete()) {
        if (interaction.commandName === 'embed' && client.embedVault) {
          const focused = interaction.options.getFocused(true);
          if (focused.name === 'name') {
            const all = await client.embedVault.list(interaction.guildId).catch(() => []);
            const filtered = all
              .filter(item => item.name.toLowerCase().includes(String(focused.value).toLowerCase()))
              .slice(0, 25)
              .map(item => ({ name: item.name, value: item.name }));
            return interaction.respond(filtered);
          }
        }
      }

      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
          await command.execute(interaction);
        } catch (cmdErr) {
          console.error(`[Command: ${interaction.commandName}] Execution error:`, cmdErr);
          try {
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: '❌ An error occurred executing the command.', ephemeral: true });
            }
          } catch (replyErr) {
            console.error('[Slash Command] Failed to send error reply:', replyErr);
          }
        }
        return;
      }

      // Route button interactions
      if (interaction.isButton()) {
        try {
          // Check if Welcome module handles this button
          if (interaction.customId.startsWith('welcome_') && client.welcome && typeof client.welcome.handleButtonInteraction === 'function') {
            await client.welcome.handleButtonInteraction(interaction);
            return;
          }

          // Check if EmbedVault module handles this button
          if (interaction.customId.startsWith('embedvault_') && client.embedVault && typeof client.embedVault.handleButtonInteraction === 'function') {
            await client.embedVault.handleButtonInteraction(interaction);
            return;
          }

          // Check if Gateway module handles this button
          if (client.gateway && typeof client.gateway.handleInteraction === 'function') {
            await client.gateway.handleInteraction(interaction);
            return;
          }
        } catch (err) {
          console.error('[Button Interaction] Error:', err);
          try {
            if (interaction.isRepliable() && !interaction.replied) {
              await interaction.reply({ content: '❌ An error occurred processing your interaction.', ephemeral: true });
            }
          } catch (replyErr) {
            console.error('[Button] Failed to send error reply:', replyErr);
          }
        }
      }

      // Route modal interactions
      if (interaction.isModalSubmit()) {
        try {
          // Check if Welcome module handles this modal
          if (interaction.customId.startsWith('welcome_modal_') && client.welcome && typeof client.welcome.handleModalSubmit === 'function') {
            await client.welcome.handleModalSubmit(interaction);
            return;
          }

          // Check if EmbedVault module handles this modal
          if (interaction.customId.startsWith('embedvault_modal:') && client.embedVault && typeof client.embedVault.handleModalSubmit === 'function') {
            await client.embedVault.handleModalSubmit(interaction);
            return;
          }
        } catch (err) {
          console.error('[Modal Interaction] Error:', err);
          try {
            if (interaction.isRepliable() && !interaction.replied) {
              await interaction.reply({ content: '❌ Failed to process your submission.', ephemeral: true });
            }
          } catch (replyErr) {
            console.error('[Modal] Failed to send error reply:', replyErr);
          }
        }
      }

      // Route select menu interactions
      if (interaction.isSelectMenu()) {
        try {
          if (interaction.customId.startsWith('embedvault_') && client.embedVault && typeof client.embedVault.handleSelectMenu === 'function') {
            await client.embedVault.handleSelectMenu(interaction);
            return;
          }

          if (client.gateway && typeof client.gateway.handleInteraction === 'function') {
            await client.gateway.handleInteraction(interaction);
            return;
          }
        } catch (err) {
          console.error('[Select Menu] Error:', err);
          try {
            if (interaction.isRepliable() && !interaction.replied) {
              await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
            }
          } catch (replyErr) {
            console.error('[Select Menu] Failed to send error reply:', replyErr);
          }
        }
      }
    } catch (err) {
      console.error('[interactionCreate] Handler failed:', err);
      try {
        if (interaction && interaction.isRepliable && interaction.isRepliable() && !interaction.replied) {
          await interaction.reply({ content: '❌ Internal error.', ephemeral: true });
        }
      } catch (e) {
        console.error('[interactionCreate] Failed to send final error reply:', e);
      }
    }
  },
};
