import XPManager from '../modules/leveling/XPManager.js';
import { EmbedBuilder } from 'discord.js';

const xpManager = new XPManager();

export default {
  name: 'messageCreate',
  async execute(message) {
    try {
      if (message.author.bot) return;
      if (!message.guild) return;

      if (message.client?.gateway?.observeMessage) {
        await message.client.gateway.observeMessage(message);
      }

      const member = message.member;
      if (!member) return;

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
      .setTitle('🎉 Level Up!')
      .setDescription(`${message.author}, you leveled up to **Level ${xpResult.newLevel}**!`)
      .addFields(
        { name: 'Previous Level', value: xpResult.oldLevel.toString(), inline: true },
        { name: 'New Level', value: xpResult.newLevel.toString(), inline: true },
        { name: 'XP Gained', value: `+${xpResult.xpGained}`, inline: true }
      )
      .setColor(0xffd700)
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error('[messageCreate] Failed to send level up message:', error);
  }
}
