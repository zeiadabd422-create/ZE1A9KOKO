import GatewayConfig from './schema.js';
import { checkTriggerWord } from './checker.js';
import { verifyMember, createEmbed } from './actions.js';

export default function GatewayModule(client) {
      return {
            async handleMessage(message) {
                      try {
                                const config = await GatewayConfig.findOne({ guildId: message.guildId });
                                        if (!config?.enabled || !config.methods?.trigger?.enabled) return;
                                                if (message.channelId !== config.methods.trigger.channel) return;

                                                        const content = message.content.trim().toLowerCase();
                                                                if (checkTriggerWord(content, config.methods.trigger.triggerWord.toLowerCase())) {
                                                                              const result = await verifyMember(message.member, config, 'trigger');
                                                                                        if (result.processing) return;

                                                                                                  if (result.alreadyVerified) {
                                                                                                                const alreadyEmbed = await createEmbed(config, result.message, 'alreadyVerified', message.member);
                                                                                                                            return message.channel.send({ embeds: [alreadyEmbed] });
                                                                                                  }

                                                                                                            if (result.success) {
                                                                                                                            const loadingEmbed = await createEmbed(config, '🔄 Processing...', 'success', message.member);
                                                                                                                                        const loadingMsg = await message.channel.send({ embeds: [loadingEmbed] });
                                                                                                                                                    if (message.deletable) await message.delete().catch(() => {});
                                                                                                                                                                await new Promise(r => setTimeout(r, 2000));
                                                                                                                                                                            const idCardMsg = `**✅ Verification Complete**\n\n> 👤 **Member:** {user}\n> 🏅 **Join Position:** #{join_pos}\n> 📅 **Account Age:** {account_age} days\n> 🟢 **Status:** Verified`;
                                                                                                                                                                                        const idCardEmbed = await createEmbed(config, idCardMsg, 'success', message.member);
                                                                                                                                                                                                    await loadingMsg.edit({ embeds: [idCardEmbed] });
                                                                                                            }
                                                                }
                      } catch (err) {}
            }
      };
}
