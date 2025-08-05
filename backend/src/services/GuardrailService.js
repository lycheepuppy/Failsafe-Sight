/**
 * Guardrail Service
 * Main orchestration service for guardrail checks
 */

const BusinessRuleEngine = require('./BusinessRuleEngine');
const AgenticAnalysisService = require('./AgenticAnalysisService');
const AIAnalysisService = require('./AIAnalysisService');
const CacheService = require('./CacheService');
const logger = require('../utils/logger');

class GuardrailService {
  constructor() {
    this.businessRuleEngine = BusinessRuleEngine;
    this.agenticAnalysisService = AgenticAnalysisService;
    this.aiAnalysisService = AIAnalysisService;
    this.cacheService = CacheService;
  }

  /**
   * Perform comprehensive guardrail check
   * @param {Object} requestData - Request data
   * @param {string} customPrompt - Optional custom prompt
   * @returns {Promise<Object>} Guardrail check results
   */
  async checkGuardrails(requestData, customPrompt = '') {
    const startTime = Date.now();
    
    try {
      // Validate input
      const validation = this.validateRequest(requestData);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          timestamp: new Date().toISOString()
        };
      }

      // Check cache first
      const cacheKey = this.cacheService.generateKey({ ...requestData, customPrompt });
      const cachedResult = this.cacheService.get(cacheKey);
      
      if (cachedResult) {
        logger.info('Guardrail check served from cache', {
          inputLength: requestData.input?.length || 0,
          duration: Date.now() - startTime
        });
        return {
          ...cachedResult,
          cached: true,
          timestamp: new Date().toISOString()
        };
      }

      // Sanitize input
      const sanitizedRequest = this.sanitizeRequest(requestData);

      // Perform business rule evaluation
      const businessRules = await this.performBusinessRuleEvaluation(sanitizedRequest);

      // Perform agentic analysis
      const agenticAnalysis = await this.performAgenticAnalysis(sanitizedRequest);

      // Perform AI analysis (if enabled)
      const aiAnalysis = await this.performAIAnalysis(sanitizedRequest, customPrompt);

      // Combine results
      const combinedResults = this.combineResults(businessRules, agenticAnalysis, aiAnalysis);

      // Add metadata
      const finalResult = {
        ...combinedResults,
        success: true,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        cacheKey,
        services: {
          businessRules: businessRules.success,
          agenticAnalysis: agenticAnalysis.success,
          aiAnalysis: aiAnalysis.success
        }
      };

      // Cache the result
      this.cacheService.set(cacheKey, finalResult);

      logger.info('Guardrail Check', {
        inputLength: sanitizedRequest.input?.length || 0,
        verdict: finalResult.verdict,
        duration: finalResult.duration
      });

