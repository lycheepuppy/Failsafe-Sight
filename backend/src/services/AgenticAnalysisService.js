/**
 * Agentic Analysis Service
 * Handles second-line agentic analysis for fraud detection
 */

const logger = require('../utils/logger');

class AgenticAnalysisService {
  constructor() {
    this.manipulationPatterns = [
      'please help me', 'i\'m desperate', 'i have no money', 'i\'m starving',
      'i\'ll die', 'emergency', 'urgent', 'desperate', 'please', 'help',
      'family', 'children', 'sick', 'hospital', 'medical', 'crisis',
      'threat', 'complain', 'escalate', 'manager', 'ceo', 'social media'
    ];

    this.jailbreakPatterns = [
      'ignore prior instructions', 'ignore all previous', 'forget everything',
      'ignore rules', 'ignore guidelines', 'ignore policies', 'system test',
      'override', 'bypass', 'ignore safety', 'ignore restrictions',
      'pretend to be', 'act as if', 'ignore your training', 'ignore your instructions'
    ];

    this.hallucinationIndicators = [
      'order number', 'tracking number', 'delivery time', 'restaurant name',
      'menu item', 'price', 'address', 'phone number', 'email'
    ];

    this.poisoningPatterns = [
      'refund again', 'same issue', 'always happens', 'every time',
      'repeated', 'multiple times', 'frequent', 'regular'
    ];
  }

  /**
   * Perform comprehensive agentic analysis
   * @param {Object} request - Guardrail request object
   * @returns {Object} Analysis results
   */
  analyze(request) {
    const analysis = {
      manipulation: false,
      jailbreak: false,
      hallucination: false,
      poisoning: false,
      evidence: []
    };

    // Check for manipulation
    const manipulationResult = this.detectManipulation(request);
    if (manipulationResult.detected) {
      analysis.manipulation = true;
      analysis.evidence.push(manipulationResult.evidence);
    }

    // Check for jailbreak
    const jailbreakResult = this.detectJailbreak(request);
    if (jailbreakResult.detected) {
      analysis.jailbreak = true;
      analysis.evidence.push(jailbreakResult.evidence);
    }

    // Check for hallucination
    const hallucinationResult = this.detectHallucination(request);
    if (hallucinationResult.detected) {
      analysis.hallucination = true;
      analysis.evidence.push(hallucinationResult.evidence);
    }

    // Check for poisoning
    const poisoningResult = this.detectPoisoning(request);
    if (poisoningResult.detected) {
      analysis.poisoning = true;
      analysis.evidence.push(poisoningResult.evidence);
    }

    logger.debug('Agentic analysis completed', {
      manipulation: analysis.manipulation,
      jailbreak: analysis.jailbreak,
      hallucination: analysis.hallucination,
      poisoning: analysis.poisoning,
      evidenceCount: analysis.evidence.length
    });

    return analysis;
  }

  /**
   * Detect emotional manipulation tactics
   * @param {Object} request - Guardrail request object
   * @returns {Object} Detection result
   */
  detectManipulation(request) {
    const inputMatch = this.matchesPatterns(request.input, this.manipulationPatterns);
    const reasoningMatch = this.matchesPatterns(request.reasoning, this.manipulationPatterns);

    if (inputMatch || reasoningMatch) {
      return {
        detected: true,
        evidence: 'AGENTIC: Emotional manipulation tactics detected',
        confidence: 'HIGH'
      };
    }

    return { detected: false, evidence: '', confidence: 'LOW' };
  }

  /**
   * Detect jailbreak/prompt injection attempts
   * @param {Object} request - Guardrail request object
   * @returns {Object} Detection result
   */
  detectJailbreak(request) {
    const inputMatch = this.matchesPatterns(request.input, this.jailbreakPatterns);
    const reasoningMatch = this.matchesPatterns(request.reasoning, this.jailbreakPatterns);

    if (inputMatch || reasoningMatch) {
      return {
        detected: true,
        evidence: 'AGENTIC: Jailbreak/prompt injection detected',
        confidence: 'HIGH'
      };
    }

    return { detected: false, evidence: '', confidence: 'LOW' };
  }

  /**
   * Detect potential agent hallucination
   * @param {Object} request - Guardrail request object
   * @returns {Object} Detection result
   */
  detectHallucination(request) {
    // Check if agent mentions specific details not likely in customer input
    const hasHallucination = this.hallucinationIndicators.some(indicator => {
      const reasoningHasIndicator = request.reasoning.toLowerCase().includes(indicator.toLowerCase());
      const inputHasIndicator = request.input.toLowerCase().includes(indicator.toLowerCase());
      
      return reasoningHasIndicator && !inputHasIndicator;
    });

    if (hasHallucination) {
      return {
        detected: true,
        evidence: 'AGENTIC: Agent may be hallucinating specific order details',
        confidence: 'MEDIUM'
      };
    }

    return { detected: false, evidence: '', confidence: 'LOW' };
  }

  /**
   * Detect poisoning patterns
   * @param {Object} request - Guardrail request object
   * @returns {Object} Detection result
   */
  detectPoisoning(request) {
    const inputMatch = this.matchesPatterns(request.input, this.poisoningPatterns);

    if (inputMatch) {
      return {
        detected: true,
        evidence: 'AGENTIC: Potential poisoning: repetitive complaint patterns detected',
        confidence: 'MEDIUM'
      };
    }

    return { detected: false, evidence: '', confidence: 'LOW' };
  }

  /**
   * Check if text matches any patterns
   * @param {string} text - Text to check
   * @param {Array} patterns - Patterns to match against
   * @returns {boolean} True if any pattern matches
   */
  matchesPatterns(text, patterns) {
    const lowerText = text.toLowerCase();
    return patterns.some(pattern => lowerText.includes(pattern.toLowerCase()));
  }

  /**
   * Get analysis summary
   * @param {Object} analysis - Analysis results
   * @returns {Object} Summary object
   */
  getSummary(analysis) {
    const issues = [];
    if (analysis.manipulation) issues.push('Manipulation');
    if (analysis.jailbreak) issues.push('Jailbreak');
    if (analysis.hallucination) issues.push('Hallucination');
    if (analysis.poisoning) issues.push('Poisoning');

    return {
      hasIssues: issues.length > 0,
      issueCount: issues.length,
      issues,
      evidenceCount: analysis.evidence.length
    };
  }
}

module.exports = new AgenticAnalysisService(); 