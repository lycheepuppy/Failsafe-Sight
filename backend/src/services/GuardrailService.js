/**
 * Guardrail Service
 * Main orchestration service for guardrail checks
 */

const BusinessRuleEngine = require('./BusinessRuleEngine');
const AgenticAnalysisService = require('./AgenticAnalysisService');
const AIAnalysisService = require('./AIAnalysisService');
const ScannerService = require('./ScannerService');
const CacheService = require('./CacheService');
const logger = require('../utils/logger');

class GuardrailService {
  constructor() {
    this.businessRuleEngine = BusinessRuleEngine;
    this.agenticAnalysisService = AgenticAnalysisService;
    this.aiAnalysisService = new AIAnalysisService();
    this.scannerService = new ScannerService();
    this.cacheService = CacheService;
  }

  /**
   * Perform comprehensive guardrail check with enhanced security and performance
   * @param {Object} requestData - Request data
   * @param {string} customPrompt - Optional custom prompt
   * @param {boolean} bypassCache - Optional flag to bypass cache for debugging
   * @returns {Promise<Object>} Guardrail check results
   */
  async checkGuardrails(requestData, customPrompt = '', bypassCache = false) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    try {
      // Input validation with enhanced security
      const validation = this.validateRequest(requestData);
      if (!validation.valid) {
        logger.warn('Invalid request data', { 
          requestId, 
          error: validation.error,
          inputLength: requestData.input?.length || 0 
        });
        return {
          success: false,
          error: validation.error,
          timestamp: new Date().toISOString(),
          requestId
        };
      }

      // Generate cache key with security considerations
      const cacheKey = this.cacheService.generateKey({ 
        ...requestData, 
        customPrompt,
        hash: this.generateContentHash(requestData)
      });
      
      // Check cache with enhanced security
      let cachedResult = null;
      if (!bypassCache) {
        cachedResult = this.cacheService.get(cacheKey);
        if (cachedResult && this.isCacheValid(cachedResult)) {
          logger.info('Guardrail check served from cache', {
            requestId,
            inputLength: requestData.input?.length || 0,
            duration: Date.now() - startTime,
            cacheHit: true
          });
          return {
            ...cachedResult,
            cached: true,
            timestamp: new Date().toISOString(),
            requestId
          };
        }
      }

      // Sanitize input with enhanced security
      const sanitizedRequest = this.sanitizeRequest(requestData);
      
      // Parallel execution for better performance
      const [businessRules, agenticAnalysis, scannerAnalysis] = await Promise.allSettled([
        this.performBusinessRuleEvaluation(sanitizedRequest),
        this.performAgenticAnalysis(sanitizedRequest),
        this.performScannerAnalysis(sanitizedRequest)
      ]);

      // AI analysis (sequential due to rate limits)
      const aiAnalysis = await this.performAIAnalysis(sanitizedRequest, customPrompt);

      // Combine results with enhanced error handling
      const combinedResults = this.combineResults(
        businessRules.status === 'fulfilled' ? businessRules.value : { success: false, error: businessRules.reason },
        agenticAnalysis.status === 'fulfilled' ? agenticAnalysis.value : { success: false, error: agenticAnalysis.reason },
        aiAnalysis,
        scannerAnalysis.status === 'fulfilled' ? scannerAnalysis.value : { success: false, error: scannerAnalysis.reason },
        sanitizedRequest
      );

      // Add metadata with enhanced security
      const finalResult = {
        ...combinedResults,
        success: true,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        requestId,
        cacheKey: this.maskCacheKey(cacheKey),
        services: {
          businessRules: businessRules.status === 'fulfilled' && businessRules.value.success,
          agenticAnalysis: agenticAnalysis.status === 'fulfilled' && agenticAnalysis.value.success,
          aiAnalysis: aiAnalysis.success,
          scannerAnalysis: scannerAnalysis.status === 'fulfilled' && scannerAnalysis.value.success
        },
        security: {
          sanitized: true,
          validated: true,
          timestamp: new Date().toISOString()
        }
      };

      // Cache the result with enhanced security
      this.cacheService.set(cacheKey, finalResult);

      logger.info('Guardrail Check Completed', {
        requestId,
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
   * Generate unique request ID for tracking
   * @returns {string} Unique request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate content hash for cache key security
   * @param {Object} requestData - Request data
   * @returns {string} Content hash
   */
  generateContentHash(requestData) {
    const crypto = require('crypto');
    const content = JSON.stringify({
      input: requestData.input || '',
      reasoning: requestData.reasoning || '',
      output: requestData.output || ''
    });
    return crypto.createHash('sha256').update(content).digest('hex').substr(0, 16);
  }

  /**
   * Check if cached result is still valid
   * @param {Object} cachedResult - Cached result
   * @returns {boolean} Whether cache is valid
   */
  isCacheValid(cachedResult) {
    if (!cachedResult || !cachedResult.timestamp) return false;
    
    const cacheAge = Date.now() - new Date(cachedResult.timestamp).getTime();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    return cacheAge < maxAge;
  }

  /**
   * Mask cache key for security in logs
   * @param {string} cacheKey - Original cache key
   * @returns {string} Masked cache key
   */
  maskCacheKey(cacheKey) {
    if (!cacheKey || cacheKey.length < 8) return '***';
    return `${cacheKey.substr(0, 4)}***${cacheKey.substr(-4)}`;
  }

  /**
   * Sanitize request data with enhanced security
   * @param {Object} requestData - Request data to sanitize
   * @returns {Object} Sanitized request data
   */
  sanitizeRequest(requestData) {
    const sanitized = {};
    
    // Sanitize input with enhanced security
    if (requestData.input) {
      sanitized.input = this.sanitizeText(requestData.input);
    }
    
    // Sanitize reasoning with enhanced security
    if (requestData.reasoning) {
      sanitized.reasoning = this.sanitizeText(requestData.reasoning);
    }
    
    // Sanitize output with enhanced security
    if (requestData.output) {
      sanitized.output = this.sanitizeText(requestData.output);
    }
    
    // Sanitize config with enhanced security
    if (requestData.config) {
      sanitized.config = this.sanitizeConfig(requestData.config);
    }
    
    // Add sanitization metadata
    sanitized._sanitized = true;
    sanitized._sanitizedAt = new Date().toISOString();
    
    return sanitized;
  }

  /**
   * Sanitize text with enhanced security
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeText(text) {
    if (!text || typeof text !== 'string') return '';
    
    return text
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/data:/gi, '') // Remove data: protocol
      .replace(/vbscript:/gi, '') // Remove vbscript: protocol
      .substring(0, 10000); // Limit length for security
  }

  /**
   * Sanitize config object with enhanced security
   * @param {Object} config - Config object to sanitize
   * @returns {Object} Sanitized config
   */
  sanitizeConfig(config) {
    if (!config || typeof config !== 'object') return {};
    
    const sanitized = {};
    
    // Sanitize numeric values
    if (typeof config.loanLimit === 'number') {
      sanitized.loanLimit = Math.max(0, Math.min(10000, config.loanLimit));
    }
    
    if (typeof config.minLoan === 'number') {
      sanitized.minLoan = Math.max(0, Math.min(1000, config.minLoan));
    }
    
    // Sanitize string values
    if (typeof config.sensitivityLevel === 'string') {
      const validLevels = ['discreet', 'balanced', 'aggressive'];
      sanitized.sensitivityLevel = validLevels.includes(config.sensitivityLevel) 
        ? config.sensitivityLevel 
        : 'balanced';
    }
    
    // Sanitize boolean values
    if (typeof config.aiEnabled === 'boolean') {
      sanitized.aiEnabled = config.aiEnabled;
    }
    
    // Sanitize business rules array
    if (Array.isArray(config.businessRules)) {
      sanitized.businessRules = config.businessRules
        .filter(rule => rule && typeof rule === 'object')
        .map(rule => ({
          id: this.sanitizeText(rule.id || ''),
          enabled: Boolean(rule.enabled),
          threshold: typeof rule.threshold === 'number' ? Math.max(0, rule.threshold) : 0
        }))
        .slice(0, 20); // Limit number of rules
    }
    
    return sanitized;
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
   * Perform scanner analysis using LLM Guard scanners
   * @param {Object} request - Request data
   * @returns {Promise<Object>} Scanner analysis results
   */
  async performScannerAnalysis(request) {
    try {
      const { input, reasoning, output } = request;
      
      // Run comprehensive scans on all content
      const inputScan = await this.scannerService.runComprehensiveScan(input || '');
      const reasoningScan = await this.scannerService.runComprehensiveScan(reasoning || '');
      const outputScan = await this.scannerService.runComprehensiveScan(output || '');

      // Analyze results for security issues
      const issues = [];
      let riskLevel = 'NONE';

      // Check for malicious URLs (critical security issue)
      if (inputScan.success && inputScan.maliciousUrls.riskLevel === 'HIGH') {
        issues.push(`Input contains malicious URLs`);
        riskLevel = 'HIGH';
      }
      if (reasoningScan.success && reasoningScan.maliciousUrls.riskLevel === 'HIGH') {
        issues.push(`Reasoning contains malicious URLs`);
        riskLevel = 'HIGH';
      }
      if (outputScan.success && outputScan.maliciousUrls.riskLevel === 'HIGH') {
        issues.push(`Output contains malicious URLs`);
        riskLevel = 'HIGH';
      }



      // Check for secrets exposure (critical security issue)
      if (inputScan.success && inputScan.secrets.riskLevel === 'HIGH') {
        issues.push('High-risk secrets detected in input');
        riskLevel = 'HIGH';
      }
      if (reasoningScan.success && reasoningScan.secrets.riskLevel === 'HIGH') {
        issues.push('High-risk secrets detected in reasoning');
        riskLevel = 'HIGH';
      }
      if (outputScan.success && outputScan.secrets.riskLevel === 'HIGH') {
        issues.push('High-risk secrets detected in output');
        riskLevel = 'HIGH';
      }

      // Check for code injection (critical security issue)
      if (inputScan.success && inputScan.codeInjection.injectionDetected) {
        issues.push('Code injection detected in input');
        riskLevel = 'HIGH';
      }
      if (reasoningScan.success && reasoningScan.codeInjection.injectionDetected) {
        issues.push('Code injection detected in reasoning');
        riskLevel = 'HIGH';
      }
      if (outputScan.success && outputScan.codeInjection.injectionDetected) {
        issues.push('Code injection detected in output');
        riskLevel = 'HIGH';
      }

      // Determine verdict based on scanner results
      let verdict = 'CONFIRM';
      let reasonCode = 'BOUNDARY';
      let action = 'ALLOW';

      if (riskLevel === 'HIGH') {
        verdict = 'OVERRIDE';
        reasonCode = 'SECURITY';
        action = 'BLOCK';
      } else if (riskLevel === 'LOW') {
        reasonCode = 'SECURITY';
        action = 'ESCALATE';
      }

      return {
        success: true,
        data: {
          verdict,
          reasonCode,
          action,
          evidence: issues,
          riskLevel,
          scans: {
            input: inputScan,
            reasoning: reasoningScan,
            output: outputScan
          }
        }
      };
    } catch (error) {
      logger.error('Scanner analysis failed', { error: error.message });
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
   * @param {Object} scannerAnalysis - Scanner analysis results
   * @param {Object} requestData - Original request data for context
   * @returns {Object} Combined results
   */
  combineResults(businessRules, agenticAnalysis, aiAnalysis, scannerAnalysis, requestData) {
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

    // Agentic analysis - handles both supporting rejections and overriding approvals
    if (agenticAnalysis.success && agenticAnalysis.data) {
      const aa = agenticAnalysis.data;
      
      // Check if this is a medical emergency scenario
      const requestText = `${requestData.input || ''} ${requestData.reasoning || ''} ${requestData.output || ''}`.toLowerCase();
      const medicalTerms = ['emergency', 'medical', 'dental', 'surgery', 'infection', 'pain', 'doctor', 'hospital'];
      const medicalContextTerms = ['treatment', 'medical treatment', 'dental treatment', 'surgery', 'infection', 'pain', 'doctor', 'hospital'];
      const isMedicalEmergency = medicalTerms.some(term => requestText.includes(term)) && 
                                medicalContextTerms.some(term => requestText.includes(term));
      
      // Check if the output indicates a rejection
      const outputText = requestData.output || '';
      const isRejection = outputText.toLowerCase().includes('reject') || 
                          outputText.toLowerCase().includes('deny') || 
                          outputText.toLowerCase().includes('block');
      
      // Handle agentic analysis verdict
      if (aa.verdict && aa.verdict === 'OVERRIDE') {
        // For medical emergencies, be extremely conservative about overriding
        if (!isMedicalEmergency) {
          finalVerdict = 'OVERRIDE';
          finalReasonCode = aa.reasonCode || 'SECURITY';
          finalAction = aa.action || 'BLOCK';
        } else {
          // For medical emergencies, only override for clear technical threats, not emotional manipulation
          if (aa.reasonCode === 'TECHNICAL' || aa.evidence.some(e => e.includes('TECHNICAL'))) {
            finalVerdict = 'OVERRIDE';
            finalReasonCode = aa.reasonCode || 'SECURITY';
            finalAction = aa.action || 'BLOCK';
          } else {
            // For medical emergencies with emotional manipulation, just note it but don't override
            finalEvidence.push(`Note: ${aa.evidence.join(', ')} (medical emergency context - not escalated)`);
          }
        }
      } else if (aa.verdict && aa.verdict === 'CONFIRM' && isRejection) {
        // If agentic analysis confirms a rejection, support it
        finalVerdict = 'CONFIRM';
        finalReasonCode = 'AGENTIC_SUPPORT';
        finalAction = 'BLOCK';
        finalEvidence.push('AGENTIC: Second-line analysis confirms rejection decision');
      }
      
      if (aa.evidence && aa.evidence.length > 0) {
        if (isMedicalEmergency) {
          // For medical emergencies, prefix the evidence to indicate context
          finalEvidence.push(...aa.evidence.map(evidence => `Medical context: ${evidence}`));
        } else {
          finalEvidence.push(...aa.evidence);
        }
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

    // Scanner analysis (security-focused, high priority)
    if (scannerAnalysis.success && scannerAnalysis.data) {
      const scanner = scannerAnalysis.data;
      if (scanner.verdict === 'OVERRIDE' && finalVerdict !== 'OVERRIDE') {
        finalVerdict = 'OVERRIDE';
        finalReasonCode = scanner.reasonCode;
        finalAction = scanner.action;
      }
      if (scanner.evidence && scanner.evidence.length > 0) {
        finalEvidence.push(...scanner.evidence);
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
        aiAnalysis: aiAnalysis.success ? aiAnalysis.data : null,
        scannerAnalysis: scannerAnalysis.success ? scannerAnalysis.data : null
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
        patternsCount: this.agenticAnalysisService.manipulationPatterns.length + 
                      this.agenticAnalysisService.politicalManipulationPatterns.length +
                      this.agenticAnalysisService.jailbreakPatterns.length
      },
      aiAnalysis: {
        enabled: this.aiAnalysisService.isEnabled(),
        status: this.aiAnalysisService.getStatus()
      },
      scannerAnalysis: {
        enabled: true,
        scanners: ['ReadingTime', 'JSONValidation', 'URLReachability', 'MaliciousURLs']
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