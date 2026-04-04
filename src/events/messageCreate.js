import XPManager from '../modules/leveling/XPManager.js';
import { EmbedBuilder } from 'discord.js';

const xpManager = new XPManager();

export default {
  name: 'messageCreate',
  async execute(message) {
    try {
      // تجاهل رسائل الـ bot
      if (message.author.bot) return;

      // معالجة الرسائل الخاصة (DM) - Gateway Verification
      if (!message.guild) {
        const gateway = message.client?.container?.gateway;
        const handled = await gateway?.dmHandler?.handleDM(message);
        if (handled) {
          try {
            const mutualGuilds = message.client.guilds.cache.filter(
              guild => guild.members.cache.has(message.author.id)
            );

            if (mutualGuilds.size > 0) {
              const guild = mutualGuilds.first();
              const result = await gateway.startVerification(message.author, guild);

              if (!result?.success && !result?.queued) {
                console.error('[messageCreate] Verification start failed:', result);
              }
            }
          } catch (error) {
            console.error('[messageCreate] Gateway verification error:', error);
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
