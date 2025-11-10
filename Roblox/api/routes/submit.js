/**
 * KS Bot - Submit Route
 * 
 * Handles in-game application submissions from Roblox.
 */

const express = require('express');
const router = express.Router();
const serverDb = require('../../../core/database/servers');
const applicationsDb = require('../../../core/database/applications');
const submissionsDb = require('../../database/submissions');
const robloxLinks = require('../../database/roblox_links');
const { asyncHandler, validateBody, rateLimiter } = require('../auth');
const { validateApplicationResponse } = require('../../../shared/utils/validator');
const { roblox: logger } = require('../../../shared/utils/logger');
const { APPLICATION_SOURCE } = require('../../../shared/constants');

// Rate limiter: 5 submissions per hour per user
const submitRateLimiter = rateLimiter(5, 60);

/**
 * POST /api/roblox/submit
 * Submit an application from in-game
 */
router.post('/', 
  submitRateLimiter,
  validateBody(['robloxUserId', 'robloxUsername', 'templateId', 'responses', 'placeId']), 
  asyncHandler(async (req, res) => {
    const { serverId, groupId, placeId } = req;
    const { robloxUserId, robloxUsername, templateId, responses } = req.body;

    try {
      // Get server configuration
      const serverConfig = await serverDb.getServer(serverId);

      if (!serverConfig) {
        return res.status(404).json({
          success: false,
          error: 'Server configuration not found',
          code: 'SERVER_NOT_FOUND'
        });
      }

      // Check if applications are enabled
      if (!serverConfig.applications.enabled) {
        return res.status(403).json({
          success: false,
          error: 'Applications are not enabled for this server',
          code: 'APPLICATIONS_DISABLED'
        });
      }

      // Get template
      const template = await serverDb.getTemplate(serverId, templateId);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
          code: 'TEMPLATE_NOT_FOUND'
        });
      }

      // Check if template is enabled
      if (!template.enabled) {
        return res.status(403).json({
          success: false,
          error: 'Template is currently disabled',
          code: 'TEMPLATE_DISABLED'
        });
      }

      // Check if template is enabled for Roblox
      if (!req.robloxLink.enabledTemplates.includes(templateId)) {
        return res.status(403).json({
          success: false,
          error: 'Template not enabled for in-game submissions',
          code: 'TEMPLATE_NOT_ENABLED_INGAME'
        });
      }

      // Check cooldown
      const cooldown = await submissionsDb.checkCooldown(
        serverId,
        robloxUserId,
        templateId,
        template.cooldownMinutes || 60
      );

      if (cooldown.onCooldown) {
        return res.status(429).json({
          success: false,
          error: `You must wait ${cooldown.remainingTime} minutes before submitting again`,
          code: 'COOLDOWN_ACTIVE',
          remainingMinutes: cooldown.remainingTime
        });
      }

      // Check rate limit
      const rateLimit = await submissionsDb.checkRateLimit(
        serverId,
        robloxUserId,
        req.robloxLink.settings.rateLimitMinutes || 5
      );

      if (rateLimit.limited) {
        return res.status(429).json({
          success: false,
          error: 'You have submitted too many applications recently',
          code: 'RATE_LIMITED',
          resetAt: rateLimit.resetAt
        });
      }

      // Validate responses
      const validatedResponses = {};
      const errors = [];

      for (const question of template.questions) {
        const response = responses[question.id];

        // Check if required question is answered
        if (question.required && (!response || response.trim() === '')) {
          errors.push(`Question "${question.question}" is required`);
          continue;
        }

        // Validate response
        if (response) {
          const validation = validateApplicationResponse(
            response,
            question.validation?.maxLength
          );

          if (!validation.valid) {
            errors.push(`Question "${question.question}": ${validation.error}`);
            continue;
          }

          validatedResponses[question.id] = validation.sanitized;
        } else {
          validatedResponses[question.id] = '';
        }
      }

      // Return validation errors if any
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors
        });
      }

      // Create application
      const application = await applicationsDb.createApplication({
        serverId,
        userId: robloxUserId, // Using Roblox user ID as the primary ID
        templateId,
        templateName: template.name,
        source: APPLICATION_SOURCE.ROBLOX,
        robloxUserId,
        robloxUsername,
        responses: validatedResponses,
        channelId: serverConfig.roblox.submissionChannelId,
        ipAddress: req.ip
      });

      // Log submission
      await submissionsDb.logSubmission({
        serverId,
        robloxUserId,
        robloxUsername,
        templateId,
        placeId,
        applicationId: application.id,
        ipAddress: req.ip,
        success: true
      });

      // Update analytics
      await serverDb.incrementAnalytics(serverId, 'totalRobloxSubmissions');
      await robloxLinks.incrementAnalytics(serverId, 'totalSubmissions');

      logger.submission(serverId, robloxUserId, templateId, APPLICATION_SOURCE.ROBLOX);

      // Return success response
      res.status(201).json({
        success: true,
        message: 'Application submitted successfully',
        applicationId: application.id,
        status: application.status,
        submittedAt: application.submittedAt,
        template: {
          id: template.id,
          name: template.name
        }
      });

      // TODO: Post application to Discord review channel
      // This would require the Discord client instance
      // Will be implemented in the Discord integration section

    } catch (error) {
      logger.error('Failed to submit application', { 
        serverId, 
        robloxUserId, 
        templateId, 
        error: error.message 
      });

      // Log failed submission
      await submissionsDb.logSubmission({
        serverId,
        robloxUserId: req.body.robloxUserId,
        robloxUsername: req.body.robloxUsername,
        templateId: req.body.templateId,
        placeId: req.body.placeId,
        applicationId: null,
        ipAddress: req.ip,
        success: false
      });

      res.status(500).json({
        success: false,
        error: 'Failed to submit application',
        code: 'SUBMISSION_ERROR'
      });
    }
  })
);

