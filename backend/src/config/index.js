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
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },
    // Enhanced security settings
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    },
    slowDown: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      delayAfter: 50, // allow 50 requests per 15 minutes, then...
      delayMs: 500 // begin adding 500ms of delay per request above 50
    },
    timeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000, // 30 seconds
    maxPayloadSize: process.env.MAX_PAYLOAD_SIZE || '10mb',
    trustProxy: process.env.TRUST_PROXY === 'true'
  },

  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY || null,
    model: process.env.OPENAI_MODEL || 'gpt-4',
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1,
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 500,
    timeout: parseInt(process.env.OPENAI_TIMEOUT) || 30000,
    retries: parseInt(process.env.OPENAI_RETRIES) || 3,
    retryDelay: parseInt(process.env.OPENAI_RETRY_DELAY) || 1000
  },

  // Business rules defaults
  businessRules: {
    enabled: true,
    defaultLoanLimit: parseInt(process.env.LOAN_LIMIT) || 3000,
    defaultMinLoan: parseInt(process.env.MIN_LOAN) || 100,
    sensitivityLevel: process.env.SENSITIVITY_LEVEL || 'medium',
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 10
  },

  // Enhanced Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
    enablePerformanceLogging: process.env.ENABLE_PERFORMANCE_LOGGING !== 'false',
    logToFile: process.env.LOG_TO_FILE === 'true',
    logDirectory: process.env.LOG_DIRECTORY || './logs',
    maxLogFiles: parseInt(process.env.MAX_LOG_FILES) || 14, // 2 weeks
    maxLogSize: process.env.MAX_LOG_SIZE || '20m'
  },

  // Enhanced Cache Configuration
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    ttl: parseInt(process.env.CACHE_TTL) || 300, // 5 minutes
    maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000,
    checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD) || 600, // 10 minutes
    useClones: false,
    deleteOnExpire: true
  },

  // Security Configuration
  security: {
    enableHpp: process.env.ENABLE_HPP !== 'false',
    enableXssClean: process.env.ENABLE_XSS_CLEAN !== 'false',
    enableMongoSanitize: process.env.ENABLE_MONGO_SANITIZE !== 'false',
    enableUserAgentFilter: process.env.ENABLE_USER_AGENT_FILTER === 'true',
    blockedUserAgents: process.env.BLOCKED_USER_AGENTS ? process.env.BLOCKED_USER_AGENTS.split(',') : [],
    enableRequestValidation: process.env.ENABLE_REQUEST_VALIDATION !== 'false',
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
    enableCompression: process.env.ENABLE_COMPRESSION !== 'false'
  },

  // Performance Configuration
  performance: {
    enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
    compressionLevel: parseInt(process.env.COMPRESSION_LEVEL) || 6,
    enableKeepAlive: process.env.ENABLE_KEEP_ALIVE !== 'false',
    keepAliveTimeout: parseInt(process.env.KEEP_ALIVE_TIMEOUT) || 65000,
    maxKeepAliveRequests: parseInt(process.env.MAX_KEEP_ALIVE_REQUESTS) || 100,
    enableGzip: process.env.ENABLE_GZIP !== 'false',
    gzipThreshold: parseInt(process.env.GZIP_THRESHOLD) || 1024
  },

  // Monitoring Configuration
  monitoring: {
    enableHealthCheck: process.env.ENABLE_HEALTH_CHECK !== 'false',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    enablePerformanceMonitoring: process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT) || 9090,
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000
  },

  // Environment
  environment: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',

  // Feature Flags
  features: {
    enableScannerService: process.env.ENABLE_SCANNER_SERVICE !== 'false',
    enableAgenticAnalysis: process.env.ENABLE_AGENTIC_ANALYSIS !== 'false',
    enableAIAnalysis: process.env.ENABLE_AI_ANALYSIS !== 'false',
    enableBusinessRules: process.env.ENABLE_BUSINESS_RULES !== 'false',
    enableCaching: process.env.ENABLE_CACHING !== 'false'
  }
};

module.exports = config; 