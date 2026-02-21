import { Client, GatewayIntentBits, Collection } from 'discord.js';
import loadEvents from './loaders/events.js';
import loadCommands from './loaders/commands.js';
import loadModules from './loaders/modules.js';
import { connectDatabase } from './core/database.js';
import { logger } from './core/logger.js';
import gatewayModule from './modules/gateway/index.js';

export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = new Collection();

export async function startBot() {
    try {
        logger.info('Starting Guardian Bot v4.0 - Full System Purge & Modular Refactor');

        // Startup Sequence: Database -> Cache Init -> Events -> Commands -> Modules -> Client Login
        
        logger.info('Step 1: Connecting to database...');
        await connectDatabase();

        logger.info('Step 2: Initializing Gateway Module cache...');
        await gatewayModule.init(client);

        logger.info('Step 3: Loading events...');
        await loadEvents(client);

        logger.info('Step 4: Loading and syncing commands...');
        await loadCommands(client);

        logger.info('Step 5: Loading modules...');
        await loadModules(client);

        // Initialize security modules
        try {
            const anti = await import('./security/antiNukeWatcher.js');
            if (anti && anti.init) anti.init(client);
        } catch (err) {
            logger.warn(`Failed to initialize antiNukeWatcher: ${err.message}`);
        }
        try {
            const webhookGuard = await import('./security/webhookGuard.js');
            if (webhookGuard && webhookGuard.init) webhookGuard.init(client);
        } catch (err) {
            logger.warn(`Failed to initialize webhookGuard: ${err.message}`);
        }

        logger.info('Step 6: Logging in to Discord...');
        const token = process.env.DISCORD_TOKEN;
        if (!token) {
            throw new Error('DISCORD_TOKEN not found in environment variables');
        }
        await client.login(token);
    } catch (error) {
        logger.error(`Failed to start bot: ${error.message}`);
        throw error;
    }
}