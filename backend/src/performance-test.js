/**
 * Performance Test Script
 * Benchmark and performance testing for Failsafe LLM Guardrails
 */

const axios = require('axios');
const config = require('./config');
const logger = require('./utils/logger');

class PerformanceTester {
  constructor() {
    this.baseUrl = `http://${config.server.host}:${config.server.port}`;
    this.results = [];
  }

  /**
   * Generate test data
   */
  generateTestData() {
    return {
      input: 'I need a $500 loan for business equipment. I have uploaded my payslips showing $3,000/month income and my business registration.',
      reasoning: 'This appears to be a legitimate business loan request with proper documentation. The amount is reasonable and the income supports repayment.',
      output: 'I can approve your $500 business equipment loan. Your income of $3,000/month provides good repayment capacity.',
      customPrompt: '',
      config: {
        aiEnabled: true,
        loanLimit: 3000,
        minLoan: 100,
        sensitivityLevel: 'medium'
      }
    };
  }

  /**
   * Single request test
   */
  async singleRequestTest() {
    const testData = this.generateTestData();
    const startTime = Date.now();
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/guardrails/check`,
        testData,
        {
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        duration,
        statusCode: response.status,
        responseSize: JSON.stringify(response.data).length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        duration,
        error: error.message,
        statusCode: error.response?.status,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Load test with concurrent requests
   */
  async loadTest(concurrency = 10, duration = 30000) {
    logger.info(`Starting load test: ${concurrency} concurrent requests for ${duration}ms`);
    
    const startTime = Date.now();
    const endTime = startTime + duration;
    const activeRequests = new Set();
    const results = [];
    
    const makeRequest = async () => {
      const result = await this.singleRequestTest();
      results.push(result);
      activeRequests.delete(result);
    };
    
    // Start initial requests
    for (let i = 0; i < concurrency; i++) {
      const request = makeRequest();
      activeRequests.add(request);
    }
    
    // Continue making requests until time is up
    const interval = setInterval(() => {
      if (Date.now() >= endTime) {
        clearInterval(interval);
        return;
      }
      
      // Replace completed requests
      for (let i = activeRequests.size; i < concurrency; i++) {
        const request = makeRequest();
        activeRequests.add(request);
      }
    }, 100);
    
    // Wait for all requests to complete
    await new Promise(resolve => {
      const checkComplete = () => {
        if (activeRequests.size === 0) {
          resolve();
        } else {
          setTimeout(checkComplete, 100);
        }
      };
      checkComplete();
    });
    
    return this.analyzeResults(results);
  }

  /**
   * Stress test
   */
  async stressTest(maxConcurrency = 50, stepSize = 5) {
    logger.info(`Starting stress test: up to ${maxConcurrency} concurrent requests`);
    
    const results = [];
    
    for (let concurrency = stepSize; concurrency <= maxConcurrency; concurrency += stepSize) {
      logger.info(`Testing with ${concurrency} concurrent requests...`);
      
      const testResult = await this.loadTest(concurrency, 10000); // 10 seconds per test
      testResult.concurrency = concurrency;
      results.push(testResult);
      
      // If error rate is too high, stop testing
      if (testResult.errorRate > 0.1) {
        logger.warn(`Error rate too high (${testResult.errorRate * 100}%), stopping stress test`);
        break;
      }
    }
    
    return results;
  }

  /**
   * Analyze test results
   */
  analyzeResults(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const durations = successful.map(r => r.duration);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    
    // Calculate percentiles
    const sortedDurations = durations.sort((a, b) => a - b);
    const p50 = sortedDurations[Math.floor(sortedDurations.length * 0.5)] || 0;
    const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)] || 0;
    const p99 = sortedDurations[Math.floor(sortedDurations.length * 0.99)] || 0;
    
    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: results.length > 0 ? successful.length / results.length : 0,
      errorRate: results.length > 0 ? failed.length / results.length : 0,
      duration: {
        average: Math.round(avgDuration),
        min: minDuration,
        max: maxDuration,
        p50: Math.round(p50),
        p95: Math.round(p95),
        p99: Math.round(p99)
      },
      throughput: results.length > 0 ? Math.round(results.length / (results[results.length - 1].timestamp - results[0].timestamp) * 1000) : 0,
      errors: failed.map(f => f.error).filter((v, i, a) => a.indexOf(v) === i)
    };
  }

  /**
   * Print performance report
   */
  printReport(report, testType = 'Load Test') {
    console.log(`\n🚀 ${testType} Performance Report`);
    console.log('================================');
    console.log(`Total Requests: ${report.total}`);
    console.log(`Successful: ${report.successful}`);
    console.log(`Failed: ${report.failed}`);
    console.log(`Success Rate: ${(report.successRate * 100).toFixed(2)}%`);
    console.log(`Error Rate: ${(report.errorRate * 100).toFixed(2)}%`);
    console.log(`Throughput: ${report.throughput} req/s`);
    
    console.log('\nResponse Times:');
    console.log(`  Average: ${report.duration.average}ms`);
    console.log(`  Min: ${report.duration.min}ms`);
    console.log(`  Max: ${report.duration.max}ms`);
    console.log(`  P50: ${report.duration.p50}ms`);
    console.log(`  P95: ${report.duration.p95}ms`);
    console.log(`  P99: ${report.duration.p99}ms`);
    
    if (report.errors.length > 0) {
      console.log('\nErrors:');
      report.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
    
    console.log('');
  }

  /**
   * Run comprehensive performance tests
   */
  async runPerformanceTests() {
    console.log('🚀 Starting Performance Tests...\n');
    
    // Single request test
    console.log('1. Single Request Test');
    const singleResult = await this.singleRequestTest();
    this.printReport({
      total: 1,
      successful: singleResult.success ? 1 : 0,
      failed: singleResult.success ? 0 : 1,
      successRate: singleResult.success ? 1 : 0,
      errorRate: singleResult.success ? 0 : 1,
      duration: {
        average: singleResult.duration,
        min: singleResult.duration,
        max: singleResult.duration,
        p50: singleResult.duration,
        p95: singleResult.duration,
        p99: singleResult.duration
      },
      throughput: 1,
      errors: singleResult.success ? [] : [singleResult.error]
    }, 'Single Request Test');
    
    // Load test
    console.log('2. Load Test (10 concurrent requests, 30 seconds)');
    const loadResult = await this.loadTest(10, 30000);
    this.printReport(loadResult, 'Load Test');
    
    // Stress test
    console.log('3. Stress Test (up to 50 concurrent requests)');
    const stressResults = await this.stressTest(50, 10);
    
    console.log('\nStress Test Results:');
    stressResults.forEach(result => {
      console.log(`\nConcurrency: ${result.concurrency}`);
      console.log(`  Success Rate: ${(result.successRate * 100).toFixed(2)}%`);
      console.log(`  Average Response Time: ${result.duration.average}ms`);
      console.log(`  Throughput: ${result.throughput} req/s`);
    });
    
    return {
      single: singleResult,
      load: loadResult,
      stress: stressResults
    };
  }
}

// Run performance tests if this file is executed directly
if (require.main === module) {
  const tester = new PerformanceTester();
  
  tester.runPerformanceTests()
    .then(results => {
      logger.info('Performance tests completed', results);
      console.log('\n✅ Performance tests completed successfully!');
    })
    .catch(error => {
      logger.error('Performance test failed', { error: error.message });
      console.error('❌ Performance test failed:', error.message);
      process.exit(1);
    });
}

module.exports = PerformanceTester; 