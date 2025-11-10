const applicationsDb = require('../core/database/applications');
const serverDb = require('../core/database/servers');
const submissionsDb = require('../roblox/database/submissions');
const roleSync = require('../roblox/utils/role_sync');
const { main: logger } = require('../shared/utils/logger');
const { APPLICATION_SOURCE, APPLICATION_STATUS } = require('../shared/constants');

class SharedApplicationHandler {
  /**
   * Process application submission (from any source)
   * @param {Object} data - Submission data
   * @returns {Promise<Object>}
   */
  async submitApplication(data) {
    try {
      const { 
        serverId, 
        userId, 
        templateId, 
        responses, 
        source = APPLICATION_SOURCE.DISCORD,
        robloxUserId = null,
        robloxUsername = null,
        placeId = null,
        ipAddress = null
      } = data;

      // Get template
      const template = await serverDb.getTemplate(serverId, templateId);

      if (!template || !template.enabled) {
        return {
          success: false,
          error: 'Template not found or disabled'
        };
      }

      // Check cooldown
      if (source === APPLICATION_SOURCE.ROBLOX && robloxUserId) {
        const cooldown = await submissionsDb.checkCooldown(
          serverId,
          robloxUserId,
          templateId,
          template.cooldownMinutes || 60
        );

        if (cooldown.onCooldown) {
          return {
            success: false,
            error: `Cooldown active: ${cooldown.remainingTime} minutes remaining`,
            cooldownRemaining: cooldown.remainingTime
          };
        }
      }

      // Create application
      const application = await applicationsDb.createApplication({
        serverId,
        userId: userId || robloxUserId,
        templateId,
        templateName: template.name,
        source,
        robloxUserId,
        robloxUsername,
        responses,
        ipAddress
      });

      // Log submission if from Roblox
      if (source === APPLICATION_SOURCE.ROBLOX) {
        await submissionsDb.logSubmission({
          serverId,
          robloxUserId,
          robloxUsername,
          templateId,
          placeId,
          applicationId: application.id,
          ipAddress,
          success: true
        });
      }

      // Update analytics
      await serverDb.incrementAnalytics(serverId, 
        source === APPLICATION_SOURCE.ROBLOX ? 'totalRobloxSubmissions' : 'totalApplications'
      );

      logger.info('Application submitted', {
        applicationId: application.id,
        serverId,
        source,
        templateId
      });

      return {
        success: true,
        application
      };

    } catch (error) {
      logger.error('Failed to submit application', { error: error.message });
      return {
        success: false,
        error: 'Failed to submit application'
      };
    }
  }

  /**
   * Approve application (from any source)
   * @param {string} applicationId - Application ID
   * @param {string} reviewerId - Reviewer user ID
   * @param {string} reason - Approval reason (optional)
   * @param {Object} client - Discord client (for role sync)
   * @returns {Promise<Object>}
   */
  async approveApplication(applicationId, reviewerId, reason = null, client = null) {
    try {
      const application = await applicationsDb.getApplication(applicationId);

      if (!application) {
        return {
          success: false,
          error: 'Application not found'
        };
      }

      if (application.status !== APPLICATION_STATUS.PENDING) {
        return {
          success: false,
          error: `Application already ${application.status}`
        };
      }

      // Approve in database
      await applicationsDb.approveApplication(applicationId, reviewerId, reason);

      // Handle role assignment based on source
      if (application.source === APPLICATION_SOURCE.ROBLOX && client) {
        // Trigger Roblox role sync
        const syncResult = await roleSync.syncFromApplication(application, client);
        
        if (!syncResult.success) {
          logger.warn('Role sync failed after approval', {
            applicationId,
            error: syncResult.error
          });
        }
      }

      logger.info('Application approved', {
        applicationId,
        reviewerId,
        source: application.source
      });

      return {
        success: true,
        application: await applicationsDb.getApplication(applicationId)
      };

    } catch (error) {
      logger.error('Failed to approve application', { 
        applicationId, 
        error: error.message 
      });
      return {
        success: false,
        error: 'Failed to approve application'
      };
    }
  }

  /**
   * Deny application (from any source)
   * @param {string} applicationId - Application ID
   * @param {string} reviewerId - Reviewer user ID
   * @param {string} reason - Denial reason
   * @returns {Promise<Object>}
   */
  async denyApplication(applicationId, reviewerId, reason) {
    try {
      const application = await applicationsDb.getApplication(applicationId);

      if (!application) {
        return {
          success: false,
          error: 'Application not found'
        };
      }

      if (application.status !== APPLICATION_STATUS.PENDING) {
        return {
          success: false,
          error: `Application already ${application.status}`
        };
      }

      // Deny in database
      await applicationsDb.denyApplication(applicationId, reviewerId, reason);

      logger.info('Application denied', {
        applicationId,
        reviewerId,
        source: application.source
      });

      return {
        success: true,
        application: await applicationsDb.getApplication(applicationId)
      };

    } catch (error) {
      logger.error('Failed to deny application', { 
        applicationId, 
        error: error.message 
      });
      return {
        success: false,
        error: 'Failed to deny application'
      };
    }
  }

  /**
   * Get application statistics
   * @param {string} serverId - Server ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>}
   */
  async getStatistics(serverId, filters = {}) {
    try {
      const stats = await applicationsDb.getStatistics(serverId);

      // Add Roblox-specific stats if needed
      if (filters.includeRoblox) {
        const robloxStats = await submissionsDb.getStatistics(serverId);
        stats.roblox = robloxStats;
      }

      return stats;

    } catch (error) {
      logger.error('Failed to get statistics', { serverId, error: error.message });
      return null;
    }
  }

  /**
   * Validate application eligibility
   * @param {Object} data - Validation data
   * @returns {Promise<Object>}
   */
  async checkEligibility(data) {
    const { serverId, userId, robloxUserId, templateId, source } = data;

    try {
      const template = await serverDb.getTemplate(serverId, templateId);

      if (!template || !template.enabled) {
        return {
          eligible: false,
          reason: 'Template not found or disabled'
        };
      }

      // Check for pending application
      const identifier = source === APPLICATION_SOURCE.ROBLOX ? robloxUserId : userId;
      const hasPending = await applicationsDb.hasPendingApplication(
        serverId,
        identifier,
        templateId
      );

      if (hasPending) {
        return {
          eligible: false,
          reason: 'Already has pending application for this template'
        };
      }

      // Check cooldown for Roblox submissions
      if (source === APPLICATION_SOURCE.ROBLOX && robloxUserId) {
        const cooldown = await submissionsDb.checkCooldown(
          serverId,
          robloxUserId,
          templateId,
          template.cooldownMinutes || 60
        );

        if (cooldown.onCooldown) {
          return {
            eligible: false,
            reason: 'cooldown',
            cooldownRemaining: cooldown.remainingTime
          };
        }

        // Check rate limit
        const rateLimit = await submissionsDb.checkRateLimit(
          serverId,
          robloxUserId,
          5
        );

        if (rateLimit.limited) {
          return {
            eligible: false,
            reason: 'rate_limited',
            resetAt: rateLimit.resetAt
          };
        }
      }

      return {
        eligible: true,
        template: {
          id: template.id,
          name: template.name,
          questionCount: template.questions.length
        }
      };

    } catch (error) {
      logger.error('Failed to check eligibility', { error: error.message });
      return {
        eligible: false,
        reason: 'Error checking eligibility'
      };
    }
  }
}

module.exports = new SharedApplicationHandler();