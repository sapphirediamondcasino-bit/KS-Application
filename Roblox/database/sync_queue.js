/**
 * KS Bot - Roblox Sync Queue Database
 * 
 * Manages the queue of pending role synchronizations between Discord and Roblox.
 * Handles retries, prioritization, and failure tracking.
 */

const db = require('../../data/db_handler');
const { PATHS, SYNC_STATUS } = require('../../shared/constants');
const { roblox: logger } = require('../../shared/utils/logger');

class SyncQueueDatabase {
  /**
   * Get all sync jobs
   * @returns {Promise<Array>}
   */
  async getAllJobs() {
    try {
      const queue = await db.read(PATHS.ROBLOX.SYNC_QUEUE);
      return queue || [];
    } catch (error) {
      logger.error('Failed to read sync queue', { error });
      return [];
    }
  }

  /**
   * Add sync job to queue
   * @param {Object} jobData - Job data
   * @returns {Promise<Object>}
   */
  async addJob(jobData) {
    try {
      const job = {
        id: db.generateId(),
        serverId: jobData.serverId,
        robloxUserId: jobData.robloxUserId,
        robloxUsername: jobData.robloxUsername,
        groupId: jobData.groupId,
        newRank: jobData.newRank,
        
        // Discord info
        discordUserId: jobData.discordUserId || null,
        discordRoleId: jobData.discordRoleId || null,
        
        // Status
        status: SYNC_STATUS.QUEUED,
        priority: jobData.priority || 0, // Higher = more important
        
        // Retry info
        attempts: 0,
        maxAttempts: jobData.maxAttempts || 3,
        lastAttemptAt: null,
        nextRetryAt: null,
        
        // Error tracking
        errors: [],
        lastError: null,
        
        // Metadata
        reason: jobData.reason || 'Manual sync',
        applicationId: jobData.applicationId || null,
        
        // Timestamps
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null
      };

      await db.modify(PATHS.ROBLOX.SYNC_QUEUE, (queue) => {
        queue.push(job);
        return queue;
      });

      logger.info('Sync job added to queue', { 
        jobId: job.id, 
        serverId: job.serverId,
        robloxUserId: job.robloxUserId 
      });

      return job;
    } catch (error) {
      logger.error('Failed to add sync job', { error });
      throw error;
    }
  }

  /**
   * Get job by ID
   * @param {string} jobId - Job ID
   * @returns {Promise<Object|null>}
   */
  async getJob(jobId) {
    try {
      const queue = await this.getAllJobs();
      return queue.find(j => j.id === jobId) || null;
    } catch (error) {
      logger.error('Failed to get job', { jobId, error });
      return null;
    }
  }

  /**
   * Update job
   * @param {string} jobId - Job ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>}
   */
  async updateJob(jobId, updates) {
    try {
      let updatedJob = null;

      await db.modify(PATHS.ROBLOX.SYNC_QUEUE, (queue) => {
        const index = queue.findIndex(j => j.id === jobId);
        
        if (index === -1) {
          throw new Error('Job not found');
        }

        queue[index] = {
          ...queue[index],
          ...updates,
          updatedAt: new Date().toISOString()
        };

        updatedJob = queue[index];

        return queue;
      });

      return updatedJob;
    } catch (error) {
      logger.error('Failed to update job', { jobId, error });
      throw error;
    }
  }

