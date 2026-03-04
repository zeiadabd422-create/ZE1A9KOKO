import { SlashCommandBuilder } from 'discord.js';
import { render } from '../../core/embedEngine.js';

export default {
  data: new SlashCommandBuilder()
    .setName('embed_preview')
    .setDescription('Preview an embed from a raw JSON string.')
    .addStringOption((option) =>
      option
        .setName('json')
        .setDescription('The JSON definition of the embed.')
        .setRequired(true),
    ),

  async execute(interaction) {
    try {
      const jsonStr = interaction.options.getString('json', true);
      let payload;

      try {
        payload = JSON.parse(jsonStr);
      } catch (parseErr) {
        return await interaction.reply({
          content: '❌ **Invalid JSON:** تأكد من كتابة الكود بصيغة JSON صحيحة.',
          ephemeral: true,
        });
      }

      // إضافة متغيرات أساسية لجعل المعاينة واقعية
      const placeholders = {
        user: interaction.user.username,
        server: interaction.guild.name,
        avatar: interaction.user.displayAvatarURL(),
        user_nick: interaction.member?.nickname || interaction.user.username,
        server_boostcount: interaction.guild?.premiumSubscriptionCount || 0,
        user_joindate: interaction.member?.joinedAt ? interaction.member.joinedAt.toISOString() : '',
      };

      const embed = render(payload, placeholders);
      
      if (embed && embed.error === 'EMBED_DESCRIPTION_TOO_LONG') {
        return await interaction.reply({
          content: '❌ **Embed description is too long (4096 char limit).**',
          ephemeral: true,
        });
      }
      
      await interaction.reply({ 
        embeds: [embed], 
        ephemeral: true 
      });

    } catch (err) {
      console.error('[COMMAND-ERROR] Preview Failed:', err);
      if (!interaction.replied) {
        await interaction.reply({
          content: '⚠️ حدث خطأ أثناء معالجة الإيمبد. تأكد من أن الحقول تتبع معايير ديسكورد.',
          ephemeral: true,
        });
      }
    }
  },
};
