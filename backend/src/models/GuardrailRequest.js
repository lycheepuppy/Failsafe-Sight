/**
 * Guardrail Request Model
 * Data model and validation for guardrail check requests
 */

class GuardrailRequest {
  constructor(data) {
    this.input = data.input || '';
    this.reasoning = data.reasoning || '';
    this.output = data.output || '';
  }

  /**
   * Validate the request data
   * @returns {Object} Validation result with isValid boolean and errors array
   */
  validate() {
    const errors = [];

    if (!this.input || typeof this.input !== 'string') {
      errors.push('Input must be a non-empty string');
    }

    if (!this.reasoning || typeof this.reasoning !== 'string') {
      errors.push('Reasoning must be a non-empty string');
    }

    if (!this.output || typeof this.output !== 'string') {
      errors.push('Output must be a non-empty string');
    }

    if (this.input.length > 10000) {
      errors.push('Input exceeds maximum length of 10,000 characters');
    }

    if (this.reasoning.length > 10000) {
      errors.push('Reasoning exceeds maximum length of 10,000 characters');
    }

    if (this.output.length > 5000) {
      errors.push('Output exceeds maximum length of 5,000 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize the request data
   * @returns {GuardrailRequest} Sanitized request
   */
  sanitize() {
    return new GuardrailRequest({
      input: this.input.trim(),
      reasoning: this.reasoning.trim(),
      output: this.output.trim()
    });
  }

  /**
   * Get a summary of the request for logging
   * @returns {Object} Request summary
   */
  getSummary() {
    return {
      inputLength: this.input.length,
      reasoningLength: this.reasoning.length,
      outputLength: this.output.length,
      inputPreview: this.input.substring(0, 100) + (this.input.length > 100 ? '...' : ''),
      outputPreview: this.output.substring(0, 100) + (this.output.length > 100 ? '...' : '')
    };
  }
}

module.exports = GuardrailRequest; 