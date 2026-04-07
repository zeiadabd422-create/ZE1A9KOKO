import { Events } from 'discord.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);

    // ===== REGISTER COMMANDS IN DISCORD API =====
    try {
      if (!client.commands || client.commands.size === 0) {
        console.warn('[Ready] No commands loaded to register');
      } else {
        const commandData = client.commands.map((cmd) => cmd.data);

        // Register commands globally or per guild
        // Using guild registration for faster updates during development
        const guildId = process.env.GUILD_ID;

        if (guildId) {
          // Guild-specific registration (faster, for testing)
          const guild = client.guilds.cache.get(guildId);
          if (guild) {
            await guild.commands.set(commandData);
            console.log(`[Ready] Registered ${commandData.length} commands in guild ${guildId}`);
          } else {
            console.warn(`[Ready] Guild ${guildId} not found, falling back to global registration`);
            await client.application?.commands.set(commandData);
            console.log(`[Ready] Registered ${commandData.length} commands globally`);
          }
        } else {
          // Global registration (production)
          await client.application?.commands.set(commandData);
          console.log(`[Ready] Registered ${commandData.length} commands globally`);
        }
      }
    } catch (error) {
      console.error('[Ready] Failed to register commands:', error);
    }

    if (client.inviteTracker && typeof client.inviteTracker.initialize === 'function') {
      try {
        await client.inviteTracker.initialize();
      } catch (err) {
        console.error('[Ready] inviteTracker initialization failed:', err);
      }
    }
  },
};
