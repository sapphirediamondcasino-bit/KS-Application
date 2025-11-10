/**
 * Tickets Database Module
 * Manages support ticket system
 */

const db = require('../db_handler');

class TicketsDatabase {
  /**
   * Create a new ticket
   */
  async createTicket(guildId, userId, channelId, subject = null, category = null) {
    // Get next ticket number for this guild
    const ticketNumber = await this.getNextTicketNumber(guildId);
    
    const sql = `INSERT INTO tickets 
                 (guild_id, user_id, channel_id, ticket_number, subject, category, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    const result = await db.run(sql, [
      guildId,
      userId,
      channelId,
      ticketNumber,
      subject,
      category,
      'open'
    ]);
    
    return { ticketId: result.lastID, ticketNumber };
  }

  /**
   * Get next ticket number for a guild
   */
  async getNextTicketNumber(guildId) {
    const sql = `SELECT MAX(ticket_number) as max_num FROM tickets WHERE guild_id = ?`;
    const result = await db.get(sql, [guildId]);
    return (result.max_num || 0) + 1;
  }

  /**
   * Get ticket by ID
   */
  async getTicket(ticketId) {
    const sql = 'SELECT * FROM tickets WHERE id = ?';
    return await db.get(sql, [ticketId]);
  }

  /**
   * Get ticket by channel ID
   */
  async getTicketByChannel(channelId) {
    const sql = 'SELECT * FROM tickets WHERE channel_id = ?';
    return await db.get(sql, [channelId]);
  }

  /**
   * Get ticket by ticket number in a guild
   */
  async getTicketByNumber(guildId, ticketNumber) {
    const sql = 'SELECT * FROM tickets WHERE guild_id = ? AND ticket_number = ?';
    return await db.get(sql, [guildId, ticketNumber]);
  }

  /**
   * Get all tickets for a user in a guild
   */
  async getUserTickets(guildId, userId, status = null) {
    let sql = 'SELECT * FROM tickets WHERE guild_id = ? AND user_id = ?';
    const params = [guildId, userId];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY created_at DESC';
    return await db.all(sql, params);
  }

  /**
   * Get all open tickets for a guild
   */
  async getOpenTickets(guildId) {
    const sql = `SELECT * FROM tickets 
                 WHERE guild_id = ? AND status = 'open'
                 ORDER BY created_at ASC`;
    return await db.all(sql, [guildId]);
  }

  /**
   * Get all tickets for a guild (with optional status filter)
   */
  async getTicketsByGuild(guildId, status = null) {
    let sql = 'SELECT * FROM tickets WHERE guild_id = ?';
    const params = [guildId];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY created_at DESC';
    return await db.all(sql, params);
  }

  /**
   * Claim a ticket
   */
  async claimTicket(ticketId, staffId) {
    const sql = `UPDATE tickets 
                 SET claimed_by = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`;
    return await db.run(sql, [staffId, ticketId]);
  }

  /**
   * Unclaim a ticket
   */
  async unclaimTicket(ticketId) {
    const sql = `UPDATE tickets 
                 SET claimed_by = NULL, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`;
    return await db.run(sql, [ticketId]);
  }

  /**
   * Close a ticket
   */
  async closeTicket(ticketId, closedBy, reason = null) {
    const sql = `UPDATE tickets 
                 SET status = 'closed', closed_by = ?, close_reason = ?,
                     closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`;
    return await db.run(sql, [closedBy, reason, ticketId]);
  }

  /**
   * Reopen a ticket
   */
  async reopenTicket(ticketId) {
    const sql = `UPDATE tickets 
                 SET status = 'open', closed_by = NULL, close_reason = NULL,
                     closed_at = NULL, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`;
    return await db.run(sql, [ticketId]);
  }

  /**
   * Add message to ticket (for transcript)
   */
  async addMessage(ticketId, userId, username, content) {
    const sql = `INSERT INTO ticket_messages 
                 (ticket_id, user_id, username, message_content)
                 VALUES (?, ?, ?, ?)`;
    return await db.run(sql, [ticketId, userId, username, content]);
  }

  /**
   * Get all messages for a ticket (transcript)
   */
  async getMessages(ticketId) {
    const sql = `SELECT * FROM ticket_messages 
                 WHERE ticket_id = ?
                 ORDER BY timestamp ASC`;
    return await db.all(sql, [ticketId]);
  }

  /**
   * Get ticket statistics for a guild
   */
  async getStats(guildId) {
    const sql = `SELECT 
                   COUNT(*) as total,
                   SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
                   SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
                 FROM tickets 
                 WHERE guild_id = ?`;
    
    return await db.get(sql, [guildId]);
  }

  /**
   * Delete ticket and its messages
   */
  async deleteTicket(ticketId) {
    // Delete messages first
    await db.run('DELETE FROM ticket_messages WHERE ticket_id = ?', [ticketId]);
    
    // Delete ticket
    const sql = 'DELETE FROM tickets WHERE id = ?';
    return await db.run(sql, [ticketId]);
  }

  /**
   * Check if user has open ticket
   */
  async hasOpenTicket(guildId, userId) {
    const sql = `SELECT COUNT(*) as count FROM tickets 
                 WHERE guild_id = ? AND user_id = ? AND status = 'open'`;
    const result = await db.get(sql, [guildId, userId]);
    return result.count > 0;
  }

  /**
   * Update ticket category
   */
  async updateCategory(ticketId, category) {
    const sql = `UPDATE tickets 
                 SET category = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`;
    return await db.run(sql, [category, ticketId]);
  }
}

// Export singleton instance
module.exports = new TicketsDatabase();