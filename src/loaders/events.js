import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function loadEvents(client) {
  const eventsPath = path.join(__dirname, '../events');
  if (!fs.existsSync(eventsPath)) return;

  const files = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const filePath = path.join(eventsPath, file);
    try {
      const event = await import(pathToFileURL(filePath).href);
      const evt = event.default;
      if (!evt || !evt.name || typeof evt.execute !== 'function') continue;
      // Event name may be a string or Events enum; register with client
      client.on(evt.name, (...args) => evt.execute(...args));
    } catch (err) {
      console.error(`Failed to load event ${file}:`, err);
    }
  }
}
