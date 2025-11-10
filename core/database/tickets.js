/**
 * KS Bot - Tickets Database
 * 
 * Manages ticket system data, including ticket creation, updates,
 * transcripts, and participant management.
 */

const path = require('path');
const db = require('../../data/db_handler');
const { PATHS, TICKET_STATUS, TICKET_PRIORITY } = require('../../shared/constants');
const { database: logger } = require('../../shared/utils/logger');

class TicketDatabase {
  /**
   * Get ticket file path
   * @param {string} ticketId - Ticket ID
   * @returns {string}
   */
  getTicketPath(ticketId) {
    return path.join(PATHS.TICKETS, `${ticketId}.json`);
  }

  /**
   * Create new ticket
   * @param {Object} ticketData - Ticket data
   * @returns {Promise<Object>}
   */
  async createTicket(ticketData) {
    try {
      const ticketId = db.generateId();
      const filePath = this.getTicketPath(ticketId);

      const ticket = {
        id: ticketId,
        serverId: ticketData.serverId,
        userId: ticketData.userId,
        channelId: ticketData.channelId,
        
        // Ticket information
        subject: ticketData.subject,
        description: ticketData.description,
        category: ticketData.category || null,
        priority: ticketData.priority || TICKET_PRIORITY.MEDIUM,
        
        // Status
        status: TICKET_STATUS.OPEN,
        
        // Participants
        participants: [ticketData.userId],
        assignedTo: [],
        
        // Messages
        messageCount: 0,
        firstMessageId: ticketData.firstMessageId || null,
        
        // Timestamps
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        closedAt: null,
        closedBy: null,
        closeReason: null,
        
        // Metadata
        metadata: {
          userTag: ticketData.userTag || null,
          inactivityWarned: false,
          transcriptUrl: null
        },
        
        updatedAt: new Date().toISOString()
      };

      await db.write(filePath, ticket);
      logger.write('tickets', 'createTicket', 1, true, 0);

      return ticket;
    } catch (error) {
      logger.error('tickets', 'createTicket', error);
      throw error;
    }
  }

  /**
   * Get ticket by ID
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Object|null>}
   */
  async getTicket(ticketId) {
    try {
      const filePath = this.getTicketPath(ticketId);
      const ticket = await db.read(filePath);
      return ticket;
    } catch (error) {
      logger.error('tickets', 'getTicket', error);
      return null;
    }
  }

  /**
   * Get ticket by channel ID
   * @param {string} channelId - Discord channel ID
   * @returns {Promise<Object|null>}
   */
  async getTicketByChannel(channelId) {
    try {
      const files = await db.listFiles(PATHS.TICKETS, '.json');

      for (const file of files) {
        const filePath = path.join(PATHS.TICKETS, file);
        const ticket = await db.read(filePath);

        if (ticket && ticket.channelId === channelId) {
          return ticket;
        }
      }

      return null;
    } catch (error) {
      logger.error('tickets', 'getTicketByChannel', error);
      return null;
    }
  }

  /**
   * Update ticket
   * @param {string} ticketId - Ticket ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>}
   */
  async updateTicket(ticketId, updates) {
    try {
      const filePath = this.getTicketPath(ticketId);

      const updatedTicket = await db.modify(filePath, (ticket) => {
        if (!ticket) {
          throw new Error('Ticket not found');
        }

        const updated = {
          ...ticket,
          ...updates,
          updatedAt: new Date().toISOString()
        };

        return updated;
      });

      return updatedTicket;
    } catch (error) {
      logger.error('tickets', 'updateTicket', error);
      throw error;
    }
  }

  /**
   * Close ticket
   * @param {string} ticketId - Ticket ID
   * @param {string} closedBy - User ID who closed the ticket
   * @param {string} reason - Close reason
   * @returns {Promise<Object>}
   */
  async closeTicket(ticketId, closedBy, reason = null) {
    try {
      return await this.updateTicket(ticketId, {
        status: TICKET_STATUS.CLOSED,
        closedAt: new Date().toISOString(),
        closedBy,
        closeReason: reason
      });
    } catch (error) {
      logger.error('tickets', 'closeTicket', error);
      throw error;
    }
  }

