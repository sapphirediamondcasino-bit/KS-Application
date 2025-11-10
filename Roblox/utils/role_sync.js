/**
 * KS Bot - Discord ↔ Roblox Role Synchronization
 * 
 * Handles automatic synchronization of roles between Discord and Roblox.
 * Processes sync queue and manages role updates.
 */

const robloxAPI = require('./roblox_api');
const robloxLinks = require('../database/roblox_links');
const syncQueue = require('../database/sync_queue');
const { roblox: logger } = require('../../shared/utils/logger');
const { SYNC_STATUS } = require('../../shared/constants');

class RoleSyncManager {
  constructor() {
    this.processing = false;
    this.processInterval = null;
  }

  /**
   * Start automatic sync processing
   * @param {number} intervalMs - Processing interval in milliseconds
   */
  startAutoSync(intervalMs = 30000) {
    if (this.processInterval) {
      logger.warn('Auto-sync already running');
      return;
    }

    logger.info('Starting auto-sync', { intervalMs });

    this.processInterval = setInterval(async () => {
      await this.processPendingJobs();
    }, intervalMs);

    // Process immediately
    this.processPendingJobs();
  }

  /**
   * Stop automatic sync processing
   */
  stopAutoSync() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
      logger.info('Auto-sync stopped');
    }
  }

  /**
   * Process pending sync jobs
   * @param {number} batchSize - Number of jobs to process at once
   * @returns {Promise<Object>}
   */
  async processPendingJobs(batchSize = 5) {
    if (this.processing) {
      logger.debug('Already processing sync jobs, skipping');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.processing = true;

    try {
      const pendingJobs = await syncQueue.getPendingJobs(batchSize);

      if (pendingJobs.length === 0) {
        return { processed: 0, succeeded: 0, failed: 0 };
      }

      logger.info('Processing sync jobs', { count: pendingJobs.length });

      let succeeded = 0;
      let failed = 0;

      for (const job of pendingJobs) {
        try {
          const result = await this.processJob(job);
          
          if (result.success) {
            succeeded++;
          } else {
            failed++;
          }
        } catch (error) {
          logger.error('Failed to process job', { jobId: job.id, error });
          failed++;
        }
      }

      return {
        processed: pendingJobs.length,
        succeeded,
        failed
      };
    } catch (error) {
      logger.error('Failed to process pending jobs', { error });
      return { processed: 0, succeeded: 0, failed: 0 };
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process a single sync job
   * @param {Object} job - Sync job
   * @returns {Promise<Object>}
   */
  async processJob(job) {
    try {
      logger.info('Processing sync job', {
        jobId: job.id,
        serverId: job.serverId,
        robloxUserId: job.robloxUserId,
        newRank: job.newRank
      });

      // Mark as in progress
      await syncQueue.markInProgress(job.id);

      // Get link info
      const link = await robloxLinks.getLink(job.serverId);

      if (!link) {
        throw new Error('Roblox link not found for server');
      }

      if (!link.verified) {
        throw new Error('Roblox group not verified');
      }

      // Get group roles to find role ID
      const roles = await robloxAPI.getGroupRoles(link.groupId);
      const targetRole = roles.find(r => r.rank === job.newRank);

      if (!targetRole) {
        throw new Error(`Role with rank ${job.newRank} not found in group`);
      }

      // Check if user is in the group
      const userRole = await robloxAPI.getUserRoleInGroup(job.robloxUserId, link.groupId);

      if (!userRole) {
        throw new Error('User is not in the Roblox group');
      }

      // Check if user already has the target rank
      if (userRole.rank === job.newRank) {
        logger.info('User already has target rank', {
          jobId: job.id,
          robloxUserId: job.robloxUserId,
          rank: job.newRank
        });

        await syncQueue.markCompleted(job.id);
        await robloxLinks.updateLastSync(job.serverId, true);

        return {
          success: true,
          message: 'User already has target rank'
        };
      }

      // Perform the rank update
      await robloxAPI.setUserRank(link.groupId, job.robloxUserId, targetRole.id);

      // Mark as completed
      await syncQueue.markCompleted(job.id);
      await robloxLinks.updateLastSync(job.serverId, true);
      await robloxLinks.incrementAnalytics(job.serverId, 'totalSyncs');

      logger.sync(job.serverId, job.robloxUserId, job.newRank, true);

      return {
        success: true,
        message: 'Role synchronized successfully'
      };
    } catch (error) {
      logger.error('Sync job failed', { jobId: job.id, error: error.message });

      // Mark as failed (will retry if under max attempts)
      await syncQueue.markFailed(job.id, error.message, true);
      await robloxLinks.updateLastSync(job.serverId, false);

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Queue role sync for user
   * @param {Object} syncData - Sync data
   * @returns {Promise<Object>}
   */
  async queueSync(syncData) {
    try {
      // Validate link exists and is verified
      const link = await robloxLinks.getLink(syncData.serverId);

      if (!link) {
        return {
          success: false,
          error: 'Roblox integration not set up for this server'
        };
      }

      if (!link.verified) {
        return {
          success: false,
          error: 'Roblox group not verified'
        };
      }

      // Check if user already has pending sync
      const hasPending = await syncQueue.hasPendingSync(syncData.serverId, syncData.robloxUserId);

      if (hasPending) {
        return {
          success: false,
          error: 'User already has a pending role sync'
        };
      }

      // Add to queue
      const job = await syncQueue.addJob({
        serverId: syncData.serverId,
        robloxUserId: syncData.robloxUserId,
        robloxUsername: syncData.robloxUsername,
        groupId: link.groupId,
        newRank: syncData.newRank,
        discordUserId: syncData.discordUserId,
        discordRoleId: syncData.discordRoleId,
        reason: syncData.reason || 'Application approved',
        applicationId: syncData.applicationId,
        priority: syncData.priority || 0
      });

      logger.info('Role sync queued', {
        jobId: job.id,
        serverId: syncData.serverId,
        robloxUserId: syncData.robloxUserId
      });

      return {
        success: true,
        jobId: job.id,
        message: 'Role sync queued successfully'
      };
    } catch (error) {
      logger.error('Failed to queue sync', { error });
      return {
        success: false,
        error: 'Failed to queue role sync'
      };
    }
  }

  /**
   * Sync role immediately (bypass queue)
   * @param {Object} syncData - Sync data
   * @returns {Promise<Object>}
   */
  async syncImmediately(syncData) {
    try {
      // Create temporary job
      const job = {
        id: 'immediate_' + Date.now(),
        serverId: syncData.serverId,
        robloxUserId: syncData.robloxUserId,
        robloxUsername: syncData.robloxUsername,
        newRank: syncData.newRank,
        reason: syncData.reason || 'Immediate sync'
      };

      // Process immediately
      const result = await this.processJob(job);

      return result;
    } catch (error) {
      logger.error('Immediate sync failed', { error });
      return {
        success: false,
        error: 'Failed to sync role'
      };
    }
  }

  /**
   * Sync role based on application approval
   * @param {Object} application - Application object
   * @param {Object} client - Discord client
   * @returns {Promise<Object>}
   */
  async syncFromApplication(application, client) {
    try {
      // Get link
      const link = await robloxLinks.getLink(application.serverId);

      if (!link || !link.verified) {
        return {
          success: false,
          error: 'Roblox not configured or not verified'
        };
      }

      // Get role mapping for this template
      const mapping = link.roleMappings[application.templateId];

      if (!mapping) {
        return {
          success: false,
          error: 'No role mapping configured for this application template'
        };
      }

      // If application is from Roblox, sync directly
      if (application.source === 'roblox' && application.robloxUserId) {
        return await this.queueSync({
          serverId: application.serverId,
          robloxUserId: application.robloxUserId,
          robloxUsername: application.robloxUsername,
          newRank: mapping.robloxRank,
          discordRoleId: mapping.discordRoleId,
          reason: `Application approved: ${application.templateName}`,
          applicationId: application.id,
          priority: 1
        });
      }

      // If from Discord, we need to link Discord user to Roblox
      // This would require additional user verification/linking system
      return {
        success: false,
        error: 'Discord to Roblox linking not yet implemented'
      };
    } catch (error) {
      logger.error('Failed to sync from application', { 
        applicationId: application.id, 
        error 
      });
      return {
        success: false,
        error: 'Failed to sync role from application'
      };
    }
  }

  /**
   * Bulk sync roles
   * @param {Array<Object>} syncDataArray - Array of sync data objects
   * @returns {Promise<Object>}
   */
  async bulkSync(syncDataArray) {
    try {
      let queued = 0;
      let failed = 0;

      for (const syncData of syncDataArray) {
        const result = await this.queueSync(syncData);
        
        if (result.success) {
          queued++;
        } else {
          failed++;
        }
      }

      return {
        success: true,
        queued,
        failed,
        total: syncDataArray.length
      };
    } catch (error) {
      logger.error('Bulk sync failed', { error });
      return {
        success: false,
        error: 'Bulk sync failed'
      };
    }
  }

  /**
   * Get sync status for user
   * @param {string} serverId - Discord server ID
   * @param {string} robloxUserId - Roblox user ID
   * @returns {Promise<Object>}
   */
  async getSyncStatus(serverId, robloxUserId) {
    try {
      const jobs = await syncQueue.getUserJobs(serverId, robloxUserId);

      if (jobs.length === 0) {
        return {
          hasPending: false,
          jobs: []
        };
      }

      const pending = jobs.filter(j => 
        j.status === SYNC_STATUS.QUEUED || 
        j.status === SYNC_STATUS.IN_PROGRESS ||
        j.status === SYNC_STATUS.RETRYING
      );

      return {
        hasPending: pending.length > 0,
        pendingCount: pending.length,
        totalJobs: jobs.length,
        jobs: jobs.map(j => ({
          id: j.id,
          status: j.status,
          newRank: j.newRank,
          attempts: j.attempts,
          createdAt: j.createdAt,
          lastError: j.lastError
        }))
      };
    } catch (error) {
      logger.error('Failed to get sync status', { serverId, robloxUserId, error });
      return {
        hasPending: false,
        jobs: []
      };
    }
  }

  /**
   * Cancel pending sync
   * @param {string} serverId - Discord server ID
   * @param {string} robloxUserId - Roblox user ID
   * @returns {Promise<Object>}
   */
  async cancelSync(serverId, robloxUserId) {
    try {
      const cancelled = await syncQueue.cancelUserJobs(serverId, robloxUserId);

      return {
        success: true,
        cancelled
      };
    } catch (error) {
      logger.error('Failed to cancel sync', { serverId, robloxUserId, error });
      return {
        success: false,
        error: 'Failed to cancel sync'
      };
    }
  }

  /**
   * Retry failed syncs
   * @param {string} serverId - Discord server ID
   * @returns {Promise<Object>}
   */
  async retryFailed(serverId) {
    try {
      const retried = await syncQueue.retryFailedJobs(serverId);

      return {
        success: true,
        retried
      };
    } catch (error) {
      logger.error('Failed to retry failed syncs', { serverId, error });
      return {
        success: false,
        error: 'Failed to retry failed syncs'
      };
    }
  }

  /**
   * Get sync queue statistics
   * @param {string} serverId - Discord server ID
   * @returns {Promise<Object>}
   */
  async getQueueStats(serverId) {
    try {
      return await syncQueue.getStatistics(serverId);
    } catch (error) {
      logger.error('Failed to get queue stats', { serverId, error });
      return null;
    }
  }

  /**
   * Validate sync data
   * @param {Object} syncData - Sync data to validate
   * @returns {Object} { valid, error }
   */
  validateSyncData(syncData) {
    if (!syncData.serverId) {
      return { valid: false, error: 'Server ID is required' };
    }

    if (!syncData.robloxUserId) {
      return { valid: false, error: 'Roblox user ID is required' };
    }

    if (!syncData.newRank && syncData.newRank !== 0) {
      return { valid: false, error: 'New rank is required' };
    }

    if (syncData.newRank < 0 || syncData.newRank > 255) {
      return { valid: false, error: 'Rank must be between 0 and 255' };
    }

    return { valid: true };
  }

  /**
   * Test sync connection
   * @param {string} serverId - Discord server ID
   * @returns {Promise<Object>}
   */
  async testConnection(serverId) {
    try {
      const link = await robloxLinks.getLink(serverId);

      if (!link) {
        return {
          success: false,
          error: 'No Roblox link found'
        };
      }

      if (!link.verified) {
        return {
          success: false,
          error: 'Roblox group not verified'
        };
      }

      // Try to get group info
      const groupInfo = await robloxAPI.getGroupInfo(link.groupId);

      if (!groupInfo) {
        return {
          success: false,
          error: 'Failed to fetch group information'
        };
      }

      // Try to get roles
      const roles = await robloxAPI.getGroupRoles(link.groupId);

      if (!roles || roles.length === 0) {
        return {
          success: false,
          error: 'Failed to fetch group roles'
        };
      }

      return {
        success: true,
        message: 'Connection test successful',
        groupInfo: {
          id: groupInfo.id,
          name: groupInfo.name,
          memberCount: groupInfo.memberCount
        },
        roleCount: roles.length
      };
    } catch (error) {
      logger.error('Connection test failed', { serverId, error });
      return {
        success: false,
        error: 'Connection test failed'
      };
    }
  }

  /**
   * Get available ranks for server
   * @param {string} serverId - Discord server ID
   * @returns {Promise<Array>}
   */
  async getAvailableRanks(serverId) {
    try {
      const link = await robloxLinks.getLink(serverId);

      if (!link || !link.verified) {
        return [];
      }

      const roles = await robloxAPI.getGroupRoles(link.groupId);

      return roles.map(role => ({
        id: role.id,
        name: role.name,
        rank: role.rank,
        memberCount: role.memberCount
      }));
    } catch (error) {
      logger.error('Failed to get available ranks', { serverId, error });
      return [];
    }
  }

  /**
   * Preview sync (check what would happen without executing)
   * @param {Object} syncData - Sync data
   * @returns {Promise<Object>}
   */
  async previewSync(syncData) {
    try {
      const link = await robloxLinks.getLink(syncData.serverId);

      if (!link) {
        return {
          canSync: false,
          error: 'Roblox link not found'
        };
      }

      if (!link.verified) {
        return {
          canSync: false,
          error: 'Roblox group not verified'
        };
      }

      // Get current role
      const currentRole = await robloxAPI.getUserRoleInGroup(
        syncData.robloxUserId,
        link.groupId
      );

      if (!currentRole) {
        return {
          canSync: false,
          error: 'User is not in the Roblox group'
        };
      }

      // Get target role
      const roles = await robloxAPI.getGroupRoles(link.groupId);
      const targetRole = roles.find(r => r.rank === syncData.newRank);

      if (!targetRole) {
        return {
          canSync: false,
          error: `Role with rank ${syncData.newRank} not found`
        };
      }

      return {
        canSync: true,
        currentRole: {
          id: currentRole.id,
          name: currentRole.name,
          rank: currentRole.rank
        },
        targetRole: {
          id: targetRole.id,
          name: targetRole.name,
          rank: targetRole.rank
        },
        willChange: currentRole.rank !== targetRole.rank,
        message: currentRole.rank === targetRole.rank
          ? 'User already has the target rank'
          : `Will change from "${currentRole.name}" (${currentRole.rank}) to "${targetRole.name}" (${targetRole.rank})`
      };
    } catch (error) {
      logger.error('Failed to preview sync', { error });
      return {
        canSync: false,
        error: 'Failed to preview sync'
      };
    }
  }

  /**
   * Sync all users in a role mapping
   * @param {string} serverId - Discord server ID
   * @param {string} templateId - Template ID
   * @param {Object} client - Discord client
   * @returns {Promise<Object>}
   */
  async syncAllForTemplate(serverId, templateId, client) {
    try {
      const link = await robloxLinks.getLink(serverId);

      if (!link || !link.verified) {
        return {
          success: false,
          error: 'Roblox link not found or not verified'
        };
      }

      const mapping = link.roleMappings[templateId];

      if (!mapping) {
        return {
          success: false,
          error: 'No role mapping found for template'
        };
      }

      // Get all users with the Discord role
      const guild = await client.guilds.fetch(serverId);
      const role = await guild.roles.fetch(mapping.discordRoleId);

      if (!role) {
        return {
          success: false,
          error: 'Discord role not found'
        };
      }

      // This would require a user linking system to map Discord users to Roblox users
      // For now, return a placeholder
      return {
        success: false,
        error: 'Bulk Discord to Roblox sync requires user linking system (not yet implemented)'
      };
    } catch (error) {
      logger.error('Failed to sync all for template', { serverId, templateId, error });
      return {
        success: false,
        error: 'Failed to sync all users'
      };
    }
  }

  /**
   * Clean completed sync jobs
   * @param {number} hoursOld - Delete jobs older than this many hours
   * @returns {Promise<number>}
   */
  async cleanCompletedJobs(hoursOld = 24) {
    try {
      return await syncQueue.cleanCompletedJobs(hoursOld);
    } catch (error) {
      logger.error('Failed to clean completed jobs', { error });
      return 0;
    }
  }

  /**
   * Get sync history for user
   * @param {string} serverId - Discord server ID
   * @param {string} robloxUserId - Roblox user ID
   * @param {number} limit - Max results
   * @returns {Promise<Array>}
   */
  async getSyncHistory(serverId, robloxUserId, limit = 10) {
    try {
      const jobs = await syncQueue.getUserJobs(serverId, robloxUserId);

      // Filter to completed/failed jobs
      const history = jobs.filter(j => 
        j.status === SYNC_STATUS.COMPLETED || 
        j.status === SYNC_STATUS.FAILED
      );

      // Sort by completion date (newest first)
      history.sort((a, b) => {
        const aTime = a.completedAt || a.updatedAt;
        const bTime = b.completedAt || b.updatedAt;
        return new Date(bTime) - new Date(aTime);
      });

      // Limit results
      return history.slice(0, limit).map(j => ({
        id: j.id,
        status: j.status,
        newRank: j.newRank,
        reason: j.reason,
        attempts: j.attempts,
        createdAt: j.createdAt,
        completedAt: j.completedAt,
        error: j.lastError
      }));
    } catch (error) {
      logger.error('Failed to get sync history', { serverId, robloxUserId, error });
      return [];
    }
  }

  /**
   * Estimate sync completion time
   * @param {string} serverId - Discord server ID
   * @returns {Promise<Object>}
   */
  async estimateCompletionTime(serverId) {
    try {
      const stats = await syncQueue.getStatistics(serverId);

      if (!stats) {
        return null;
      }

      const pendingCount = stats.queued + stats.retrying;

      if (pendingCount === 0) {
        return {
          pendingCount: 0,
          estimatedMinutes: 0,
          message: 'No pending syncs'
        };
      }

      // Estimate based on average processing time
      // Assume ~10 seconds per sync including API delays
      const estimatedSeconds = pendingCount * 10;
      const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

      return {
        pendingCount,
        estimatedMinutes,
        estimatedSeconds,
        message: `Approximately ${estimatedMinutes} minute${estimatedMinutes !== 1 ? 's' : ''}`
      };
    } catch (error) {
      logger.error('Failed to estimate completion time', { serverId, error });
      return null;
    }
  }
}

// Export singleton instance
module.exports = new RoleSyncManager();