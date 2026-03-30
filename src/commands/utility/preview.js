import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { VisualParser } from '../../core/VisualEngine/Parser.js';

export default {
  data: new SlashCommandBuilder()
    .setName('embed_preview')
    .setDescription('معاينة إيمبد من كود JSON • Preview an embed from a raw JSON string.')
    .addStringOption(option =>
      option
        .setName('json')
        .setDescription('تعريف الإيمبد بصيغة JSON • The JSON definition of the embed.')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const jsonStr = interaction.options.getString('json', true);
      let payload;

      try {
        payload = JSON.parse(jsonStr);
        if (payload.embeds && Array.isArray(payload.embeds)) payload = payload.embeds[0];
      } catch {
        return interaction.reply({
          content: '❌ Invalid JSON: تأكد من كتابة الكود بصيغة JSON صحيحة.',
          flags: [MessageFlags.Ephemeral],
        });
      }

      const parser = new VisualParser();
      const parsed = await parser.parse(payload, {
        user: interaction.user.tag,
        guild: interaction.guild?.name || 'Unknown Guild',
        member_count: interaction.guild?.memberCount || 0,
      });

      return interaction.reply({ embeds: parsed.embeds, flags: [MessageFlags.Ephemeral] });
    } catch (err) {
      console.error('[COMMAND-ERROR] Preview Failed:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '⚠️ حدث خطأ أثناء معالجة الإيمبد. تأكد من أن الحقول تتبع معايير ديسكورد.',
          flags: [MessageFlags.Ephemeral],
        });
      }
    }
  },
};