/**
 * KS Bot - Logger Utility
 * 
 * Centralized logging system using Winston.
 * Handles console and file logging with rotation.
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

const { LOG_LEVELS } = require('../constants');

// Ensure log directory exists
const logDir = process.env.LOG_PATH || './logs';
fs.ensureDirSync(logDir);
fs.ensureDirSync(path.join(logDir, 'roblox'));
fs.ensureDirSync(path.join(logDir, 'discord'));
fs.ensureDirSync(path.join(logDir, 'errors'));

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      msg += `\n${stack}`;
    }
    
    return msg;
  })
);

// Console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} ${level}: ${message}`;
    
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata, null, 2)}`;
    }
    
    return msg;
  })
);

// Transport: Console
const consoleTransport = new winston.transports.Console({
  format: consoleFormat,
  level: process.env.LOG_LEVEL || 'info'
});

// Transport: Combined logs (all levels)
const combinedFileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
  level: 'info'
});

// Transport: Error logs
const errorFileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'errors', 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat,
  level: 'error'
});

// Transport: Roblox specific logs
const robloxFileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'roblox', 'roblox-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
  level: 'debug'
});

// Transport: Discord specific logs
const discordFileTransport = new DailyRotateFile({
  filename: path.join(logDir, 'discord', 'discord-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
  level: 'debug'
});

// Create main logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    consoleTransport,
    combinedFileTransport,
    errorFileTransport
  ],
  exitOnError: false
});

// Create specialized loggers
const robloxLogger = winston.createLogger({
  level: 'debug',
  format: logFormat,
  transports: [
    consoleTransport,
    robloxFileTransport,
    errorFileTransport
  ],
  defaultMeta: { service: 'roblox' }
});

const discordLogger = winston.createLogger({
  level: 'debug',
  format: logFormat,
  transports: [
    consoleTransport,
    discordFileTransport,
    errorFileTransport
  ],
  defaultMeta: { service: 'discord' }
});

// Helper functions for structured logging
const loggers = {
  /**
   * Main logger - general purpose
   */
  main: {
    error: (message, meta = {}) => logger.error(message, meta),
    warn: (message, meta = {}) => logger.warn(message, meta),
    info: (message, meta = {}) => logger.info(message, meta),
    debug: (message, meta = {}) => logger.debug(message, meta),
    verbose: (message, meta = {}) => logger.verbose(message, meta)
  },

  /**
   * Roblox logger - for Roblox integration events
   */
  roblox: {
    error: (message, meta = {}) => robloxLogger.error(message, meta),
    warn: (message, meta = {}) => robloxLogger.warn(message, meta),
    info: (message, meta = {}) => robloxLogger.info(message, meta),
    debug: (message, meta = {}) => robloxLogger.debug(message, meta),
    
    // Specialized Roblox logging
    apiCall: (endpoint, method, status, duration) => {
      robloxLogger.info('Roblox API Call', {
        endpoint,
        method,
        status,
        duration: `${duration}ms`
      });
    },
    
    submission: (serverId, userId, templateId, source) => {
      robloxLogger.info('Application Submission', {
        serverId,
        robloxUserId: userId,
        templateId,
        source
      });
    },
    
    sync: (serverId, userId, rank, success) => {
      robloxLogger.info('Role Sync', {
        serverId,
        robloxUserId: userId,
        newRank: rank,
        success
      });
    },
    
    verification: (serverId, groupId, success) => {
      robloxLogger.info('Group Verification', {
        serverId,
        groupId,
        success
      });
    }
  },

  /**
   * Discord logger - for Discord bot events
   */
  discord: {
    error: (message, meta = {}) => discordLogger.error(message, meta),
    warn: (message, meta = {}) => discordLogger.warn(message, meta),
    info: (message, meta = {}) => discordLogger.info(message, meta),
    debug: (message, meta = {}) => discordLogger.debug(message, meta),
    
    // Specialized Discord logging
    command: (commandName, userId, guildId, success = true) => {
      discordLogger.info('Command Executed', {
        command: commandName,
        userId,
        guildId,
        success
      });
    },
    
    interaction: (type, customId, userId, guildId) => {
      discordLogger.debug('Interaction Received', {
        type,
        customId,
        userId,
        guildId
      });
    },
    
    application: (action, applicationId, userId, guildId) => {
      discordLogger.info('Application Action', {
        action,
        applicationId,
        userId,
        guildId
      });
    },
    
    ticket: (action, ticketId, userId, guildId) => {
      discordLogger.info('Ticket Action', {
        action,
        ticketId,
        userId,
        guildId
      });
    }
  },

  /**
   * Security logger - for security-related events
   */
  security: {
    log: (event, severity, details) => {
      const logLevel = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
      logger.log(logLevel, `SECURITY: ${event}`, {
        severity,
        timestamp: new Date().toISOString(),
        ...details
      });
    },
    
    unauthorizedAccess: (userId, resource, ip = null) => {
      logger.warn('SECURITY: Unauthorized Access Attempt', {
        userId,
        resource,
        ip,
        severity: 'high'
      });
    },
    
    apiKeyUsed: (serverId, apiKey, endpoint, success) => {
      logger.info('SECURITY: API Key Usage', {
        serverId,
        apiKeyPreview: apiKey.substring(0, 20) + '...',
        endpoint,
        success
      });
    },
    
    rateLimited: (identifier, endpoint, limit) => {
      logger.warn('SECURITY: Rate Limit Hit', {
        identifier,
        endpoint,
        limit
      });
    }
  },

  /**
   * Database logger - for database operations
   */
  database: {
    error: (message, meta = {}) => logger.error(message, meta),
    warn: (message, meta = {}) => logger.warn(message, meta),
    info: (message, meta = {}) => logger.info(message, meta),
    debug: (message, meta = {}) => logger.debug(message, meta),
    verbose: (message, meta = {}) => logger.verbose(message, meta),
    
    read: (collection, operation, success, duration) => {
      logger.debug('Database Read', {
        collection,
        operation,
        success,
        duration: `${duration}ms`
      });
    },
    
    write: (collection, operation, recordCount, success, duration) => {
      logger.info('Database Write', {
        collection,
        operation,
        recordCount,
        success,
        duration: `${duration}ms`
      });
    },
    
    backup: (success, path, size = null) => {
      logger.info('Database Backup', {
        success,
        path,
        size: size ? `${(size / 1024 / 1024).toFixed(2)}MB` : 'unknown'
      });
    }
  },

  /**
   * Performance logger - for performance monitoring
   */
  performance: {
    measure: (operation, duration, metadata = {}) => {
      const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
      logger.log(level, `Performance: ${operation}`, {
        duration: `${duration}ms`,
        ...metadata
      });
    },
    
    apiLatency: (service, endpoint, duration) => {
      const level = duration > 3000 ? 'warn' : 'debug';
      logger.log(level, `API Latency: ${service}`, {
        endpoint,
        duration: `${duration}ms`
      });
    }
  }
};

/**
 * Create a child logger with default metadata
 * @param {Object} defaultMeta - Default metadata to include in all logs
 * @returns {Object} Child logger instance
 */
function createChildLogger(defaultMeta = {}) {
  return logger.child(defaultMeta);
}

/**
 * Log an error with full context
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
function logError(error, context = {}) {
  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code || 'UNKNOWN'
    },
    context
  });
}

/**
 * Log startup information
 */
function logStartup() {
  logger.info('='.repeat(60));
  logger.info('KS Bot Starting...');
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Log Level: ${process.env.LOG_LEVEL || 'info'}`);
  logger.info(`Node Version: ${process.version}`);
  logger.info(`Process ID: ${process.pid}`);
  logger.info('='.repeat(60));
}

/**
 * Log shutdown information
 */
function logShutdown(reason = 'Unknown') {
  logger.info('='.repeat(60));
  logger.info('KS Bot Shutting Down...');
  logger.info(`Reason: ${reason}`);
  logger.info(`Uptime: ${process.uptime().toFixed(2)} seconds`);
  logger.info('='.repeat(60));
}

// Export loggers
module.exports = {
  ...loggers,
  logger, // Raw winston logger
  createChildLogger,
  logError,
  logStartup,
  logShutdown
};