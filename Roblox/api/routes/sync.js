/**
 * KS Bot - Sync Route
 * 
 * Provides role synchronization status and information for Roblox games.
 */

const express = require('express');
const router = express.Router();
const syncQueue = require('../../database/sync_queue');
const robloxLinks = require('../../database/roblox_links');
const roleSync = require('../../utils/role_sync');
const { asyncHandler } = require('../auth');
const { roblox: logger } = require('../../../shared/utils/logger');

/**
 * GET /api/roblox/sync/status/:robloxUserId
 * Get sync status for a specific user
 */
router.get('/status/:robloxUserId', asyncHandler(async (req, res) => {
  const { serverId } = req;
  const { robloxUserId } = req.params;

  try {
    const status = await roleSync.getSyncStatus(serverId, robloxUserId);

    res.json({
      success: true,
      robloxUserId,
      hasPending: status.hasPending,
      pendingCount: status.pendingCount || 0,
      jobs: status.jobs || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get sync status', { 
      serverId, 
      robloxUserId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sync status',
      code: 'SYNC_STATUS_ERROR'
    });
  }
}));

/**
 * GET /api/roblox/sync/queue
 * Get queue statistics for the server
 */
router.get('/queue', asyncHandler(async (req, res) => {
  const { serverId } = req;

  try {
    const stats = await syncQueue.getStatistics(serverId);

    if (!stats) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve queue statistics',
        code: 'QUEUE_STATS_ERROR'
      });
    }

    // Get completion estimate
    const estimate = await roleSync.estimateCompletionTime(serverId);

    res.json({
      success: true,
      queue: {
        total: stats.total,
        queued: stats.queued,
        inProgress: stats.inProgress,
        retrying: stats.retrying,
        completed: stats.completed,
        failed: stats.failed,
        averageAttempts: parseFloat(stats.averageAttempts),
        oldestPending: stats.oldestPending
      },
      estimate: estimate || {
        pendingCount: 0,
        estimatedMinutes: 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get queue stats', { 
      serverId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve queue statistics',
      code: 'QUEUE_ERROR'
    });
  }
}));

/**
 * GET /api/roblox/sync/history/:robloxUserId
 * Get sync history for a user
 */
router.get('/history/:robloxUserId', asyncHandler(async (req, res) => {
  const { serverId } = req;
  const { robloxUserId } = req.params;
  const { limit = 10 } = req.query;

  try {
    const history = await roleSync.getSyncHistory(
      serverId, 
      robloxUserId, 
      parseInt(limit)
    );

    res.json({
      success: true,
      robloxUserId,
      history,
      count: history.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get sync history', { 
      serverId, 
      robloxUserId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sync history',
      code: 'HISTORY_ERROR'
    });
  }
}));

/**
 * GET /api/roblox/sync/mappings
 * Get role mappings for the server
 */
router.get('/mappings', asyncHandler(async (req, res) => {
  const { serverId } = req;

  try {
    const link = await robloxLinks.getLink(serverId);

    if (!link) {
      return res.status(404).json({
        success: false,
        error: 'Roblox link not found',
        code: 'LINK_NOT_FOUND'
      });
    }

    // Get available ranks
    const availableRanks = await roleSync.getAvailableRanks(serverId);

    res.json({
      success: true,
      groupId: link.groupId,
      mappings: Object.entries(link.roleMappings).map(([templateId, mapping]) => ({
        templateId,
        discordRoleId: mapping.discordRoleId,
        robloxRank: mapping.robloxRank
      })),
      availableRanks,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get role mappings', { 
      serverId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve role mappings',
      code: 'MAPPINGS_ERROR'
    });
  }
}));

/**
 * POST /api/roblox/sync/test
 * Test sync connection and permissions
 */
router.post('/test', asyncHandler(async (req, res) => {
  const { serverId } = req;

  try {
    const result = await roleSync.testConnection(serverId);

    res.json({
      success: result.success,
      message: result.message || result.error,
      details: result.groupInfo || null,
      roleCount: result.roleCount || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to test sync connection', { 
      serverId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      code: 'TEST_ERROR'
    });
  }
}));

/**
 * POST /api/roblox/sync/preview
 * Preview what would happen if a sync was performed
 */