  /**
   * Lock ticket
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Object>}
   */
  async lockTicket(ticketId) {
    try {
      return await this.updateTicket(ticketId, {
        status: TICKET_STATUS.LOCKED
      });
    } catch (error) {
      logger.error('tickets', 'lockTicket', error);
      throw error;
    }
  }

  /**
   * Archive ticket
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Object>}
   */
  async archiveTicket(ticketId) {
    try {
      return await this.updateTicket(ticketId, {
        status: TICKET_STATUS.ARCHIVED
      });
    } catch (error) {
      logger.error('tickets', 'archiveTicket', error);
      throw error;
    }
  }

  /**
   * Reopen ticket
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Object>}
   */
  async reopenTicket(ticketId) {
    try {
      return await this.updateTicket(ticketId, {
        status: TICKET_STATUS.OPEN,
        closedAt: null,
        closedBy: null,
        closeReason: null,
        lastActivityAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('tickets', 'reopenTicket', error);
      throw error;
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
      const filePath = this.getTicketPath(ticketId);

      const updatedTicket = await db.modify(filePath, (ticket) => {
        if (!ticket) {
          throw new Error('Ticket not found');
        }

        if (!ticket.participants.includes(userId)) {
          ticket.participants.push(userId);
        }

        ticket.lastActivityAt = new Date().toISOString();
        ticket.updatedAt = new Date().toISOString();

        return ticket;
      });

      return updatedTicket;
    } catch (error) {
      logger.error('tickets', 'addParticipant', error);
      throw error;
    }
  }

  /**
   * Remove participant from ticket
   * @param {string} ticketId - Ticket ID
   * @param {string} userId - User ID to remove
   * @returns {Promise<Object>}
   */
  async removeParticipant(ticketId, userId) {
    try {
      const filePath = this.getTicketPath(ticketId);

      const updatedTicket = await db.modify(filePath, (ticket) => {
        if (!ticket) {
          throw new Error('Ticket not found');
        }

        ticket.participants = ticket.participants.filter(id => id !== userId);
        ticket.updatedAt = new Date().toISOString();

        return ticket;
      });

      return updatedTicket;
    } catch (error) {
      logger.error('tickets', 'removeParticipant', error);
      throw error;
    }
  }

  /**
   * Assign ticket to user
   * @param {string} ticketId - Ticket ID
   * @param {string} userId - User ID to assign
   * @returns {Promise<Object>}
   */
  async assignTicket(ticketId, userId) {
    try {
      const filePath = this.getTicketPath(ticketId);

      const updatedTicket = await db.modify(filePath, (ticket) => {
        if (!ticket) {
          throw new Error('Ticket not found');
        }

        if (!ticket.assignedTo.includes(userId)) {
          ticket.assignedTo.push(userId);
        }

        ticket.updatedAt = new Date().toISOString();

        return ticket;
      });

      return updatedTicket;
    } catch (error) {
      logger.error('tickets', 'assignTicket', error);
      throw error;
    }
  }

  /**
   * Unassign ticket from user
   * @param {string} ticketId - Ticket ID
   * @param {string} userId - User ID to unassign
   * @returns {Promise<Object>}
   */
  async unassignTicket(ticketId, userId) {
    try {
      const filePath = this.getTicketPath(ticketId);

      const updatedTicket = await db.modify(filePath, (ticket) => {
        if (!ticket) {
          throw new Error('Ticket not found');
        }

        ticket.assignedTo = ticket.assignedTo.filter(id => id !== userId);
        ticket.updatedAt = new Date().toISOString();

        return ticket;
      });

      return updatedTicket;
    } catch (error) {
      logger.error('tickets', 'unassignTicket', error);
      throw error;
    }
  }

  /**
   * Update ticket activity
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Object>}
   */
  async updateActivity(ticketId) {
    try {
      const filePath = this.getTicketPath(ticketId);

      const updatedTicket = await db.modify(filePath, (ticket) => {
        if (!ticket) {
          throw new Error('Ticket not found');
        }

        ticket.lastActivityAt = new Date().toISOString();
        ticket.messageCount++;
        ticket.metadata.inactivityWarned = false;
        ticket.updatedAt = new Date().toISOString();

        return ticket;
      });

      return updatedTicket;
    } catch (error) {
      logger.error('tickets', 'updateActivity', error);
      throw error;
    }
  }

  /**
   * Set transcript URL
   * @param {string} ticketId - Ticket ID
   * @param {string} transcriptUrl - Transcript URL
   * @returns {Promise<Object>}
   */
  async setTranscript(ticketId, transcriptUrl) {
    try {
      const filePath = this.getTicketPath(ticketId);

      const updatedTicket = await db.modify(filePath, (ticket) => {
        if (!ticket) {
          throw new Error('Ticket not found');
        }

        ticket.metadata.transcriptUrl = transcriptUrl;
        ticket.updatedAt = new Date().toISOString();

        return ticket;
      });

      return updatedTicket;
    } catch (error) {
      logger.error('tickets', 'setTranscript', error);
      throw error;
    }
  }

  /**
   * Mark ticket as warned for inactivity
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Object>}
   */
  async markInactivityWarned(ticketId) {
    try {
      const filePath = this.getTicketPath(ticketId);

      const updatedTicket = await db.modify(filePath, (ticket) => {
        if (!ticket) {
          throw new Error('Ticket not found');
        }

        ticket.metadata.inactivityWarned = true;
        ticket.updatedAt = new Date().toISOString();

        return ticket;
      });

      return updatedTicket;
    } catch (error) {
      logger.error('tickets', 'markInactivityWarned', error);
      throw error;
    }
  }

  /**
   * Delete ticket
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<void>}
   */
  async deleteTicket(ticketId) {
    try {
      const filePath = this.getTicketPath(ticketId);
      await db.delete(filePath);
      logger.write('tickets', 'deleteTicket', 1, true, 0);
    } catch (error) {
      logger.error('tickets', 'deleteTicket', error);
      throw error;
    }
  }

  /**
   * Get all tickets for a server
   * @param {string} serverId - Discord server ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>}
   */
  async getServerTickets(serverId, filters = {}) {
    try {
      const files = await db.listFiles(PATHS.TICKETS, '.json');
      const tickets = [];

      for (const file of files) {
        const filePath = path.join(PATHS.TICKETS, file);
        const ticket = await db.read(filePath);

        if (ticket && ticket.serverId === serverId) {
          // Apply filters
          if (this.matchesFilters(ticket, filters)) {
            tickets.push(ticket);
          }
        }
      }

      // Sort by creation date (newest first)
      tickets.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );

      return tickets;
    } catch (error) {
      logger.error('tickets', 'getServerTickets', error);
      return [];
    }
  }

  /**
   * Get tickets by user
   * @param {string} serverId - Discord server ID
   * @param {string} userId - User ID
   * @returns {Promise<Array>}
   */
  async getUserTickets(serverId, userId) {
    try {
      return await this.getServerTickets(serverId, { userId });
    } catch (error) {
      logger.error('tickets', 'getUserTickets', error);
      return [];
    }
  }

  /**
   * Get tickets by status
   * @param {string} serverId - Discord server ID
   * @param {string} status - Ticket status
   * @returns {Promise<Array>}
   */
  async getTicketsByStatus(serverId, status) {
    try {
      return await this.getServerTickets(serverId, { status });
    } catch (error) {
      logger.error('tickets', 'getTicketsByStatus', error);
      return [];
    }
  }

  /**
   * Get open tickets for user
   * @param {string} serverId - Discord server ID
   * @param {string} userId - User ID
   * @returns {Promise<Array>}
   */
  async getUserOpenTickets(serverId, userId) {
    try {
      return await this.getServerTickets(serverId, { 
        userId, 
        status: TICKET_STATUS.OPEN 
      });
    } catch (error) {
      logger.error('tickets', 'getUserOpenTickets', error);
      return [];
    }
  }

  /**
   * Count user's open tickets
   * @param {string} serverId - Discord server ID
   * @param {string} userId - User ID
   * @returns {Promise<number>}
   */
  async countUserOpenTickets(serverId, userId) {
    try {
      const tickets = await this.getUserOpenTickets(serverId, userId);
      return tickets.length;
    } catch (error) {
      logger.error('tickets', 'countUserOpenTickets', error);
      return 0;
    }
  }

  /**
   * Get assigned tickets for user
   * @param {string} serverId - Discord server ID
   * @param {string} userId - User ID
   * @returns {Promise<Array>}
   */
  async getAssignedTickets(serverId, userId) {
    try {
      const allTickets = await this.getServerTickets(serverId);
      
      return allTickets.filter(ticket => 
        ticket.assignedTo.includes(userId) && 
        ticket.status === TICKET_STATUS.OPEN
      );
    } catch (error) {
      logger.error('tickets', 'getAssignedTickets', error);
      return [];
    }
  }

  /**
   * Get inactive tickets
   * @param {string} serverId - Discord server ID
   * @param {number} inactiveHours - Hours of inactivity
   * @returns {Promise<Array>}
   */
  async getInactiveTickets(serverId, inactiveHours = 24) {
    try {
      const tickets = await this.getTicketsByStatus(serverId, TICKET_STATUS.OPEN);
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - inactiveHours);

      return tickets.filter(ticket => {
        const lastActivity = new Date(ticket.lastActivityAt);
        return lastActivity < cutoffTime;
      });
    } catch (error) {
      logger.error('tickets', 'getInactiveTickets', error);
      return [];
    }
  }

