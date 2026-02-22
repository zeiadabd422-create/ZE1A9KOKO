import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function loadModules(client) {
  const modulesPath = path.join(__dirname, '../modules');
  if (!fs.existsSync(modulesPath)) return; // graceful if folder missing or empty

  const entries = fs.readdirSync(modulesPath, { withFileTypes: true });
  const folders = entries.filter(e => e.isDirectory()).map(d => d.name);
  if (folders.length === 0) return;

  await Promise.all(
    folders.map(async folder => {
      const modFile = path.join(modulesPath, folder, 'index.js');
      if (!fs.existsSync(modFile)) return;
      try {
        const mod = await import(pathToFileURL(modFile).href);
        // support default export as function or object
        if (typeof mod.default === 'function') {
          client[folder] = mod.default(client);
        } else if (typeof mod.default === 'object') {
          client[folder] = mod.default;
        }
      } catch (err) {
        console.error(`Failed to load module ${folder}:`, err);
      }
    })
  );
}
