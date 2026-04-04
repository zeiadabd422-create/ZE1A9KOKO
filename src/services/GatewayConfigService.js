import mongoose from 'mongoose';
import GatewayConfig from '../models/GatewayConfig.js';

function setNestedValue(object, dottedKey, value) {
  const keys = dottedKey.split('.');
  let current = object;

  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
}

function mergeUpdateData(target, updateData) {
  const result = Array.isArray(target) ? [...target] : { ...target };

  for (const [key, value] of Object.entries(updateData)) {
    if (typeof key === 'string' && key.includes('.')) {
      setNestedValue(result, key, value);
      continue;
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = mergeUpdateData(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * GatewayConfigService - Service layer for Gateway configuration management
 * Provides MongoDB persistence with in-memory caching and fallback safety
 */
export class GatewayConfigService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get configuration for a guild
   * @param {string} guildId - The guild ID
   * @returns {Promise<Object>} Configuration object
   */
  async getConfig(guildId) {
    if (!guildId) {
      throw new Error('Guild ID is required');
    }

    try {
      // Check cache first
      const cached = this.cache.get(guildId);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        return cached.data;
      }

      // If database is not ready, use fallback immediately
      if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        console.warn('[GatewayConfigService] MongoDB not connected, using in-memory fallback for getConfig.');
        const fallbackConfig = {
          guildId,
          roles: {
            successRoleId: null,
            failureRoleId: null
          },
          settings: {
            enabled: true,
            verificationChannel: null,
            difficulty: 'NORMAL'
          },
          visualTemplates: {}
        };

        this.cache.set(guildId, {
          data: fallbackConfig,
          timestamp: Date.now()
        });
        return fallbackConfig;
      }

      // Fetch from database
      let config = await GatewayConfig.findOne({ guildId });

      // Create default config if not found
      if (!config) {
        config = new GatewayConfig({
          guildId,
          roles: {
            successRoleId: null,
            failureRoleId: null
          },
          settings: {
            enabled: true,
            verificationChannel: null,
            difficulty: 'NORMAL'
          },
          visualTemplates: {}
        });
        await config.save();
      }

      // Cache the result
      const configData = {
        guildId: config.guildId,
        roles: config.roles,
        settings: config.settings,
        visualTemplates: config.visualTemplates
      };

      this.cache.set(guildId, {
        data: configData,
        timestamp: Date.now()
      });

      return configData;

    } catch (error) {
      console.error('[GatewayConfigService] Database error in getConfig:', error);

      // Fallback to in-memory default
      const fallbackConfig = {
        guildId,
        roles: {
          successRoleId: null,
          failureRoleId: null
        },
        settings: {
          enabled: true,
          verificationChannel: null,
          difficulty: 'NORMAL'
        },
        visualTemplates: {}
      };

      // Cache fallback
      this.cache.set(guildId, {
        data: fallbackConfig,
        timestamp: Date.now()
      });

      return fallbackConfig;
    }
  }

  /**
   * Set configuration for a guild
   * @param {string} guildId - The guild ID
   * @param {Object} data - Configuration data to update
   * @returns {Promise<Object>} Updated configuration
   */
  async setConfig(guildId, data) {
    if (!guildId) {
      throw new Error('Guild ID is required');
    }

    // If database is not ready, use fallback and cache update only
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      console.warn('[GatewayConfigService] MongoDB not connected, using in-memory fallback for setConfig.');
      const current = this.cache.get(guildId)?.data || {
        guildId,
        roles: { successRoleId: null, failureRoleId: null },
        settings: { enabled: true, verificationChannel: null, difficulty: 'NORMAL' },
        visualTemplates: {}
      };

      const updated = mergeUpdateData(current, data);
      this.cache.set(guildId, {
        data: updated,
        timestamp: Date.now()
      });

      return updated;
    }

    try {
      // Update or create config
      let config = await GatewayConfig.findOne({ guildId });
      const defaultConfig = {
        guildId,
        roles: {
          successRoleId: null,
          failureRoleId: null
        },
        settings: {
          enabled: true,
          verificationChannel: null,
          difficulty: 'NORMAL'
        },
        visualTemplates: {}
      };
      const updateData = { ...data };

      if (!config) {
        const createDoc = mergeUpdateData(defaultConfig, updateData);
        config = await GatewayConfig.create(createDoc);
      } else {
        config = await GatewayConfig.findOneAndUpdate(
          { guildId },
          {
            $set: {
              ...updateData,
              guildId
            }
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
          }
        );
      }

      // Update cache
      const configData = {
        guildId: config.guildId,
        roles: config.roles,
        settings: config.settings,
        visualTemplates: config.visualTemplates
      };

      this.cache.set(guildId, {
        data: configData,
        timestamp: Date.now()
      });

      return configData;

    } catch (error) {
      console.error('[GatewayConfigService] Database error in setConfig:', error);

      // Fallback: update cache only
      const current = this.cache.get(guildId)?.data || {
        guildId,
        roles: { successRoleId: null, failureRoleId: null },
        settings: { enabled: true, verificationChannel: null, difficulty: 'NORMAL' },
        visualTemplates: {}
      };

      const updated = mergeUpdateData(current, data);
      this.cache.set(guildId, {
        data: updated,
        timestamp: Date.now()
      });

      return updated;
    }
  }

  /**
   * Update roles for a guild
   * @param {string} guildId - The guild ID
   * @param {Object} roles - Role configuration
   * @returns {Promise<Object>} Updated configuration
   */
  async updateRoles(guildId, roles) {
    return await this.setConfig(guildId, { roles });
  }

  /**
   * Clear cache for a guild
   * @param {string} guildId - The guild ID
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
}

// Export singleton instance
export const gatewayConfigService = new GatewayConfigService();
export default gatewayConfigService;