import XPManager from '../modules/leveling/XPManager.js';
import { EmbedBuilder } from 'discord.js';

const xpManager = new XPManager();

export default {
  name: 'messageCreate',
  async execute(message) {
    try {
      // تجاهل رسائل الـ bot و الخاصة بدون معالجة خاصة
      if (message.author.bot) return;

      // معالجة الرسائل الخاصة من خلال gateway
      if (!message.guild) {
        if (message.client?.gateway?.observeMessage) {
          try {
            await message.client.gateway.observeMessage(message);
          } catch (error) {
            console.error('[messageCreate] Gateway DM observer error:', error);
          }
        }
        return;
      }

      // معالجة رسائل السيرفر
      if (message.client?.gateway?.observeMessage) {
        try {
          await message.client.gateway.observeMessage(message);
        } catch (error) {
          console.error('[messageCreate] Gateway observer error:', error);
        }
      }

      const member = message.member;
      if (!member) return;

      // حساب الـ XP
      const xpAmount = xpManager.calculateXP(message);
      const xpResult = await xpManager.addXP(member, xpAmount, 'message');

      if (xpResult.success && xpResult.leveledUp) {
        await sendLevelUpMessage(message, xpResult);
      }
    } catch (error) {
      console.error('[messageCreate] Failed to process message:', error);
    }
  },
};

async function sendLevelUpMessage(message, xpResult) {
  try {
    const embed = new EmbedBuilder()
      .setTitle('🎉 مستوى جديد!')
      .setDescription(`${message.author}، لقد وصلت للمستوى **${xpResult.newLevel}**!`)
      .addFields(
        { name: 'المستوى السابق', value: xpResult.oldLevel.toString(), inline: true },
        { name: 'المستوى الجديد', value: xpResult.newLevel.toString(), inline: true },
        { name: 'الـ XP المكتسبة', value: `+${xpResult.xpGained}`, inline: true }
      )
      .setColor(0xffd700)
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error('[messageCreate] Failed to send level up message:', error);
  }
}
