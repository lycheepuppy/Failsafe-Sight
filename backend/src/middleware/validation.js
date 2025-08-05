/**
 * Validation Middleware
 * Provides comprehensive input validation using express-validator
 */

const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Validation rules for guardrail check endpoint
 */
const guardrailCheckValidation = [
  body('input')
    .trim()
    .notEmpty()
    .withMessage('Input field is required')
    .isString()
    .withMessage('Input must be a string')
    .isLength({ min: 1, max: 10000 })
    .withMessage('Input must be between 1 and 10,000 characters'),

  body('reasoning')
    .trim()
    .notEmpty()
    .withMessage('Reasoning field is required')
    .isString()
    .withMessage('Reasoning must be a string')
    .isLength({ min: 1, max: 10000 })
    .withMessage('Reasoning must be between 1 and 10,000 characters'),

  body('output')
    .trim()
    .notEmpty()
    .withMessage('Output field is required')
    .isString()
    .withMessage('Output must be a string')
    .isLength({ min: 1, max: 10000 })
    .withMessage('Output must be between 1 and 10,000 characters'),

  body('customPrompt')
    .optional()
    .trim()
    .isString()
    .withMessage('Custom prompt must be a string')
    .isLength({ max: 5000 })
    .withMessage('Custom prompt must not exceed 5,000 characters')
];

/**
 * Validation rules for business rule updates
 */
const businessRuleValidation = [
  body('id')
    .trim()
    .notEmpty()
    .withMessage('Rule ID is required')
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('Rule ID must contain only uppercase letters, numbers, and hyphens'),

  body('name')
    .trim()
    .notEmpty()
    .withMessage('Rule name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Rule name must be between 1 and 100 characters'),

  body('description')
    .optional()
    .trim()
    .isString()
    .withMessage('Description must be a string')
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),

  body('patterns')
    .isArray({ min: 1 })
    .withMessage('Patterns must be a non-empty array')
    .custom((patterns) => {
      if (!patterns.every(pattern => typeof pattern === 'string' && pattern.length > 0)) {
        throw new Error('All patterns must be non-empty strings');
      }
      return true;
    }),

  body('action')
    .optional()
    .isIn(['ALLOW', 'BLOCK', 'ESCALATE'])
    .withMessage('Action must be one of: ALLOW, BLOCK, ESCALATE'),

  body('enabled')
    .optional()
    .isBoolean()
    .withMessage('Enabled must be a boolean'),

  body('threshold')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Threshold must be a positive integer')
];

/**
 * Validation rules for configuration updates
 */
const configValidation = [
  body('loanLimit')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('Loan limit must be between 1 and 100,000'),

  body('minLoan')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Minimum loan must be between 1 and 10,000'),

  body('sensitivityLevel')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Sensitivity level must be one of: low, medium, high'),

  body('aiEnabled')
    .optional()
    .isBoolean()
    .withMessage('AI enabled must be a boolean')
];

/**
 * Sanitize and validate request body
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    logger.warn('Validation failed', {
      path: req.path,
      method: req.method,
      errors: errorMessages
    });

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errorMessages
    });
  }

  next();
};

/**
 * Sanitize request body to prevent XSS and injection attacks
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const sanitizeRequest = (req, res, next) => {
  // Sanitize string fields
  const stringFields = ['input', 'reasoning', 'output', 'customPrompt', 'name', 'description'];
  
  stringFields.forEach(field => {
    if (req.body[field] && typeof req.body[field] === 'string') {
      // Remove potentially dangerous characters
      req.body[field] = req.body[field]
        .replace(/[<>]/g, '') // Remove < and >
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .trim();
    }
  });

  // Sanitize patterns array
  if (req.body.patterns && Array.isArray(req.body.patterns)) {
    req.body.patterns = req.body.patterns.map(pattern => {
      if (typeof pattern === 'string') {
        return pattern
          .replace(/[<>]/g, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+=/gi, '')
          .trim();
      }
      return pattern;
    });
  }

  next();
};

/**
 * Rate limiting validation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateRateLimit = (req, res, next) => {
  // This will be handled by express-rate-limit middleware
  // This function can be used for custom rate limiting logic
  next();
};

module.exports = {
  guardrailCheckValidation,
  businessRuleValidation,
  configValidation,
  validateRequest,
  sanitizeRequest,
  validateRateLimit
}; 