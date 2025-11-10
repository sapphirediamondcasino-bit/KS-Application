const serverDb = require('../core/database/servers');
const { main: logger } = require('../shared/utils/logger');

class SharedPermissionHandler {
  /**
   * Check if user can review applications
   * @param {string} serverId - Server ID
   * @param {string} userId - User ID
   * @param {Array} userRoles - User's role IDs
   * @returns {Promise<boolean>}
   */
  async canReviewApplications(serverId, userId, userRoles = []) {
    try {
      const serverConfig = await serverDb.getServer(serverId);

      if (!serverConfig) {
        return false;
      }

      // Check if user has any reviewer role
      return userRoles.some(roleId => 
        serverConfig.applications.reviewerRoleIds.includes(roleId)
      );

    } catch (error) {
      logger.error('Failed to check review permissions', { 
        serverId, 
        userId, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Check if user can manage tickets
   * @param {string} serverId - Server ID
   * @param {string} userId - User ID
   * @param {Array} userRoles - User's role IDs
   * @returns {Promise<boolean>}
   */
  async canManageTickets(serverId, userId, userRoles = []) {
    try {
      const serverConfig = await serverDb.getServer(serverId);

      if (!serverConfig) {
        return false;
      }

      // Check if user has any support role
      return userRoles.some(roleId => 
        serverConfig.tickets.supportRoleIds.includes(roleId)
      );

    } catch (error) {
      logger.error('Failed to check ticket permissions', { 
        serverId, 
        userId, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Check if user can access specific application
   * @param {string} serverId - Server ID
   * @param {string} userId - User ID
   * @param {string} applicationId - Application ID
   * @param {Array} userRoles - User's role IDs
   * @returns {Promise<boolean>}
   */
  async canAccessApplication(serverId, userId, applicationId, userRoles = []) {
    try {
      const applicationsDb = require('../core/database/applications');
      const application = await applicationsDb.getApplication(applicationId);

      if (!application) {
        return false;
      }

      // User can access their own applications
      if (application.userId === userId || application.robloxUserId === userId) {
        return true;
      }

      // Check if user can review applications
      return await this.canReviewApplications(serverId, userId, userRoles);

    } catch (error) {
      logger.error('Failed to check application access', { 
        serverId, 
        userId, 
        applicationId, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Check if user can access specific ticket
   * @param {string} serverId - Server ID
   * @param {string} userId - User ID
   * @param {string} ticketId - Ticket ID
   * @param {Array} userRoles - User's role IDs
   * @returns {Promise<boolean>}
   */
  async canAccessTicket(serverId, userId, ticketId, userRoles = []) {
    try {
      const ticketsDb = require('../core/database/tickets');
      const ticket = await ticketsDb.getTicket(ticketId);

      if (!ticket) {
        return false;
      }

      // User can access their own tickets
      if (ticket.userId === userId) {
        return true;
      }

      // Check if user is a participant
      if (ticket.participants.includes(userId)) {
        return true;
      }

      // Check if user can manage tickets
      return await this.canManageTickets(serverId, userId, userRoles);

    } catch (error) {
      logger.error('Failed to check ticket access', { 
        serverId, 
        userId, 
        ticketId, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Get user's effective permissions
   * @param {string} serverId - Server ID
   * @param {Array} userRoles - User's role IDs
   * @returns {Promise<Object>}
   */
  async getUserPermissions(serverId, userRoles = []) {
    try {
      return {
        canReviewApplications: await this.canReviewApplications(serverId, null, userRoles),
        canManageTickets: await this.canManageTickets(serverId, null, userRoles)
      };

    } catch (error) {
      logger.error('Failed to get user permissions', { 
        serverId, 
        error: error.message 
      });
      return {
        canReviewApplications: false,
        canManageTickets: false
      };
    }
  }
}

module.exports = new SharedPermissionHandler();