  /**
   * Auto-close inactive tickets
   * @param {string} serverId - Discord server ID
   * @param {number} inactiveHours - Hours of inactivity before auto-close
   * @param {string} closedBy - User ID (usually bot ID)
   * @returns {Promise<number>} Number of closed tickets
   */
  async autoCloseInactive(serverId, inactiveHours, closedBy) {
    try {
      const inactiveTickets = await this.getInactiveTickets(serverId, inactiveHours);
      let closed = 0;

      for (const ticket of inactiveTickets) {
        try {
          await this.closeTicket(ticket.id, closedBy, 'Auto-closed due to inactivity');
          closed++;
        } catch (error) {
          logger.error('tickets', 'autoCloseInactive:single', error);
        }
      }

      return closed;
    } catch (error) {
      logger.error('tickets', 'autoCloseInactive', error);
      return 0;
    }
  }

  /**
   * Get ticket statistics for server
   * @param {string} serverId - Discord server ID
   * @returns {Promise<Object>}
   */
  async getStatistics(serverId) {
    try {
      const tickets = await this.getServerTickets(serverId);

      const stats = {
        total: tickets.length,
        open: tickets.filter(t => t.status === TICKET_STATUS.OPEN).length,
        closed: tickets.filter(t => t.status === TICKET_STATUS.CLOSED).length,
        locked: tickets.filter(t => t.status === TICKET_STATUS.LOCKED).length,
        archived: tickets.filter(t => t.status === TICKET_STATUS.ARCHIVED).length,
        byPriority: {
          low: tickets.filter(t => t.priority === TICKET_PRIORITY.LOW).length,
          medium: tickets.filter(t => t.priority === TICKET_PRIORITY.MEDIUM).length,
          high: tickets.filter(t => t.priority === TICKET_PRIORITY.HIGH).length,
          urgent: tickets.filter(t => t.priority === TICKET_PRIORITY.URGENT).length
        },
        byCategory: {},
        averageMessagesPerTicket: 0,
        averageResolutionTime: 0
      };

      // Count by category
      tickets.forEach(ticket => {
        if (ticket.category) {
          if (!stats.byCategory[ticket.category]) {
            stats.byCategory[ticket.category] = 0;
          }
          stats.byCategory[ticket.category]++;
        }
      });

      // Calculate averages
      if (tickets.length > 0) {
        const totalMessages = tickets.reduce((sum, t) => sum + t.messageCount, 0);
        stats.averageMessagesPerTicket = Math.round(totalMessages / tickets.length);

        const closedTickets = tickets.filter(t => t.closedAt);
        if (closedTickets.length > 0) {
          const totalResolutionTime = closedTickets.reduce((sum, t) => {
            const created = new Date(t.createdAt);
            const closed = new Date(t.closedAt);
            return sum + (closed - created);
          }, 0);
          
          // Convert to hours
          stats.averageResolutionTime = Math.round(
            totalResolutionTime / closedTickets.length / 1000 / 60 / 60
          );
        }
      }

      return stats;
    } catch (error) {
      logger.error('tickets', 'getStatistics', error);
      return null;
    }
  }

