import { handleButton as handleShopButton, handleSelectMenu as handleShopSelect } from './ShopInteractionHandler.js';
import { gatewayLogger } from '../utils/GatewayLogger.js';

export async function handleInteraction(interaction) {
  console.log("📦 DISPATCHER RECEIVED", interaction.customId);
  
  try {
    // 🔴 TRACE POINT 2: Dispatcher received interaction
    console.log('[TRACE-2] ✅ InteractionDispatcher RECEIVED');
    console.log('[TRACE-2] - customId:', interaction.customId);
    console.log('[TRACE-2] - isButton:', interaction.isButton?.());
    
    const client = interaction.client;
    const gateway = client?.container?.gateway;  // ✅ صحح إلى "gateway"

    console.log('[TRACE-2] - gateway exists:', !!gateway);

    try {
      if (gateway) {
        console.log('[TRACE-2] 🎯 Calling gateway.handleInteraction...');
        gatewayLogger.log('DEBUG', null, 'Dispatcher routing to gateway', { customId: interaction.customId });
        const handled = await gateway.handleInteraction(interaction);
        console.log('[TRACE-2] - gateway returned:', handled);
        if (handled === true) {
          console.log('[TRACE-2] ✅ GATEWAY HANDLED - returning');
          return;
        }
      }
    } catch (err) {
      console.log('[TRACE-2] ❌ Gateway handler error:', err.message);
      gatewayLogger.error(null, err, { dispatcher: 'gateway_handler', customId: interaction.customId });
      // Continue to other handlers
    }

    console.log('[TRACE-2] - Continuing to other handlers...');

    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (cmd) return await cmd.execute(interaction);
    }

    if (interaction.isButton()) {
      try {
        if (await handleShopButton(interaction)) return;
      } catch (err) {
        gatewayLogger.error(null, err, { dispatcher: 'shop_button' });
      }
    }

    gatewayLogger.log('DEBUG', null, 'Unhandled interaction', { customId: interaction.customId, type: interaction.type });
  } catch (error) {
    gatewayLogger.error(null, error, { dispatcher: 'main_handler' });
    if (interaction.isRepliable()) {
      await interaction.reply({ content: '⚠️ Error processing interaction', ephemeral: true }).catch(() => {});
    }
  }
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

async function handleButtonInteraction(interaction) {
  try {
    const shopHandled = await handleShopButton(interaction);
    if (shopHandled) {
      return true;
    }

    console.warn('[Dispatcher] Unhandled button:', interaction.customId);
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

    console.warn('[Dispatcher] Unhandled select menu:', interaction.customId);
    return false;
  } catch (error) {
    console.error('[InteractionDispatcher] handleSelectMenuInteraction error:', error);
    if (interaction.isRepliable()) {
      await interaction.reply({ content: 'Internal error handling select menu.', ephemeral: true }).catch(() => {});
    }
    return true;
  }
}
