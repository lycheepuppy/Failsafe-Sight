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
   * Generate cache key from request data with enhanced security
   * @param {Object} request - Request object
   * @returns {string} Cache key
   */
  generateKey(request) {
    const crypto = require('crypto');
    const { input, reasoning, output, customPrompt, hash } = request;
    
    // Use provided hash if available, otherwise generate one
    const contentHash = hash || crypto.createHash('sha256').update(
      JSON.stringify({
        input: input?.substring(0, 200),
        reasoning: reasoning?.substring(0, 200),
        output: output?.substring(0, 200),
        customPrompt: customPrompt?.substring(0, 100)
      })
    ).digest('hex').substr(0, 16);
    
    // Create a more secure and shorter key
    return `guardrail:${contentHash}`;
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
   * Set cache value with enhanced security
   * @param {string} key - Cache key
   * @param {Object} value - Value to cache
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {boolean} Success status
   */
  set(key, value, ttl = null) {
    if (!config.cache.enabled) return false;
    
    // Validate key format
    if (!this.validateKey(key)) {
      logger.warn('Invalid cache key format', { key: key?.substring(0, 20) + '...' });
      return false;
    }
    
    try {
      // Sanitize value before caching
      const sanitizedValue = this.sanitizeValue(value);
      
      const success = this.cache.set(key, sanitizedValue, ttl || config.cache.ttl);
      if (success) {
        logger.debug('Cache set', { 
          key: this.maskKey(key), 
          ttl: ttl || config.cache.ttl,
          valueSize: JSON.stringify(sanitizedValue).length
        });
      }
      return success;
    } catch (error) {
      logger.warn('Cache set error', { error: error.message, key: this.maskKey(key) });
      return false;
    }
  }

  /**
   * Mask cache key for security in logs
   * @param {string} key - Original cache key
   * @returns {string} Masked cache key
   */
  maskKey(key) {
    if (!key || key.length < 8) return '***';
    return `${key.substr(0, 4)}***${key.substr(-4)}`;
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
   * Get cache statistics with enhanced security
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
        maxSize: config.cache.maxSize,
        memoryUsage: {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024), // MB
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) // MB
        },
        uptime: Math.round(process.uptime())
      };
    } catch (error) {
      logger.warn('Cache stats error', { error: error.message });
      return {
        keys: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        size: 0,
        maxSize: config.cache.maxSize,
        memoryUsage: { rss: 0, heapUsed: 0, heapTotal: 0 },
        uptime: 0
      };
    }
  }

  /**
   * Validate cache key format for security
   * @param {string} key - Cache key to validate
   * @returns {boolean} Whether key is valid
   */
  validateKey(key) {
    if (!key || typeof key !== 'string') return false;
    if (key.length > 100) return false; // Prevent overly long keys
    if (!key.startsWith('guardrail:')) return false; // Ensure proper prefix
    return /^[a-zA-Z0-9:_-]+$/.test(key); // Only allow safe characters
  }

  /**
   * Sanitize cache value for security
   * @param {Object} value - Value to sanitize
   * @returns {Object} Sanitized value
   */
  sanitizeValue(value) {
    if (!value || typeof value !== 'object') return value;
    
    // Remove sensitive fields from cached data
    const sanitized = { ...value };
    delete sanitized.cacheKey; // Don't cache the cache key
    delete sanitized.requestId; // Don't cache request IDs
    
    return sanitized;
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