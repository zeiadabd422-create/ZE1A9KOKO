import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function loadCommands(client) {
  const commandsPath = path.join(__dirname, '../commands');
  if (!fs.existsSync(commandsPath)) return;

  const walk = async (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const res = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(res);
      else if (entry.isFile() && res.endsWith('.js')) {
        try {
          const cmd = await import(pathToFileURL(res).href);
          const c = cmd.default;
          if (!c || !c.name || typeof c.execute !== 'function') continue;
          client.commands.set(c.name, c);
        } catch (err) {
          console.error(`Failed to load command ${res}:`, err);
        }
      }
    }
  };

  await walk(commandsPath);
}
