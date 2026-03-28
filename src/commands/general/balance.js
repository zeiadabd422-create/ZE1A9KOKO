import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import EconomyManager from '../../modules/Economy/EconomyManager.js';
import { VisualParser } from '../../core/VisualEngine/Parser.js';

const economyManager = new EconomyManager();

export default {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('عرض رصيدك الاقتصادي • View your economy balance'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      const userId = interaction.user.id;
      const guildId = interaction.guild.id;

      // Get balance data
      const balance = await economyManager.getBalance(userId, guildId);

      if (!balance) {
        return await interaction.editReply({
          content: '❌ حدث خطأ في جلب البيانات. يرجى المحاولة لاحقاً.',
        });
      }

      // Create embed using VisualParser
      const embedData = {
        title: '💰 Economy Balance',
        description: `رصيد **${interaction.user.displayName}** الاقتصادي`,
        color: '#FFD700',
        thumbnail: { url: interaction.user.displayAvatarURL({ size: 128 }) },
        fields: [
          {
            name: '🪙 Coins',
            value: balance.coins.toLocaleString(),
            inline: true,
          },
          {
            name: '💎 Gems',
            value: balance.gems.toLocaleString(),
            inline: true,
          },
          {
            name: '🏦 Bank',
            value: balance.bank.toLocaleString(),
            inline: true,
          },
          {
            name: '💵 Total Wealth',
            value: (balance.coins + balance.gems + balance.bank).toLocaleString(),
            inline: false,
          },
        ],
        footer: {
          text: balance.exists
            ? `آخر تحديث: ${balance.lastUpdated.toLocaleDateString()}`
            : 'لم تقم بأي معاملات بعد',
        },
        timestamp: new Date(),
      };

      // Parse with VisualParser for advanced features
      const parsed = new VisualParser().parse(embedData, {
        user: interaction.user.toString(),
        guild: interaction.guild.name,
        member_count: interaction.guild.memberCount,
      });

      await interaction.editReply({ embeds: parsed.embeds });

    } catch (error) {
      console.error('[Balance Command] Error:', error);
      await interaction.editReply({
        content: '❌ حدث خطأ أثناء عرض الرصيد. يرجى المحاولة لاحقاً.',
      });
    }
  },
};