router.post('/preview', asyncHandler(async (req, res) => {
  const { serverId } = req;
  const { robloxUserId, newRank } = req.body;

  if (!robloxUserId || newRank === undefined) {
    return res.status(400).json({
      success: false,
      error: 'robloxUserId and newRank are required',
      code: 'MISSING_PARAMS'
    });
  }

  try {
    const preview = await roleSync.previewSync({
      serverId,
      robloxUserId,
      newRank
    });

    res.json({
      success: preview.canSync,
      preview: {
        currentRole: preview.currentRole || null,
        targetRole: preview.targetRole || null,
        willChange: preview.willChange || false,
        message: preview.message || preview.error
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to preview sync', { 
      serverId, 
      robloxUserId, 
      newRank, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to preview sync',
      code: 'PREVIEW_ERROR'
    });
  }
}));

/**
 * GET /api/roblox/sync/analytics
 * Get sync analytics for the server
 */
router.get('/analytics', asyncHandler(async (req, res) => {
  const { serverId } = req;
  const { days = 7 } = req.query;

  try {
    const link = await robloxLinks.getLink(serverId);

    if (!link) {
      return res.status(404).json({
        success: false,
        error: 'Roblox link not found',
        code: 'LINK_NOT_FOUND'
      });
    }

    const stats = await syncQueue.getStatistics(serverId);

    res.json({
      success: true,
      analytics: {
        totalSyncs: link.analytics.totalSyncs || 0,
        failedSyncs: link.analytics.failedSyncs || 0,
        lastSyncAt: link.analytics.lastSyncAt,
        successRate: link.analytics.totalSyncs > 0
          ? ((link.analytics.totalSyncs - link.analytics.failedSyncs) / link.analytics.totalSyncs * 100).toFixed(2)
          : 0,
        queue: {
          pending: (stats.queued || 0) + (stats.retrying || 0),
          inProgress: stats.inProgress || 0,
          failed: stats.failed || 0
        }
      },
      period: `Last ${days} days`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get sync analytics', { 
      serverId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
}));

/**
 * GET /api/roblox/sync/check/:robloxUserId/:newRank
 * Quick check if a user can be synced to a rank
 */
router.get('/check/:robloxUserId/:newRank', asyncHandler(async (req, res) => {
  const { serverId } = req;
  const { robloxUserId, newRank } = req.params;

  try {
    // Check if user has pending sync
    const hasPending = await syncQueue.hasPendingSync(serverId, robloxUserId);

    if (hasPending) {
      return res.json({
        success: true,
        canSync: false,
        reason: 'User already has a pending sync',
        code: 'PENDING_SYNC'
      });
    }

    // Validate rank
    const rank = parseInt(newRank);
    if (isNaN(rank) || rank < 0 || rank > 255) {
      return res.json({
        success: true,
        canSync: false,
        reason: 'Invalid rank value',
        code: 'INVALID_RANK'
      });
    }

    res.json({
      success: true,
      canSync: true,
      robloxUserId,
      newRank: rank,
      message: 'User can be synced'
    });
  } catch (error) {
    logger.error('Failed to check sync eligibility', { 
      serverId, 
      robloxUserId, 
      newRank, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to check sync eligibility',
      code: 'CHECK_ERROR'
    });
  }
}));

/**
 * POST /api/roblox/sync/manual
 * Manually trigger a sync (for testing/admin purposes)
 * This would typically be protected with additional authentication
 */
router.post('/manual', asyncHandler(async (req, res) => {
  const { serverId } = req;
  const { robloxUserId, robloxUsername, newRank, reason } = req.body;

  if (!robloxUserId || newRank === undefined) {
    return res.status(400).json({
      success: false,
      error: 'robloxUserId and newRank are required',
      code: 'MISSING_PARAMS'
    });
  }

  try {
    // Validate sync data
    const validation = roleSync.validateSyncData({
      serverId,
      robloxUserId,
      newRank
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        code: 'INVALID_SYNC_DATA'
      });
    }

    // Queue the sync
    const result = await roleSync.queueSync({
      serverId,
      robloxUserId,
      robloxUsername: robloxUsername || 'Unknown',
      newRank,
      reason: reason || 'Manual sync via API',
      priority: 1 // Higher priority for manual syncs
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: 'QUEUE_FAILED'
      });
    }

    logger.info('Manual sync queued', { 
      serverId, 
      robloxUserId, 
      newRank, 
      jobId: result.jobId 
    });

    res.json({
      success: true,
      message: 'Sync queued successfully',
      jobId: result.jobId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to queue manual sync', { 
      serverId, 
      robloxUserId, 
      newRank, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to queue sync',
      code: 'MANUAL_SYNC_ERROR'
    });
  }
}));

/**
 * DELETE /api/roblox/sync/cancel/:robloxUserId
 * Cancel pending syncs for a user
 */
router.delete('/cancel/:robloxUserId', asyncHandler(async (req, res) => {
  const { serverId } = req;
  const { robloxUserId } = req.params;

  try {
    const result = await roleSync.cancelSync(serverId, robloxUserId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        code: 'CANCEL_FAILED'
      });
    }

    logger.info('Syncs cancelled', { 
      serverId, 
      robloxUserId, 
      cancelled: result.cancelled 
    });

    res.json({
      success: true,
      message: 'Pending syncs cancelled',
      cancelled: result.cancelled,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to cancel syncs', { 
      serverId, 
      robloxUserId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to cancel syncs',
      code: 'CANCEL_ERROR'
    });
  }
}));

/**
 * POST /api/roblox/sync/retry-failed
 * Retry all failed syncs for the server
 */
router.post('/retry-failed', asyncHandler(async (req, res) => {
  const { serverId } = req;

  try {
    const result = await roleSync.retryFailed(serverId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        code: 'RETRY_FAILED'
      });
    }

    logger.info('Failed syncs retried', { 
      serverId, 
      retried: result.retried 
    });

    res.json({
      success: true,
      message: 'Failed syncs queued for retry',
      retried: result.retried,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to retry syncs', { 
      serverId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retry syncs',
      code: 'RETRY_ERROR'
    });
  }
}));

/**
 * GET /api/roblox/sync/ranks
 * Get available ranks in the Roblox group
 */
router.get('/ranks', asyncHandler(async (req, res) => {
  const { serverId } = req;

  try {
    const ranks = await roleSync.getAvailableRanks(serverId);

    res.json({
      success: true,
      ranks,
      count: ranks.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get available ranks', { 
      serverId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve ranks',
      code: 'RANKS_ERROR'
    });
  }
}));

module.exports = router;