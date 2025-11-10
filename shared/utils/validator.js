/**
 * KS Bot - Validator Utility
 * 
 * Input validation and sanitization functions.
 * Uses Joi for complex validation schemas.
 */

const Joi = require('joi');
const sanitizeHtml = require('sanitize-html');
const { VALIDATION, LIMITS } = require('../constants');

/**
 * Validate Discord snowflake ID
 * @param {string} id - Discord ID to validate
 * @returns {boolean} True if valid
 */
function isValidDiscordId(id) {
  if (typeof id !== 'string') return false;
  return VALIDATION.DISCORD_ID.test(id);
}

/**
 * Validate Roblox user ID
 * @param {string|number} id - Roblox user ID
 * @returns {boolean} True if valid
 */
function isValidRobloxUserId(id) {
  const idStr = String(id);
  return VALIDATION.ROBLOX_USER_ID.test(idStr);
}

/**
 * Validate Roblox group ID
 * @param {string|number} id - Roblox group ID
 * @returns {boolean} True if valid
 */
function isValidRobloxGroupId(id) {
  const idStr = String(id);
  return VALIDATION.ROBLOX_GROUP_ID.test(idStr);
}

/**
 * Validate Roblox place ID
 * @param {string|number} id - Roblox place ID
 * @returns {boolean} True if valid
 */
function isValidRobloxPlaceId(id) {
  const idStr = String(id);
  return VALIDATION.ROBLOX_PLACE_ID.test(idStr);
}

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  return VALIDATION.EMAIL.test(email);
}

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
function isValidUrl(url) {
  if (typeof url !== 'string') return false;
  return VALIDATION.URL.test(url);
}

/**
 * Validate hex color code
 * @param {string} color - Hex color to validate
 * @returns {boolean} True if valid
 */
function isValidHexColor(color) {
  if (typeof color !== 'string') return false;
  return VALIDATION.HEX_COLOR.test(color);
}

/**
 * Validate API key format
 * @param {string} apiKey - API key to validate
 * @returns {boolean} True if valid
 */
function isValidApiKey(apiKey) {
  if (typeof apiKey !== 'string') return false;
  return VALIDATION.API_KEY.test(apiKey);
}

/**
 * Sanitize user input (remove HTML, XSS protection)
 * @param {string} input - Input to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized string
 */
function sanitizeInput(input, options = {}) {
  if (typeof input !== 'string') return '';
  
  const defaultOptions = {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'escape'
  };
  
  return sanitizeHtml(input, { ...defaultOptions, ...options });
}

/**
 * Validate and sanitize application response
 * @param {string} response - User response
 * @param {number} maxLength - Maximum length
 * @returns {Object} { valid, sanitized, error }
 */
function validateApplicationResponse(response, maxLength = LIMITS.APPLICATION.MAX_RESPONSE_LENGTH) {
  if (!response || typeof response !== 'string') {
    return {
      valid: false,
      sanitized: '',
      error: 'Response is required'
    };
  }
  
  const trimmed = response.trim();
  
  if (trimmed.length === 0) {
    return {
      valid: false,
      sanitized: '',
      error: 'Response cannot be empty'
    };
  }
  
  if (trimmed.length > maxLength) {
    return {
      valid: false,
      sanitized: trimmed,
      error: `Response exceeds maximum length of ${maxLength} characters`
    };
  }
  
  const sanitized = sanitizeInput(trimmed, {
    allowedTags: ['b', 'i', 'u', 'br', 'p'],
    allowedAttributes: {}
  });
  
  return {
    valid: true,
    sanitized,
    error: null
  };
}

/**
 * Joi schema for application template creation
 */
const applicationTemplateSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(LIMITS.APPLICATION.MAX_TEMPLATE_NAME_LENGTH)
    .required()
    .messages({
      'string.min': 'Template name must be at least 3 characters',
      'string.max': `Template name cannot exceed ${LIMITS.APPLICATION.MAX_TEMPLATE_NAME_LENGTH} characters`,
      'any.required': 'Template name is required'
    }),
  
  description: Joi.string()
    .max(500)
    .optional()
    .allow(''),
  
  questions: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        type: Joi.string()
          .valid('short_text', 'long_text', 'multiple_choice', 'dropdown', 'checkbox', 'number', 'email', 'url', 'date')
          .required(),
        question: Joi.string()
          .min(5)
          .max(LIMITS.APPLICATION.MAX_QUESTION_LENGTH)
          .required(),
        required: Joi.boolean().default(true),
        choices: Joi.array()
          .items(Joi.string())
          .max(LIMITS.APPLICATION.MAX_CHOICE_OPTIONS)
          .when('type', {
            is: Joi.string().valid('multiple_choice', 'dropdown', 'checkbox'),
            then: Joi.required(),
            otherwise: Joi.optional()
          }),
        placeholder: Joi.string().optional(),
        validation: Joi.object({
          minLength: Joi.number().integer().min(0).optional(),
          maxLength: Joi.number().integer().min(0).optional(),
          min: Joi.number().optional(),
          max: Joi.number().optional(),
          pattern: Joi.string().optional()
        }).optional()
      })
    )
    .min(1)
    .max(LIMITS.APPLICATION.MAX_QUESTIONS)
    .required()
    .messages({
      'array.min': 'At least one question is required',
      'array.max': `Cannot exceed ${LIMITS.APPLICATION.MAX_QUESTIONS} questions`
    }),
  
  cooldownMinutes: Joi.number()
    .integer()
    .min(0)
    .max(1440)
    .default(60),
  
  roleId: Joi.string()
    .pattern(VALIDATION.DISCORD_ID)
    .optional()
    .allow(null),
  
  enabled: Joi.boolean().default(true),
  
  allowRobloxSubmissions: Joi.boolean().default(false),
  
  requirePlaytime: Joi.number()
    .integer()
    .min(0)
    .default(0),
  
  autoApprove: Joi.boolean().default(false),
  
  autoApproveConditions: Joi.object({
    minAccountAge: Joi.number().integer().min(0).optional(),
    requiredRole: Joi.string().pattern(VALIDATION.DISCORD_ID).optional(),
    minPlaytime: Joi.number().integer().min(0).optional()
  }).optional()
});

/**
 * Joi schema for Roblox link creation
 */
const robloxLinkSchema = Joi.object({
  serverId: Joi.string()
    .pattern(VALIDATION.DISCORD_ID)
    .required(),
  
  groupId: Joi.string()
    .pattern(VALIDATION.ROBLOX_GROUP_ID)
    .required()
    .messages({
      'string.pattern.base': 'Invalid Roblox group ID format'
    }),
  
  placeIds: Joi.array()
    .items(
      Joi.string().pattern(VALIDATION.ROBLOX_PLACE_ID)
    )
    .min(1)
    .max(LIMITS.ROBLOX.MAX_PLACE_IDS)
    .required(),
  
  enabledTemplates: Joi.array()
    .items(Joi.string())
    .max(LIMITS.ROBLOX.MAX_TEMPLATES_IN_GAME)
    .default([]),
  
  roleMappings: Joi.object()
    .pattern(
      Joi.string(),
      Joi.object({
        discordRoleId: Joi.string().pattern(VALIDATION.DISCORD_ID).required(),
        robloxRank: Joi.number().integer().min(0).max(255).required()
      })
    )
    .max(LIMITS.ROBLOX.MAX_ROLE_MAPPINGS),
  
  settings: Joi.object({
    requirePlaytime: Joi.number().integer().min(0).default(60),
    rateLimitMinutes: Joi.number().integer().min(1).max(1440).default(60),
    notificationsEnabled: Joi.boolean().default(true),
    autoSync: Joi.boolean().default(true),
    syncIntervalMinutes: Joi.number().integer().min(1).max(60).default(5)
  }).default()
});

/**
 * Joi schema for ticket creation
 */
const ticketSchema = Joi.object({
  userId: Joi.string()
    .pattern(VALIDATION.DISCORD_ID)
    .required(),
  
  guildId: Joi.string()
    .pattern(VALIDATION.DISCORD_ID)
    .required(),
  
  subject: Joi.string()
    .min(5)
    .max(100)
    .required()
    .messages({
      'string.min': 'Subject must be at least 5 characters',
      'string.max': 'Subject cannot exceed 100 characters'
    }),
  
  description: Joi.string()
    .min(10)
    .max(2000)
    .required()
    .messages({
      'string.min': 'Description must be at least 10 characters',
      'string.max': 'Description cannot exceed 2000 characters'
    }),
  
  priority: Joi.string()
    .valid('low', 'medium', 'high', 'urgent')
    .default('medium'),
  
  category: Joi.string()
    .max(50)
    .optional()
});

