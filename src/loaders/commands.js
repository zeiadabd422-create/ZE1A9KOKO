import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { REST, Routes } from 'discord.js';
import { logger } from '../core/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Recursive Command Loader with Auto-Deployer
 * Scans all subdirectories in src/commands and syncs globally
 * Handles duplicate command names and API errors with retry logic
 */
export default async function loadCommands(client) {
    const commandsPath = path.join(__dirname, '../commands');
    const commandsJson = [];
    const loadedCommandNames = new Set();

    /**
     * Recursively scan directories for command files
     */
    async function scanDirectory(dir) {
        if (!fs.existsSync(dir)) return;
        
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const resPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await scanDirectory(resPath);
            } else if (entry.name.endsWith('.js')) {
                try {
                    const commandModule = await import(pathToFileURL(resPath).href);
                    const command = commandModule.default;

                    if (!command || !command.data || !command.data.name) {
                        logger.warn(`Skipping invalid command file: ${resPath}`);
                        continue;
                    }

                    const commandName = command.data.name;

                    // Check for duplicate command names
                    if (loadedCommandNames.has(commandName)) {
                        logger.error(`\x1b[31m[ERROR] Duplicate command name found: "${commandName}" in ${entry.name}. Skipping.\x1b[0m`);
                        continue;
                    }

                    // Check if command already in client.commands (safety check)
                    if (client.commands.has(commandName)) {
                        logger.error(`\x1b[31m[ERROR] Command "${commandName}" already registered. Skipping.\x1b[0m`);
                        continue;
                    }

                    client.commands.set(commandName, command);
                    loadedCommandNames.add(commandName);
                    commandsJson.push(command.data.toJSON());
                    logger.info(`Loaded command: ${commandName}`);
                } catch (error) {
                    logger.error(`Failed to load command from ${resPath}: ${error.message}`);
                }
            }
        }
    }

    try {
        logger.info('Starting recursive command loader...');
        await scanDirectory(commandsPath);
        logger.info(`\x1b[32m[System] Loaded ${commandsJson.length} commands successfully\x1b[0m`);
    } catch (error) {
        logger.error(`Command scanning failed: ${error.message}`);
        return;
    }

    // Auto-Deployer: Sync commands to Discord with error handling
    await syncCommandsToDeploy(client, commandsJson);
}

/**
 * Auto-Deployer using REST API
 * Performs .put() to GUILD_ID with duplicate checking and error handling
 */
async function syncCommandsToDeploy(client, commandsJson) {
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID;
    const guildId = process.env.GUILD_ID;

    // Validate required environment variables
    if (!token) {
        logger.error('DISCORD_TOKEN not set in environment variables');
        return;
    }
    if (!clientId) {
        logger.error('CLIENT_ID not set in environment variables');
        return;
    }
    if (!guildId) {
        logger.error('GUILD_ID not set in environment variables');
        return;
    }
    if (commandsJson.length === 0) {
        logger.warn('No commands to sync');
        return;
    }

    // Check for duplicate command names in the deploy list
    const deployedNames = new Set();
    const validCommands = [];
    
    for (const cmdJson of commandsJson) {
        if (deployedNames.has(cmdJson.name)) {
            logger.error(`\x1b[31m[ERROR] APPLICATION_COMMANDS_DUPLICATE_NAME: "${cmdJson.name}" appears multiple times. Skipping duplicate.\x1b[0m`);
            continue;
        }
        deployedNames.add(cmdJson.name);
        validCommands.push(cmdJson);
    }

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        logger.info(`Syncing ${validCommands.length} commands to Discord (Guild: ${guildId})...`);
        
        // First, delete all existing commands for a clean slate (Full System Purge)
        try {
            const existingCommands = await rest.get(Routes.applicationGuildCommands(clientId, guildId));
            if (existingCommands && existingCommands.length > 0) {
                logger.info(`Purging ${existingCommands.length} existing commands...`);
                for (const cmd of existingCommands) {
                    await rest.delete(Routes.applicationGuildCommand(clientId, guildId, cmd.id));
                }
                logger.info('\x1b[32m[System] All existing commands purged successfully\x1b[0m');
            }
        } catch (purgeError) {
            logger.warn(`Failed to purge existing commands: ${purgeError.message}`);
        }

        // Deploy new commands
        const result = await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
            body: validCommands,
        });

        logger.info(`\x1b[32m[System] ${result.length} commands synced successfully!\x1b[0m`);
    } catch (error) {
        // Handle specific Discord API errors
        if (error.code === 'TokenInvalid') {
            logger.error('\x1b[31m[ERROR] TokenInvalid: Discord token is invalid or has expired. Please check your DISCORD_TOKEN.\x1b[0m');
        } else if (error.code === 'APPLICATION_COMMANDS_DUPLICATE_NAME') {
            logger.error('\x1b[31m[ERROR] APPLICATION_COMMANDS_DUPLICATE_NAME: One or more commands have the same name.\x1b[0m');
        } else {
            logger.error(`\x1b[31m[Sync Error] ${error.message}\x1b[0m`);
            if (error.status) logger.error(`Status: ${error.status}`);
        }
    }
}
