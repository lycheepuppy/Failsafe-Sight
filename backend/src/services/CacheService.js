/**
 * Cache Service
 * Provides caching functionality for improved performance
 */

const NodeCache = require('node-cache');
const config = require('../config');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: config.cache.ttl,
      maxKeys: config.cache.maxSize,
      checkperiod: 60, // Check for expired keys every minute
      useClones: false // Better performance
    });

    // Cache event listeners
    this.cache.on('expired', (key, value) => {
      logger.debug('Cache key expired', { key });
    });

    this.cache.on('flush', () => {
      logger.info('Cache flushed');
    });

    logger.info('Cache service initialized', {
      ttl: config.cache.ttl,
      maxSize: config.cache.maxSize,
      enabled: config.cache.enabled
    });
  }

  /**
   * Generate cache key from request data
   * @param {Object} request - Request object
   * @returns {string} Cache key
   */
  generateKey(request) {
    const { input, reasoning, output, customPrompt } = request;
    const keyData = {
      input: input?.substring(0, 100), // Truncate for key size
      reasoning: reasoning?.substring(0, 100),
      output: output?.substring(0, 100),
      customPrompt: customPrompt?.substring(0, 50)
    };
    
    return `guardrail:${Buffer.from(JSON.stringify(keyData)).toString('base64').substring(0, 50)}`;
  }

  /**
   * Get cached result
   * @param {string} key - Cache key
   * @returns {Object|null} Cached result or null
   */
  get(key) {
    if (!config.cache.enabled) return null;
    
    try {
      const result = this.cache.get(key);
      if (result) {
        logger.debug('Cache hit', { key });
        return result;
      }
      logger.debug('Cache miss', { key });
      return null;
    } catch (error) {
      logger.warn('Cache get error', { error: error.message, key });
      return null;
    }
  }

  /**
   * Set cache value
   * @param {string} key - Cache key
   * @param {Object} value - Value to cache
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {boolean} Success status
   */
  set(key, value, ttl = null) {
    if (!config.cache.enabled) return false;
    
    try {
      const success = this.cache.set(key, value, ttl || config.cache.ttl);
      if (success) {
        logger.debug('Cache set', { key, ttl: ttl || config.cache.ttl });
      }
      return success;
    } catch (error) {
      logger.warn('Cache set error', { error: error.message, key });
      return false;
    }
  }

  /**
   * Delete cache key
   * @param {string} key - Cache key
   * @returns {number} Number of deleted keys
   */
  delete(key) {
    try {
      const deleted = this.cache.del(key);
      logger.debug('Cache delete', { key, deleted });
      return deleted;
    } catch (error) {
      logger.warn('Cache delete error', { error: error.message, key });
      return 0;
    }
  }

  /**
   * Clear all cache
   * @returns {boolean} Success status
   */
  clear() {
    try {
      this.cache.flushAll();
      logger.info('Cache cleared');
      return true;
    } catch (error) {
      logger.warn('Cache clear error', { error: error.message });
      return false;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    try {
      const stats = this.cache.getStats();
      return {
        keys: stats.keys,
        hits: stats.hits,
        misses: stats.misses,
        hitRate: stats.hits / (stats.hits + stats.misses) || 0,
        size: this.cache.keys().length,
        maxSize: config.cache.maxSize
      };
    } catch (error) {
      logger.warn('Cache stats error', { error: error.message });
      return {
        keys: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        maxSize: config.cache.maxSize
      };
    }
  }

  /**
   * Check if cache is enabled
   * @returns {boolean} True if cache is enabled
   */
  isEnabled() {
    return config.cache.enabled;
  }

  /**
   * Get cache keys
   * @returns {Array} Array of cache keys
   */
  getKeys() {
    try {
      return this.cache.keys();
    } catch (error) {
      logger.warn('Cache keys error', { error: error.message });
      return [];
    }
  }
}

module.exports = new CacheService(); 