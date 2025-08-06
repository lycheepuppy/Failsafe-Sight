/**
 * Scanner Service
 * Implements LLM Guard scanners for comprehensive security validation
 * Based on protectai/llm-guard library functionality
 */

const axios = require('axios');
const logger = require('../utils/logger');
const natural = require('natural');
const compromise = require('compromise');
const sentiment = require('sentiment');
const ProfanityFilter = require('profanity-filter');

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

    // Initialize profanity filter
    this.profanityFilter = ProfanityFilter;
    
    // Bias detection patterns
    this.biasPatterns = {
      gender: [
        /he\s+should|she\s+should|men\s+are|women\s+are|male\s+vs\s+female|gender\s+roles/i,
        /stereotypical|traditional\s+roles|masculine|feminine|patriarchal/i
      ],
      racial: [
        /race\s+based|ethnic\s+background|cultural\s+stereotypes|racial\s+profiling/i,
        /white\s+vs\s+black|asian\s+vs\s+hispanic|minority\s+groups/i
      ],
      age: [
        /young\s+people\s+are|old\s+people\s+are|millennials\s+vs\s+boomers/i,
        /age\s+discrimination|generational\s+differences/i
      ],
      socioeconomic: [
        /rich\s+vs\s+poor|wealthy\s+vs\s+poor|upper\s+class|lower\s+class/i,
        /socioeconomic\s+status|education\s+level/i
      ]
    };

    // Code detection patterns
    this.codePatterns = [
      /function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=/i,
      /if\s*\(|for\s*\(|while\s*\(|switch\s*\(|try\s*\{/i,
      /import\s+|export\s+|require\s*\(|module\.exports/i,
      /class\s+\w+|interface\s+\w+|enum\s+\w+/i,
      /console\.log|debugger|breakpoint/i,
      /<script>|<\/script>|<php|<%|<%=/i,
      /SELECT\s+.*\s+FROM|INSERT\s+INTO|UPDATE\s+.*\s+SET|DELETE\s+FROM/i
    ];

    // Secrets detection patterns
    this.secretPatterns = {
      apiKeys: [
        /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/i,
        /sk-[a-zA-Z0-9]{24,}|pk-[a-zA-Z0-9]{24,}/i,
        /[a-zA-Z0-9]{32,}/i
      ],
      passwords: [
        /password\s*[:=]\s*['"][^'"]{8,}['"]/i,
        /passwd\s*[:=]\s*['"][^'"]{8,}['"]/i,
        /pwd\s*[:=]\s*['"][^'"]{8,}['"]/i
      ],
      tokens: [
        /token\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/i,
        /access[_-]?token\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/i,
        /bearer\s+[a-zA-Z0-9]{20,}/i
      ],
      emails: [
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i
      ],
      creditCards: [
        /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/i
      ],
      ssn: [
        /\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b/i
      ]
    };
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
   * Detect bias in content
   * @param {string} content - Content to analyze
   * @returns {Object} Bias detection results
   */
  detectBias(content) {
    try {
      if (!content || typeof content !== 'string') {
        return {
          success: false,
          error: 'Invalid content provided',
          biasDetected: false,
          biasTypes: [],
          confidence: 0
        };
      }

      const biasTypes = [];
      let totalMatches = 0;

      // Check each bias category
      for (const [category, patterns] of Object.entries(this.biasPatterns)) {
        let categoryMatches = 0;
        
        for (const pattern of patterns) {
          const matches = content.match(pattern);
          if (matches) {
            categoryMatches += matches.length;
            totalMatches += matches.length;
          }
        }

        if (categoryMatches > 0) {
          biasTypes.push({
            type: category,
            matches: categoryMatches,
            examples: this.extractBiasExamples(content, patterns)
          });
        }
      }

      const confidence = Math.min(totalMatches * 10, 100);
      const biasDetected = biasTypes.length > 0;

      return {
        success: true,
        biasDetected,
        biasTypes,
        confidence,
        totalMatches
      };
    } catch (error) {
      logger.error('Bias detection failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        biasDetected: false,
        biasTypes: [],
        confidence: 0
      };
    }
  }

  /**
   * Extract bias examples from content
   * @param {string} content - Content to analyze
   * @param {Array} patterns - Patterns to match
   * @returns {Array} Examples found
   */
  extractBiasExamples(content, patterns) {
    const examples = [];
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        examples.push(...matches.slice(0, 3)); // Limit to 3 examples
      }
    }
    return examples;
  }

  /**
   * Detect toxicity in content
   * @param {string} content - Content to analyze
   * @returns {Object} Toxicity detection results
   */
  detectToxicity(content) {
    try {
      if (!content || typeof content !== 'string') {
        return {
          success: false,
          error: 'Invalid content provided',
          toxicityScore: 0,
          isToxic: false,
          profanityCount: 0
        };
      }

      // Use sentiment analysis
      const sentimentResult = new sentiment();
      const analysis = sentimentResult.analyze(content);

      // Check for profanity
      const profanityResult = this.profanityFilter.clean(content);
      const profanityCount = content !== profanityResult ? 1 : 0;

      // Calculate toxicity score (0-100)
      let toxicityScore = 0;
      
      // Negative sentiment contributes to toxicity
      if (analysis.score < 0) {
        toxicityScore += Math.abs(analysis.score) * 10;
      }

      // Profanity contributes to toxicity
      toxicityScore += profanityCount * 15;

      // Cap at 100
      toxicityScore = Math.min(toxicityScore, 100);

      const isToxic = toxicityScore > 30;

      return {
        success: true,
        toxicityScore: Math.round(toxicityScore),
        isToxic,
        profanityCount,
        sentimentScore: analysis.score,
        negativeWords: analysis.negative,
        positiveWords: analysis.positive
      };
    } catch (error) {
      logger.error('Toxicity detection failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        toxicityScore: 0,
        isToxic: false,
        profanityCount: 0
      };
    }
  }

  /**
   * Detect code in content
   * @param {string} content - Content to analyze
   * @returns {Object} Code detection results
   */
  detectCode(content) {
    try {
      if (!content || typeof content !== 'string') {
        return {
          success: false,
          error: 'Invalid content provided',
          codeDetected: false,
          codeTypes: [],
          confidence: 0
        };
      }

      const codeTypes = [];
      let totalMatches = 0;

      // Check for programming language patterns
      const languagePatterns = {
        javascript: [
          /function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=/i,
          /if\s*\(|for\s*\(|while\s*\(|switch\s*\(|try\s*\{/i,
          /import\s+|export\s+|require\s*\(|module\.exports/i,
          /console\.log|debugger|breakpoint/i
        ],
        python: [
          /def\s+\w+\s*\(|import\s+\w+|from\s+\w+\s+import/i,
          /if\s+.*:|for\s+.*:|while\s+.*:|try:|except:/i,
          /print\s*\(|return\s+|class\s+\w+/i
        ],
        sql: [
          /SELECT\s+.*\s+FROM|INSERT\s+INTO|UPDATE\s+.*\s+SET|DELETE\s+FROM/i,
          /WHERE\s+|GROUP\s+BY|ORDER\s+BY|JOIN\s+/i
        ],
        html: [
          /<[^>]+>|<\/[^>]+>|<[^>]+\/>/i,
          /<!DOCTYPE|html>|head>|body>|div>|span>/i
        ],
        php: [
          /<\?php|\?>|<%|<%=/i,
          /\$[a-zA-Z_][a-zA-Z0-9_]*\s*=/i
        ]
      };

      for (const [language, patterns] of Object.entries(languagePatterns)) {
        let languageMatches = 0;
        
        for (const pattern of patterns) {
          const matches = content.match(pattern);
          if (matches) {
            languageMatches += matches.length;
            totalMatches += matches.length;
          }
        }

        if (languageMatches > 0) {
          codeTypes.push({
            language,
            matches: languageMatches,
            confidence: Math.min(languageMatches * 20, 100)
          });
        }
      }

      const codeDetected = codeTypes.length > 0;
      const confidence = codeDetected ? Math.min(totalMatches * 15, 100) : 0;

      return {
        success: true,
        codeDetected,
        codeTypes,
        confidence,
        totalMatches
      };
    } catch (error) {
      logger.error('Code detection failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        codeDetected: false,
        codeTypes: [],
        confidence: 0
      };
    }
  }

  /**
   * Detect secrets and sensitive information
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
            examples: foundSecrets
          });
        }
      }

      const secretsDetected = secretTypes.length > 0;
      let riskLevel = 'NONE';
      
      if (totalSecrets > 5) riskLevel = 'HIGH';
      else if (totalSecrets > 2) riskLevel = 'MEDIUM';
      else if (totalSecrets > 0) riskLevel = 'LOW';

      return {
        success: true,
        secretsDetected,
        secretTypes,
        totalSecrets,
        riskLevel
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
   * Sanitize secret for display (hide sensitive parts)
   * @param {string} secret - Secret to sanitize
   * @returns {string} Sanitized secret
   */
  sanitizeSecret(secret) {
    if (secret.length <= 8) {
      return '*'.repeat(secret.length);
    }
    
    const visibleChars = Math.min(4, Math.floor(secret.length * 0.2));
    const hiddenChars = secret.length - visibleChars;
    
    return secret.substring(0, visibleChars) + '*'.repeat(hiddenChars);
  }

  /**
   * Detect language of content
   * @param {string} content - Content to analyze
   * @returns {Object} Language detection results
   */
  detectLanguage(content) {
    try {
      if (!content || typeof content !== 'string') {
        return {
          success: false,
          error: 'Invalid content provided',
          detectedLanguage: 'unknown',
          confidence: 0
        };
      }

      // Simple language detection based on common patterns
      const languagePatterns = {
        english: /[a-zA-Z]/g,
        spanish: /[áéíóúñü]/gi,
        french: /[àâäéèêëïîôöùûüÿç]/gi,
        german: /[äöüß]/gi,
        chinese: /[\u4e00-\u9fff]/g,
        japanese: /[\u3040-\u309f\u30a0-\u30ff]/g,
        korean: /[\uac00-\ud7af]/g,
        arabic: /[\u0600-\u06ff]/g,
        russian: /[\u0400-\u04ff]/g
      };

      let maxScore = 0;
      let detectedLanguage = 'unknown';

      for (const [language, pattern] of Object.entries(languagePatterns)) {
        const matches = content.match(pattern);
        const score = matches ? matches.length : 0;
        
        if (score > maxScore) {
          maxScore = score;
          detectedLanguage = language;
        }
      }

      const confidence = Math.min((maxScore / content.length) * 100, 100);

      return {
        success: true,
        detectedLanguage,
        confidence: Math.round(confidence),
        totalCharacters: content.length
      };
    } catch (error) {
      logger.error('Language detection failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        detectedLanguage: 'unknown',
        confidence: 0
      };
    }
  }

  /**
   * Check factual consistency (basic implementation)
   * @param {string} content - Content to analyze
   * @returns {Object} Factual consistency results
   */
  checkFactualConsistency(content) {
    try {
      if (!content || typeof content !== 'string') {
        return {
          success: false,
          error: 'Invalid content provided',
          consistencyScore: 0,
          issues: []
        };
      }

      const issues = [];
      let consistencyScore = 100;

      // Check for contradictory statements
      const contradictions = [
        { pattern: /(yes|no|true|false).*?(no|yes|false|true)/gi, penalty: 20 },
        { pattern: /(always|never).*?(sometimes|occasionally)/gi, penalty: 15 },
        { pattern: /(all|every|none).*?(some|few|many)/gi, penalty: 10 }
      ];

      for (const contradiction of contradictions) {
        const matches = content.match(contradiction.pattern);
        if (matches) {
          issues.push(`Contradictory statements found: ${matches.length} instances`);
          consistencyScore -= contradiction.penalty * matches.length;
        }
      }

      // Check for vague statements
      const vaguePatterns = [
        /maybe|perhaps|possibly|might|could|seems like/i,
        /I think|I believe|in my opinion|as far as I know/i
      ];

      let vagueCount = 0;
      for (const pattern of vaguePatterns) {
        const matches = content.match(pattern);
        if (matches) {
          vagueCount += matches.length;
        }
      }

      if (vagueCount > 0) {
        issues.push(`Vague statements found: ${vagueCount} instances`);
        consistencyScore -= vagueCount * 5;
      }

      consistencyScore = Math.max(0, consistencyScore);

      return {
        success: true,
        consistencyScore: Math.round(consistencyScore),
        issues,
        totalIssues: issues.length
      };
    } catch (error) {
      logger.error('Factual consistency check failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        consistencyScore: 0,
        issues: []
      };
    }
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
      biasDetection: this.detectBias(content),
      toxicityDetection: this.detectToxicity(content),
      codeDetection: this.detectCode(content),
      secretsDetection: this.detectSecrets(content),
      languageDetection: this.detectLanguage(content),
      factualConsistency: this.checkFactualConsistency(content),
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