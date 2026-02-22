import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { connectDatabase } from './core/database.js';
import loadModules from './loaders/modules.js';
import loadEvents from './loaders/events.js';
import loadCommands from './loaders/commands.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.commands = new Collection();

async function bootstrap() {
  try {
    if (!process.env.MONGO_URI) {
      console.warn('MONGO_URI not set; database connection will be skipped if not provided.');
    }
    await connectDatabase();
    await loadModules(client);
    await loadEvents(client);
    await loadCommands(client);
    if (!process.env.DISCORD_TOKEN) {
      throw new Error('DISCORD_TOKEN is not set in environment');
    }
    await client.login(process.env.DISCORD_TOKEN);
    console.log('Bot logged in.');
  } catch (err) {
    console.error('Bootstrap failed:', err);
    process.exit(1);
  }
}

bootstrap();

export default client;
