/**
 * ─── src/loaders/commands.js ──────────────────────────────────────────────────
 * GUARDIAN V2 - RECURSIVE GLOBAL LOADER
 * المصدر: مراجعة المدير التقني لضمان دعم الأقسام (Categories) تلقائياً
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * دالة المسح العميق مع استخراج القسم بناءً على اسم المجلد
 */
function scanDir(dir, baseDir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanDir(fullPath, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      // استخراج اسم المجلد الأب ليكون هو "القسم"
      const relativePath = path.relative(baseDir, dir);
      const category = relativePath || 'General'; 
      results.push({ fullPath, category });
    }
  }
  return results;
}

export default async function loadCommands(client) {
  const commandsPath = path.join(__dirname, '../commands');
  
  if (!fs.existsSync(commandsPath)) {
      console.warn('[IRON-LOADER] Commands directory not found.');
      return;
  }

  const files = scanDir(commandsPath, commandsPath);

  for (const { fullPath, category } of files) {
    try {
      // استخدام طابع زمني (Cache Busting) لضمان تحميل أحدث نسخة من الملف
      const fileUrl = `${pathToFileURL(fullPath).href}?update=${Date.now()}`;
      const mod = await import(fileUrl);
      const cmd = mod.default;

      if (cmd && cmd.data && typeof cmd.execute === 'function') {
        // إضافة القسم للأمر تلقائياً لخدمة أمر الـ Help مستقبلاً
        cmd.category = category;
        client.commands.set(cmd.data.name, cmd);
      }
    } catch (err) {
      console.error(`[IRON-LOADER] Failed to load ${fullPath}:`, err.message);
    }
  }

  console.log(`[IRON-LOADER] Successfully loaded ${client.commands.size} commands in [${new Set(files.map(f => f.category)).size}] categories.`);
}
