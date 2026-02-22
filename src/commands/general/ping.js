export default {
  name: 'ping',
  description: 'Replies with Pong!',
  async execute(interaction) {
    try {
      await interaction.reply({ content: 'Pong!', ephemeral: true });
    } catch (err) {
      console.error('ping command error:', err);
    }
  },
};
