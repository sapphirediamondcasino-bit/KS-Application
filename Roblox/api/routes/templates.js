/**
 * KS Bot - Templates Route
 * 
 * Returns available application templates for in-game use.
 */

const express = require('express');
const router = express.Router();
const serverDb = require('../../../core/database/servers');
const { asyncHandler } = require('../auth');
const { roblox: logger } = require('../../../shared/utils/logger');

/**
 * GET /api/roblox/templates
 * Get all enabled templates for the server
 */
router.get('/', asyncHandler(async (req, res) => {
  const { serverId } = req;

  try {
    const serverConfig = await serverDb.getServer(serverId);

    if (!serverConfig) {
      return res.status(404).json({
        success: false,
        error: 'Server configuration not found',
        code: 'SERVER_NOT_FOUND'
      });
    }

    // Filter to enabled templates that are also enabled for Roblox
    const templates = serverConfig.applications.templates.filter(t => 
      t.enabled && req.robloxLink.enabledTemplates.includes(t.id)
    );

    const response = {
      success: true,
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description || '',
        questionCount: t.questions.length,
        cooldownMinutes: t.cooldownMinutes || 60,
        requirePlaytime: t.requirePlaytime || 0,
        enabled: t.enabled
      })),
      count: templates.length,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get templates', { serverId, error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve templates',
      code: 'TEMPLATES_ERROR'
    });
  }
}));

/**
 * GET /api/roblox/templates/:templateId
 * Get detailed information about a specific template
 */
router.get('/:templateId', asyncHandler(async (req, res) => {
  const { serverId } = req;
  const { templateId } = req.params;

  try {
    const template = await serverDb.getTemplate(serverId, templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }

    // Check if template is enabled for Roblox
    if (!req.robloxLink.enabledTemplates.includes(templateId)) {
      return res.status(403).json({
        success: false,
        error: 'Template not enabled for in-game use',
        code: 'TEMPLATE_DISABLED'
      });
    }

    if (!template.enabled) {
      return res.status(403).json({
        success: false,
        error: 'Template is currently disabled',
        code: 'TEMPLATE_DISABLED'
      });
    }

    // Return full template details including questions
    const response = {
      success: true,
      template: {
        id: template.id,
        name: template.name,
        description: template.description || '',
        questions: template.questions.map((q, index) => ({
          id: q.id,
          index,
          type: q.type,
          question: q.question,
          required: q.required !== false,
          choices: q.choices || [],
          placeholder: q.placeholder || '',
          validation: q.validation || {}
        })),
        cooldownMinutes: template.cooldownMinutes || 60,
        requirePlaytime: template.requirePlaytime || 0,
        autoApprove: template.autoApprove || false,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get template', { 
      serverId, 
      templateId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve template',
      code: 'TEMPLATE_ERROR'
    });
  }
}));

/**
 * POST /api/roblox/templates/check-eligibility
 * Check if a user is eligible to submit an application
 */
router.post('/check-eligibility', asyncHandler(async (req, res) => {
  const { serverId } = req;
  const { robloxUserId, templateId } = req.body;

  if (!robloxUserId || !templateId) {
    return res.status(400).json({
      success: false,
      error: 'robloxUserId and templateId are required',
      code: 'MISSING_PARAMS'
    });
  }

  try {
    const submissionsDb = require('../../database/submissions');
    const applicationsDb = require('../../../core/database/applications');

    // Get template
    const template = await serverDb.getTemplate(serverId, templateId);

    if (!template || !template.enabled) {
      return res.status(404).json({
        success: false,
        error: 'Template not found or disabled',
        code: 'TEMPLATE_NOT_FOUND'
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
      return res.json({
        success: true,
        eligible: false,
        reason: 'cooldown',
        cooldownRemaining: cooldown.remainingTime,
        message: `You must wait ${cooldown.remainingTime} minutes before submitting again`
      });
    }

    // Check rate limit
    const rateLimit = await submissionsDb.checkRateLimit(
      serverId,
      robloxUserId,
      req.robloxLink.settings.rateLimitMinutes || 5
    );

    if (rateLimit.limited) {
      return res.json({
        success: true,
        eligible: false,
        reason: 'rate_limited',
        resetAt: rateLimit.resetAt,
        message: 'You have submitted too many applications recently'
      });
    }

    // Check for pending application
    const hasPending = await applicationsDb.hasPendingApplication(
      serverId,
      null,
      templateId
    );

    if (hasPending) {
      return res.json({
        success: true,
        eligible: false,
        reason: 'pending_application',
        message: 'You already have a pending application for this template'
      });
    }

    // User is eligible
    res.json({
      success: true,
      eligible: true,
      template: {
        id: template.id,
        name: template.name,
        questionCount: template.questions.length
      },
      message: 'Eligible to submit application'
    });
  } catch (error) {
    logger.error('Failed to check eligibility', { 
      serverId, 
      robloxUserId, 
      templateId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to check eligibility',
      code: 'ELIGIBILITY_ERROR'
    });
  }
}));

module.exports = router;