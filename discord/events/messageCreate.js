// ==========================================
// FILE: discord/events/messageCreate.js
// ==========================================
const ticketsDb = require('../../core/database/tickets');
const { discord: logger } = require('../../shared/utils/logger');

module.exports = {
  name: 'messageCreate',
  
  async execute(message, client) {
    try {
      // Ignore bot messages
      if (message.author.bot) return;

      // Check if message is in a ticket channel
      const ticket = await ticketsDb.getTicketByChannel(message.channel.id);

      if (ticket) {
        // Update ticket activity
        await ticketsDb.updateActivity(ticket.id);

        logger.debug('Ticket activity updated', {
          ticketId: ticket.id,
          userId: message.author.id
        });
      }

      // Add any other message handling logic here
      // For example: auto-responses, keyword detection, etc.

    } catch (error) {
      logger.error('Error in messageCreate', {
        messageId: message.id,
        channelId: message.channel.id,
        error: error.message
      });
    }
  }
};