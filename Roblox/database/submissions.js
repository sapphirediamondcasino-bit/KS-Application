/**
 * KS Bot - Roblox Submissions Database
 * 
 * Tracks in-game application submissions for analytics and rate limiting.
 * This is separate from the main applications database for performance.
 */

const db = require('../../data/db_handler');
const { PATHS } = require('../../shared/constants');
const { roblox: logger } = require('../../shared/utils/logger');

class RobloxSubmissionsDatabase {
  /**
   * Get all submissions
   * @returns {Promise<Array>}
   */
  async getAllSubmissions() {
    try {
      const submissions = await db.read(PATHS.ROBLOX.SUBMISSIONS);
      return submissions || [];
    } catch (error) {
      logger.error('Failed to read submissions', { error });
      return [];
    }
  }

  /**
   * Log a submission
   * @param {Object} submissionData - Submission data
   * @returns {Promise<void>}
   */
  async logSubmission(submissionData) {
    try {
      await db.modify(PATHS.ROBLOX.SUBMISSIONS, (submissions) => {
        const submission = {
          id: db.generateId(),
          serverId: submissionData.serverId,
          robloxUserId: submissionData.robloxUserId,
          robloxUsername: submissionData.robloxUsername,
          templateId: submissionData.templateId,
          placeId: submissionData.placeId,
          applicationId: submissionData.applicationId,
          timestamp: new Date().toISOString(),
          ipAddress: submissionData.ipAddress || null,
          success: submissionData.success !== false
        };

        submissions.push(submission);

        // Keep only last 10,000 submissions for performance
        if (submissions.length > 10000) {
          submissions.shift();
        }

        return submissions;
      });

      logger.submission(
        submissionData.serverId,
        submissionData.robloxUserId,
        submissionData.templateId,
        'roblox'
      );
    } catch (error) {
      logger.error('Failed to log submission', { error });
    }
  }

  /**
   * Get submissions for a server
   * @param {string} serverId - Discord server ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>}
   */
  async getServerSubmissions(serverId, filters = {}) {
    try {
      const submissions = await this.getAllSubmissions();
      
      let filtered = submissions.filter(s => s.serverId === serverId);

      // Apply additional filters
      if (filters.robloxUserId) {
        filtered = filtered.filter(s => s.robloxUserId === filters.robloxUserId);
      }

      if (filters.templateId) {
        filtered = filtered.filter(s => s.templateId === filters.templateId);
      }

      if (filters.placeId) {
        filtered = filtered.filter(s => s.placeId === filters.placeId);
      }

      if (filters.success !== undefined) {
        filtered = filtered.filter(s => s.success === filters.success);
      }

      if (filters.since) {
        const sinceDate = new Date(filters.since);
        filtered = filtered.filter(s => new Date(s.timestamp) >= sinceDate);
      }

      // Sort by timestamp (newest first)
      filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return filtered;
    } catch (error) {
      logger.error('Failed to get server submissions', { serverId, error });
      return [];
    }
  }

  /**
   * Get user submissions
   * @param {string} serverId - Discord server ID
   * @param {string} robloxUserId - Roblox user ID
   * @returns {Promise<Array>}
   */
  async getUserSubmissions(serverId, robloxUserId) {
    try {
      return await this.getServerSubmissions(serverId, { robloxUserId });
    } catch (error) {
      logger.error('Failed to get user submissions', { serverId, robloxUserId, error });
      return [];
    }
  }

  /**
   * Get last submission time for user
   * @param {string} serverId - Discord server ID
   * @param {string} robloxUserId - Roblox user ID
   * @param {string} templateId - Template ID (optional)
   * @returns {Promise<Date|null>}
   */
  async getLastSubmissionTime(serverId, robloxUserId, templateId = null) {
    try {
      const filters = { robloxUserId };
      if (templateId) {
        filters.templateId = templateId;
      }

      const submissions = await this.getServerSubmissions(serverId, filters);

      if (submissions.length === 0) {
        return null;
      }

      // Get most recent
      return new Date(submissions[0].timestamp);
    } catch (error) {
      logger.error('Failed to get last submission time', { serverId, robloxUserId, error });
      return null;
    }
  }

  /**
   * Check if user is on cooldown
   * @param {string} serverId - Discord server ID
   * @param {string} robloxUserId - Roblox user ID
   * @param {string} templateId - Template ID
   * @param {number} cooldownMinutes - Cooldown in minutes
   * @returns {Promise<Object>} { onCooldown, remainingTime }
   */
  async checkCooldown(serverId, robloxUserId, templateId, cooldownMinutes) {
    try {
      const lastSubmission = await this.getLastSubmissionTime(serverId, robloxUserId, templateId);

      if (!lastSubmission) {
        return { onCooldown: false, remainingTime: 0 };
      }

      const cooldownMs = cooldownMinutes * 60 * 1000;
      const elapsedMs = Date.now() - lastSubmission.getTime();

      if (elapsedMs < cooldownMs) {
        return {
          onCooldown: true,
          remainingTime: Math.ceil((cooldownMs - elapsedMs) / 1000 / 60) // Minutes
        };
      }

      return { onCooldown: false, remainingTime: 0 };
    } catch (error) {
      logger.error('Failed to check cooldown', { serverId, robloxUserId, error });
      return { onCooldown: false, remainingTime: 0 };
    }
  }

