/**
 * KS Bot - Applications Database
 * 
 * Manages application submissions from both Discord and Roblox.
 * Handles storage, retrieval, status updates, and analytics.
 */

const path = require('path');
const db = require('../../data/db_handler');
const { PATHS, APPLICATION_STATUS, APPLICATION_SOURCE } = require('../../shared/constants');
const { database: logger } = require('../../shared/utils/logger');

class ApplicationDatabase {
  /**
   * Get application file path
   * @param {string} applicationId - Application ID
   * @returns {string}
   */
  getApplicationPath(applicationId) {
    return path.join(PATHS.APPLICATIONS, `${applicationId}.json`);
  }

  /**
   * Get server applications directory
   * @param {string} serverId - Discord server ID
   * @returns {string}
   */
  getServerApplicationsPath(serverId) {
    return path.join(PATHS.APPLICATIONS, serverId);
  }

  /**
   * Create new application
   * @param {Object} applicationData - Application data
   * @returns {Promise<Object>}
   */
  async createApplication(applicationData) {
    try {
      const applicationId = db.generateId();
      const filePath = this.getApplicationPath(applicationId);

      const application = {
        id: applicationId,
        serverId: applicationData.serverId,
        userId: applicationData.userId,
        templateId: applicationData.templateId,
        templateName: applicationData.templateName,
        
        // Source information
        source: applicationData.source || APPLICATION_SOURCE.DISCORD,
        robloxUserId: applicationData.robloxUserId || null,
        robloxUsername: applicationData.robloxUsername || null,
        
        // Application data
        responses: applicationData.responses,
        
        // Status
        status: APPLICATION_STATUS.PENDING,
        submittedAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null,
        reason: null,
        
        // Additional metadata
        metadata: {
          userTag: applicationData.userTag || null,
          channelId: applicationData.channelId || null,
          messageId: applicationData.messageId || null,
          ipAddress: applicationData.ipAddress || null,
          userAgent: applicationData.userAgent || null
        },
        
        // Timestamps
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.write(filePath, application);
      logger.write('applications', 'createApplication', 1, true, 0);

      return application;
    } catch (error) {
      logger.error('applications', 'createApplication', error);
      throw error;
    }
  }

  /**
   * Get application by ID
   * @param {string} applicationId - Application ID
   * @returns {Promise<Object|null>}
   */
  async getApplication(applicationId) {
    try {
      const filePath = this.getApplicationPath(applicationId);
      const application = await db.read(filePath);
      return application;
    } catch (error) {
      logger.error('applications', 'getApplication', error);
      return null;
    }
  }

  /**
   * Update application
   * @param {string} applicationId - Application ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>}
   */
  async updateApplication(applicationId, updates) {
    try {
      const filePath = this.getApplicationPath(applicationId);

      const updatedApplication = await db.modify(filePath, (application) => {
        if (!application) {
          throw new Error('Application not found');
        }

        const updated = {
          ...application,
          ...updates,
          updatedAt: new Date().toISOString()
        };

        return updated;
      });

      return updatedApplication;
    } catch (error) {
      logger.error('applications', 'updateApplication', error);
      throw error;
    }
  }

  /**
   * Approve application
   * @param {string} applicationId - Application ID
   * @param {string} reviewerId - Reviewer user ID
   * @param {string} reason - Approval reason (optional)
   * @returns {Promise<Object>}
   */
  async approveApplication(applicationId, reviewerId, reason = null) {
    try {
      return await this.updateApplication(applicationId, {
        status: APPLICATION_STATUS.APPROVED,
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewerId,
        reason
      });
    } catch (error) {
      logger.error('applications', 'approveApplication', error);
      throw error;
    }
  }

  /**
   * Deny application
   * @param {string} applicationId - Application ID
   * @param {string} reviewerId - Reviewer user ID
   * @param {string} reason - Denial reason
   * @returns {Promise<Object>}
   */
  async denyApplication(applicationId, reviewerId, reason) {
    try {
      return await this.updateApplication(applicationId, {
        status: APPLICATION_STATUS.DENIED,
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewerId,
        reason
      });
    } catch (error) {
      logger.error('applications', 'denyApplication', error);
      throw error;
    }
  }

  /**
   * Cancel application
   * @param {string} applicationId - Application ID
   * @returns {Promise<Object>}
   */
  async cancelApplication(applicationId) {
    try {
      return await this.updateApplication(applicationId, {
        status: APPLICATION_STATUS.CANCELLED,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('applications', 'cancelApplication', error);
      throw error;
    }
  }

  /**
   * Delete application
   * @param {string} applicationId - Application ID
   * @returns {Promise<void>}
   */
  async deleteApplication(applicationId) {
    try {
      const filePath = this.getApplicationPath(applicationId);
      await db.delete(filePath);
      logger.write('applications', 'deleteApplication', 1, true, 0);
    } catch (error) {
      logger.error('applications', 'deleteApplication', error);
      throw error;
    }
  }

  /**
   * Get all applications for a server
   * @param {string} serverId - Discord server ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>}
   */
  async getServerApplications(serverId, filters = {}) {
    try {
      const files = await db.listFiles(PATHS.APPLICATIONS, '.json');
      const applications = [];

      for (const file of files) {
        const filePath = path.join(PATHS.APPLICATIONS, file);
        const application = await db.read(filePath);

        if (application && application.serverId === serverId) {
          // Apply filters
          if (this.matchesFilters(application, filters)) {
            applications.push(application);
          }
        }
      }

      // Sort by submission date (newest first)
      applications.sort((a, b) => 
        new Date(b.submittedAt) - new Date(a.submittedAt)
      );

      return applications;
    } catch (error) {
      logger.error('applications', 'getServerApplications', error);
      return [];
    }
  }

  /**
   * Get applications by user
   * @param {string} serverId - Discord server ID
   * @param {string} userId - User ID
   * @returns {Promise<Array>}
   */
  async getUserApplications(serverId, userId) {
    try {
      return await this.getServerApplications(serverId, { userId });
    } catch (error) {
      logger.error('applications', 'getUserApplications', error);
      return [];
    }
  }

  /**
   * Get applications by status
   * @param {string} serverId - Discord server ID
   * @param {string} status - Application status
   * @returns {Promise<Array>}
   */
  async getApplicationsByStatus(serverId, status) {
    try {
      return await this.getServerApplications(serverId, { status });
    } catch (error) {
      logger.error('applications', 'getApplicationsByStatus', error);
      return [];
    }
  }

  /**
   * Get applications by template
   * @param {string} serverId - Discord server ID
   * @param {string} templateId - Template ID
   * @returns {Promise<Array>}
   */
  async getApplicationsByTemplate(serverId, templateId) {
    try {
      return await this.getServerApplications(serverId, { templateId });
    } catch (error) {
      logger.error('applications', 'getApplicationsByTemplate', error);
      return [];
    }
  }

  /**
   * Get applications by source
   * @param {string} serverId - Discord server ID
   * @param {string} source - Application source (discord/roblox)
   * @returns {Promise<Array>}
   */
  async getApplicationsBySource(serverId, source) {
    try {
      return await this.getServerApplications(serverId, { source });
    } catch (error) {
      logger.error('applications', 'getApplicationsBySource', error);
      return [];
    }
  }

  /**
   * Check if user has pending application
   * @param {string} serverId - Discord server ID
   * @param {string} userId - User ID
   * @param {string} templateId - Template ID (optional)
   * @returns {Promise<boolean>}
   */
  async hasPendingApplication(serverId, userId, templateId = null) {
    try {
      const filters = {
        userId,
        status: APPLICATION_STATUS.PENDING
      };

      if (templateId) {
        filters.templateId = templateId;
      }

      const applications = await this.getServerApplications(serverId, filters);
      return applications.length > 0;
    } catch (error) {
      logger.error('applications', 'hasPendingApplication', error);
      return false;
    }
  }

  /**
   * Get last submission time for user
   * @param {string} serverId - Discord server ID
   * @param {string} userId - User ID
   * @param {string} templateId - Template ID
   * @returns {Promise<Date|null>}
   */
  async getLastSubmissionTime(serverId, userId, templateId) {
    try {
      const applications = await this.getUserApplications(serverId, userId);
      
      const templateApps = applications.filter(app => app.templateId === templateId);
      
      if (templateApps.length === 0) {
        return null;
      }

      // Get most recent submission
      const latest = templateApps.reduce((latest, app) => {
        const appDate = new Date(app.submittedAt);
        return appDate > latest ? appDate : latest;
      }, new Date(0));

      return latest;
    } catch (error) {
      logger.error('applications', 'getLastSubmissionTime', error);
      return null;
    }
  }

  /**
   * Check if user is on cooldown
   * @param {string} serverId - Discord server ID
   * @param {string} userId - User ID
   * @param {string} templateId - Template ID
   * @param {number} cooldownMinutes - Cooldown in minutes
   * @returns {Promise<Object>} { onCooldown, remainingTime }
   */
  async checkCooldown(serverId, userId, templateId, cooldownMinutes) {
    try {
      const lastSubmission = await this.getLastSubmissionTime(serverId, userId, templateId);
      
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
      logger.error('applications', 'checkCooldown', error);
      return { onCooldown: false, remainingTime: 0 };
    }
  }

  /**
   * Get application statistics for server
   * @param {string} serverId - Discord server ID
   * @returns {Promise<Object>}
   */
  async getStatistics(serverId) {
    try {
      const applications = await this.getServerApplications(serverId);

      const stats = {
        total: applications.length,
        pending: applications.filter(a => a.status === APPLICATION_STATUS.PENDING).length,
        approved: applications.filter(a => a.status === APPLICATION_STATUS.APPROVED).length,
        denied: applications.filter(a => a.status === APPLICATION_STATUS.DENIED).length,
        cancelled: applications.filter(a => a.status === APPLICATION_STATUS.CANCELLED).length,
        fromDiscord: applications.filter(a => a.source === APPLICATION_SOURCE.DISCORD).length,
        fromRoblox: applications.filter(a => a.source === APPLICATION_SOURCE.ROBLOX).length,
        byTemplate: {}
      };

      // Count by template
      applications.forEach(app => {
        if (!stats.byTemplate[app.templateId]) {
          stats.byTemplate[app.templateId] = {
            name: app.templateName,
            total: 0,
            pending: 0,
            approved: 0,
            denied: 0
          };
        }

        stats.byTemplate[app.templateId].total++;
        stats.byTemplate[app.templateId][app.status]++;
      });

      return stats;
    } catch (error) {
      logger.error('applications', 'getStatistics', error);
      return null;
    }
  }

  /**
   * Search applications
   * @param {string} serverId - Discord server ID
   * @param {string} query - Search query
   * @returns {Promise<Array>}
   */
  async searchApplications(serverId, query) {
    try {
      const applications = await this.getServerApplications(serverId);
      const lowerQuery = query.toLowerCase();

      return applications.filter(app => {
        // Search in user ID
        if (app.userId.includes(query)) return true;

        // Search in template name
        if (app.templateName.toLowerCase().includes(lowerQuery)) return true;

        // Search in Roblox username
        if (app.robloxUsername && app.robloxUsername.toLowerCase().includes(lowerQuery)) {
          return true;
        }

        // Search in responses
        const responseText = Object.values(app.responses).join(' ').toLowerCase();
        if (responseText.includes(lowerQuery)) return true;

        return false;
      });
    } catch (error) {
      logger.error('applications', 'searchApplications', error);
      return [];
    }
  }

  /**
   * Bulk update applications
   * @param {Array<string>} applicationIds - Application IDs
   * @param {Object} updates - Updates to apply
   * @returns {Promise<number>} Number of updated applications
   */
  async bulkUpdate(applicationIds, updates) {
    try {
      let updated = 0;

      for (const id of applicationIds) {
        try {
          await this.updateApplication(id, updates);
          updated++;
        } catch (error) {
          logger.error('applications', 'bulkUpdate:single', error);
        }
      }

      return updated;
    } catch (error) {
      logger.error('applications', 'bulkUpdate', error);
      return 0;
    }
  }

  /**
   * Bulk delete applications
   * @param {Array<string>} applicationIds - Application IDs
   * @returns {Promise<number>} Number of deleted applications
   */
  async bulkDelete(applicationIds) {
    try {
      let deleted = 0;

      for (const id of applicationIds) {
        try {
          await this.deleteApplication(id);
          deleted++;
        } catch (error) {
          logger.error('applications', 'bulkDelete:single', error);
        }
      }

      return deleted;
    } catch (error) {
      logger.error('applications', 'bulkDelete', error);
      return 0;
    }
  }

  /**
   * Clean old applications
   * @param {string} serverId - Discord server ID
   * @param {number} daysOld - Delete applications older than this many days
   * @param {Array<string>} statuses - Only delete applications with these statuses
   * @returns {Promise<number>} Number of deleted applications
   */
  async cleanOldApplications(serverId, daysOld = 90, statuses = [APPLICATION_STATUS.APPROVED, APPLICATION_STATUS.DENIED]) {
    try {
      const applications = await this.getServerApplications(serverId);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const toDelete = applications.filter(app => {
        const appDate = new Date(app.submittedAt);
        return appDate < cutoffDate && statuses.includes(app.status);
      });

      const ids = toDelete.map(app => app.id);
      return await this.bulkDelete(ids);
    } catch (error) {
      logger.error('applications', 'cleanOldApplications', error);
      return 0;
    }
  }

  /**
   * Check if application matches filters
   * @param {Object} application - Application object
   * @param {Object} filters - Filter criteria
   * @returns {boolean}
   */
  matchesFilters(application, filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (application[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Export applications to JSON
   * @param {string} serverId - Discord server ID
   * @param {Object} filters - Filter options
   * @returns {Promise<string>} JSON string
   */
  async exportApplications(serverId, filters = {}) {
    try {
      const applications = await this.getServerApplications(serverId, filters);
      return JSON.stringify(applications, null, 2);
    } catch (error) {
      logger.error('applications', 'exportApplications', error);
      return null;
    }
  }
}

// Export singleton instance
module.exports = new ApplicationDatabase();