      return finalResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Guardrail check failed', { 
        error: error.message, 
        stack: error.stack,
        duration 
      });

      return {
        success: false,
        error: 'Internal server error',
        verdict: 'OVERRIDE',
        reasonCode: 'ERROR',
        action: 'ESCALATE',
        evidence: ['Service temporarily unavailable'],
        timestamp: new Date().toISOString(),
        duration
      };
    }
  }

  /**
   * Validate request data
   * @param {Object} requestData - Request data to validate
   * @returns {Object} Validation result
   */
  validateRequest(requestData) {
    const { input, reasoning, output } = requestData;

    if (!input || typeof input !== 'string') {
      return { valid: false, error: 'Input field is required and must be a string' };
    }

    if (!reasoning || typeof reasoning !== 'string') {
      return { valid: false, error: 'Reasoning field is required and must be a string' };
    }

    if (!output || typeof output !== 'string') {
      return { valid: false, error: 'Output field is required and must be a string' };
    }

    // Check length limits
    if (input.length > 10000) {
      return { valid: false, error: 'Input field exceeds maximum length of 10,000 characters' };
    }

    if (reasoning.length > 10000) {
      return { valid: false, error: 'Reasoning field exceeds maximum length of 10,000 characters' };
    }

    if (output.length > 10000) {
      return { valid: false, error: 'Output field exceeds maximum length of 10,000 characters' };
    }

    return { valid: true };
  }

  /**
   * Sanitize request data
   * @param {Object} requestData - Request data to sanitize
   * @returns {Object} Sanitized request data
   */
  sanitizeRequest(requestData) {
    return {
      input: requestData.input.trim(),
      reasoning: requestData.reasoning.trim(),
      output: requestData.output.trim()
    };
  }

  /**
   * Perform business rule evaluation
   * @param {Object} request - Sanitized request
   * @returns {Promise<Object>} Business rule results
   */
  async performBusinessRuleEvaluation(request) {
    try {
      const startTime = Date.now();
      const results = this.businessRuleEngine.evaluate(request);
      const duration = Date.now() - startTime;

      logger.debug('Business rule evaluation completed', { duration });

      return {
        success: true,
        data: results,
        duration
      };
    } catch (error) {
      logger.error('Business rule evaluation failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        data: {
          evidence: ['Business rule evaluation failed'],
          reasonCode: 'ERROR',
          action: 'ESCALATE',
          triggeredRules: []
        }
      };
    }
  }

  /**
   * Perform agentic analysis
   * @param {Object} request - Sanitized request
   * @returns {Promise<Object>} Agentic analysis results
   */
  async performAgenticAnalysis(request) {
    try {
      const startTime = Date.now();
      const results = this.agenticAnalysisService.analyze(request);
      const duration = Date.now() - startTime;

      logger.debug('Agentic analysis completed', { duration });

      return {
        success: true,
        data: results,
        duration
      };
    } catch (error) {
      logger.error('Agentic analysis failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        data: {
          evidence: ['Agentic analysis failed'],
          reasonCode: 'ERROR',
          action: 'ESCALATE',
          patterns: []
        }
      };
    }
  }

  /**
   * Perform AI analysis
   * @param {Object} request - Sanitized request
   * @param {string} customPrompt - Custom prompt
   * @returns {Promise<Object>} AI analysis results
   */
  async performAIAnalysis(request, customPrompt = '') {
    try {
      if (!this.aiAnalysisService.isEnabled()) {
        return {
          success: false,
          error: 'AI analysis not enabled',
          data: null
        };
      }

      const startTime = Date.now();
      const results = await this.aiAnalysisService.analyze(request, customPrompt);
      const duration = Date.now() - startTime;

      logger.debug('AI analysis completed', { duration });

      return {
        success: results.success,
        data: results.data,
        error: results.error,
        duration
      };
    } catch (error) {
      logger.error('AI analysis failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Combine results from all analysis services
   * @param {Object} businessRules - Business rule results
   * @param {Object} agenticAnalysis - Agentic analysis results
   * @param {Object} aiAnalysis - AI analysis results
   * @returns {Object} Combined results
   */
  combineResults(businessRules, agenticAnalysis, aiAnalysis) {
    let finalVerdict = 'CONFIRM';
    let finalReasonCode = 'BOUNDARY';
    let finalAction = 'ALLOW';
    let finalEvidence = [];

    // Business rules take highest priority
    if (businessRules.success && businessRules.data) {
      const br = businessRules.data;
      if (br.verdict === 'OVERRIDE') {
        finalVerdict = 'OVERRIDE';
        finalReasonCode = br.reasonCode;
        finalAction = br.action;
      }
      if (br.evidence && br.evidence.length > 0) {
        finalEvidence.push(...br.evidence);
      }
    }

    // Agentic analysis
    if (agenticAnalysis.success && agenticAnalysis.data) {
      const aa = agenticAnalysis.data;
      if (aa.verdict === 'OVERRIDE' && finalVerdict !== 'OVERRIDE') {
        finalVerdict = 'OVERRIDE';
        finalReasonCode = aa.reasonCode;
        finalAction = aa.action;
      }
      if (aa.evidence && aa.evidence.length > 0) {
        finalEvidence.push(...aa.evidence);
      }
    }

    // AI analysis (highest confidence but can be overridden by business rules)
    if (aiAnalysis.success && aiAnalysis.data) {
      const ai = aiAnalysis.data;
      if (ai.verdict === 'OVERRIDE' && finalVerdict !== 'OVERRIDE') {
        finalVerdict = 'OVERRIDE';
        finalReasonCode = ai.reason_code;
        finalAction = ai.action;
      }
      if (ai.evidence && ai.evidence.length > 0) {
        finalEvidence.push(...ai.evidence);
      }
    }

    return {
      verdict: finalVerdict,
      reasonCode: finalReasonCode,
      action: finalAction,
      evidence: finalEvidence,
      analysis: {
        businessRules: businessRules.success ? businessRules.data : null,
        agenticAnalysis: agenticAnalysis.success ? agenticAnalysis.data : null,
        aiAnalysis: aiAnalysis.success ? aiAnalysis.data : null
      }
    };
  }

  /**
   * Get service status
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      businessRules: {
        enabled: true,
        rulesCount: this.businessRuleEngine.getRules().length
      },
      agenticAnalysis: {
        enabled: true,
        patternsCount: this.agenticAnalysisService.getPatterns().length
      },
      aiAnalysis: {
        enabled: this.aiAnalysisService.isEnabled(),
        status: this.aiAnalysisService.getStatus()
      },
      cache: {
        enabled: this.cacheService.isEnabled(),
        stats: this.cacheService.getStats()
      }
    };
  }

  /**
   * Clear cache
   * @returns {boolean} Success status
   */
  clearCache() {
    return this.cacheService.clear();
  }
}

module.exports = new GuardrailService(); 