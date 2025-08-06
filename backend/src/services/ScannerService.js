/**
 * Scanner Service
 * Implements LLM Guard scanners for comprehensive security validation
 * Based on protectai/llm-guard library functionality
 */

const axios = require('axios');
const logger = require('../utils/logger');

class ScannerService {
  constructor() {
    this.maliciousUrlPatterns = [
      // Common malicious URL patterns
      /bit\.ly|tinyurl\.com|goo\.gl|t\.co|is\.gd|v\.gd|cli\.gs|ow\.ly|su\.pr|twurl\.nl|snipurl\.com|short\.to|BudURL\.com|ping\.fm|tr\.im|zip\.my|MetaURI\.com|sn\.im|short\.ie|kl\.am|wp\.me|rubyurl\.com|om\.ly|to\.ly|bit\.do|t\.co|lnkd\.in|db\.tt|qr\.ae|adf\.ly|goo\.gl|bitly\.com|cur\.lv|tiny\.cc|ow\.ly|bit\.ly|ity\.im|q\.gs|is\.gd|po\.st|bc\.vc|twitthis\.com|u\.to|j\.mp|buzurl\.com|cutt\.us|u\.bb|yourls\.org|x\.co|prettylinkpro\.com|scrnch\.me|filoops\.info|vzturl\.com|qr\.net|1url\.com|tweez\.me|v\.gd|tr\.im|link\.zip\.net/i,
      // Suspicious domains
      /(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}/g,
      // IP addresses (potential malicious redirects)
      /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g
    ];

    this.suspiciousKeywords = [
      'malware', 'virus', 'phishing', 'scam', 'hack', 'exploit',
      'crypto', 'bitcoin', 'wallet', 'password', 'login', 'bank',
      'paypal', 'credit', 'card', 'social', 'security', 'ssn'
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

      // Average reading speed: 200-250 words per minute
      const wordsPerMinute = 225;
      const words = content.trim().split(/\s+/).length;
      const readingTimeMinutes = words / wordsPerMinute;
      const readingTimeSeconds = Math.round(readingTimeMinutes * 60);

      return {
        success: true,
        readingTime: readingTimeSeconds,
        readingTimeMinutes: Math.round(readingTimeMinutes * 10) / 10,
        wordCount: words,
        complexity: this.assessComplexity(content)
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
   * @param {string} content - Text content
   * @returns {string} Complexity level
   */
  assessComplexity(content) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const avgWordsPerSentence = words.length / sentences.length;
    
    if (avgWordsPerSentence > 25) return 'HIGH';
    if (avgWordsPerSentence > 15) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Validate JSON structure and content
   * @param {string} content - JSON string to validate
   * @returns {Object} JSON validation results
   */
  validateJSON(content) {
    try {
      if (!content || typeof content !== 'string') {
        return {
          success: false,
          error: 'Invalid content provided',
          isValid: false,
          issues: ['Content is not a string']
        };
      }

      const issues = [];
      let parsedJson = null;

      // Try to parse JSON
      try {
        parsedJson = JSON.parse(content);
      } catch (parseError) {
        return {
          success: true,
          isValid: false,
          issues: [`JSON parsing failed: ${parseError.message}`],
          parsedJson: null
        };
      }

      // Check for common JSON security issues
      if (typeof parsedJson === 'object' && parsedJson !== null) {
        // Check for circular references
        const seen = new WeakSet();
        const hasCircularRefs = this.checkCircularReferences(parsedJson, seen);
        if (hasCircularRefs) {
          issues.push('Circular references detected');
        }

        // Check for suspicious keys
        const suspiciousKeys = this.findSuspiciousKeys(parsedJson);
        if (suspiciousKeys.length > 0) {
          issues.push(`Suspicious keys found: ${suspiciousKeys.join(', ')}`);
        }

        // Check for large objects
        const size = JSON.stringify(parsedJson).length;
        if (size > 1000000) { // 1MB limit
          issues.push('JSON object is too large (>1MB)');
        }
      }

      return {
        success: true,
        isValid: issues.length === 0,
        issues,
        parsedJson,
        size: JSON.stringify(parsedJson).length
      };
    } catch (error) {
      logger.error('JSON validation failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        isValid: false,
        issues: [error.message]
      };
    }
  }

  /**
   * Check for circular references in objects
   * @param {Object} obj - Object to check
   * @param {WeakSet} seen - Set of seen objects
   * @returns {boolean} True if circular references found
   */
  checkCircularReferences(obj, seen = new WeakSet()) {
    if (obj !== null && typeof obj === 'object') {
      if (seen.has(obj)) {
        return true;
      }
      seen.add(obj);
      
      for (const key in obj) {
        if (this.checkCircularReferences(obj[key], seen)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Find suspicious keys in JSON objects
   * @param {Object} obj - Object to analyze
   * @returns {Array} Array of suspicious keys
   */
  findSuspiciousKeys(obj, path = '') {
    const suspicious = [];
    
    if (obj !== null && typeof obj === 'object') {
      for (const key in obj) {
        const currentPath = path ? `${path}.${key}` : key;
        
        // Check if key is suspicious
        if (this.suspiciousKeywords.some(keyword => 
          key.toLowerCase().includes(keyword.toLowerCase())
        )) {
          suspicious.push(currentPath);
        }
        
        // Recursively check nested objects
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          suspicious.push(...this.findSuspiciousKeys(obj[key], currentPath));
        }
      }
    }
    
    return suspicious;
  }

  /**
   * Check URL reachability
   * @param {string} url - URL to check
   * @returns {Object} URL reachability results
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
      try {
        new URL(url);
      } catch (urlError) {
        return {
          success: true,
          isReachable: false,
          error: 'Invalid URL format',
          statusCode: null,
          responseTime: null
        };
      }

      const startTime = Date.now();
      
      try {
        const response = await axios.head(url, {
          timeout: 10000, // 10 second timeout
          maxRedirects: 5,
          validateStatus: () => true // Don't throw on any status code
        });

        const responseTime = Date.now() - startTime;
        const isReachable = response.status >= 200 && response.status < 400;

        return {
          success: true,
          isReachable,
          statusCode: response.status,
          responseTime,
          headers: response.headers,
          finalUrl: response.request?.res?.responseUrl || url
        };
      } catch (requestError) {
        const responseTime = Date.now() - startTime;
        
        return {
          success: true,
          isReachable: false,
          error: requestError.message,
          statusCode: requestError.response?.status || null,
          responseTime
        };
      }
    } catch (error) {
      logger.error('URL reachability check failed', { url, error: error.message });
      return {
        success: false,
        error: error.message,
        isReachable: false,
        statusCode: null,
        responseTime: null
      };
    }
  }

  /**
   * Detect malicious URLs
   * @param {string} content - Content to scan for URLs
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
          totalUrls: 0
        };
      }

      const maliciousUrls = [];
      const suspiciousUrls = [];
      
      // Extract URLs from content
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = content.match(urlRegex) || [];
      
      urls.forEach(url => {
        const isMalicious = this.isMaliciousURL(url);
        const isSuspicious = this.isSuspiciousURL(url);
        
        if (isMalicious) {
          maliciousUrls.push({
            url,
            reason: 'Matches malicious URL pattern',
            confidence: 'HIGH'
          });
        } else if (isSuspicious) {
          suspiciousUrls.push({
            url,
            reason: 'Suspicious URL characteristics',
            confidence: 'MEDIUM'
          });
        }
      });

      return {
        success: true,
        maliciousUrls,
        suspiciousUrls,
        totalUrls: urls.length,
        riskLevel: this.calculateRiskLevel(maliciousUrls.length, suspiciousUrls.length)
      };
    } catch (error) {
      logger.error('Malicious URL detection failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        maliciousUrls: [],
        suspiciousUrls: [],
        totalUrls: 0
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
      const urlObj = new URL(url);
      
      // Check against malicious patterns
      for (const pattern of this.maliciousUrlPatterns) {
        if (pattern.test(url)) {
          return true;
        }
      }
      
      // Check for suspicious keywords in URL
      const urlLower = url.toLowerCase();
      if (this.suspiciousKeywords.some(keyword => urlLower.includes(keyword))) {
        return true;
      }
      
      return false;
    } catch (error) {
      return true; // Invalid URLs are considered suspicious
    }
  }

  /**
   * Check if URL is suspicious
   * @param {string} url - URL to check
   * @returns {boolean} True if suspicious
   */
  isSuspiciousURL(url) {
    try {
      const urlObj = new URL(url);
      
      // Check for suspicious characteristics
      const suspicious = [
        urlObj.hostname.includes('bit.ly'),
        urlObj.hostname.includes('tinyurl'),
        urlObj.hostname.includes('goo.gl'),
        urlObj.pathname.length > 100, // Very long paths
        urlObj.search.length > 200, // Very long query strings
        urlObj.hostname.split('.').length > 4 // Too many subdomains
      ];
      
      return suspicious.some(Boolean);
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate overall risk level
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
   * Run comprehensive scan on content
   * @param {string} content - Content to scan
   * @returns {Object} Comprehensive scan results
   */
  async runComprehensiveScan(content) {
    const results = {
      readingTime: this.calculateReadingTime(content),
      jsonValidation: this.validateJSON(content),
      maliciousUrls: this.detectMaliciousURLs(content),
      urlReachability: null
    };

    // Check URL reachability for any URLs found
    const urls = content.match(/(https?:\/\/[^\s]+)/g) || [];
    if (urls.length > 0) {
      // Check first URL as sample (to avoid too many requests)
      results.urlReachability = await this.checkURLReachability(urls[0]);
    }

    return results;
  }
}

module.exports = ScannerService; 