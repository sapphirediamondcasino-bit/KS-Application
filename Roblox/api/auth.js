/**
 * KS Bot - API Authentication Middleware
 * 
 * Validates API keys and request signatures from Roblox game servers.
 */

const robloxLinks = require('../database/roblox_links');
const encryption = require('../utils/encryption');
const { security: logger } = require('../../shared/utils/logger');
const { validateTimestamp } = require('../../shared/utils/validator');

/**
 * Authentication middleware
 * Validates API key and request signature
 */
async function authMiddleware(req, res, next) {
  try {
    // Extract API key from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.unauthorizedAccess('unknown', 'No API key provided', req.ip);
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NO_API_KEY'
      });
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate API key format
    if (!apiKey || apiKey.length < 32) {
      logger.unauthorizedAccess('unknown', 'Invalid API key format', req.ip);
      return res.status(401).json({
        success: false,
        error: 'Invalid API key format',
        code: 'INVALID_API_KEY'
      });
    }

    // Validate API key against database
    const link = await robloxLinks.validateApiKey(apiKey);

    if (!link) {
      logger.unauthorizedAccess('unknown', 'Invalid API key', req.ip);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired API key',
        code: 'INVALID_API_KEY'
      });
    }

    // Check if link is verified
    if (!link.verified) {
      logger.unauthorizedAccess(link.serverId, 'Group not verified', req.ip);
      return res.status(403).json({
        success: false,
        error: 'Roblox group not verified',
        code: 'NOT_VERIFIED'
      });
    }

    // Validate request timestamp (prevent replay attacks)
    const timestamp = req.body.timestamp || req.query.timestamp;

    if (!timestamp) {
      logger.unauthorizedAccess(link.serverId, 'No timestamp provided', req.ip);
      return res.status(400).json({
        success: false,
        error: 'Timestamp required',
        code: 'NO_TIMESTAMP'
      });
    }

    if (!validateTimestamp(timestamp, 300)) { // 5 minute window
      logger.unauthorizedAccess(link.serverId, 'Invalid timestamp', req.ip);
      return res.status(400).json({
        success: false,
        error: 'Request timestamp is invalid or expired',
        code: 'INVALID_TIMESTAMP'
      });
    }

    // Validate request signature if present
    const signature = req.headers['x-request-signature'];

    if (signature) {
      const method = req.method;
      const path = req.path;
      const body = req.body;

      const isValid = encryption.verifyRequestSignature(
        method,
        path,
        body,
        timestamp,
        signature,
        apiKey
      );

      if (!isValid) {
        logger.unauthorizedAccess(link.serverId, 'Invalid signature', req.ip);
        return res.status(401).json({
          success: false,
          error: 'Invalid request signature',
          code: 'INVALID_SIGNATURE'
        });
      }
    }

    // Validate place ID if provided
    const placeId = req.body.placeId || req.query.placeId;

    if (placeId && !link.placeIds.includes(placeId.toString())) {
      logger.unauthorizedAccess(link.serverId, 'Unauthorized place ID', req.ip);
      return res.status(403).json({
        success: false,
        error: 'Place ID not authorized for this server',
        code: 'UNAUTHORIZED_PLACE'
      });
    }

    // Attach link data to request for use in routes
    req.robloxLink = link;
    req.serverId = link.serverId;
    req.groupId = link.groupId;
    req.placeId = placeId;

    // Log successful authentication
    logger.apiKeyUsed(link.serverId, apiKey, req.path, true);

    next();
  } catch (error) {
    logger.error('Authentication error', { error: error.message, path: req.path });
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Optional authentication middleware
 * Same as authMiddleware but doesn't block if auth fails
 */
async function optionalAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No auth provided, continue without link data
      next();
      return;
    }

    const apiKey = authHeader.substring(7);
    const link = await robloxLinks.validateApiKey(apiKey);

    if (link && link.verified) {
      req.robloxLink = link;
      req.serverId = link.serverId;
      req.groupId = link.groupId;
    }

    next();
  } catch (error) {
    // Continue without auth on error
    next();
  }
}

/**
 * Rate limiting middleware specific to API endpoints
 */
function createRateLimiter(maxRequests, windowMinutes) {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.serverId || req.ip;
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    // Get or create request record
    let record = requests.get(key);

    if (!record || now - record.resetAt > windowMs) {
      record = {
        count: 0,
        resetAt: now + windowMs
      };
      requests.set(key, record);
    }

    // Check limit
    if (record.count >= maxRequests) {
      const resetIn = Math.ceil((record.resetAt - now) / 1000);

      logger.rateLimited(key, req.path, maxRequests);

      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        code: 'RATE_LIMITED',
        resetIn
      });
    }

    // Increment count
    record.count++;

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - record.count);
    res.setHeader('X-RateLimit-Reset', Math.floor(record.resetAt / 1000));

    next();
  };
}

/**
 * Validate request body middleware
 */
function validateBody(requiredFields) {
  return (req, res, next) => {
    const missing = [];

    for (const field of requiredFields) {
      if (req.body[field] === undefined || req.body[field] === null) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        missing
      });
    }

    next();
  };
}

/**
 * Validate query parameters middleware
 */
function validateQuery(requiredParams) {
  return (req, res, next) => {
    const missing = [];

    for (const param of requiredParams) {
      if (req.query[param] === undefined || req.query[param] === null) {
        missing.push(param);
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        code: 'MISSING_PARAMS',
        missing
      });
    }

    next();
  };
}

/**
 * Error wrapper for async route handlers
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = authMiddleware;
module.exports.optionalAuth = optionalAuthMiddleware;
module.exports.rateLimiter = createRateLimiter;
module.exports.validateBody = validateBody;
module.exports.validateQuery = validateQuery;
module.exports.asyncHandler = asyncHandler;