/**
 * Logger Utility
 * Centralized logging for the Failsafe LLM Guardrails backend
 */

const config = require('../config');

class Logger {
  constructor() {
    this.level = config.logging.level;
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  _shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  _formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(data && { data })
    };

    if (config.logging.format === 'json') {
      return JSON.stringify(logEntry);
    }

    return `[${timestamp}] ${level.toUpperCase()}: ${message}${data ? ` ${JSON.stringify(data)}` : ''}`;
  }

  error(message, data = null) {
    if (this._shouldLog('error')) {
      console.error(this._formatMessage('error', message, data));
    }
  }

  warn(message, data = null) {
    if (this._shouldLog('warn')) {
      console.warn(this._formatMessage('warn', message, data));
    }
  }

  info(message, data = null) {
    if (this._shouldLog('info')) {
      console.info(this._formatMessage('info', message, data));
    }
  }

  debug(message, data = null) {
    if (this._shouldLog('debug')) {
      console.debug(this._formatMessage('debug', message, data));
    }
  }

  // Specialized logging methods
  apiRequest(method, path, duration, statusCode) {
    this.info('API Request', {
      method,
      path,
      duration: `${duration}ms`,
      statusCode
    });
  }

  guardrailCheck(input, result, duration) {
    this.info('Guardrail Check', {
      inputLength: input.length,
      verdict: result.verdict,
      reasonCode: result.reason_code,
      duration: `${duration}ms`
    });
  }

  aiAnalysis(success, duration, error = null) {
    if (success) {
      this.info('AI Analysis Success', { duration: `${duration}ms` });
    } else {
      this.error('AI Analysis Failed', { duration: `${duration}ms`, error });
    }
  }
}

module.exports = new Logger(); 