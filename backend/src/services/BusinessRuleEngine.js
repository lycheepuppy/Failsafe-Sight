/**
 * Business Rule Engine Service
 * Handles business rule validation and enforcement
 */

const config = require('../config');
const logger = require('../utils/logger');

class BusinessRuleEngine {
  constructor() {
    this.rules = this.initializeRules();
    this.compiledPatterns = new Map();
    this.compilePatterns();
  }

  /**
   * Compile regex patterns for better performance
   */
  compilePatterns() {
    this.rules.forEach(rule => {
      if (rule.patterns) {
        rule.compiledPatterns = rule.patterns.map(pattern => {
          try {
            return new RegExp(pattern, 'i');
          } catch (error) {
            logger.warn('Invalid regex pattern', { pattern, error: error.message });
            // Fallback to simple string matching
            return { test: (text) => text.toLowerCase().includes(pattern.toLowerCase()) };
          }
        });
      }
    });
  }

  /**
   * Initialize business rules
   * @returns {Array} Array of business rules
   */
  initializeRules() {
    return [
      {
        id: 'LBC-1',
        name: 'Maximum Loan Amount',
        description: 'Block loans exceeding maximum limit',
        enabled: true,
        action: 'BLOCK',
        patterns: ['\\$\\d+(?:\\.\\d{2})?'],
        threshold: config.businessRules.defaultLoanLimit || 3000,
        customLogic: this.checkMaxLoanAmount.bind(this)
      },
      {
        id: 'LBC-2',
        name: 'Minimum Loan Amount',
        description: 'Escalate loans below minimum threshold',
        enabled: true,
        action: 'ESCALATE',
        patterns: ['\\$\\d+(?:\\.\\d{2})?'],
        threshold: config.businessRules.defaultMinLoan || 100,
        customLogic: this.checkMinLoanAmount.bind(this)
      },
      {
        id: 'LBC-3',
        name: 'Income-to-Loan Ratio',
        description: 'Escalate loans exceeding income ratio limit',
        enabled: true,
        action: 'ESCALATE',
        patterns: ['\\$\\d+(?:\\.\\d{2})?'],
        threshold: 0.5, // 50% of monthly income
        customLogic: this.checkIncomeToLoanRatio.bind(this)
      },
      {
        id: 'LBC-4',
        name: 'Multiple Loan Applications',
        description: 'Detect rapid successive loan applications',
        enabled: true,
        action: 'ESCALATE',
        patterns: ['\\d+\\s+(?:days?|weeks?|months?)\\s+(?:ago|before)'],
        threshold: 30, // days
        customLogic: this.checkLoanFrequency.bind(this)
      },
      {
        id: 'LBC-5',
        name: 'Technical Injection',
        description: 'Block technical injection attempts',
        enabled: true,
        action: 'BLOCK',
        patterns: [
          '<script>',
          'alert\\(',
          'approveLoan\\(\\d+\\)',
          'disburse\\(\\d+\\)',
          'system\\.override',
          'internal\\.system'
        ],
        threshold: 1
      },
      {
        id: 'LBC-6',
        name: 'Explicit Limit Requests',
        description: 'Block explicit requests for maximum amounts',
        enabled: true,
        action: 'BLOCK',
        patterns: [
          'maximum\\s+loan',
          'highest\\s+amount',
          'approve.*\\$3000',
          'approve.*maximum',
          'urgent.*\\$3000',
          'immediately.*\\$3000',
          'approve.*three\\s+thousand',
          'approve.*3k'
        ],
        threshold: 1
      },
      {
        id: 'LBC-7',
        name: 'Unverifiable Documentation',
        description: 'Detect attempts to use unverifiable proof',
        enabled: true,
        action: 'ESCALATE',
        patterns: [
          'screenshot.*instead',
          'bank\\s+app.*screenshot',
          'phone\\s+broken.*upload',
          'can\'t\\s+upload.*screenshot',
          'technical\\s+difficulties.*screenshot',
          'balance.*\\$\\d{4,}.*screenshot',
          'bank\\s+balance.*screenshot',
          'screenshot.*proof',
          'screenshot.*verification'
        ],
        threshold: 2
      }
    ];
  }

