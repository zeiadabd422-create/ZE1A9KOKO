import GatewayModel from './schema.js';
import { logger } from '../../core/logger.js';

/**
 * Gateway In-Memory Cache
 * DDD: Application Layer - Caching mechanism
 * 
 * Prevents database bottlenecks by caching gateway configurations in memory.
 * Format: Map<guildId, gatewayConfig>
 */
class GatewayCache {
    constructor() {
        this.cache = new Map();
        this.initialized = false;
        this.initializationDelay = 0;
    }

    /**
     * Initialize cache from database
     * Called once after database connection on bot startup
     */
    async initCache() {
        try {
            if (this.initialized) {
                logger.warn('Gateway cache already initialized, skipping reinit');
                return;
            }

            logger.info('Initializing gateway cache from MongoDB...');
            const startTime = Date.now();

            const gateways = await GatewayModel.find({}).lean();

            if (!gateways || gateways.length === 0) {
                logger.info('No gateway configurations found in database');
                this.initialized = true;
                this.initializationDelay = Date.now() - startTime;
                return;
            }

            // Load all gateways into memory
            for (const gateway of gateways) {
                this.cache.set(gateway.guildId, gateway);
            }

            this.initialized = true;
            this.initializationDelay = Date.now() - startTime;

            logger.info(`✓ Gateway cache initialized with ${gateways.length} configs in ${this.initializationDelay}ms`);
        } catch (error) {
            logger.error(`Failed to initialize gateway cache: ${error.message}`);
            this.initialized = true; // Mark as initialized even on error to prevent retries
        }
    }

    /**
     * Get gateway configuration from cache
     * @param {string} guildId - Discord Guild ID
     * @returns {Object|null} Gateway configuration or null if not found
     */
    getCache(guildId) {
        if (!guildId) return null;
        
        const cached = this.cache.get(guildId);
        if (cached) {
            logger.debug(`Gateway cache HIT for guild ${guildId}`);
        } else {
            logger.debug(`Gateway cache MISS for guild ${guildId}`);
        }
        return cached || null;
    }

    /**
     * Set gateway configuration in cache
     * @param {string} guildId - Discord Guild ID
     * @param {Object} data - Gateway configuration data
     */
    setCache(guildId, data) {
        if (!guildId) return;

        try {
            // Merge with existing cache if present
            const existing = this.cache.get(guildId) || {};
            const merged = { ...existing, ...data, guildId };
            
            this.cache.set(guildId, merged);
            logger.info(`Gateway cache SET for guild ${guildId}`);
        } catch (error) {
            logger.error(`Failed to set gateway cache for ${guildId}: ${error.message}`);
        }
    }

    /**
     * Delete gateway configuration from cache
     * @param {string} guildId - Discord Guild ID
     */
    deleteCache(guildId) {
        if (!guildId) return;

        this.cache.delete(guildId);
        logger.info(`Gateway cache DELETED for guild ${guildId}`);
    }

    /**
     * Clear entire cache
     * Useful for testing or manual cache reset
     */
    clearCache() {
        this.cache.clear();
        logger.info('Gateway cache CLEARED');
    }

    /**
     * Get all cached gateways
     * @returns {Object} Map of all cached gateway configurations
     */
    getAllCache() {
        return new Map(this.cache);
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getStats() {
        return {
            initialized: this.initialized,
            size: this.cache.size,
            initializationDelay: this.initializationDelay,
            entries: Array.from(this.cache.keys())
        };
    }

    /**
     * Check if cache is ready
     * @returns {boolean} Is cache initialized
     */
    isReady() {
        return this.initialized;
    }
}

// Export singleton instance
export default new GatewayCache();
