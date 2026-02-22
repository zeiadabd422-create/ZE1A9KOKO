import { Client, GatewayIntentBits, Collection, Partials } from "discord.js";
import dotenv from "dotenv";
import { connectDatabase } from "./core/database.js";
import loadModules from "./loaders/modules.js";
import loadEvents from "./loaders/events.js";
import loadCommands from "./loaders/commands.js";

dotenv.config();

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

async function bootstrap() {
      await connectDatabase();
        await loadModules(client);
          await loadEvents(client);
            await loadCommands(client);
              await client.login(process.env.DISCORD_TOKEN);
}

bootstrap();
export default client;
