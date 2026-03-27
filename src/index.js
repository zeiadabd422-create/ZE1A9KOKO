import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import dotenv from 'dotenv';
import { connectDatabase } from './core/database.js';
import loadModules from './loaders/modules.js';
import loadEvents from './loaders/events.js';
import loadCommands from './loaders/commands.js';
import TaskScheduler from './core/TaskScheduler.js';
import { startApi } from './api.js';
import EmbedVault from './modules/embedVault/index.js';
import VisualEngine from './core/VisualEngine.js';
import { initializeEmbedHelper } from './utils/embedHelper.js';

// 1. تحميل الإعدادات فوراً
dotenv.config();

// 2. فحص النظام (System Check) - التأكد من البيانات الحيوية
const REQUIRED_ENV = ['DISCORD_TOKEN', 'MONGO_URI', 'CLIENT_ID', 'GUILD_ID'];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length) {
  console.error(`[SYSTEM-CHECK] CRITICAL ERROR: Missing env vars: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// 3. درع الحماية العالمي (Global Anti-Crash)
process.on('unhandledRejection', (reason) => {
  console.error('[ANTI-CRASH] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[ANTI-CRASH] Uncaught Exception:', err);
});

// 4. إعداد العميل (Client Setup)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.Reaction,
    Partials.GuildMember, // مضافة لضمان عمل الرتب المؤقتة
  ],
});

client.commands = new Collection();

// 5. وظيفة الإقلاع الاحترافية (Bootstrap Sequence)
async function bootstrap() {
  try {
    console.log('--- [GUARDIAN V2 BOOT SEQUENCE] ---');

    // أ. الربط مع قاعدة البيانات
    await connectDatabase();
    console.log('[1/4] DATABASE: Online.');

    // ب. تحميل الأنظمة (Modules & Loaders)
    await loadModules(client);
    client.embedVault = EmbedVault(client);
    initializeEmbedHelper(client); // Initialize embed helper after vault is ready
    await loadEvents(client);
    await loadCommands(client);
    console.log('[2/4] LOADERS: All systems loaded.');

    // ج. تشغيل المجدول الزمني (Scheduler)
    const scheduler = new TaskScheduler(client);
    scheduler.start();
    console.log('[3/4] SCHEDULER: Ironclad Service Online.');

    // تشغيل الـ API Server
    startApi();

    // د. تسجيل الدخول
    await client.login(process.env.DISCORD_TOKEN);
    console.log(`[4/4] AUTH: Logged in as ${client.user.tag}`);
    console.log('--- [SYSTEM READY] ---');

  } catch (error) {
    console.error('[BOOT-ERROR] Critical failure during startup:', error);
    process.exit(1);
  }
}

bootstrap();

export default client;