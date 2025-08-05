/**
 * Failsafe LLM Guardrails Server
 * Main server entry point with clean architecture
 */

// Load environment variables first
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const guardrailRoutes = require('./routes/guardrailRoutes');
const { errorHandler, notFoundHandler, requestLogger, corsHandler } = require('./middleware/errorHandler');

class Server {
  constructor() {
    this.app = express();
    this.port = config.server.port;
    this.host = config.server.host;
  }

  /**
   * Initialize the server
   */
  initialize() {
    this.setupSecurity();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup security middleware
   */
  setupSecurity() {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.server.rateLimit.windowMs,
      max: config.server.rateLimit.max,
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(config.server.rateLimit.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/v1/', limiter);

    // Request timeout
    this.app.use((req, res, next) => {
      req.setTimeout(config.server.timeout, () => {
        res.status(408).json({ error: 'Request timeout' });
      });
      next();
    });
  }

  /**
   * Setup middleware
   */
  setupMiddleware() {
    // Compression
    this.app.use(compression());
    
    // Request logging (conditional)
    if (config.logging.enableRequestLogging) {
      this.app.use(requestLogger);
    }
    
    // CORS handling
    this.app.use(corsHandler);
    
    // Body parsing with limits
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        try {
          JSON.parse(buf);
        } catch (e) {
          res.status(400).json({ error: 'Invalid JSON' });
          throw new Error('Invalid JSON');
        }
      }
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb',
      parameterLimit: 1000
    }));
  }

  /**
   * Setup routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: config.environment
      });
    });

    // API routes
    this.app.use('/v1/guardrails', guardrailRoutes);
    
    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Failsafe LLM Guardrails API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          guardrails: '/v1/guardrails/health',
          check: '/v1/guardrails/check',
          rules: '/v1/guardrails/rules'
        }
      });
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler (must be last before error handler)
    this.app.use(notFoundHandler);
    
    // Global error handler (must be last)
    this.app.use(errorHandler);
  }

  /**
   * Start the server
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, this.host, () => {
          logger.info('Server started successfully', {
            host: this.host,
            port: this.port,
            environment: config.environment,
            timestamp: new Date().toISOString()
          });
          
          this.logStartupInfo();
          resolve();
        });

        this.server.on('error', (error) => {
          logger.error('Server failed to start', { error: error.message });
          reject(error);
        });

        // Graceful shutdown
        this.setupGracefulShutdown();
      } catch (error) {
        logger.error('Failed to start server', { error: error.message });
        reject(error);
      }
    });
  }

  /**
   * Log startup information
   */
  logStartupInfo() {
    logger.info('Application startup complete', {
      version: '1.0.0',
      environment: config.environment,
      features: {
        businessRules: true,
        agenticAnalysis: true,
        aiAnalysis: config.openai.apiKey ? true : false,
        rateLimiting: true,
        compression: true,
        security: true
      },
      endpoints: [
        'GET  /',
        'GET  /health',
        'GET  /v1/guardrails/health',
        'POST /v1/guardrails/check',
        'GET  /v1/guardrails/rules',
        'POST /v1/guardrails/rules',
        'PUT  /v1/guardrails/rules/:ruleId'
      ]
    });
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      
      this.server.close(() => {
        logger.info('Server closed successfully');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Stop the server
   */
  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Server stopped successfully');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Create and start server if this file is run directly
if (require.main === module) {
  const server = new Server();
  
  server.initialize();
  server.start().catch((error) => {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  });
}

module.exports = Server; 