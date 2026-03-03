import { Client, GatewayIntentBits, Collection, Partials } from "discord.js";
import dotenv from "dotenv";
import { connectDatabase } from "./core/database.js";
import loadModules from "./loaders/modules.js";
import loadEvents from "./loaders/events.js";
import loadCommands from "./loaders/commands.js";

dotenv.config();

// environment validation - critical variables must be present before bot starts
if (!process.env.CLIENT_ID || !process.env.GUILD_ID) {
  console.error('Error: CLIENT_ID and GUILD_ID must be set in environment variables');
  process.exit(1);
}

// global safety: log unhandled promise rejections
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));
// also capture uncaught exceptions so the process doesn't silently die
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));

const client = new Client({
      intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.DirectMessageReactions,
      ],
      partials: [
            Partials.Channel,
            Partials.Message,
            Partials.User,
            Partials.Reaction,
      ],
});

client.commands = new Collection();

import scheduler from './core/TaskScheduler.js';

async function bootstrap() {
      await connectDatabase();
      // kick off background tasks such as temp-role cleanup
      scheduler.start();
        await loadModules(client);
          await loadEvents(client);
            await loadCommands(client);
              await client.login(process.env.DISCORD_TOKEN);
}

bootstrap();
export default client;
