const ticketsDb = require('../core/database/tickets');
const serverDb = require('../core/database/servers');
const { main: logger } = require('../shared/utils/logger');

class SharedTicketHandler {
  /**
   * Create a new ticket
   * @param {Object} data - Ticket data
   * @returns {Promise<Object>}
   */
  async createTicket(data) {
    try {
      const { 
        serverId, 
        userId, 
        subject, 
        description, 
        priority = 'medium',
        category = null,
        channelId = null
      } = data;

      const serverConfig = await serverDb.getServer(serverId);

      if (!serverConfig || !serverConfig.tickets.enabled) {
        return {
          success: false,
          error: 'Tickets not enabled on this server'
        };
      }

      // Check user's open ticket count
      const openCount = await ticketsDb.countUserOpenTickets(serverId, userId);

      if (openCount >= serverConfig.tickets.maxOpenTickets) {
        return {
          success: false,
          error: `Maximum of ${serverConfig.tickets.maxOpenTickets} open tickets reached`
        };
      }

      // Create ticket
      const ticket = await ticketsDb.createTicket({
        serverId,
        userId,
        channelId,
        subject,
        description,
        priority,
        category
      });

      // Update analytics
      await serverDb.incrementAnalytics(serverId, 'totalTickets');

      logger.info('Ticket created', {
        ticketId: ticket.id,
        serverId,
        userId
      });

      return {
        success: true,
        ticket
      };

    } catch (error) {
      logger.error('Failed to create ticket', { error: error.message });
      return {
        success: false,
        error: 'Failed to create ticket'
      };
    }
  }

  /**
   * Close a ticket
   * @param {string} ticketId - Ticket ID
   * @param {string} closedBy - User ID who closed
   * @param {string} reason - Close reason
   * @returns {Promise<Object>}
   */
  async closeTicket(ticketId, closedBy, reason = null) {
    try {
      const ticket = await ticketsDb.getTicket(ticketId);

      if (!ticket) {
        return {
          success: false,
          error: 'Ticket not found'
        };
      }

      if (ticket.status === 'closed') {
        return {
          success: false,
          error: 'Ticket already closed'
        };
      }

      await ticketsDb.closeTicket(ticketId, closedBy, reason);

      logger.info('Ticket closed', {
        ticketId,
        closedBy
      });

      return {
        success: true,
        ticket: await ticketsDb.getTicket(ticketId)
      };

    } catch (error) {
      logger.error('Failed to close ticket', { ticketId, error: error.message });
      return {
        success: false,
        error: 'Failed to close ticket'
      };
    }
  }

  /**
   * Add participant to ticket
   * @param {string} ticketId - Ticket ID
   * @param {string} userId - User ID to add
   * @returns {Promise<Object>}
   */
  async addParticipant(ticketId, userId) {
    try {
      const ticket = await ticketsDb.getTicket(ticketId);

      if (!ticket) {
        return {
          success: false,
          error: 'Ticket not found'
        };
      }

      if (ticket.participants.includes(userId)) {
        return {
          success: false,
          error: 'User already in ticket'
        };
      }

      await ticketsDb.addParticipant(ticketId, userId);

      logger.info('Participant added to ticket', {
        ticketId,
        userId
      });

      return {
        success: true,
        ticket: await ticketsDb.getTicket(ticketId)
      };

    } catch (error) {
      logger.error('Failed to add participant', { ticketId, error: error.message });
      return {
        success: false,
        error: 'Failed to add participant'
      };
    }
  }

  /**
   * Get ticket statistics
   * @param {string} serverId - Server ID
   * @returns {Promise<Object>}
   */
  async getStatistics(serverId) {
    try {
      return await ticketsDb.getStatistics(serverId);
    } catch (error) {
      logger.error('Failed to get ticket statistics', { serverId, error: error.message });
      return null;
    }
  }

  /**
   * Update ticket activity
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<void>}
   */
  async updateActivity(ticketId) {
    try {
      await ticketsDb.updateActivity(ticketId);
    } catch (error) {
      logger.error('Failed to update ticket activity', { ticketId, error: error.message });
    }
  }
}

module.exports = new SharedTicketHandler();