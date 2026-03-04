// 1. يجب أن تكون جميع أوامر الـ import في مقدمة الملف تماماً
import { Client, GatewayIntentBits, Collection, Partials } from "discord.js";
import dotenv from "dotenv";
import { connectDatabase } from "./core/database.js";
import loadModules from "./loaders/modules.js";
import loadEvents from "./loaders/events.js";
import loadCommands from "./loaders/commands.js";
import TaskScheduler from "./core/TaskScheduler.js";

// 2. تحميل إعدادات البيئة أولاً
dotenv.config();

// 3. درع الحماية من الانهيار (Anti-Crash)
process.on('unhandledRejection', (reason) => {
    console.error('[ANTI-CRASH] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[ANTI-CRASH] Uncaught Exception:', err);
});

// 4. فحص النظام الصارم (System Check)
const requiredEnv = ['DISCORD_TOKEN', 'MONGO_URI', 'CLIENT_ID', 'GUILD_ID'];
requiredEnv.forEach(key => {
    if (!process.env[key]) {
        console.error(`[SYSTEM-CHECK] CRITICAL ERROR: ${key} is missing in .env!`);
        process.exit(1);
    }
});

// 5. إعداد العميل (Client Configuration)
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
        Partials.GuildMember,
    ],
});

client.commands = new Collection();

// 6. وظيفة الإقلاع الاحترافية (Bootstrap Sequence)
async function bootstrap() {
    try {
        console.log("[SYSTEM] Starting Ironclad Boot Sequence...");

        // الاتصال بقاعدة البيانات
        await connectDatabase();
        console.log("[DATABASE] Connection established.");

        // تشغيل المجدول الزمني للرتب والمهام
        const scheduler = new TaskScheduler(client);
        scheduler.start();
        console.log("[SCHEDULER] Background tasks online.");

        // تحميل الأنظمة والأحداث والأوامر
        await loadModules(client);
        await loadEvents(client);
        await loadCommands(client);

        // تسجيل الدخول
        await client.login(process.env.DISCORD_TOKEN);
        console.log(`[AUTH] Guardian V2 is active as ${client.user.tag}`);

    } catch (error) {
        console.error("[BOOT-ERROR] Critical failure during startup:", error);
        process.exit(1);
    }
}

bootstrap();

export default client;
