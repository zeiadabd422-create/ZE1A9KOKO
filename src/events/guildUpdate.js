import { VisualParser } from '../core/VisualEngine/Parser.js';

export default {
  name: 'guildUpdate',
  async execute(oldGuild, newGuild) {
    try {
      const { client } = newGuild;
      if (!client) return;

      const oldBoostLevel = oldGuild.premiumTier ?? 0;
      const newBoostLevel = newGuild.premiumTier ?? 0;
      const boostCountChange = (newGuild.premiumSubscriptionCount ?? 0) - (oldGuild.premiumSubscriptionCount ?? 0);

      if (newBoostLevel > oldBoostLevel || boostCountChange >= 1) {
        const parser = new VisualParser();
        const payload = {
          title: 'Server Boost Update',
          description: `🎉 ${newGuild.name} just received a boost update!`,
          color: '#f1c40f',
          fields: [
            { name: 'Boost Tier', value: `${oldBoostLevel} → ${newBoostLevel}`, inline: true },
            {
              name: 'Boost Count',
              value: `${oldGuild.premiumSubscriptionCount ?? 0} → ${newGuild.premiumSubscriptionCount ?? 0}`,
              inline: true,
            },
          ],
          footer: { text: 'Thank you to the boosters!' },
          timestamp: new Date(),
        };

        const parsed = await parser.parse(payload, {
          guild: newGuild.name,
          member_count: newGuild?.memberCount ?? 0,
          user: 'Server Booster',
        });

        const channel =
          newGuild.systemChannel ||
          newGuild.channels.cache.find((c) => c.isTextBased() && c.permissionsFor(newGuild.members.me).has('SendMessages'));

        if (channel) {
          await channel.send({ embeds: parsed.embeds, components: parsed.components });
        }
      }
    } catch (err) {
      console.error('[guildUpdate] Handler failed:', err);
    }
  },
};
