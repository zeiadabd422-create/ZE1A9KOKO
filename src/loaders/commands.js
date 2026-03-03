import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function loadCommands(client) {
  const commandsPath = path.join(__dirname, '../commands');
  if (!fs.existsSync(commandsPath)) return;

  async function scanDir(dir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const res = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...(await scanDir(res)));
      } else if (entry.isFile() && res.endsWith('.js')) {
        results.push(res);
      }
    }
    return results;
  }

  const files = await scanDir(commandsPath);
  for (const file of files) {
    try {
      const cmd = await import(pathToFileURL(file).href);
      const c = cmd.default;
      if (!c) continue;
      if (c.data) {
        if (typeof c.execute !== 'function') continue;
        client.commands.set(c.data.name, c);
      } else if (c.name && typeof c.execute === 'function') {
        client.commands.set(c.name, c);
      }
    } catch (err) {
      console.error(`Failed to load command ${file}:`, err);
    }
  }
}