  /**
   * Check loan amount against limits
   * @param {string} output - The output text to check
   * @returns {Object} Result with matched and amount
   */
  checkMaxLoanAmount(output) {
    try {
      // Look for loan amounts in the output - prioritize amounts near "approve" or "loan"
      const approveMatch = output.match(/(?:approve|loan).*?\$(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
      if (approveMatch) {
        const loanAmount = parseFloat(approveMatch[1].replace(/,/g, ''));
        const maxLimit = config.businessRules.defaultLoanLimit || 3000;
        
        // Check if amount exceeds maximum limit
        if (loanAmount > maxLimit) {
          return {
            matched: true,
            amount: loanAmount,
            reason: `Loan amount $${loanAmount} exceeds maximum limit of $${maxLimit}`
          };
        }
      }
      
      // Fallback: look for all amounts and find the one that's most likely the loan amount
      const amountMatches = output.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g);
      if (amountMatches) {
        // Look for amounts that appear near loan-related keywords
        const loanKeywords = ['loan', 'approve', 'request', 'amount', 'disburse'];
        let bestMatch = null;
        let bestScore = 0;
        
        amountMatches.forEach(match => {
          const amount = parseFloat(match.replace(/[$,]/g, ''));
          const matchIndex = output.indexOf(match);
          
          // Check proximity to loan keywords
          let score = 0;
          loanKeywords.forEach(keyword => {
            const keywordIndex = output.toLowerCase().indexOf(keyword, Math.max(0, matchIndex - 50));
            if (keywordIndex !== -1 && Math.abs(keywordIndex - matchIndex) < 100) {
              score += 1;
            }
          });
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = amount;
          }
        });
        
        if (bestMatch && bestScore > 0) {
          const maxLimit = config.businessRules.defaultLoanLimit || 3000;
          if (bestMatch > maxLimit) {
            return {
              matched: true,
              amount: bestMatch,
              reason: `Loan amount $${bestMatch} exceeds maximum limit of $${maxLimit}`
            };
          }
        }
      }
      
      return { matched: false };
    } catch (error) {
      logger.error('Error checking maximum loan amount', { error: error.message, output });
      return { matched: false };
    }
  }

