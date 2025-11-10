// ==========================================
// FILE: discord/commands/ticket/add.js
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
        .setName('add')
        .setDescription('Add a user to the ticket')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User to add')
            .setRequired(true)
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

    const canManage = await permissionHandler.canManageTickets(interaction.member);

    if (!canManage) {
      return await interaction.reply({
        content: 'You do not have permission to add users to tickets.',
        ephemeral: true
      });
    }

    const user = interaction.options.getUser('user');

    await ticketHandler.addUserToTicket(interaction, ticket.id, user);
  }
};