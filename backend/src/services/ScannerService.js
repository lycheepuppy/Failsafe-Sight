/**
 * Scanner Service
 * Implements LLM Guard scanners for comprehensive security validation
 * Focused on deterministic checks for sensitive areas only
 */

const axios = require('axios');
const logger = require('../utils/logger');

class ScannerService {
  constructor() {
    // Only keep deterministic patterns for critical security checks
    this.maliciousUrlPatterns = [
      // Common malicious URL patterns
      /bit\.ly|tinyurl\.com|goo\.gl|t\.co|is\.gd|v\.gd|cli\.gs|ow\.ly|su\.pr|twurl\.nl|snipurl\.com|short\.to|BudURL\.com|ping\.fm|tr\.im|zip\.my|MetaURI\.com|sn\.im|short\.ie|kl\.am|wp\.me|rubyurl\.com|om\.ly|to\.ly|bit\.do|t\.co|lnkd\.in|db\.tt|qr\.ae|adf\.ly|goo\.gl|bitly\.com|cur\.lv|tiny\.cc|ow\.ly|bit\.ly|ity\.im|q\.gs|is\.gd|po\.st|bc\.vc|twitthis\.com|u\.to|j\.mp|buzurl\.com|cutt\.us|u\.bb|yourls\.org|x\.co|prettylinkpro\.com|scrnch\.me|filoops\.info|vzturl\.com|qr\.net|1url\.com|tweez\.me|v\.gd|tr\.im|link\.zip\.net/i,
      // IP addresses (potential malicious redirects)
      /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g
    ];

    // Only keep high-confidence secrets patterns
    this.secretPatterns = {
      apiKeys: [
        /sk-[a-zA-Z0-9]{24,}|pk-[a-zA-Z0-9]{24,}/i,
        /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{32,}['"]/i
      ],
      passwords: [
        /password\s*[:=]\s*['"][^'"]{8,}['"]/i,
        /passwd\s*[:=]\s*['"][^'"]{8,}['"]/i
      ],
      tokens: [
        /token\s*[:=]\s*['"][a-zA-Z0-9]{32,}['"]/i,
        /access[_-]?token\s*[:=]\s*['"][a-zA-Z0-9]{32,}['"]/i,
        /bearer\s+[a-zA-Z0-9]{32,}/i
      ],
      creditCards: [
        /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/i
      ],
      ssn: [
        /\b\d{3}-\d{2}-\d{4}\b/i
      ]
    };

    // Only keep actual code injection patterns (not common words)
    this.codeInjectionPatterns = [
      // Actual code constructs
      /<script[^>]*>.*<\/script>/is,
      /<\?php.*\?>/is,
      /<%.*%>/is,
      /javascript:/i,
      /data:text\/html/i,
      /vbscript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /document\.write\s*\(/i,
      /innerHTML\s*=/i,
      /outerHTML\s*=/i
    ];
  }

  /**
   * Calculate reading time for content
   * @param {string} content - Text content to analyze
   * @returns {Object} Reading time analysis
   */
  calculateReadingTime(content) {
    try {
      if (!content || typeof content !== 'string') {
        return {
          success: false,
          error: 'Invalid content provided',
          readingTime: 0,
          wordCount: 0
        };
      }

      const words = content.trim().split(/\s+/).filter(word => word.length > 0);
      const wordCount = words.length;
      const wordsPerMinute = 200; // Average reading speed
      const readingTime = Math.ceil(wordCount / wordsPerMinute);

      return {
        success: true,
        readingTime,
        wordCount,
        wordsPerMinute
      };
    } catch (error) {
      logger.error('Reading time calculation failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        readingTime: 0,
        wordCount: 0
      };
    }
  }

  /**
   * Assess content complexity
   * @param {string} content - Text content to analyze
   * @returns {Object} Complexity analysis
   */
  assessComplexity(content) {
    try {
      if (!content || typeof content !== 'string') {
        return {
          success: false,
          error: 'Invalid content provided',
          complexity: 'LOW',
          score: 0
        };
      }

      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const words = content.split(/\s+/).filter(w => w.length > 0);
      const avgWordsPerSentence = words.length / sentences.length;

      let complexity = 'LOW';
      let score = 0;

      if (avgWordsPerSentence > 20) {
        complexity = 'HIGH';
        score = 80;
      } else if (avgWordsPerSentence > 15) {
        complexity = 'MEDIUM';
        score = 50;
      } else {
        complexity = 'LOW';
        score = 20;
      }

      return {
        success: true,
        complexity,
        score,
        avgWordsPerSentence: Math.round(avgWordsPerSentence * 100) / 100,
        sentenceCount: sentences.length,
        wordCount: words.length
      };
    } catch (error) {
      logger.error('Complexity assessment failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        complexity: 'LOW',
        score: 0
      };
    }
  }

  /**
   * Validate JSON format (simplified - only check if it's valid JSON)
   * @param {string} content - Content to validate
   * @returns {Object} JSON validation results
   */
  validateJSON(content) {
    try {
      if (!content || typeof content !== 'string') {
        return {
          success: false,
          error: 'Invalid content provided',
          isValid: false,
          errorDetails: 'No content provided'
        };
      }

      // Only validate if content looks like JSON (starts with { or [)
      const trimmed = content.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return {
          success: true,
          isValid: false,
          errorDetails: 'Content is not JSON format',
          isJsonLike: false
        };
      }

      // Try to parse as JSON
      JSON.parse(trimmed);
      
      return {
        success: true,
        isValid: true,
        errorDetails: null,
        isJsonLike: true
      };
    } catch (error) {
      return {
        success: true,
        isValid: false,
        errorDetails: error.message,
        isJsonLike: true
      };
    }
  }

  /**
   * Check URL reachability
   * @param {string} url - URL to check
   * @returns {Promise<Object>} URL reachability results
   */
  async checkURLReachability(url) {
    try {
      if (!url || typeof url !== 'string') {
        return {
          success: false,
          error: 'Invalid URL provided',
          isReachable: false,
          statusCode: null,
          responseTime: null
        };
      }

      // Basic URL validation
      const urlPattern = /^https?:\/\/.+/i;
      if (!urlPattern.test(url)) {
        return {
          success: false,
          error: 'Invalid URL format',
          isReachable: false,
          statusCode: null,
          responseTime: null
        };
      }

      const startTime = Date.now();
      const response = await axios.get(url, {
        timeout: 5000,
        maxRedirects: 3,
        validateStatus: () => true // Accept all status codes
      });
      const responseTime = Date.now() - startTime;

      const isReachable = response.status >= 200 && response.status < 400;

      return {
        success: true,
        isReachable,
        statusCode: response.status,
        responseTime,
        url: url
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        isReachable: false,
        statusCode: null,
        responseTime: null,
        url: url
      };
    }
  }

  /**
   * Detect malicious URLs in content
   * @param {string} content - Content to analyze
   * @returns {Object} Malicious URL detection results
   */
  detectMaliciousURLs(content) {
    try {
      if (!content || typeof content !== 'string') {
        return {
          success: false,
          error: 'Invalid content provided',
          maliciousUrls: [],
          suspiciousUrls: [],
          riskLevel: 'NONE'
        };
      }

      const maliciousUrls = [];
      const suspiciousUrls = [];

      // Extract URLs from content
      const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
      const urls = content.match(urlPattern) || [];

      for (const url of urls) {
        if (this.isMaliciousURL(url)) {
          maliciousUrls.push(url);
        } else if (this.isSuspiciousURL(url)) {
          suspiciousUrls.push(url);
        }
      }

      const riskLevel = this.calculateRiskLevel(maliciousUrls.length, suspiciousUrls.length);

      return {
        success: true,
        maliciousUrls,
        suspiciousUrls,
        riskLevel,
        totalUrls: urls.length
      };
    } catch (error) {
      logger.error('Malicious URL detection failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        maliciousUrls: [],
        suspiciousUrls: [],
        riskLevel: 'NONE'
      };
    }
  }

  /**
   * Check if URL is malicious
   * @param {string} url - URL to check
   * @returns {boolean} True if malicious
   */
  isMaliciousURL(url) {
    try {
      // Check against known malicious patterns
      return this.maliciousUrlPatterns.some(pattern => pattern.test(url));
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if URL is suspicious
   * @param {string} url - URL to check
   * @returns {boolean} True if suspicious
   */
  isSuspiciousURL(url) {
    try {
      // Check for IP addresses (potential malicious redirects)
      const ipPattern = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/;
      return ipPattern.test(url);
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate risk level based on malicious and suspicious URLs
   * @param {number} maliciousCount - Number of malicious URLs
   * @param {number} suspiciousCount - Number of suspicious URLs
   * @returns {string} Risk level
   */
  calculateRiskLevel(maliciousCount, suspiciousCount) {
    if (maliciousCount > 0) return 'HIGH';
    if (suspiciousCount > 2) return 'MEDIUM';
    if (suspiciousCount > 0) return 'LOW';
    return 'NONE';
  }

  /**
   * Detect secrets and sensitive information (deterministic only)
   * @param {string} content - Content to analyze
   * @returns {Object} Secrets detection results
   */
  detectSecrets(content) {
    try {
      if (!content || typeof content !== 'string') {
        return {
          success: false,
          error: 'Invalid content provided',
          secretsDetected: false,
          secretTypes: [],
          riskLevel: 'NONE'
        };
      }

      const secretTypes = [];
      let totalSecrets = 0;

      for (const [type, patterns] of Object.entries(this.secretPatterns)) {
        let typeMatches = 0;
        const foundSecrets = [];
        
        for (const pattern of patterns) {
          const matches = content.match(pattern);
          if (matches) {
            typeMatches += matches.length;
            totalSecrets += matches.length;
            
            // Add first few matches as examples (sanitized)
            matches.slice(0, 2).forEach(match => {
              foundSecrets.push(this.sanitizeSecret(match));
            });
          }
        }

        if (typeMatches > 0) {
          secretTypes.push({
            type,
            count: typeMatches,
            examples: foundSecrets,
            riskLevel: this.getSecretRiskLevel(type)
          });
        }
      }

      const secretsDetected = secretTypes.length > 0;
      const riskLevel = secretsDetected ? 
        this.getHighestRiskLevel(secretTypes.map(s => s.riskLevel)) : 'NONE';

      return {
        success: true,
        secretsDetected,
        secretTypes,
        riskLevel,
        totalSecrets
      };
    } catch (error) {
      logger.error('Secrets detection failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        secretsDetected: false,
        secretTypes: [],
        riskLevel: 'NONE'
      };
    }
  }

  /**
   * Sanitize secret for display
   * @param {string} secret - Secret to sanitize
   * @returns {string} Sanitized secret
   */
  sanitizeSecret(secret) {
    if (!secret || secret.length < 8) return '***';
    return secret.substring(0, 4) + '***' + secret.substring(secret.length - 4);
  }

  /**
   * Get risk level for secret type
   * @param {string} type - Secret type
   * @returns {string} Risk level
   */
  getSecretRiskLevel(type) {
    const riskLevels = {
      apiKeys: 'HIGH',
      passwords: 'HIGH',
      tokens: 'HIGH',
      creditCards: 'HIGH',
      ssn: 'HIGH'
    };
    return riskLevels[type] || 'MEDIUM';
  }

  /**
   * Get highest risk level from array
   * @param {Array} riskLevels - Array of risk levels
   * @returns {string} Highest risk level
   */
  getHighestRiskLevel(riskLevels) {
    const levels = { 'NONE': 0, 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 };
    return riskLevels.reduce((highest, current) => 
      levels[current] > levels[highest] ? current : highest, 'NONE');
  }

  /**
   * Detect code injection attempts (deterministic only)
   * @param {string} content - Content to analyze
   * @returns {Object} Code injection detection results
   */
  detectCodeInjection(content) {
    try {
      if (!content || typeof content !== 'string') {
        return {
          success: false,
          error: 'Invalid content provided',
          injectionDetected: false,
          injectionTypes: [],
          confidence: 0
        };
      }

      const injectionTypes = [];
      let totalMatches = 0;

      for (const pattern of this.codeInjectionPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          totalMatches += matches.length;
          injectionTypes.push({
            pattern: pattern.toString(),
            matches: matches.length,
            confidence: 90 // High confidence for actual code injection patterns
          });
        }
      }

      const injectionDetected = injectionTypes.length > 0;
      const confidence = injectionDetected ? 90 : 0;

      return {
        success: true,
        injectionDetected,
        injectionTypes,
        confidence,
        totalMatches
      };
    } catch (error) {
      logger.error('Code injection detection failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        injectionDetected: false,
        injectionTypes: [],
        confidence: 0
      };
    }
  }

  /**
   * Run comprehensive security scan (simplified)
   * @param {string} content - Content to scan
   * @returns {Promise<Object>} Comprehensive scan results
   */
  async runComprehensiveScan(content) {
    try {
      if (!content || typeof content !== 'string') {
        return {
          success: false,
          error: 'Invalid content provided'
        };
      }

      // Run only deterministic checks
      const readingTime = this.calculateReadingTime(content);
      const complexity = this.assessComplexity(content);
      const maliciousUrls = this.detectMaliciousURLs(content);
      const secrets = this.detectSecrets(content);
      const codeInjection = this.detectCodeInjection(content);

      // Determine overall risk level
      const riskFactors = [];
      let overallRisk = 'NONE';

      if (maliciousUrls.success && maliciousUrls.riskLevel !== 'NONE') {
        riskFactors.push(`Malicious URLs: ${maliciousUrls.riskLevel}`);
        if (maliciousUrls.riskLevel === 'HIGH') overallRisk = 'HIGH';
      }

      if (secrets.success && secrets.riskLevel !== 'NONE') {
        riskFactors.push(`Secrets detected: ${secrets.riskLevel}`);
        if (secrets.riskLevel === 'HIGH') overallRisk = 'HIGH';
      }

      if (codeInjection.success && codeInjection.injectionDetected) {
        riskFactors.push('Code injection detected');
        overallRisk = 'HIGH';
      }

      if (overallRisk === 'NONE' && riskFactors.length > 0) {
        overallRisk = 'LOW';
      }

      return {
        success: true,
        readingTime,
        complexity,
        maliciousUrls,
        secrets,
        codeInjection,
        riskFactors,
        overallRisk,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Comprehensive scan failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ScannerService; 