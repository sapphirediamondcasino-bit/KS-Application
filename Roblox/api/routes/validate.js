/**
 * KS Bot - Validate Route
 * 
 * Validates game server connection and returns configuration data.
 * Called when a game starts up to verify connectivity.
 */

const express = require('express');
const router = express.Router();
const serverDb = require('../../../core/database/servers');
const { asyncHandler, validateBody } = require('../auth');
const { roblox: logger } = require('../../../shared/utils/logger');

/**
 * POST /api/roblox/validate
 * Validate game server connection
 */
router.post('/', validateBody(['placeId']), asyncHandler(async (req, res) => {
  const { serverId, groupId, placeId } = req;
  const { gameVersion } = req.body;

  try {
    // Get server configuration
    const serverConfig = await serverDb.getServer(serverId);

    if (!serverConfig) {
      logger.warn('Server configuration not found', { serverId });
      return res.status(404).json({
        success: false,
        error: 'Server configuration not found',
        code: 'SERVER_NOT_FOUND'
      });
    }

    // Check if Roblox integration is enabled
    if (!serverConfig.roblox.enabled) {
      return res.status(403).json({
        success: false,
        error: 'Roblox integration is not enabled for this server',
        code: 'INTEGRATION_DISABLED'
      });
    }

    // Get enabled templates
    const templates = serverConfig.applications.templates.filter(t => 
      req.robloxLink.enabledTemplates.includes(t.id) && t.enabled
    );

    // Build response with configuration
    const response = {
      success: true,
      message: 'Connection validated successfully',
      server: {
        id: serverId,
        name: serverConfig.serverId, // Would need guild name from Discord client
        robloxEnabled: serverConfig.roblox.enabled
      },
      group: {
        id: groupId,
        placeIds: req.robloxLink.placeIds
      },
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        questions: t.questions.map(q => ({
          id: q.id,
          type: q.type,
          question: q.question,
          required: q.required,
          choices: q.choices || [],
          placeholder: q.placeholder,
          validation: q.validation
        })),
        cooldownMinutes: t.cooldownMinutes,
        requirePlaytime: t.requirePlaytime
      })),
      settings: {
        requirePlaytime: req.robloxLink.settings.requirePlaytime,
        rateLimitMinutes: req.robloxLink.settings.rateLimitMinutes,
        notificationsEnabled: req.robloxLink.settings.notificationsEnabled
      },
      timestamp: new Date().toISOString()
    };

    // Log successful validation
    logger.info('Game server validated', {
      serverId,
      placeId,
      gameVersion,
      templateCount: templates.length
    });

    res.json(response);
  } catch (error) {
    logger.error('Validation failed', { serverId, placeId, error: error.message });
    res.status(500).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR'
    });
  }
}));

/**
 * GET /api/roblox/validate/status
 * Get connection status (simple health check)
 */
router.get('/status', asyncHandler(async (req, res) => {
  const { serverId, groupId } = req;

  res.json({
    success: true,
    status: 'connected',
    serverId,
    groupId,
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /api/roblox/validate/config
 * Get current configuration without full validation
 */
router.get('/config', asyncHandler(async (req, res) => {
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

    res.json({
      success: true,
      config: {
        robloxEnabled: serverConfig.roblox.enabled,
        applicationsEnabled: serverConfig.applications.enabled,
        templatesCount: req.robloxLink.enabledTemplates.length,
        settings: req.robloxLink.settings
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get config', { serverId, error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve configuration',
      code: 'CONFIG_ERROR'
    });
  }
}));

module.exports = router;