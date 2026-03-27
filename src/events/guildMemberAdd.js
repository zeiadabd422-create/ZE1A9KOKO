import { EmbedBuilder } from 'discord.js';
import { render as renderWelcomeEmbed } from '../core/VisualEngine.js';

export default {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      const welcomeEmbed = await renderWelcomeEmbed(
        {
          title: 'Welcome {user}!',
          description: 'Glad you joined {guild}. We are {member_count} strong!',
          color: '#00aaff',
          footer: { text: 'Auto welcome message' },
        },
        member
      );

      const embedToSend = welcomeEmbed instanceof EmbedBuilder ? welcomeEmbed : new EmbedBuilder({
        title: 'Welcome!',
        description: `Hello ${member.user?.tag || 'new member'}.`,
        color: '#00aaff',
      });

      const channel =
        member.guild.systemChannel ||
        member.guild.channels.cache.find(
          (c) => c.isTextBased() && c.permissionsFor(member.guild.members.me).has('SendMessages')
        );

      if (!channel) {
        console.warn('[guildMemberAdd] No available channel to send welcome message.');
        return;
      }

      await channel.send({ embeds: [embedToSend] });
    } catch (err) {
      console.error('[guildMemberAdd] render/send failed:', err);
      try {
        const fallback = new EmbedBuilder()
          .setTitle('Welcome!')
          .setDescription(`Hello ${member.user?.tag || 'new member'}, welcome to ${member.guild?.name || 'the server'}!`)
          .setColor('#00aaff');

        const channel =
          member.guild.systemChannel ||
          member.guild.channels.cache.find(
            (c) => c.isTextBased() && c.permissionsFor(member.guild.members.me).has('SendMessages')
          );

        if (channel) await channel.send({ embeds: [fallback] });
      } catch (fallbackError) {
        console.error('[guildMemberAdd] fallback send failed:', fallbackError);
      }
    }
  },
};
