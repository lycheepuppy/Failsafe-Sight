/**
 * Application Configuration
 * Centralized configuration management for the Failsafe LLM Guardrails backend
 */

// Validate required environment variables (only for production)
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = ['OPENAI_API_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('Please set these variables in your .env file or environment');
    process.exit(1);
  }
}

const config = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || 'localhost',
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true
    },
    // Security settings
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    },
    timeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000 // 30 seconds
  },

  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY || null,
    model: process.env.OPENAI_MODEL || 'gpt-4',
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1,
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 500,
    timeout: parseInt(process.env.OPENAI_TIMEOUT) || 30000
  },

  // Business rules defaults
  businessRules: {
    enabled: true,
    defaultLoanLimit: parseInt(process.env.LOAN_LIMIT) || 3000,
    defaultMinLoan: parseInt(process.env.MIN_LOAN) || 100,
    sensitivityLevel: process.env.SENSITIVITY_LEVEL || 'medium'
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false'
  },

  // Cache Configuration
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    ttl: parseInt(process.env.CACHE_TTL) || 300, // 5 minutes
    maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000
  },

  // Environment
  environment: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development'
};

module.exports = config; 