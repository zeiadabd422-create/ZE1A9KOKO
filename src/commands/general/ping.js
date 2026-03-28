import { SlashCommandBuilder, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('اختبر اتصالك • Test your connection - Replies with Pong!'),
  async execute(interaction) {
    try {
      await interaction.reply({ content: '🏓 Pong!' });
    } catch (err) {
      console.error('ping command error:', err);
    }
  },
};
