import mongoose from 'mongoose';

const GuildConfigSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Gateway System Configuration
  gateway: {
    enabled: { type: Boolean, default: true },
    channelId: { type: String, default: null },
    method: { type: String, enum: ['button', 'keyword', 'slash'], default: 'button' },
    keyword: { type: String, default: '!verify' },
    autoKick: { type: Boolean, default: false },
    autoKickDelay: { type: Number, default: 300000 }, // 5 minutes
    riskThreshold: { type: Number, default: 50 }, // Risk score threshold
    welcomeMessage: { type: String, default: 'Welcome to the server!' },
    verifiedRoleId: { type: String, default: null },
    unverifiedRoleId: { type: String, default: null }
  },

  welcome: {
    channelId: { type: String, default: null },
    autoRoleId: { type: String, default: null },
    title: { type: String, default: 'Welcome' },
    description: { type: String, default: 'Welcome to the server!' },
    color: { type: String, default: '#2ecc71' },
    image: { type: String, default: null },
    footer: { type: String, default: null },
  },

  goodbye: {
    channelId: { type: String, default: null },
    title: { type: String, default: 'Goodbye' },
    description: { type: String, default: 'Goodbye and good luck!', },
    color: { type: String, default: '#ff0000' },
    image: { type: String, default: null },
    footer: { type: String, default: null },
  },

  // Economy System Configuration
  economy: {
    enabled: { type: Boolean, default: true },
    currencyName: { type: String, default: 'Coins' },
    currencySymbol: { type: String, default: '🪙' },
    startingBalance: { type: Number, default: 100 },
    maxBalance: { type: Number, default: 1000000 },
    dailyReward: { type: Number, default: 50 },
    dailyCooldown: { type: Number, default: 86400000 } // 24 hours
  },

  // Shop System Configuration
  shop: {
    enabled: { type: Boolean, default: true },
    channelId: { type: String, default: null },
    embedColor: { type: Number, default: 0x00FF00 },
    maxItemsPerPage: { type: Number, default: 5 },
    purchaseCooldown: { type: Number, default: 30000 } // 30 seconds
  },

  // Leveling System Configuration
  leveling: {
    enabled: { type: Boolean, default: true },
    xpPerMessage: { type: Number, default: 10 },
    xpCooldown: { type: Number, default: 60000 }, // 1 minute
    levelUpChannelId: { type: String, default: null },
    levelUpMessage: { type: String, default: 'Congratulations {user}! You reached level {level}!' },
    maxLevel: { type: Number, default: 100 }
  },

  // Visual Engine Configuration
  visual: {
    enabled: { type: Boolean, default: true },
    defaultEmbedColor: { type: Number, default: 0xDAA520 },
    maxEmbedsPerMessage: { type: Number, default: 10 },
    embedTimeout: { type: Number, default: 300000 } // 5 minutes
  },

  // Administrative Settings
  admin: {
    logChannelId: { type: String, default: null },
    adminRoleIds: [{ type: String }],
    modRoleIds: [{ type: String }],
    commandPrefix: { type: String, default: '/' },
    language: { type: String, default: 'en' }
  },

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
GuildConfigSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get or create config
GuildConfigSchema.statics.getOrCreate = async function(guildId) {
  let config = await this.findOne({ guildId });
  if (!config) {
    config = new this({ guildId });
    await config.save();
  }
  return config;
};

// Instance method to update specific section
GuildConfigSchema.methods.updateSection = async function(section, data) {
  if (!this[section]) {
    throw new Error(`Invalid section: ${section}`);
  }

  // Deep merge the data
  Object.assign(this[section], data);
  this.updatedAt = new Date();
  return this.save();
};

const GuildConfig = mongoose.model('GuildConfig', GuildConfigSchema);

export default GuildConfig;