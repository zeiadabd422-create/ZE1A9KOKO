import XPManager from '../modules/leveling/XPManager.js';
import { EmbedBuilder } from 'discord.js';
import { MAGIC_WORDS } from '../utils/normalizeText.js';
import { ThreadVerificationSystem } from '../core/ThreadVerificationSystem.js';

const xpManager = new XPManager();

export default {
  name: 'messageCreate',
  async execute(message) {
    try {
      // تجاهل رسائل الـ bot
      if (message.author.bot) return;

      // معالجة الرسائل الخاصة (DM) - Thread Verification
      if (!message.guild) {
        if (MAGIC_WORDS.isStart(message.content)) {
          try {
            const result = await ThreadVerificationSystem.startVerificationFromDM(
              message.author,
              message.client
            );

            if (result?.error === 'session_exists') {
              await message.reply({
                content: '⚠️ عندك جلسة تحقق مفتوحة بالفعل. يرجى إكمالها أو الانتظار.',
              }).catch(() => {});
            } else if (result?.error) {
              await message.reply({
                content: '❌ حدث خطأ في إنشاء جلسة التحقق. يرجى المحاولة لاحقا.',
              }).catch(() => {});
            } else if (result?.thread) {
              // Success - message sent in thread
            }
          } catch (error) {
            console.error('[messageCreate] Thread verification error:', error);
          }
        }
        return;
      }

      // معالجة رسائل السيرفر - XP فقط
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
