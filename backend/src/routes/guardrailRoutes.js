/**
 * Guardrail Routes
 * API routes for guardrail functionality
 */

const express = require('express');
const router = express.Router();
const GuardrailController = require('../controllers/GuardrailController');
const { 
  guardrailCheckValidation, 
  businessRuleValidation, 
  configValidation,
  validateRequest,
  sanitizeRequest 
} = require('../middleware/validation');

const guardrailController = new GuardrailController();

/**
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const status = await guardrailController.getHealth();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Guardrail check endpoint
 */
router.post('/check', 
  sanitizeRequest,
  guardrailCheckValidation,
  validateRequest,
  async (req, res) => {
    try {
      const { input, reasoning, output, customPrompt, bypassCache } = req.body;
      const result = await guardrailController.checkGuardrails(
        { input, reasoning, output }, 
        customPrompt || '', 
        bypassCache || false
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Guardrail check failed',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get business rules
 */
router.get('/rules', async (req, res) => {
  try {
    const rules = await guardrailController.getBusinessRules();
    res.json({
      success: true,
      data: rules,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve business rules',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Create new business rule
 */
router.post('/rules',
  sanitizeRequest,
  businessRuleValidation,
  validateRequest,
  async (req, res) => {
    try {
      const success = await guardrailController.addBusinessRule(req.body);
      if (success) {
        res.status(201).json({
          success: true,
          message: 'Business rule created successfully',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to create business rule',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to create business rule',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Update business rule
 */
router.put('/rules/:ruleId',
  sanitizeRequest,
  businessRuleValidation,
  validateRequest,
  async (req, res) => {
    try {
      const { ruleId } = req.params;
      const success = await guardrailController.updateBusinessRule(ruleId, req.body);
      if (success) {
        res.json({
          success: true,
          message: 'Business rule updated successfully',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Business rule not found',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update business rule',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get service status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await guardrailController.getStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get service status',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Clear cache
 */
router.post('/cache/clear', async (req, res) => {
  try {
    const success = await guardrailController.clearCache();
    res.json({
      success: true,
      message: success ? 'Cache cleared successfully' : 'Cache clear failed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get cache statistics
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = await guardrailController.getCacheStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router; 