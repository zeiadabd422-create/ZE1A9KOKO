import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { render } from '../../core/embedEngine.js';

export default {
  data: new SlashCommandBuilder()
    .setName('embed_preview')
    .setDescription('Preview an embed from a raw JSON string.')
    .addStringOption(option =>
      option
        .setName('json')
        .setDescription('The JSON definition of the embed.')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const jsonStr = interaction.options.getString('json', true);
      let payload;

      try {
        payload = JSON.parse(jsonStr);
        // Support Discord message payloads that wrap the embed in an array
        if (payload.embeds && Array.isArray(payload.embeds)) payload = payload.embeds[0];
      } catch {
        return interaction.reply({
          content: '❌ Invalid JSON: تأكد من كتابة الكود بصيغة JSON صحيحة.',
          ephemeral: true,
        });
      }

      // FIX #4 – pass real member context so ALL placeholders (including avatars) resolve
      const rendered = render(payload, { member: interaction.member });

      // FIX – render() returns a plain object; discord.js v14 requires an EmbedBuilder instance
      const embed = new EmbedBuilder(rendered);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('[COMMAND-ERROR] Preview Failed:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '⚠️ حدث خطأ أثناء معالجة الإيمبد. تأكد من أن الحقول تتبع معايير ديسكورد.',
          ephemeral: true,
        });
      }
    }
  },
};