  /**
   * Check rate limit (submissions per hour)
   * @param {string} serverId - Discord server ID
   * @param {string} robloxUserId - Roblox user ID
   * @param {number} maxPerHour - Max submissions per hour
   * @returns {Promise<Object>} { limited, count, resetAt }
   */
  async checkRateLimit(serverId, robloxUserId, maxPerHour = 5) {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const recentSubmissions = await this.getServerSubmissions(serverId, {
        robloxUserId,
        since: oneHourAgo.toISOString()
      });

      if (recentSubmissions.length >= maxPerHour) {
        // Find oldest submission in the window
        const oldestSubmission = recentSubmissions[recentSubmissions.length - 1];
        const resetAt = new Date(new Date(oldestSubmission.timestamp).getTime() + 60 * 60 * 1000);

        return {
          limited: true,
          count: recentSubmissions.length,
          resetAt
        };
      }

      return {
        limited: false,
        count: recentSubmissions.length,
        resetAt: null
      };
    } catch (error) {
      logger.error('Failed to check rate limit', { serverId, robloxUserId, error });
      return { limited: false, count: 0, resetAt: null };
    }
  }

  /**
   * Get submission statistics
   * @param {string} serverId - Discord server ID
   * @param {Object} options - Options { days, templateId }
   * @returns {Promise<Object>}
   */
  async getStatistics(serverId, options = {}) {
    try {
      const filters = {};

      if (options.days) {
        const since = new Date();
        since.setDate(since.getDate() - options.days);
        filters.since = since.toISOString();
      }

      if (options.templateId) {
        filters.templateId = options.templateId;
      }

      const submissions = await this.getServerSubmissions(serverId, filters);

      const stats = {
        total: submissions.length,
        successful: submissions.filter(s => s.success).length,
        failed: submissions.filter(s => !s.success).length,
        uniqueUsers: new Set(submissions.map(s => s.robloxUserId)).size,
        byTemplate: {},
        byPlace: {},
        byHour: Array(24).fill(0),
        byDay: Array(7).fill(0)
      };

      // Count by template
      submissions.forEach(s => {
        if (!stats.byTemplate[s.templateId]) {
          stats.byTemplate[s.templateId] = 0;
        }
        stats.byTemplate[s.templateId]++;
      });

      // Count by place
      submissions.forEach(s => {
        if (!stats.byPlace[s.placeId]) {
          stats.byPlace[s.placeId] = 0;
        }
        stats.byPlace[s.placeId]++;
      });

      // Count by hour of day
      submissions.forEach(s => {
        const hour = new Date(s.timestamp).getHours();
        stats.byHour[hour]++;
      });

      // Count by day of week (0 = Sunday)
      submissions.forEach(s => {
        const day = new Date(s.timestamp).getDay();
        stats.byDay[day]++;
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get statistics', { serverId, error });
      return null;
    }
  }

  /**
   * Get top submitters
   * @param {string} serverId - Discord server ID
   * @param {number} limit - Number of top submitters to return
   * @param {number} days - Number of days to look back (optional)
   * @returns {Promise<Array>}
   */
  async getTopSubmitters(serverId, limit = 10, days = null) {
    try {
      const filters = {};

      if (days) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        filters.since = since.toISOString();
      }

      const submissions = await this.getServerSubmissions(serverId, filters);

      // Count submissions per user
      const userCounts = {};
      submissions.forEach(s => {
        if (!userCounts[s.robloxUserId]) {
          userCounts[s.robloxUserId] = {
            robloxUserId: s.robloxUserId,
            robloxUsername: s.robloxUsername,
            count: 0
          };
        }
        userCounts[s.robloxUserId].count++;
      });

      // Sort and limit
      const sorted = Object.values(userCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return sorted;
    } catch (error) {
      logger.error('Failed to get top submitters', { serverId, error });
      return [];
    }
  }

  /**
   * Clean old submissions
   * @param {number} daysOld - Delete submissions older than this many days
   * @returns {Promise<number>} Number of deleted submissions
   */
  async cleanOldSubmissions(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      let deletedCount = 0;

      await db.modify(PATHS.ROBLOX.SUBMISSIONS, (submissions) => {
        const originalLength = submissions.length;
        
        const filtered = submissions.filter(s => {
          const submissionDate = new Date(s.timestamp);
          return submissionDate >= cutoffDate;
        });

        deletedCount = originalLength - filtered.length;

        return filtered;
      });

      if (deletedCount > 0) {
        logger.info('Cleaned old submissions', { deleted: deletedCount, daysOld });
      }

      return deletedCount;
    } catch (error) {
      logger.error('Failed to clean old submissions', { error });
      return 0;
    }
  }

  /**
   * Export submissions to JSON
   * @param {string} serverId - Discord server ID
   * @param {Object} filters - Filter options
   * @returns {Promise<string>}
   */
  async exportSubmissions(serverId, filters = {}) {
    try {
      const submissions = await this.getServerSubmissions(serverId, filters);
      return JSON.stringify(submissions, null, 2);
    } catch (error) {
      logger.error('Failed to export submissions', { serverId, error });
      return null;
    }
  }
}

// Export singleton instance
module.exports = new RobloxSubmissionsDatabase();