/**
 * Guardrail Response Model
 * Data model for guardrail check responses
 */

class GuardrailResponse {
  constructor(data = {}) {
    this.verdict = data.verdict || 'CONFIRM';
    this.reason_code = data.reason_code || 'BOUNDARY';
    this.evidence = data.evidence || [];
    this.action = data.action || 'ALLOW';
    this.agentic_analysis = data.agentic_analysis || {
      manipulation: false,
      jailbreak: false,
      hallucination: false,
      poisoning: false,
      evidence: []
    };
    this.ai_analysis = data.ai_analysis || {
      success: false,
      data: null,
      error: null
    };
    this.metadata = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      processing_time: data.processing_time || 0
    };
  }

  /**
   * Set the verdict and related fields
   * @param {string} verdict - The verdict (CONFIRM or OVERRIDE)
   * @param {string} reasonCode - The reason code
   * @param {string} action - The action to take
   */
  setVerdict(verdict, reasonCode, action) {
    this.verdict = verdict;
    this.reason_code = reasonCode;
    this.action = action;
  }

  /**
   * Add evidence to the response
   * @param {string|Array} evidence - Evidence to add
   */
  addEvidence(evidence) {
    if (Array.isArray(evidence)) {
      this.evidence.push(...evidence);
    } else {
      this.evidence.push(evidence);
    }
  }

  /**
   * Set agentic analysis results
   * @param {Object} analysis - Agentic analysis object
   */
  setAgenticAnalysis(analysis) {
    this.agentic_analysis = {
      manipulation: analysis.manipulation || false,
      jailbreak: analysis.jailbreak || false,
      hallucination: analysis.hallucination || false,
      poisoning: analysis.poisoning || false,
      evidence: analysis.evidence || []
    };
  }

  /**
   * Set AI analysis results
   * @param {Object} analysis - AI analysis object
   */
  setAIAnalysis(analysis) {
    this.ai_analysis = {
      success: analysis.success || false,
      data: analysis.data || null,
      error: analysis.error || null,
      raw_response: analysis.raw_response || null
    };
  }

  /**
   * Set processing time
   * @param {number} time - Processing time in milliseconds
   */
  setProcessingTime(time) {
    this.metadata.processing_time = time;
  }

  /**
   * Check if the response indicates a block or escalation
   * @returns {boolean} True if action is BLOCK or ESCALATE
   */
  requiresAction() {
    return this.action === 'BLOCK' || this.action === 'ESCALATE';
  }

  /**
   * Get a summary of the response for logging
   * @returns {Object} Response summary
   */
  getSummary() {
    return {
      verdict: this.verdict,
      reasonCode: this.reason_code,
      action: this.action,
      evidenceCount: this.evidence.length,
      requiresAction: this.requiresAction(),
      processingTime: this.metadata.processing_time
    };
  }

  /**
   * Convert to plain object for JSON serialization
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      verdict: this.verdict,
      reason_code: this.reason_code,
      evidence: this.evidence,
      action: this.action,
      agentic_analysis: this.agentic_analysis,
      ai_analysis: this.ai_analysis,
      metadata: this.metadata
    };
  }
}

module.exports = GuardrailResponse; 