/**
 * Validate application template
 * @param {Object} template - Template data
 * @returns {Object} { valid, value, error }
 */
function validateApplicationTemplate(template) {
  const { error, value } = applicationTemplateSchema.validate(template, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    return {
      valid: false,
      value: null,
      error: error.details.map(d => d.message).join(', ')
    };
  }
  
  return {
    valid: true,
    value,
    error: null
  };
}

/**
 * Validate Roblox link data
 * @param {Object} linkData - Link data
 * @returns {Object} { valid, value, error }
 */
function validateRobloxLink(linkData) {
  const { error, value } = robloxLinkSchema.validate(linkData, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    return {
      valid: false,
      value: null,
      error: error.details.map(d => d.message).join(', ')
    };
  }
  
  return {
    valid: true,
    value,
    error: null
  };
}

/**
 * Validate ticket data
 * @param {Object} ticketData - Ticket data
 * @returns {Object} { valid, value, error }
 */
function validateTicket(ticketData) {
  const { error, value } = ticketSchema.validate(ticketData, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    return {
      valid: false,
      value: null,
      error: error.details.map(d => d.message).join(', ')
    };
  }
  
  return {
    valid: true,
    value,
    error: null
  };
}

/**
 * Validate timestamp (prevent replay attacks)
 * @param {number} timestamp - Unix timestamp
 * @param {number} maxDrift - Max allowed drift in seconds
 * @returns {boolean} True if valid
 */
function validateTimestamp(timestamp, maxDrift = 300) {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - timestamp);
  return diff <= maxDrift;
}

/**
 * Validate file size
 * @param {number} size - File size in bytes
 * @param {number} maxSize - Max size in bytes
 * @returns {boolean} True if valid
 */
function validateFileSize(size, maxSize) {
  return size > 0 && size <= maxSize;
}

/**
 * Validate array of IDs
 * @param {Array} ids - Array of IDs
 * @param {Function} validator - Validator function
 * @returns {Object} { valid, invalidIds }
 */
function validateIdArray(ids, validator) {
  if (!Array.isArray(ids)) {
    return { valid: false, invalidIds: [] };
  }
  
  const invalidIds = ids.filter(id => !validator(id));
  
  return {
    valid: invalidIds.length === 0,
    invalidIds
  };
}

/**
 * Validate rate limit
 * @param {Object} cache - Rate limit cache (Map or similar)
 * @param {string} key - Rate limit key
 * @param {number} limit - Max requests
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Object} { allowed, remaining, resetAt }
 */
function checkRateLimit(cache, key, limit, windowMs) {
  const now = Date.now();
  const record = cache.get(key);
  
  if (!record || now > record.resetAt) {
    // New window
    cache.set(key, {
      count: 1,
      resetAt: now + windowMs
    });
    
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + windowMs
    };
  }
  
  if (record.count >= limit) {
    // Rate limited
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt
    };
  }
  
  // Increment count
  record.count++;
  cache.set(key, record);
  
  return {
    allowed: true,
    remaining: limit - record.count,
    resetAt: record.resetAt
  };
}

module.exports = {
  // Basic validators
  isValidDiscordId,
  isValidRobloxUserId,
  isValidRobloxGroupId,
  isValidRobloxPlaceId,
  isValidEmail,
  isValidUrl,
  isValidHexColor,
  isValidApiKey,
  
  // Sanitization
  sanitizeInput,
  validateApplicationResponse,
  
  // Schema validators
  validateApplicationTemplate,
  validateRobloxLink,
  validateTicket,
  
  // Utility validators
  validateTimestamp,
  validateFileSize,
  validateIdArray,
  checkRateLimit,
  
  // Export schemas for custom validation
  schemas: {
    applicationTemplate: applicationTemplateSchema,
    robloxLink: robloxLinkSchema,
    ticket: ticketSchema
  }
};