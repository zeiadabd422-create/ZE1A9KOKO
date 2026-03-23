import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('goodbye')
    .setDescription('تكوين قناة رسالة الوداع • Configure goodbye message channel')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('تعيين قناة الوداع • Set the goodbye channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('القناة لنشر رسائل الوداع • Channel to post goodbye messages')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    try {
      if (!interaction.memberPermissions?.has('Administrator')) {
        await interaction.reply({ content: '❌ Administrator required.', ephemeral: true });
        return;
      }

      const sub = interaction.options.getSubcommand();
      if (sub === 'setup') {
        const channel = interaction.options.getChannel('channel');
        if (!channel) {
          await interaction.reply({ content: '❌ Channel is required.', ephemeral: true });
          return;
        }

        if (!interaction.client.welcome) {
          await interaction.reply({ content: '❌ Welcome module is not loaded.', ephemeral: true });
          return;
        }

        try {
          const result = await interaction.client.welcome.setupGoodbye(
            interaction.guild.id,
            channel.id
          );
          if (result.success) {
            await interaction.reply({
              content: `✅ Goodbye channel configured: <#${channel.id}>`,
              ephemeral: true,
            });
          } else {
            await interaction.reply({ content: `❌ Setup failed: ${result.error}`, ephemeral: true });
          }
        } catch (err) {
          console.error('[goodbye command] Setup error:', err);
          await interaction.reply({ content: '❌ An error occurred during goodbye setup.', ephemeral: true });
        }
      }
    } catch (err) {
      console.error('[goodbye command] Execute error:', err);
      try {
        if (interaction.isRepliable() && !interaction.replied) {
          await interaction.reply({ content: '❌ Command error.', ephemeral: true });
        }
      } catch (replyErr) {
        console.error('[goodbye command] Failed to send error reply:', replyErr);
      }
    }
  },
};