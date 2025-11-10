// ==========================================
// FILE: discord/commands/ticket/close.js
// ==========================================
const { SlashCommandBuilder } = require('discord.js');
const ticketHandler = require('../../handlers/ticket_handler');
const ticketsDb = require('../../core/database/tickets');
const permissionHandler = require('../../handlers/permission_handler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system management')
    .addSubcommand(sub =>
      sub
        .setName('close')
        .setDescription('Close the current ticket')
        .addStringOption(opt =>
          opt.setName('reason')
            .setDescription('Reason for closing')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const ticket = await ticketsDb.getTicketByChannel(interaction.channel.id);

    if (!ticket) {
      return await interaction.reply({
        content: 'This is not a ticket channel.',
        ephemeral: true
      });
    }

    const canAccess = await permissionHandler.canAccessTicket(interaction.member, ticket);

    if (!canAccess) {
      return await interaction.reply({
        content: 'You do not have permission to close this ticket.',
        ephemeral: true
      });
    }

    const reason = interaction.options.getString('reason');

    await ticketHandler.closeTicket(interaction, ticket.id, reason);
  }
};