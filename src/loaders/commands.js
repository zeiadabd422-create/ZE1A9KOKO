const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

module.exports = (client) => {
        client.commands = new Collection();
            const commandsPath = path.join(__dirname, '../commands');

                const readCommands = (dir) => {
                            const files = fs.readdirSync(dir, { withFileTypes: true });
                                    for (const file of files) {
                                                    const fullPath = path.join(dir, file.name);
                                                                if (file.isDirectory()) {
                                                                                    readCommands(fullPath); 
                                                                } else if (file.name.endsWith('.js')) {
                                                                                    const command = require(fullPath);
                                                                                                    if ('data' in command && 'execute' in command) {
                                                                                                                            client.commands.set(command.data.name, command);
                                                                                                    }
                                                                }
                                    }
                };

                    readCommands(commandsPath);
                        console.log(`[IRON-LOADER] Successfully loaded ${client.commands.size} commands recursively.`);
};
