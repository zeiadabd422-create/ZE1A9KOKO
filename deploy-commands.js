import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { config } from 'dotenv';
import { REST } from 'discord.js';

config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.CLIENT_ID || !process.env.GUILD_ID) {
  console.error('CLIENT_ID and GUILD_ID are required in environment variables');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function collectCommands(dir) {
  const list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const res = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      list.push(...(await collectCommands(res)));
    } else if (entry.isFile() && res.endsWith('.js')) {
      try {
        const cmd = await import(pathToFileURL(res).href);
        const c = cmd.default;
        if (!c) continue;
        if (c.data) {
          list.push(c.data.toJSON());
        } else if (c.name) {
          list.push({ name: c.name, description: c.description || 'No description provided' });
        }
      } catch (e) {
        console.error('Failed to load command for deployment:', res, e);
      }
    }
  }
  return list;
}

(async () => {
  try {
    const commandsDir = path.join(__dirname, 'src', 'commands');
    if (!fs.existsSync(commandsDir)) {
      console.error('Commands directory not found:', commandsDir);
      process.exit(1);
    }

    const commands = await collectCommands(commandsDir);
    console.log(`[DEPLOY] Found ${commands.length} command(s)`);

    await rest.put(`/applications/${process.env.CLIENT_ID}/guilds/${process.env.GUILD_ID}/commands`, { body: [] });
    console.log('[DEPLOY] Cleared existing guild commands');

    await rest.put(`/applications/${process.env.CLIENT_ID}/guilds/${process.env.GUILD_ID}/commands`, { body: commands });
    console.log('[DEPLOY] Registered commands successfully');
    process.exit(0);
  } catch (err) {
    console.error('[DEPLOY] Command deployment failed:', err);
    process.exit(1);
  }
})();
