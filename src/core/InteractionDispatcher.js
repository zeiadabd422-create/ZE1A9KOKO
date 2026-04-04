import { handleButton as handleShopButton, handleSelectMenu as handleShopSelect } from './ShopInteractionHandler.js';

export async function handleInteraction(interaction) {
  const client = interaction.client;

  // 1. Gateway أولاً
  const gateway = client?.container?.gateway;
  if (gateway) {
    const handled = await gateway.handleInteraction(interaction);
    if (handled) return;
  }

  // 2. Commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (command) {
      await command.execute(interaction);
      return;
    }
  }

  // 3. باقي الأنظمة هنا
  if (interaction.isAutocomplete()) {
    return handleAutocomplete(interaction);
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
  try {
    const shopHandled = await handleShopButton(interaction);
    if (shopHandled) {
      return true;
    }

    if (interaction.isRepliable()) {
      await interaction.reply({ content: 'Button action not handled.', ephemeral: true }).catch(() => {});
    }
    return false;
  } catch (error) {
    console.error('[InteractionDispatcher] handleButtonInteraction error:', error);
    if (interaction.isRepliable()) {
      await interaction.reply({ content: 'Internal error handling button.', ephemeral: true }).catch(() => {});
    }
    return true;
  }
}

async function handleSelectMenuInteraction(interaction) {
  try {
    const shopHandled = await handleShopSelect(interaction);
    if (shopHandled) {
      return true;
    }

    if (interaction.isRepliable()) {
      await interaction.reply({ content: 'Select menu action not handled.', ephemeral: true }).catch(() => {});
    }
    return false;
  } catch (error) {
    console.error('[InteractionDispatcher] handleSelectMenuInteraction error:', error);
    if (interaction.isRepliable()) {
      await interaction.reply({ content: 'Internal error handling select menu.', ephemeral: true }).catch(() => {});
    }
    return true;
  }
}
