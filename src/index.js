const requiredEnv = ['DISCORD_TOKEN', 'MONGO_URI', 'CLIENT_ID'];
requiredEnv.forEach(key => {
        if (!process.env[key]) {
                    console.error(`[SYSTEM-CHECK] CRITICAL ERROR: ${key} is missing in .env!`);
                            process.exit(1);
        }
});

process.on('unhandledRejection', (reason) => {
        console.error('[ANTI-CRASH] Unhandled Rejection:', reason);
});

import { Client, GatewayIntentBits, Collection, Partials } from "discord.js";
import dotenv from "dotenv";
import { connectDatabase } from "./core/database.js";
import loadModules from "./loaders/modules.js";
import loadEvents from "./loaders/events.js";
import loadCommands from "./loaders/commands.js";

dotenv.config();

// ---------- system validation ------------------------------------------------
function systemCheck() {
  const required = [
    { name: 'CLIENT_ID', env: process.env.CLIENT_ID },
    { name: 'GUILD_ID', env: process.env.GUILD_ID },
    { name: 'DISCORD_TOKEN', env: process.env.DISCORD_TOKEN },
    { name: 'MONGO_URI', env: process.env.MONGO_URI },
  ];

  const missing = required.filter((r) => !r.env).map((r) => r.name);
  if (missing.length) {
    console.error(
      `[SystemCheck] missing required env vars: ${missing.join(', ')}`
    );
    process.exit(1);
  }
}

systemCheck();

// -----------------------------------------------------------------------------

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
