import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import ShopManager from '../../modules/Shop/ShopManager.js';
import { VisualParser } from '../../core/VisualEngine/Parser.js';

const shopManager = new ShopManager();

export default {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('عرض متجر السيرفر • View the server shop'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const guildId = interaction.guild.id;
      const categories = await shopManager.getItemsByCategory(guildId);

      if (Object.keys(categories).length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('🏪 Server Shop')
          .setDescription('The shop is currently empty. Check back later!')
          .setColor(0x95a5a6);

        return await interaction.editReply({ embeds: [embed] });
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
      const embedData = {
        title: '🏪 Server Shop',
        description: 'Welcome to our shop! Choose a category to browse available items.',
        color: '#FFD700',
        fields: [
          {
            name: '📊 Shop Statistics',
            value: `**${Object.values(categories).flat().length}** items available\n**${Object.keys(categories).length}** categories`,
            inline: true,
          },
          {
            name: '💡 How to Use',
            value: 'Click on a category button to view items\nUse `/balance` to check your currency',
            inline: true,
          },
        ],
        footer: {
          text: 'Shop system powered by Guardian V2',
        },
        timestamp: new Date(),
      };

      const parsed = new VisualParser().parse(embedData, {
        user: interaction.user.toString(),
        guild: interaction.guild.name,
      });

      await interaction.editReply({
        embeds: parsed.embeds,
        components: [row],
      });

    } catch (error) {
      console.error('[Shop Command] Error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while loading the shop. Please try again later.',
      });
    }
  },
};

function getCategoryDisplayName(category) {
  const names = {
    roles: '🎭 Roles',
    cosmetics: '✨ Cosmetics',
    utilities: '🛠️ Utilities',
    premium: '💎 Premium',
  };
  return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
}