import WelcomeConfig from './schema.js';
import { parseColor } from '../../utils/parseColor.js';
import { render as renderEmbed } from '../../core/embedEngine.js';

export default function WelcomeModule(client) {
      return {
            async buildEmbed(embedConfig, member, guild) {
                      try {
                                if (!embedConfig) return null;
                                        const template = {};
                                                if (embedConfig.title) template.title = embedConfig.title;
                                                        if (embedConfig.description) template.description = embedConfig.description;
                                                                if (embedConfig.color) template.color = embedConfig.color;
                                                                        if (embedConfig.author_name) {
                                                                                      template.author = { name: embedConfig.author_name };
                                                                                                if (embedConfig.author_icon) template.author.iconURL = embedConfig.author_icon;
                                                                        }
                                                                                if (embedConfig.footer_text) {
                                                                                              template.footer = { text: embedConfig.footer_text };
                                                                                                        if (embedConfig.footer_image_url) template.footer.iconURL = embedConfig.footer_image_url;
                                                                                }
                                                                                        if (embedConfig.thumbnail_url) {
                                                                                                      template.thumbnail = { url: embedConfig.thumbnail_url };
                                                                                        } else if (embedConfig.thumbnail_toggle && member?.user) {
                                                                                                      template.thumbnail = { url: member.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: false }) };
                                                                                        }
                                                                                                if (embedConfig.image_url) template.image = { url: embedConfig.image_url };

                                                                                                        const rendered = renderEmbed(template, member || {});
                                                                                                                if (rendered?.error === 'EMBED_DESCRIPTION_TOO_LONG') return null;
                                                                                                                        if (rendered && rendered.color) {
                                                                                                                                      try { rendered.color = parseColor(rendered.color, '#4f3ff0'); } catch (_e) {}
                                                                                                                        }
                                                                                                                                return rendered;
                      } catch (err) { return null; }
            },

                async handleMemberAdd(member) {
                          try {
                                    let config = await WelcomeConfig.findOne({ guildId: member.guild.id });
                                            if (!config) config = await WelcomeConfig.findOneAndUpdate({ guildId: member.guild.id }, { guildId: member.guild.id, enabled: true }, { upsert: true, new: true });
                                                    if (!config?.enabled) return;

                                                            if (config.autoRole) {
                                                                          try {
                                                                                        const role = member.guild.roles.cache.get(config.autoRole);
                                                                                                    if (role && !member.roles.cache.has(role.id)) await member.roles.add(role.id);
                                                                          } catch (roleErr) {}
                                                            }

                                                                    if (config.welcomeEmbed?.channel) {
                                                                                  const channel = member.guild.channels.cache.get(config.welcomeEmbed.channel);
                                                                                            if (channel?.isTextBased()) {
                                                                                                            const embed = await this.buildEmbed(config.welcomeEmbed, member, member.guild);
                                                                                                                        if (embed) await channel.send({ embeds: [embed] });
                                                                                            }
                                                                    }
                          } catch (err) {}
                }
      };
}
