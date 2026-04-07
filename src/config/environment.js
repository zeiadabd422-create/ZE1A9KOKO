import dotenv from 'dotenv';
dotenv.config();

export const env = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
    CLIENT_ID: process.env.CLIENT_ID || '',
    GUILD_ID: process.env.GUILD_ID || '',
    SESSION_SECRET: process.env.SESSION_SECRET || '',
    MONGO_URI: process.env.MONGO_URI,
    PORT: parseInt(process.env.PORT || '5000', 10),
};

if (!env.DISCORD_TOKEN) {
    console.warn('WARNING: Discord DISCORD_TOKEN is missing from environment.');
}