  /**
   * Mark job as in progress
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>}
   */
  async markInProgress(jobId) {
    try {
      return await this.updateJob(jobId, {
        status: SYNC_STATUS.IN_PROGRESS,
        lastAttemptAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to mark job in progress', { jobId, error });
      throw error;
    }
  }

  /**
   * Mark job as completed
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>}
   */
  async markCompleted(jobId) {
    try {
      return await this.updateJob(jobId, {
        status: SYNC_STATUS.COMPLETED,
        completedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to mark job completed', { jobId, error });
      throw error;
    }
  }

  /**
   * Mark job as failed
   * @param {string} jobId - Job ID
   * @param {string} errorMessage - Error message
   * @param {boolean} retry - Whether to retry
   * @returns {Promise<Object>}
   */
  async markFailed(jobId, errorMessage, retry = true) {
    try {
      const job = await this.getJob(jobId);
      
      if (!job) {
        throw new Error('Job not found');
      }

      job.attempts++;
      job.errors.push({
        message: errorMessage,
        timestamp: new Date().toISOString()
      });
      job.lastError = errorMessage;

      // Check if we should retry
      if (retry && job.attempts < job.maxAttempts) {
        // Exponential backoff: 5min, 15min, 30min
        const delayMinutes = Math.min(5 * Math.pow(2, job.attempts - 1), 30);
        const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);

        return await this.updateJob(jobId, {
          status: SYNC_STATUS.RETRYING,
          attempts: job.attempts,
          errors: job.errors,
          lastError: job.lastError,
          nextRetryAt: nextRetryAt.toISOString()
        });
      } else {
        // Max attempts reached or no retry
        return await this.updateJob(jobId, {
          status: SYNC_STATUS.FAILED,
          attempts: job.attempts,
          errors: job.errors,
          lastError: job.lastError,
          completedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Failed to mark job failed', { jobId, error });
      throw error;
    }
  }

  /**
   * Delete job from queue
   * @param {string} jobId - Job ID
   * @returns {Promise<void>}
   */
  async deleteJob(jobId) {
    try {
      await db.modify(PATHS.ROBLOX.SYNC_QUEUE, (queue) => {
        return queue.filter(j => j.id !== jobId);
      });

      logger.debug('Sync job deleted', { jobId });
    } catch (error) {
      logger.error('Failed to delete job', { jobId, error });
      throw error;
    }
  }

  /**
   * Get pending jobs (queued or ready to retry)
   * @param {number} limit - Max jobs to return
   * @returns {Promise<Array>}
   */
  async getPendingJobs(limit = 10) {
    try {
      const queue = await this.getAllJobs();
      const now = new Date();

      // Filter for pending jobs
      const pending = queue.filter(job => {
        if (job.status === SYNC_STATUS.QUEUED) {
          return true;
        }
        
        if (job.status === SYNC_STATUS.RETRYING && job.nextRetryAt) {
          return new Date(job.nextRetryAt) <= now;
        }
        
        return false;
      });

      // Sort by priority (higher first), then by creation date (older first)
      pending.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

      return pending.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get pending jobs', { error });
      return [];
    }
  }

  /**
   * Get jobs by server
   * @param {string} serverId - Discord server ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>}
   */
  async getServerJobs(serverId, filters = {}) {
    try {
      const queue = await this.getAllJobs();
      
      let filtered = queue.filter(j => j.serverId === serverId);

      if (filters.status) {
        filtered = filtered.filter(j => j.status === filters.status);
      }

      if (filters.robloxUserId) {
        filtered = filtered.filter(j => j.robloxUserId === filters.robloxUserId);
      }

      // Sort by creation date (newest first)
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return filtered;
    } catch (error) {
      logger.error('Failed to get server jobs', { serverId, error });
      return [];
    }
  }

  /**
   * Get jobs for a user
   * @param {string} serverId - Discord server ID
   * @param {string} robloxUserId - Roblox user ID
   * @returns {Promise<Array>}
   */
  async getUserJobs(serverId, robloxUserId) {
    try {
      return await this.getServerJobs(serverId, { robloxUserId });
    } catch (error) {
      logger.error('Failed to get user jobs', { serverId, robloxUserId, error });
      return [];
    }
  }

  /**
   * Check if user has pending sync
   * @param {string} serverId - Discord server ID
   * @param {string} robloxUserId - Roblox user ID
   * @returns {Promise<boolean>}
   */
  async hasPendingSync(serverId, robloxUserId) {
    try {
      const jobs = await this.getUserJobs(serverId, robloxUserId);
      return jobs.some(j => 
        j.status === SYNC_STATUS.QUEUED || 
        j.status === SYNC_STATUS.IN_PROGRESS ||
        j.status === SYNC_STATUS.RETRYING
      );
    } catch (error) {
      logger.error('Failed to check pending sync', { serverId, robloxUserId, error });
      return false;
    }
  }

  /**
   * Get queue statistics
   * @param {string} serverId - Discord server ID (optional)
   * @returns {Promise<Object>}
   */
  async getStatistics(serverId = null) {
    try {
      let queue = await this.getAllJobs();

      if (serverId) {
        queue = queue.filter(j => j.serverId === serverId);
      }

      const stats = {
        total: queue.length,
        queued: queue.filter(j => j.status === SYNC_STATUS.QUEUED).length,
        inProgress: queue.filter(j => j.status === SYNC_STATUS.IN_PROGRESS).length,
        retrying: queue.filter(j => j.status === SYNC_STATUS.RETRYING).length,
        completed: queue.filter(j => j.status === SYNC_STATUS.COMPLETED).length,
        failed: queue.filter(j => j.status === SYNC_STATUS.FAILED).length,
        averageAttempts: 0,
        oldestPending: null
      };

      // Calculate average attempts
      if (queue.length > 0) {
        const totalAttempts = queue.reduce((sum, j) => sum + j.attempts, 0);
        stats.averageAttempts = (totalAttempts / queue.length).toFixed(2);
      }

      // Find oldest pending job
      const pending = queue.filter(j => 
        j.status === SYNC_STATUS.QUEUED || 
        j.status === SYNC_STATUS.RETRYING
      );

      if (pending.length > 0) {
        pending.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        stats.oldestPending = pending[0].createdAt;
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get statistics', { error });
      return null;
    }
  }

  /**
   * Clean completed jobs
   * @param {number} hoursOld - Delete completed jobs older than this many hours
   * @returns {Promise<number>} Number of deleted jobs
   */
  async cleanCompletedJobs(hoursOld = 24) {
    try {
      const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
      let deletedCount = 0;

      await db.modify(PATHS.ROBLOX.SYNC_QUEUE, (queue) => {
        const originalLength = queue.length;

        const filtered = queue.filter(job => {
          if (job.status !== SYNC_STATUS.COMPLETED) {
            return true;
          }

          const completedDate = new Date(job.completedAt);
          return completedDate >= cutoffDate;
        });

        deletedCount = originalLength - filtered.length;

        return filtered;
      });

      if (deletedCount > 0) {
        logger.info('Cleaned completed sync jobs', { deleted: deletedCount, hoursOld });
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to clean completed jobs', { error });
      return 0;
    }
  }

  /**
   * Retry failed jobs
   * @param {string} serverId - Discord server ID (optional)
   * @returns {Promise<number>} Number of jobs reset to retry
   */
  async retryFailedJobs(serverId = null) {
    try {
      let retryCount = 0;

      await db.modify(PATHS.ROBLOX.SYNC_QUEUE, (queue) => {
        queue.forEach(job => {
          if (job.status === SYNC_STATUS.FAILED) {
            if (!serverId || job.serverId === serverId) {
              job.status = SYNC_STATUS.QUEUED;
              job.attempts = 0;
              job.nextRetryAt = null;
              job.updatedAt = new Date().toISOString();
              retryCount++;
            }
          }
        });

        return queue;
      });

      if (retryCount > 0) {
        logger.info('Failed jobs reset for retry', { count: retryCount, serverId });
      }

      return retryCount;
    } catch (error) {
      logger.error('Failed to retry failed jobs', { error });
      return 0;
    }
  }

  /**
   * Cancel pending jobs for user
   * @param {string} serverId - Discord server ID
   * @param {string} robloxUserId - Roblox user ID
   * @returns {Promise<number>} Number of cancelled jobs
   */
  async cancelUserJobs(serverId, robloxUserId) {
    try {
      let cancelledCount = 0;

      await db.modify(PATHS.ROBLOX.SYNC_QUEUE, (queue) => {
        return queue.filter(job => {
          const shouldCancel = 
            job.serverId === serverId &&
            job.robloxUserId === robloxUserId &&
            (job.status === SYNC_STATUS.QUEUED || job.status === SYNC_STATUS.RETRYING);

          if (shouldCancel) {
            cancelledCount++;
            return false;
          }

          return true;
        });
      });

      if (cancelledCount > 0) {
        logger.info('User sync jobs cancelled', { serverId, robloxUserId, count: cancelledCount });
      }

      return cancelledCount;
    } catch (error) {
      logger.error('Failed to cancel user jobs', { serverId, robloxUserId, error });
      return 0;
    }
  }

  /**
   * Clear all jobs for server
   * @param {string} serverId - Discord server ID
   * @returns {Promise<number>} Number of cleared jobs
   */
  async clearServerJobs(serverId) {
    try {
      let clearedCount = 0;

      await db.modify(PATHS.ROBLOX.SYNC_QUEUE, (queue) => {
        const originalLength = queue.length;
        const filtered = queue.filter(j => j.serverId !== serverId);
        clearedCount = originalLength - filtered.length;
        return filtered;
      });

      if (clearedCount > 0) {
        logger.info('Server sync jobs cleared', { serverId, count: clearedCount });
      }

      return clearedCount;
    } catch (error) {
      logger.error('Failed to clear server jobs', { serverId, error });
      return 0;
    }
  }
}

// Export singleton instance
module.exports = new SyncQueueDatabase();