  /**
   * Search tickets
   * @param {string} serverId - Discord server ID
   * @param {string} query - Search query
   * @returns {Promise<Array>}
   */
  async searchTickets(serverId, query) {
    try {
      const tickets = await this.getServerTickets(serverId);
      const lowerQuery = query.toLowerCase();

      return tickets.filter(ticket => {
        // Search in subject
        if (ticket.subject.toLowerCase().includes(lowerQuery)) return true;

        // Search in description
        if (ticket.description.toLowerCase().includes(lowerQuery)) return true;

        // Search in category
        if (ticket.category && ticket.category.toLowerCase().includes(lowerQuery)) {
          return true;
        }

        // Search in user ID
        if (ticket.userId.includes(query)) return true;

        return false;
      });
    } catch (error) {
      logger.error('tickets', 'searchTickets', error);
      return [];
    }
  }

  /**
   * Bulk close tickets
   * @param {Array<string>} ticketIds - Ticket IDs
   * @param {string} closedBy - User ID who is closing
   * @param {string} reason - Close reason
   * @returns {Promise<number>} Number of closed tickets
   */
  async bulkClose(ticketIds, closedBy, reason) {
    try {
      let closed = 0;

      for (const id of ticketIds) {
        try {
          await this.closeTicket(id, closedBy, reason);
          closed++;
        } catch (error) {
          logger.error('tickets', 'bulkClose:single', error);
        }
      }

      return closed;
    } catch (error) {
      logger.error('tickets', 'bulkClose', error);
      return 0;
    }
  }