  checkMinLoanAmount(output) {
    try {
      // Look for loan amounts in the output - more flexible matching
      const amountMatches = output.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g);
      if (amountMatches) {
        // Find the largest amount (likely the loan amount)
        let maxAmount = 0;
        let loanAmount = 0;
        
        amountMatches.forEach(match => {
          const amount = parseFloat(match.replace(/[$,]/g, ''));
          if (amount > maxAmount) {
            maxAmount = amount;
            loanAmount = amount;
          }
        });
        
        const minLimit = config.businessRules.defaultMinLoan || 100;
        
        // Check if amount is below minimum threshold
        if (loanAmount < minLimit) {
          return {
            matched: true,
            amount: loanAmount,
            reason: `Loan amount $${loanAmount} is below minimum threshold of $${minLimit}`
          };
        }
      }
      return { matched: false };
    } catch (error) {
      logger.error('Error checking minimum loan amount', { error: error.message, output });
      return { matched: false };
    }
  }

  checkIncomeToLoanRatio(output) {
    try {
      // Extract loan amount and income from output - more precise matching
      const approveMatch = output.match(/approve.*?\$(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
      const incomeMatch = output.match(/(?:salary|income|earn).*?\$(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
      
      if (approveMatch && incomeMatch) {
        const loanAmount = parseFloat(approveMatch[1].replace(/,/g, ''));
        const monthlyIncome = parseFloat(incomeMatch[1].replace(/,/g, ''));
        const ratio = loanAmount / monthlyIncome;
        const maxRatio = 0.5; // 50% of monthly income
        
        // Check if ratio exceeds limit
        if (ratio > maxRatio) {
          return {
            matched: true,
            ratio: ratio.toFixed(2),
            reason: `Income-to-loan ratio ${(ratio * 100).toFixed(1)}% exceeds limit of ${(maxRatio * 100).toFixed(1)}%`
          };
        }
      }
      return { matched: false };
    } catch (error) {
      logger.error('Error checking income-to-loan ratio', { error: error.message, output });
      return { matched: false };
    }
  }

  checkLoanFrequency(output) {
    try {
      // Look for time references indicating recent applications
      const timeMatch = output.match(/(\d+)\s+(days?|weeks?|months?)\s+(ago|before)/i);
      if (timeMatch) {
        const timeValue = parseInt(timeMatch[1]);
        const timeUnit = timeMatch[2].toLowerCase();
        const maxDays = 30; // Maximum days between applications
        
        // Convert to days
        let daysAgo = timeValue;
        if (timeUnit.includes('week')) daysAgo = timeValue * 7;
        if (timeUnit.includes('month')) daysAgo = timeValue * 30;
        
        // Check if too recent
        if (daysAgo < maxDays) {
          return {
            matched: true,
            daysAgo: daysAgo,
            reason: `Loan application too recent (${daysAgo} days ago, minimum ${maxDays} days required)`
          };
        }
      }
      return { matched: false };
    } catch (error) {
      logger.error('Error checking loan frequency', { error: error.message, output });
      return { matched: false };
    }
  }

  /**
   * Check if text matches any patterns using compiled regex
   * @param {string} text - Text to check
   * @param {Array} compiledPatterns - Compiled patterns to match against
   * @returns {boolean} True if any pattern matches
   */
  matchesPatterns(text, compiledPatterns) {
    if (!text || !compiledPatterns) return false;
    
    const lowerText = text.toLowerCase();
    
    return compiledPatterns.some(pattern => {
      try {
        return pattern.test(lowerText);
      } catch (error) {
        logger.warn('Pattern matching error', { error: error.message });
        return false;
      }
    });
  }

  /**
   * Evaluate business rules against input
   * @param {Object} request - Guardrail request object
   * @returns {Object} Evaluation results
   */
  evaluate(request) {
    const startTime = Date.now();
    
    try {
      const results = {
        evidence: [],
        reasonCode: 'BOUNDARY',
        action: 'ALLOW',
        triggeredRules: []
      };

      for (const rule of this.rules) {
        if (!rule.enabled) continue;

        let triggered = false;
        let evidence = '';

        // Check if rule has custom logic
        if (rule.customLogic) {
          const customResult = rule.customLogic(request.output);
          if (customResult.matched) {
            triggered = true;
            evidence = `${rule.id}: ${rule.description} - ${customResult.reason || 'Amount exceeds limit'}`;
          }
        } else if (rule.compiledPatterns) {
          // Check patterns against input and reasoning
          const inputMatch = this.matchesPatterns(request.input, rule.compiledPatterns);
          const reasoningMatch = this.matchesPatterns(request.reasoning, rule.compiledPatterns);
          
          if (inputMatch || reasoningMatch) {
            triggered = true;
            evidence = `${rule.id}: ${rule.description}`;
          }
        }

        if (triggered) {
          results.triggeredRules.push(rule);
          results.evidence.push(evidence);
          
          // Update action based on rule priority
          if (rule.action === 'BLOCK') {
            results.action = 'BLOCK';
            results.reasonCode = 'BOUNDARY';
          } else if (rule.action === 'ESCALATE' && results.action !== 'BLOCK') {
            results.action = 'ESCALATE';
            results.reasonCode = 'BOUNDARY';
          }
        }
      }

      // Set verdict based on action
      results.verdict = results.action === 'ALLOW' ? 'CONFIRM' : 'OVERRIDE';

      const duration = Date.now() - startTime;
      logger.debug('Business rule evaluation completed', {
        triggeredRules: results.triggeredRules.length,
        action: results.action,
        reasonCode: results.reasonCode,
        duration
      });

      return results;
    } catch (error) {
      logger.error('Error in business rule evaluation', { error: error.message });
      return {
        evidence: ['Error in business rule evaluation'],
        reasonCode: 'ERROR',
        action: 'ESCALATE',
        triggeredRules: [],
        verdict: 'OVERRIDE'
      };
    }
  }

  /**
   * Get all business rules
   * @returns {Array} Array of business rules
   */
  getRules() {
    return this.rules;
  }

  /**
   * Update a business rule
   * @param {string} ruleId - Rule ID to update
   * @param {Object} updates - Updates to apply
   * @returns {boolean} Success status
   */
  updateRule(ruleId, updates) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      Object.assign(rule, updates);
      // Recompile patterns if patterns were updated
      if (updates.patterns) {
        rule.compiledPatterns = updates.patterns.map(pattern => {
          try {
            return new RegExp(pattern, 'i');
          } catch (error) {
            logger.warn('Invalid regex pattern', { pattern, error: error.message });
            return { test: (text) => text.toLowerCase().includes(pattern.toLowerCase()) };
          }
        });
      }
      logger.info('Business rule updated', { ruleId, updates });
      return true;
    }
    return false;
  }

  /**
   * Add a new business rule
   * @param {Object} rule - Rule to add
   * @returns {boolean} Success status
   */
  addRule(rule) {
    if (rule.id && rule.name && rule.patterns) {
      const newRule = {
        enabled: true,
        action: 'ESCALATE',
        threshold: 1,
        ...rule
      };
      
      // Compile patterns for the new rule
      newRule.compiledPatterns = newRule.patterns.map(pattern => {
        try {
          return new RegExp(pattern, 'i');
        } catch (error) {
          logger.warn('Invalid regex pattern', { pattern, error: error.message });
          return { test: (text) => text.toLowerCase().includes(pattern.toLowerCase()) };
        }
      });
      
      this.rules.push(newRule);
      logger.info('Business rule added', { ruleId: rule.id });
      return true;
    }
    return false;
  }
}

module.exports = new BusinessRuleEngine(); 