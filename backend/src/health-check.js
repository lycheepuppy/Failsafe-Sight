/**
 * Health Check Script
 * Comprehensive health monitoring for Failsafe LLM Guardrails
 */

const axios = require('axios');
const config = require('./config');
const logger = require('./utils/logger');

class HealthChecker {
  constructor() {
    this.baseUrl = `http://${config.server.host}:${config.server.port}`;
    this.checks = [
      { name: 'server_connectivity', fn: this.checkServerConnectivity.bind(this) },
      { name: 'health_endpoint', fn: this.checkHealthEndpoint.bind(this) },
      { name: 'api_endpoint', fn: this.checkApiEndpoint.bind(this) },
      { name: 'memory_usage', fn: this.checkMemoryUsage.bind(this) },
      { name: 'openai_connectivity', fn: this.checkOpenAIConnectivity.bind(this) }
    ];
  }

  /**
   * Check server connectivity
   */
  async checkServerConnectivity() {
    try {
      const response = await axios.get(`${this.baseUrl}/`, { timeout: 5000 });
      return {
        status: 'healthy',
        responseTime: response.headers['x-response-time'] || 'unknown',
        statusCode: response.status
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Check health endpoint
   */
  async checkHealthEndpoint() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
      return {
        status: 'healthy',
        uptime: response.data.uptime,
        environment: response.data.environment,
        version: response.data.version
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Check API endpoint
   */
  async checkApiEndpoint() {
    try {
      const testData = {
        input: 'Test input for health check',
        reasoning: 'Health check reasoning',
        output: 'Health check output'
      };
      
      const response = await axios.post(
        `${this.baseUrl}/v1/guardrails/check`,
        testData,
        { 
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      return {
        status: 'healthy',
        responseTime: response.headers['x-response-time'] || 'unknown',
        hasResult: !!response.data
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        statusCode: error.response?.status
      };
    }
  }

  /**
   * Check memory usage
   */
  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };

    // Check if memory usage is reasonable (less than 1GB for heap used)
    const isHealthy = memUsageMB.heapUsed < 1024;
    
    return {
      status: isHealthy ? 'healthy' : 'warning',
      memory: memUsageMB,
      threshold: '1GB'
    };
  }

  /**
   * Check OpenAI connectivity
   */
  async checkOpenAIConnectivity() {
    if (!config.openai.apiKey) {
      return {
        status: 'warning',
        message: 'OpenAI API key not configured'
      };
    }

    try {
      // Simple test to OpenAI API
      const response = await axios.get('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${config.openai.apiKey}`
        },
        timeout: 10000
      });
      
      return {
        status: 'healthy',
        modelsAvailable: response.data.data?.length || 0
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        statusCode: error.response?.status
      };
    }
  }

  /**
   * Run all health checks
   */
  async runAllChecks() {
    const results = {};
    const startTime = Date.now();

    logger.info('Starting health checks...');

    for (const check of this.checks) {
      try {
        const start = Date.now();
        const result = await check.fn();
        const duration = Date.now() - start;
        
        results[check.name] = {
          ...result,
          duration,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        results[check.name] = {
          status: 'error',
          error: error.message,
          duration: 0,
          timestamp: new Date().toISOString()
        };
      }
    }

    const totalDuration = Date.now() - startTime;
    const overallStatus = this.determineOverallStatus(results);

    const healthReport = {
      status: overallStatus,
      checks: results,
      summary: {
        total: Object.keys(results).length,
        healthy: Object.values(results).filter(r => r.status === 'healthy').length,
        unhealthy: Object.values(results).filter(r => r.status === 'unhealthy').length,
        warning: Object.values(results).filter(r => r.status === 'warning').length,
        error: Object.values(results).filter(r => r.status === 'error').length
      },
      timestamp: new Date().toISOString(),
      duration: totalDuration
    };

    logger.info('Health check completed', healthReport);
    return healthReport;
  }

  /**
   * Determine overall health status
   */
  determineOverallStatus(results) {
    const statuses = Object.values(results).map(r => r.status);
    
    if (statuses.includes('unhealthy') || statuses.includes('error')) {
      return 'unhealthy';
    } else if (statuses.includes('warning')) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  /**
   * Print health report
   */
  printReport(report) {
    console.log('\n🏥 Health Check Report');
    console.log('=====================');
    console.log(`Status: ${report.status.toUpperCase()}`);
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Duration: ${report.duration}ms`);
    console.log(`\nSummary:`);
    console.log(`  Total: ${report.summary.total}`);
    console.log(`  Healthy: ${report.summary.healthy}`);
    console.log(`  Unhealthy: ${report.summary.unhealthy}`);
    console.log(`  Warning: ${report.summary.warning}`);
    console.log(`  Error: ${report.summary.error}`);
    
    console.log('\nDetailed Results:');
    Object.entries(report.checks).forEach(([name, result]) => {
      const status = result.status === 'healthy' ? '✅' : 
                    result.status === 'warning' ? '⚠️' : '❌';
      console.log(`  ${status} ${name}: ${result.status} (${result.duration}ms)`);
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }
    });
    
    console.log('');
  }
}

// Run health check if this file is executed directly
if (require.main === module) {
  const healthChecker = new HealthChecker();
  
  healthChecker.runAllChecks()
    .then(report => {
      healthChecker.printReport(report);
      process.exit(report.status === 'healthy' ? 0 : 1);
    })
    .catch(error => {
      logger.error('Health check failed', { error: error.message });
      console.error('❌ Health check failed:', error.message);
      process.exit(1);
    });
}

module.exports = HealthChecker; 