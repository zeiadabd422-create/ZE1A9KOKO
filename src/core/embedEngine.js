const { EmbedBuilder } = require('discord.js');

class EmbedEngine {
        static render(data, placeholders = {}) {
                    const embed = new EmbedBuilder();

                            const parse = (text) => {
                                            if (!text || typeof text !== 'string') return text;
                                                        let formatted = text;
                                                                    for (const [key, value] of Object.entries(placeholders)) {
                                                                                        formatted = formatted.replace(new RegExp(`{${key}}`, 'g'), value);
                                                                    }
                                                                                return formatted;
                            };

                                    if (data.title) embed.setTitle(parse(data.title));
                                            if (data.description) embed.setDescription(parse(data.description));
                                                    if (data.color) embed.setColor(data.color.startsWith('#') ? data.color : `#${data.color}`);
                                                            
                                                                    if (data.author) {
                                                                                    embed.setAuthor({
                                                                                                        name: parse(data.author.name),
                                                                                                                        iconURL: parse(data.author.iconURL),
                                                                                                                                        url: data.author.url
                                                                                    });
                                                                    }

                                                                            if (data.fields && Array.isArray(data.fields)) {
                                                                                            embed.addFields(data.fields.map(f => ({
                                                                                                                name: parse(f.name),
                                                                                                                                value: parse(f.value),
                                                                                                                                                inline: !!f.inline
                                                                                            })));
                                                                            }

                                                                                    if (data.thumbnail) embed.setThumbnail(parse(data.thumbnail));
                                                                                            if (data.image) embed.setImage(parse(data.image));
                                                                                                    if (data.footer) {
                                                                                                                    embed.setFooter({
                                                                                                                                        text: parse(data.footer.text),
                                                                                                                                                        iconURL: parse(data.footer.iconURL)
                                                                                                                    });
                                                                                                    }

                                                                                                            if (data.timestamp) embed.setTimestamp();

                                                                                                                    return embed;
        }
}

module.exports = EmbedEngine;
