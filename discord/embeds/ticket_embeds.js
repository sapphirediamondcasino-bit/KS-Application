const { EmbedBuilder } = require('discord.js');
const { formatRelativeTime, capitalize } = require('../../shared/utils/formatter');
const { COLORS, EMOJIS } = require('../../shared/constants');

/**
 * Create ticket embed
 * @param {Object} ticket - Ticket data
 * @returns {EmbedBuilder}
 */
function createTicketEmbed(ticket) {
  const priorityColors = {
    low: COLORS.SUCCESS,
    medium: COLORS.INFO,
    high: COLORS.WARNING,
    urgent: COLORS.ERROR
  };

  const priorityEmojis = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    urgent: '🔴'
  };

  const embed = new EmbedBuilder()
    .setColor(priorityColors[ticket.priority] || COLORS.NEUTRAL)
    .setTitle(`${EMOJIS.TICKET} ${ticket.subject}`)
    .setDescription(ticket.description)
    .addFields(
      {
        name: 'Created By',
        value: `<@${ticket.userId}>`,
        inline: true
      },
      {
        name: 'Priority',
        value: `${priorityEmojis[ticket.priority]} ${capitalize(ticket.priority)}`,
        inline: true
      },
      {
        name: 'Status',
        value: capitalize(ticket.status),
        inline: true
      }
    );

  if (ticket.category) {
    embed.addFields({
      name: 'Category',
      value: ticket.category,
      inline: true
    });
  }

  if (ticket.assignedTo && ticket.assignedTo.length > 0) {
    embed.addFields({
      name: 'Assigned To',
      value: ticket.assignedTo.map(id => `<@${id}>`).join(', '),
      inline: false
    });
  }

  embed.setFooter({ text: `Ticket ID: ${ticket.id}` });
  embed.setTimestamp(new Date(ticket.createdAt));

  return embed;
}

/**
 * Create ticket closed embed
 * @param {Object} ticket - Ticket data
 * @param {string} closedBy - User ID who closed
 * @param {string} reason - Close reason
 * @returns {EmbedBuilder}
 */
function createTicketClosedEmbed(ticket, closedBy, reason) {
  return new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setTitle('🔒 Ticket Closed')
    .setDescription(reason || 'No reason provided')
    .addFields(
      {
        name: 'Closed By',
        value: `<@${closedBy}>`,
        inline: true
      },
      {
        name: 'Ticket',
        value: ticket.subject,
        inline: true
      }
    )
    .setTimestamp();
}

/**
 * Create ticket list embed
 * @param {Array} tickets - Array of tickets
 * @param {string} title - Embed title
 * @returns {EmbedBuilder}
 */
function createTicketListEmbed(tickets, title = 'Tickets') {
  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`${EMOJIS.TICKET} ${title}`)
    .setTimestamp();

  if (tickets.length === 0) {
    embed.setDescription('No tickets found.');
    return embed;
  }

  const priorityEmojis = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    urgent: '🔴'
  };

  const description = tickets.slice(0, 10).map(ticket => {
    return `${priorityEmojis[ticket.priority]} **${ticket.subject}**\n` +
           `   Created by: <@${ticket.userId}>\n` +
           `   Status: ${capitalize(ticket.status)}\n` +
           `   ID: \`${ticket.id}\``;
  }).join('\n\n');

  embed.setDescription(description);

  if (tickets.length > 10) {
    embed.setFooter({ text: `Showing 10 of ${tickets.length} tickets` });
  }

  return embed;
}

module.exports = {
  createTicketEmbed,
  createTicketClosedEmbed,
  createTicketListEmbed
};