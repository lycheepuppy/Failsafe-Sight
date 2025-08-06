/**
 * Guardrail Controller
 * Handles HTTP requests for guardrail operations
 */

const GuardrailService = require('../services/GuardrailService');
const logger = require('../utils/logger');

class GuardrailController {
  constructor() {
    this.guardrailService = GuardrailService;
  }

  /**
   * Check guardrails for a request
   * @param {Object} requestData - Request data
   * @param {string} customPrompt - Optional custom prompt
   * @param {boolean} bypassCache - Optional flag to bypass cache for debugging
   * @returns {Promise<Object>} Guardrail check results
   */
  async checkGuardrails(requestData, customPrompt = '', bypassCache = false) {
    return await this.guardrailService.checkGuardrails(requestData, customPrompt, bypassCache);
  }

  /**
   * Get health status
   * @returns {Promise<Object>} Health status
   */
  async getHealth() {
    try {
      const status = this.guardrailService.getStatus();
      return {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        services: status
      };
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      return {
        success: false,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get business rules
   * @returns {Promise<Array>} Array of business rules
   */
  async getBusinessRules() {
    try {
      return this.guardrailService.businessRuleEngine.getRules();
    } catch (error) {
      logger.error('Failed to get business rules', { error: error.message });
      throw error;
    }
  }

  /**
   * Add a new business rule
   * @param {Object} rule - Rule to add
   * @returns {Promise<boolean>} Success status
   */
  async addBusinessRule(rule) {
    try {
      return this.guardrailService.businessRuleEngine.addRule(rule);
    } catch (error) {
      logger.error('Failed to add business rule', { error: error.message, rule });
      throw error;
    }
  }

  /**
   * Update a business rule
   * @param {string} ruleId - Rule ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<boolean>} Success status
   */
  async updateBusinessRule(ruleId, updates) {
    try {
      return this.guardrailService.businessRuleEngine.updateRule(ruleId, updates);
    } catch (error) {
      logger.error('Failed to update business rule', { error: error.message, ruleId, updates });
      throw error;
    }
  }

  /**
   * Get service status
   * @returns {Promise<Object>} Service status
   */
  async getStatus() {
    try {
      return this.guardrailService.getStatus();
    } catch (error) {
      logger.error('Failed to get service status', { error: error.message });
      throw error;
    }
  }

  /**
   * Clear cache
   * @returns {Promise<boolean>} Success status
   */
  async clearCache() {
    try {
      return this.guardrailService.clearCache();
    } catch (error) {
      logger.error('Failed to clear cache', { error: error.message });
      throw error;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getCacheStats() {
    try {
      return this.guardrailService.cacheService.getStats();
    } catch (error) {
      logger.error('Failed to get cache statistics', { error: error.message });
      throw error;
    }
  }
}

module.exports = GuardrailController; 