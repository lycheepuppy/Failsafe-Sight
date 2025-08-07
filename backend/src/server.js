/**
 * Failsafe LLM Guardrails Server
 * Enhanced server entry point with enterprise-grade security and performance
 */

// Load environment variables first
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const useragent = require('express-useragent');
const config = require('./config');
const logger = require('./utils/logger');
const guardrailRoutes = require('./routes/guardrailRoutes');
const { errorHandler, notFoundHandler, requestLogger, corsHandler } = require('./middleware/errorHandler');

class Server {
  constructor() {
    this.app = express();
    this.port = config.server.port;
    this.host = config.server.host;
    this.server = null;
  }

  /**
   * Initialize the server
   */
  initialize() {
    this.setupSecurity();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupMonitoring();
  }

  /**
   * Setup enhanced security middleware
   */
  setupSecurity() {
    // Enhanced security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // HTTP Parameter Pollution protection
    if (config.security.enableHpp) {
      this.app.use(hpp());
    }

    // XSS protection (built into helmet)
    // Additional XSS protection can be added here if needed

    // NoSQL injection protection
    if (config.security.enableMongoSanitize) {
      this.app.use(mongoSanitize());
    }

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.server.rateLimit.windowMs,
      max: config.server.rateLimit.max,
      skipSuccessfulRequests: config.server.rateLimit.skipSuccessfulRequests,
      skipFailedRequests: config.server.rateLimit.skipFailedRequests,
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(config.server.rateLimit.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn('Rate limit exceeded', { ip: req.ip, userAgent: req.get('User-Agent') });
        res.status(429).json({
          error: 'Too many requests from this IP, please try again later.',
          retryAfter: Math.ceil(config.server.rateLimit.windowMs / 1000)
        });
      }
    });

    // Slow down requests
    const speedLimiter = slowDown({
      windowMs: config.server.slowDown.windowMs,
      delayAfter: config.server.slowDown.delayAfter,
      delayMs: config.server.slowDown.delayMs,
      handler: (req, res) => {
        logger.warn('Request slowed down', { ip: req.ip, userAgent: req.get('User-Agent') });
        res.status(429).json({
          error: 'Too many requests, please slow down.',
          retryAfter: Math.ceil(config.server.slowDown.windowMs / 1000)
        });
      }
    });

    this.app.use('/v1/', limiter);
    this.app.use('/v1/', speedLimiter);

    // User agent filtering
    if (config.security.enableUserAgentFilter) {
      this.app.use((req, res, next) => {
        const userAgent = req.get('User-Agent');
        const blockedAgents = config.security.blockedUserAgents;
        
        if (blockedAgents.some(agent => userAgent && userAgent.includes(agent))) {
          logger.warn('Blocked user agent', { userAgent, ip: req.ip });
          return res.status(403).json({ error: 'Access denied' });
        }
        next();
      });
    }

    // Request timeout
    this.app.use((req, res, next) => {
      req.setTimeout(config.server.timeout, () => {
        logger.warn('Request timeout', { url: req.url, method: req.method, ip: req.ip });
        res.status(408).json({ error: 'Request timeout' });
      });
      next();
    });
  }

  /**
   * Setup enhanced middleware
   */
  setupMiddleware() {
    // Compression
    if (config.performance.enableCompression) {
      this.app.use(compression({
        level: config.performance.compressionLevel,
        threshold: config.performance.gzipThreshold
      }));
    }
    
    // Request logging (conditional)
    if (config.logging.enableRequestLogging) {
      this.app.use(requestLogger);
    }
    
    // CORS handling
    this.app.use(corsHandler);
    
    // Body parsing with enhanced limits and validation
    this.app.use(express.json({ 
      limit: config.server.maxPayloadSize,
      verify: (req, res, buf) => {
        try {
          JSON.parse(buf);
        } catch (e) {
          logger.warn('Invalid JSON payload', { error: e.message, ip: req.ip });
          res.status(400).json({ error: 'Invalid JSON' });
          throw new Error('Invalid JSON');
        }
      }
    }));

    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: config.server.maxPayloadSize 
    }));

    // Trust proxy for rate limiting
    if (config.server.trustProxy) {
      this.app.set('trust proxy', 1);
    }
  }

  /**
   * Setup routes
   */
  setupRoutes() {
    // Health check endpoint
    if (config.monitoring.enableHealthCheck) {
      this.app.get('/health', (req, res) => {
        res.status(200).json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: config.environment,
          version: require('../package.json').version
        });
      });
    }

    // Metrics endpoint (basic)
    if (config.monitoring.enableMetrics) {
      this.app.get('/metrics', (req, res) => {
        const metrics = {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          timestamp: new Date().toISOString()
        };
        res.status(200).json(metrics);
      });
    }

    // API routes
    this.app.use('/v1/guardrails', guardrailRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Failsafe LLM Guardrails API',
        version: require('../package.json').version,
        environment: config.environment,
        status: 'running',
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use(notFoundHandler);
    
    // Global error handler
    this.app.use(errorHandler);
  }

  /**
   * Setup monitoring
   */
  setupMonitoring() {
    // Performance monitoring
    if (config.monitoring.enablePerformanceMonitoring) {
      this.app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
          const duration = Date.now() - start;
          if (config.logging.enablePerformanceLogging) {
            logger.info('Request performance', {
              method: req.method,
              url: req.url,
              statusCode: res.statusCode,
              duration,
              ip: req.ip
            });
          }
        });
        next();
      });
    }
  }

  /**
   * Start the server
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, this.host, () => {
          this.logStartupInfo();
          this.setupGracefulShutdown();
          resolve();
        });

        this.server.on('error', (error) => {
          logger.error('Server error', { error: error.message });
          reject(error);
        });

        // Keep-alive settings
        if (config.performance.enableKeepAlive) {
          this.server.keepAliveTimeout = config.performance.keepAliveTimeout;
          this.server.maxConnections = config.performance.maxKeepAliveRequests;
        }

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
    logger.info('🚀 Failsafe LLM Guardrails Server Started', {
      port: this.port,
      host: this.host,
      environment: config.environment,
      version: require('../package.json').version,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid
    });

    if (config.isDevelopment) {
      console.log(`\n🌐 Server running at: http://${this.host}:${this.port}`);
      console.log(`📊 Health check: http://${this.host}:${this.port}/health`);
      console.log(`📈 Metrics: http://${this.host}:${this.port}/metrics`);
      console.log(`🔧 Environment: ${config.environment}\n`);
    }
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = (signal) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
          process.exit(0);
        });

        // Force close after 30 seconds
        setTimeout(() => {
          logger.error('Forced shutdown after timeout');
          process.exit(1);
        }, 30000);
      } else {
        process.exit(0);
      }
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
          logger.info('Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Create and start server
const server = new Server();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason: reason?.message || reason, promise });
  process.exit(1);
});

// Start server if this file is run directly
if (require.main === module) {
  server.initialize();
  server.start().catch((error) => {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  });
}

module.exports = server; 