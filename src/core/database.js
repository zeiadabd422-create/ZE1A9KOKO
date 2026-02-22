import mongoose from 'mongoose';

export async function connectDatabase() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.warn('connectDatabase: MONGO_URI not provided; skipping MongoDB connection');
    return;
  }

  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
}

export default connectDatabase;
import mongoose from 'mongoose';
import { logger } from './logger.js';
import GuildConfig from './models/GuildConfig.js';
import UserConfig from './models/UserConfig.js';

let isConnected = false;

export async function connectDatabase() {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/guardian';
        await mongoose.connect(mongoUri);
        isConnected = true;
        logger.info('Database connected successfully');
    } catch (error) {
        logger.error(`Database connection failed: ${error.message}`);
        throw error;
    }
}
export async function getGuildConfig(guildId) {
    try { let config = await GuildConfig.findOne({ guildId }); if (!config) config = await GuildConfig.create({ guildId }); return config; } 
    catch (error) { return null; }
}
export async function updateGuildConfig(guildId, data) {
    try { return await GuildConfig.findOneAndUpdate({ guildId }, { $set: data }, { new: true, upsert: true, runValidators: true }); } 
    catch (error) { return null; }
}
export async function getUserConfig(userId, guildId) {
    try { let config = await UserConfig.findOne({ userId, guildId }); if (!config) config = await UserConfig.create({ userId, guildId }); return config; } 
    catch (error) { return null; }
}
export async function updateUserConfig(userId, guildId, data) {
    try { return await UserConfig.findOneAndUpdate({ userId, guildId }, { $set: data }, { new: true, upsert: true, runValidators: true }); } 
    catch (error) { return null; }
}
export function isDbConnected() { return isConnected; }