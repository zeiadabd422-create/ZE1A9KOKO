import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function loadModules(client) {
      const modulesPath = path.join(__dirname, "../modules");
        if (!fs.existsSync(modulesPath)) {
                  console.log("[INFO] No modules folder found. Skipping.");
                        return;
        }

          client.container = client.container || {};

          const folders = fs.readdirSync(modulesPath).filter(f => fs.statSync(path.join(modulesPath, f)).isDirectory());
            
              for (const folder of folders) {
                      try {
                                  const indexPath = pathToFileURL(path.join(modulesPath, folder, "index.js")).href;
                                            const mod = await import(indexPath);
                                                      let loaded = null;
                                                                if (mod.default && typeof mod.default === "function") {
                                                                                  loaded = await mod.default(client);
                                                                } else if (mod.default) {
                                                                                  loaded = mod.default;
                                                                }

                                if (loaded !== null && loaded !== undefined) {
                                          const moduleKey = folder.toLowerCase();
                                          if (['gateway', 'economy', 'shop'].includes(moduleKey)) {
                                                    client.container[moduleKey] = loaded;
                                          }

                                          if (folder !== 'gateway') {
                                                    client[folder] = loaded;
                                          }
                                }
                      } catch (error) {
                                console.error(`[MODULE-LOADER] Failed to load module "${folder}":`, error);
                      }
              }
}
