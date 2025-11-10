/**
 * KS Bot - Roblox API Server
 * 
 * Express server for handling API requests from Roblox games.
 * Includes authentication, rate limiting, and route management.
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { main: logger } = require('../../shared/utils/logger');
const config = require('../config');

// Import middleware
const authMiddleware = require('./auth');

// Import routes
const validateRoute = require('./routes/validate');
const templatesRoute = require('./routes/templates');
const submitRoute = require('./routes/submit');
const notifyRoute = require('./routes/notify');
const syncRoute = require('./routes/sync');

class RobloxAPIServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.port = config.api.port;
  }

  /**
   * Initialize and configure the API server
   */
  initialize() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.api.allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Signature'],
      credentials: true
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Global rate limiting
    const globalLimiter = rateLimit({
      windowMs: config.api.rateLimit.windowMs,
      max: config.api.rateLimit.maxRequests,
      message: {
        success: false,
        error: 'Too many requests, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          path: req.path
        });
        res.status(429).json({
          success: false,
          error: 'Too many requests, please try again later'
        });
      }
    });

    this.app.use('/api', globalLimiter);

    // Request logging middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info('API Request', {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip
        });
      });

      next();
    });

    // Health check endpoint (no auth required)
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // API version endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        success: true,
        name: 'KS Bot Roblox API',
        version: config.api.version,
        endpoints: {
          validate: '/api/roblox/validate',
          templates: '/api/roblox/templates',
          submit: '/api/roblox/submit',
          notify: '/api/roblox/notify',
          sync: '/api/roblox/sync'
        }
      });
    });

    // Mount API routes (all require authentication)
    this.app.use('/api/roblox/validate', authMiddleware, validateRoute);
    this.app.use('/api/roblox/templates', authMiddleware, templatesRoute);
    this.app.use('/api/roblox/submit', authMiddleware, submitRoute);
    this.app.use('/api/roblox/notify', authMiddleware, notifyRoute);
    this.app.use('/api/roblox/sync', authMiddleware, syncRoute);

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    });

    // Global error handler
    this.app.use((err, req, res, next) => {
      logger.error('API Error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
      });

      res.status(err.status || 500).json({
        success: false,
        error: config.debug.enabled ? err.message : 'Internal server error'
      });
    });

    logger.info('Roblox API server initialized');
  }

  /**
   * Start the API server
   * @returns {Promise<void>}
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          logger.info(`Roblox API server listening on port ${this.port}`);
          resolve();
        });

        this.server.on('error', (error) => {
          logger.error('Failed to start API server', { error });
          reject(error);
        });
      } catch (error) {
        logger.error('API server startup error', { error });
        reject(error);
      }
    });
  }

  /**
   * Stop the API server
   * @returns {Promise<void>}
   */
  async stop() {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          logger.error('Error stopping API server', { error });
          reject(error);
        } else {
          logger.info('Roblox API server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Restart the API server
   * @returns {Promise<void>}
   */
  async restart() {
    await this.stop();
    await this.start();
    logger.info('Roblox API server restarted');
  }

  /**
   * Get server status
   * @returns {Object}
   */
  getStatus() {
    return {
      running: this.server !== null,
      port: this.port,
      uptime: process.uptime()
    };
  }
}

// Export singleton instance
const apiServer = new RobloxAPIServer();
module.exports = apiServer;