  /**
   * Bulk delete tickets
   * @param {Array<string>} ticketIds - Ticket IDs
   * @returns {Promise<number>} Number of deleted tickets
   */
  async bulkDelete(ticketIds) {
    try {
      let deleted = 0;

      for (const id of ticketIds) {
        try {
          await this.deleteTicket(id);
          deleted++;
        } catch (error) {
          logger.error('tickets', 'bulkDelete:single', error);
        }
      }

      return deleted;
    } catch (error) {
      logger.error('tickets', 'bulkDelete', error);
      return 0;
    }
  }

  /**
   * Clean old tickets
   * @param {string} serverId - Discord server ID
   * @param {number} daysOld - Delete tickets older than this many days
   * @param {Array<string>} statuses - Only delete tickets with these statuses
   * @returns {Promise<number>} Number of deleted tickets
   */
  async cleanOldTickets(serverId, daysOld = 90, statuses = [TICKET_STATUS.CLOSED, TICKET_STATUS.ARCHIVED]) {
    try {
      const tickets = await this.getServerTickets(serverId);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const toDelete = tickets.filter(ticket => {
        const ticketDate = new Date(ticket.createdAt);
        return ticketDate < cutoffDate && statuses.includes(ticket.status);
      });

      const ids = toDelete.map(ticket => ticket.id);
      return await this.bulkDelete(ids);
    } catch (error) {
      logger.error('tickets', 'cleanOldTickets', error);
      return 0;
    }
  }

  /**
   * Check if ticket matches filters
   * @param {Object} ticket - Ticket object
   * @param {Object} filters - Filter criteria
   * @returns {boolean}
   */
  matchesFilters(ticket, filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (ticket[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Export tickets to JSON
   * @param {string} serverId - Discord server ID
   * @param {Object} filters - Filter options
   * @returns {Promise<string>} JSON string
   */
  async exportTickets(serverId, filters = {}) {
    try {
      const tickets = await this.getServerTickets(serverId, filters);
      return JSON.stringify(tickets, null, 2);
    } catch (error) {
      logger.error('tickets', 'exportTickets', error);
      return null;
    }
  }
}

// Export singleton instance
module.exports = new TicketDatabase();