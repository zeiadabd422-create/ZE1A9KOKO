import GuildConfigModel from '../../models/GuildConfig.js';

class GuildConfig {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get guild configuration, with caching
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object>} Guild configuration object
   */
  async get(guildId) {
    // Check cache first
    const cached = this.cache.get(guildId);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }

    // Fetch from database
    const config = await GuildConfigModel.getOrCreate(guildId);

    // Cache the result
    this.cache.set(guildId, {
      data: config.toObject(),
      timestamp: Date.now()
    });

    return config.toObject();
  }

  /**
   * Update guild configuration section
   * @param {string} guildId - Discord guild ID
   * @param {string} section - Configuration section (gateway, economy, shop, etc.)
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated configuration
   */
  async update(guildId, section, data) {
    const config = await GuildConfigModel.findOne({ guildId });
    if (!config) {
      throw new Error(`Guild config not found for ${guildId}`);
    }

    await config.updateSection(section, data);

    // Clear cache
    this.cache.delete(guildId);

    return config.toObject();
  }

  /**
   * Set entire guild configuration
   * @param {string} guildId - Discord guild ID
   * @param {Object} data - Complete configuration data
   * @returns {Promise<Object>} Updated configuration
   */
  async set(guildId, data) {
    const config = await GuildConfigModel.findOneAndUpdate(
      { guildId },
      { ...data, updatedAt: new Date() },
      { new: true, upsert: true }
    );

    // Clear cache
    this.cache.delete(guildId);

    return config.toObject();
  }

  /**
   * Clear cache for specific guild
   * @param {string} guildId - Discord guild ID
   */
  clearCache(guildId) {
    this.cache.delete(guildId);
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.cache.clear();
  }

  /**
   * Get specific section from guild config
   * @param {string} guildId - Discord guild ID
   * @param {string} section - Configuration section
   * @returns {Promise<Object>} Section configuration
   */
  async getSection(guildId, section) {
    const config = await this.get(guildId);
    return config[section] || {};
  }

  /**
   * Check if a feature is enabled for guild
   * @param {string} guildId - Discord guild ID
   * @param {string} feature - Feature name (gateway, economy, shop, leveling, visual)
   * @returns {Promise<boolean>} Whether feature is enabled
   */
  async isFeatureEnabled(guildId, feature) {
    const section = await this.getSection(guildId, feature);
    return section.enabled !== false; // Default to true if not set
  }
}

export default new GuildConfig();
