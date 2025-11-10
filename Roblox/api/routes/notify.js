/**
 * KS Bot - Notify Route
 * 
 * Sends notifications to Roblox games (called by the bot when application status changes).
 * This is primarily for the bot to push updates TO games, not for games to call.
 */

const express = require('express');
const router = express.Router();
const applicationsDb = require('../../../core/database/applications');
const { asyncHandler } = require('../auth');
const { roblox: logger } = require('../../../shared/utils/logger');

/**
 * POST /api/roblox/notify
 * Send notification to game (called by bot, not by game)
 * 
 * This endpoint would typically be called by the Discord bot
 * to push notifications to the Roblox game via MessagingService
 */
router.post('/', asyncHandler(async (req, res) => {
  const { serverId } = req;
  const { type, data } = req.body;

  if (!type || !data) {
    return res.status(400).json({
      success: false,
      error: 'type and data are required',
      code: 'MISSING_PARAMS'
    });
  }

  try {
    // This would integrate with Roblox's MessagingService
    // For now, we'll just log and return success
    // The actual implementation would require Open Cloud API integration

    logger.info('Notification queued', {
      serverId,
      type,
      targetUserId: data.robloxUserId
    });

    res.json({
      success: true,
      message: 'Notification queued',
      type,
      timestamp: new Date().toISOString()
    });

    // TODO: Implement actual MessagingService integration
    // This would require:
    // 1. Open Cloud API key with MessagingService permissions
    // 2. Publishing to a specific topic that the game subscribes to
    // 3. Proper error handling and retry logic

  } catch (error) {
    logger.error('Failed to send notification', { 
      serverId, 
      type, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to send notification',
      code: 'NOTIFY_ERROR'
    });
  }
}));

/**
 * GET /api/roblox/notify/poll/:robloxUserId
 * Poll for notifications (called by game to check for updates)
 */
router.get('/poll/:robloxUserId', asyncHandler(async (req, res) => {
  const { serverId } = req;
  const { robloxUserId } = req.params;
  const { since } = req.query; // Timestamp of last poll

  try {
    // Get applications for this user that have been updated since last poll
    const sinceDate = since ? new Date(parseInt(since)) : new Date(Date.now() - 3600000); // Default 1 hour ago

    const applications = await applicationsDb.getServerApplications(serverId, {
      robloxUserId,
      source: 'roblox'
    });

    // Filter to applications updated since last poll
    const updates = applications.filter(app => {
      const updatedAt = new Date(app.updatedAt);
      return updatedAt > sinceDate && app.reviewedAt !== null;
    });

    // Format notifications
    const notifications = updates.map(app => ({
      id: app.id,
      type: app.status === 'approved' ? 'application_approved' : 'application_denied',
      templateName: app.templateName,
      status: app.status,
      reviewedAt: app.reviewedAt,
      reason: app.reason
    }));

    res.json({
      success: true,
      notifications,
      count: notifications.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to poll notifications', { 
      serverId, 
      robloxUserId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notifications',
      code: 'POLL_ERROR'
    });
  }
}));

/**
 * POST /api/roblox/notify/acknowledge
 * Acknowledge that a notification was received
 */
router.post('/acknowledge', asyncHandler(async (req, res) => {
  const { serverId } = req;
  const { notificationId, robloxUserId } = req.body;

  if (!notificationId || !robloxUserId) {
    return res.status(400).json({
      success: false,
      error: 'notificationId and robloxUserId are required',
      code: 'MISSING_PARAMS'
    });
  }

  try {
    // Log acknowledgment
    logger.debug('Notification acknowledged', {
      serverId,
      notificationId,
      robloxUserId
    });

    res.json({
      success: true,
      message: 'Notification acknowledged'
    });

    // TODO: Store acknowledgment in database if needed for analytics

  } catch (error) {
    logger.error('Failed to acknowledge notification', { 
      serverId, 
      notificationId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge notification',
      code: 'ACK_ERROR'
    });
  }
}));

/**
 * GET /api/roblox/notify/status/:applicationId
 * Get current status of a specific application
 */
router.get('/status/:applicationId', asyncHandler(async (req, res) => {
  const { serverId } = req;
  const { applicationId } = req.params;

  try {
    const application = await applicationsDb.getApplication(applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found',
        code: 'APPLICATION_NOT_FOUND'
      });
    }

    // Verify application belongs to this server
    if (application.serverId !== serverId) {
      return res.status(403).json({
        success: false,
        error: 'Application does not belong to this server',
        code: 'FORBIDDEN'
      });
    }

    res.json({
      success: true,
      application: {
        id: application.id,
        templateName: application.templateName,
        status: application.status,
        submittedAt: application.submittedAt,
        reviewedAt: application.reviewedAt,
        reviewedBy: application.reviewedBy,
        reason: application.reason
      }
    });
  } catch (error) {
    logger.error('Failed to get application status', { 
      serverId, 
      applicationId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve application status',
      code: 'STATUS_ERROR'
    });
  }
}));

/**
 * GET /api/roblox/notify/batch/:robloxUserId
 * Get all pending notifications for a user in one request
 */
router.get('/batch/:robloxUserId', asyncHandler(async (req, res) => {
  const { serverId } = req;
  const { robloxUserId } = req.params;

  try {
    // Get all applications for this user
    const applications = await applicationsDb.getServerApplications(serverId, {
      robloxUserId,
      source: 'roblox'
    });

    // Separate by status
    const pending = applications.filter(app => app.status === 'pending');
    const approved = applications.filter(app => app.status === 'approved');
    const denied = applications.filter(app => app.status === 'denied');

    res.json({
      success: true,
      summary: {
        total: applications.length,
        pending: pending.length,
        approved: approved.length,
        denied: denied.length
      },
      applications: {
        pending: pending.map(app => ({
          id: app.id,
          templateName: app.templateName,
          submittedAt: app.submittedAt
        })),
        approved: approved.slice(0, 5).map(app => ({
          id: app.id,
          templateName: app.templateName,
          reviewedAt: app.reviewedAt
        })),
        denied: denied.slice(0, 5).map(app => ({
          id: app.id,
          templateName: app.templateName,
          reviewedAt: app.reviewedAt,
          reason: app.reason
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get batch notifications', { 
      serverId, 
      robloxUserId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notifications',
      code: 'BATCH_ERROR'
    });
  }
}));

module.exports = router;