/**
 * GET /api/roblox/submit/status/:robloxUserId
 * Get submission status for a user
 */
router.get('/status/:robloxUserId', asyncHandler(async (req, res) => {
  const { serverId } = req;
  const { robloxUserId } = req.params;

  try {
    const applications = await applicationsDb.getServerApplications(serverId, {
      source: APPLICATION_SOURCE.ROBLOX,
      robloxUserId
    });

    const submissions = await submissionsDb.getUserSubmissions(serverId, robloxUserId);

    res.json({
      success: true,
      totalApplications: applications.length,
      totalSubmissions: submissions.length,
      applications: applications.slice(0, 5).map(app => ({
        id: app.id,
        templateName: app.templateName,
        status: app.status,
        submittedAt: app.submittedAt,
        reviewedAt: app.reviewedAt
      })),
      recentSubmissions: submissions.slice(0, 10).map(sub => ({
        templateId: sub.templateId,
        timestamp: sub.timestamp,
        success: sub.success
      }))
    });
  } catch (error) {
    logger.error('Failed to get submission status', { 
      serverId, 
      robloxUserId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve submission status',
      code: 'STATUS_ERROR'
    });
  }
}));

/**
 * POST /api/roblox/submit/validate
 * Validate submission data without actually submitting
 */
router.post('/validate', 
  validateBody(['templateId', 'responses']), 
  asyncHandler(async (req, res) => {
    const { serverId } = req;
    const { templateId, responses } = req.body;

    try {
      // Get template
      const template = await serverDb.getTemplate(serverId, templateId);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
          code: 'TEMPLATE_NOT_FOUND'
        });
      }

      // Validate responses
      const errors = [];

      for (const question of template.questions) {
        const response = responses[question.id];

        // Check required questions
        if (question.required && (!response || response.trim() === '')) {
          errors.push({
            questionId: question.id,
            error: 'This question is required'
          });
          continue;
        }

        // Validate response format
        if (response) {
          const validation = validateApplicationResponse(
            response,
            question.validation?.maxLength
          );

          if (!validation.valid) {
            errors.push({
              questionId: question.id,
              error: validation.error
            });
          }
        }
      }

      res.json({
        success: true,
        valid: errors.length === 0,
        errors
      });
    } catch (error) {
      logger.error('Failed to validate submission', { 
        serverId, 
        templateId, 
        error: error.message 
      });
      res.status(500).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR'
      });
    }
  })
);

module.exports = router;