import { handleButton as handleShopButton, handleSelectMenu as handleShopSelect } from './ShopInteractionHandler.js';

export async function handleInteraction(interaction) {
  if (interaction.isAutocomplete()) {
    return handleAutocomplete(interaction);
  }

  if (interaction.isChatInputCommand()) {
    return handleCommandInteraction(interaction);
  }

  if (interaction.isButton()) {
    return handleButtonInteraction(interaction);
  }

  if (interaction.isStringSelectMenu()) {
    return handleSelectMenuInteraction(interaction);
  }

  return null;
}

async function handleAutocomplete(interaction) {
  const command = interaction.client?.commands?.get(interaction.commandName);
  if (command?.autocomplete) {
    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error('[InteractionDispatcher] autocomplete handler failed:', error);
    }
  }
}

async function handleCommandInteraction(interaction) {
  const command = interaction.client?.commands?.get(interaction.commandName);
  if (!command || typeof command.execute !== 'function') {
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Command not found or is not available.',
        ephemeral: true,
      });
    }
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('[InteractionDispatcher] command handler failed:', error);
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({
        content: 'An error occurred while processing your command.',
        ephemeral: true,
      });
    }
  }
}

async function handleButtonInteraction(interaction) {
  const gateway = interaction.client?.gateway;
  if (gateway?.handleButtonInteraction) {
    try {
      const handled = await gateway.handleButtonInteraction(interaction);
      if (handled) {
        return true; // Gateway handled it
      }
    } catch (error) {
      console.error('[InteractionDispatcher] Gateway button handler failed:', error);
      return true; // Mark as handled even on error to prevent Shop handler
    }
  }

  // Try shop handler only if gateway didn't handle it
  const shopHandled = await handleShopButton(interaction);
  return shopHandled ? true : false;
}

async function handleSelectMenuInteraction(interaction) {
  const gateway = interaction.client?.gateway;
  if (gateway?.handleSelectMenuInteraction) {
    try {
      const handled = await gateway.handleSelectMenuInteraction(interaction);
      if (handled) return;
    } catch (error) {
      console.error('[InteractionDispatcher] gateway select menu handler failed:', error);
    }
  }

  const shopHandled = await handleShopSelect(interaction);
  if (shopHandled) return;
}
