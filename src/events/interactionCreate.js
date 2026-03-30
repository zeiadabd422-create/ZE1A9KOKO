import ShopManager from '../modules/Shop/ShopManager.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const shopManager = new ShopManager();

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      if (interaction.isButton()) {
        const gateway = interaction.client?.gateway;
        if (gateway?.handleButtonInteraction) {
          const handled = await gateway.handleButtonInteraction(interaction);
          if (handled) return;
        }

        await handleButtonInteraction(interaction);
        return;
      }

      if (interaction.isChatInputCommand()) {
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

        await command.execute(interaction);
        return;
      }
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

async function handleButtonInteraction(interaction) {
  const { customId } = interaction;

  // Shop category buttons
  if (customId.startsWith('shop_category_')) {
    await interaction.deferUpdate();
    const category = customId.replace('shop_category_', '');
    await handleShopCategory(interaction, category);
    return;
  }

  // Shop item purchase buttons
  if (customId.startsWith('shop_buy_')) {
    await interaction.deferUpdate();
    const itemId = customId.replace('shop_buy_', '');
    await handleShopPurchase(interaction, itemId);
    return;
  }

  if (customId === 'shop_back') {
    await interaction.deferUpdate();
    await handleShopBack(interaction);
    return;
  }
}

async function handleShopCategory(interaction, category) {
  try {
    const guildId = interaction.guild.id;
    const items = await shopManager.getAvailableItems(guildId, category);

    if (items.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle(`🏪 ${getCategoryDisplayName(category)}`)
        .setDescription('No items available in this category.')
        .setColor(0x95a5a6);

      const backButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('shop_back')
          .setLabel('← Back to Shop')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [backButton],
      });
      return;
    }

    // Create item buttons (max 5 per row, 4 rows max = 20 items)
    const rows = [];
    let currentRow = new ActionRowBuilder();

    items.slice(0, 20).forEach((item, index) => {
      if (index > 0 && index % 5 === 0) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }

      const currencyEmoji = item.currency === 'gems' ? '💎' : '🪙';
      currentRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`shop_buy_${item.itemId}`)
          .setLabel(`${item.name} - ${currencyEmoji}${item.price}`)
          .setStyle(ButtonStyle.Success)
      );
    });

    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }

    // Add back button
    const backButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('shop_back')
        .setLabel('← Back to Shop')
        .setStyle(ButtonStyle.Secondary)
    );
    rows.push(backButton);

    // Create category embed
    const embed = new EmbedBuilder()
      .setTitle(`🏪 ${getCategoryDisplayName(category)}`)
      .setDescription(`Browse and purchase items from the ${category} category.`)
      .setColor(0x3498db)
      .setFooter({ text: `Showing ${items.length} items` });

    await interaction.editReply({
      embeds: [embed],
      components: rows,
    });

  } catch (error) {
    console.error('[handleShopCategory] Error:', error);
    await interaction.editReply({
      content: '❌ Failed to load category items.',
      embeds: [],
      components: [],
    });
  }
}

async function handleShopPurchase(interaction, itemId) {
  try {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const member = interaction.member;

    const result = await shopManager.purchaseItem(userId, guildId, itemId, member);

    if (result.success) {
      const currencyEmoji = result.item.currency === 'gems' ? '💎' : '🪙';
      const embed = new EmbedBuilder()
        .setTitle('✅ Purchase Successful!')
        .setDescription(`You have successfully purchased **${result.item.name}**!`)
        .addFields(
          { name: '💰 Cost', value: `${currencyEmoji}${result.item.price}`, inline: true },
          { name: '🆔 Transaction ID', value: result.transactionId, inline: true },
          { name: '💵 New Balance', value: `${result.newBalance.coins} 🪙 | ${result.newBalance.gems} 💎`, inline: false }
        )
        .setColor(0x2ecc71)
        .setTimestamp();

      const backButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('shop_back')
          .setLabel('← Back to Shop')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [backButton],
      });
    } else {
      const embed = new EmbedBuilder()
        .setTitle('❌ Purchase Failed')
        .setDescription(result.error)
        .setColor(0xe74c3c);

      await interaction.editReply({
        embeds: [embed],
        components: [],
      });
    }

  } catch (error) {
    console.error('[handleShopPurchase] Error:', error);
    await interaction.editReply({
      content: '❌ An error occurred during purchase.',
      embeds: [],
      components: [],
    });
  }
}

async function handleShopBack(interaction) {
  try {
    // Re-run the shop command logic
    const guildId = interaction.guild.id;
    const categories = await shopManager.getItemsByCategory(guildId);

    if (Object.keys(categories).length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('🏪 Server Shop')
        .setDescription('The shop is currently empty. Check back later!')
        .setColor(0x95a5a6);

      return await interaction.editReply({ embeds: [embed], components: [] });
    }

    // Create category buttons
    const row = new ActionRowBuilder();

    Object.keys(categories).forEach(category => {
      const categoryName = getCategoryDisplayName(category);
      const itemCount = categories[category].length;

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`shop_category_${category}`)
          .setLabel(`${categoryName} (${itemCount})`)
          .setStyle(ButtonStyle.Primary)
      );
    });

    // Create main shop embed
    const embed = new EmbedBuilder()
      .setTitle('🏪 Server Shop')
      .setDescription('Welcome to our shop! Choose a category to browse available items.')
      .setColor('#FFD700')
      .addFields(
        {
          name: '📊 Shop Statistics',
          value: `**${Object.values(categories).flat().length}** items available\n**${Object.keys(categories).length}** categories`,
          inline: true,
        },
        {
          name: '💡 How to Use',
          value: 'Click on a category button to view items\nUse `/balance` to check your currency',
          inline: true,
        }
      )
      .setFooter({ text: 'Shop system powered by Guardian V2' })
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

  } catch (error) {
    console.error('[handleShopBack] Error:', error);
    await interaction.editReply({
      content: '❌ Failed to return to shop.',
      embeds: [],
      components: [],
    });
  }
}

function getCategoryDisplayName(category) {
  const names = {
    roles: '🎭 Roles',
    cosmetics: '✨ Cosmetics',
    utilities: '🛠️ Utilities',
    premium: '💎 Premium',
  };
  return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
}