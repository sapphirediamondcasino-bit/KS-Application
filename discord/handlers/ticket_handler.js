/**
 * KS Bot - Ticket Handler
 * 
 * Handles ticket creation, management, and transcripts.
 */

const { 
    ChannelType, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    EmbedBuilder 
  } = require('discord.js');
  const serverDb = require('../../core/database/servers');
  const ticketsDb = require('../../core/database/tickets');
  const { createTicketEmbed } = require('../embeds/ticket_embeds');
  const { discord: logger } = require('../../shared/utils/logger');
  
  class TicketHandler {
    /**
     * Create a new ticket
     * @param {Interaction} interaction - Button/command interaction
     * @param {string} subject - Ticket subject
     * @param {string} description - Ticket description
     * @param {string} priority - Ticket priority
     */
    async createTicket(interaction, subject, description, priority = 'medium') {
      try {
        await interaction.deferReply({ ephemeral: true });
  
        const serverId = interaction.guild.id;
        const userId = interaction.user.id;
  
        const serverConfig = await serverDb.getServer(serverId);
  
        if (!serverConfig || !serverConfig.tickets.enabled) {
          return await interaction.editReply({
            content: 'Tickets are not enabled on this server.'
          });
        }
  
        // Check if user has too many open tickets
        const openTickets = await ticketsDb.countUserOpenTickets(serverId, userId);
  
        if (openTickets >= serverConfig.tickets.maxOpenTickets) {
          return await interaction.editReply({
            content: `You have reached the maximum of ${serverConfig.tickets.maxOpenTickets} open tickets.`
          });
        }
  
        // Get or create tickets category
        let category = null;
        if (serverConfig.tickets.categoryId) {
          category = await interaction.guild.channels.fetch(serverConfig.tickets.categoryId).catch(() => null);
        }
  
        if (!category) {
          category = await interaction.guild.channels.create({
            name: 'Tickets',
            type: ChannelType.GuildCategory
          });
  
          await serverDb.updateTicketSettings(serverId, {
            ...serverConfig.tickets,
            categoryId: category.id
          });
        }
  
        // Create ticket channel
        const channelName = `ticket-${interaction.user.username}`;
        
        const ticketChannel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: category,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: userId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            },
            {
              id: interaction.client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageMessages
              ]
            },
            // Add support roles
            ...serverConfig.tickets.supportRoleIds.map(roleId => ({
              id: roleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            }))
          ]
        });
  
        // Create ticket in database
        const ticket = await ticketsDb.createTicket({
          serverId,
          userId,
          channelId: ticketChannel.id,
          subject,
          description,
          priority,
          userTag: interaction.user.tag
        });
  
        // Update analytics
        await serverDb.incrementAnalytics(serverId, 'totalTickets');
  
        // Create ticket embed
        const embed = createTicketEmbed(ticket);
  
        // Create control buttons
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`ticket_close_${ticket.id}`)
              .setLabel('Close Ticket')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🔒'),
            new ButtonBuilder()
              .setCustomId(`ticket_claim_${ticket.id}`)
              .setLabel('Claim')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('✋')
          );
  
        const message = await ticketChannel.send({
          content: `${interaction.user} | <@&${serverConfig.tickets.supportRoleIds[0] || interaction.guild.id}>`,
          embeds: [embed],
          components: [row]
        });
  
        // Update ticket with first message ID
        await ticketsDb.updateTicket(ticket.id, {
          firstMessageId: message.id
        });
  
        await interaction.editReply({
          content: `✅ Ticket created: ${ticketChannel}`
        });
  
        logger.ticket('create', ticket.id, userId, serverId);
  
      } catch (error) {
        logger.error('Failed to create ticket', { 
          guildId: interaction.guild?.id, 
          userId: interaction.user?.id, 
          error: error.message 
        });
  
        await interaction.editReply({
          content: 'Failed to create ticket. Please try again.'
        });
      }
    }
  
    /**
     * Close a ticket
     * @param {Interaction} interaction - Button interaction
     * @param {string} ticketId - Ticket ID
     * @param {string} reason - Close reason
     */
    async closeTicket(interaction, ticketId, reason = null) {
      try {
        await interaction.deferReply();
  
        const ticket = await ticketsDb.getTicket(ticketId);
  
        if (!ticket) {
          return await interaction.editReply({
            content: 'Ticket not found.'
          });
        }
  
        if (ticket.status === 'closed') {
          return await interaction.editReply({
            content: 'This ticket is already closed.'
          });
        }
  
        // Close ticket in database
        await ticketsDb.closeTicket(ticketId, interaction.user.id, reason);
  
        // Update channel permissions (make read-only)
        const channel = interaction.channel;
        
        await channel.permissionOverwrites.edit(ticket.userId, {
          SendMessages: false
        });
  
        // Update channel name
        await channel.setName(`closed-${channel.name.replace('ticket-', '')}`);
  
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('🔒 Ticket Closed')
          .setDescription(reason || 'No reason provided')
          .addFields(
            {
              name: 'Closed By',
              value: `<@${interaction.user.id}>`,
              inline: true
            },
            {
              name: 'Closed At',
              value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
              inline: true
            }
          )
          .setTimestamp();
  
        await interaction.editReply({ embeds: [embed], components: [] });
  
        // Generate and send transcript
        await this.generateTranscript(interaction.guild, ticket);
  
        // Schedule channel deletion (e.g., after 5 minutes)
        setTimeout(async () => {
          try {
            await channel.delete();
          } catch (error) {
            logger.error('Failed to delete ticket channel', { ticketId, error: error.message });
          }
        }, 5 * 60 * 1000);
  
        logger.ticket('close', ticketId, interaction.user.id, ticket.serverId);
  
      } catch (error) {
        logger.error('Failed to close ticket', { 
          ticketId, 
          error: error.message 
        });
  
        await interaction.editReply({
          content: 'Failed to close ticket.'
        });
      }
    }
  
    /**
     * Add user to ticket
     * @param {Interaction} interaction - Command interaction
     * @param {string} ticketId - Ticket ID
     * @param {User} user - User to add
     */
    async addUserToTicket(interaction, ticketId, user) {
      try {
        await interaction.deferReply({ ephemeral: true });
  
        const ticket = await ticketsDb.getTicket(ticketId);
  
        if (!ticket) {
          return await interaction.editReply({
            content: 'Ticket not found.'
          });
        }
  
        if (ticket.participants.includes(user.id)) {
          return await interaction.editReply({
            content: 'User is already in this ticket.'
          });
        }
  
        // Add to database
        await ticketsDb.addParticipant(ticketId, user.id);
  
        // Update channel permissions
        await interaction.channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });
  
        await interaction.editReply({
          content: `✅ Added ${user} to the ticket.`
        });
  
        // Notify in channel
        await interaction.channel.send({
          content: `${user} has been added to the ticket by ${interaction.user}.`
        });
  
        logger.info('User added to ticket', { ticketId, userId: user.id });
  
      } catch (error) {
        logger.error('Failed to add user to ticket', { 
          ticketId, 
          error: error.message 
        });
  
        await interaction.editReply({
          content: 'Failed to add user to ticket.'
        });
      }
    }
  
    /**
     * Generate ticket transcript
     * @param {Guild} guild - Discord guild
     * @param {Object} ticket - Ticket data
     */
    async generateTranscript(guild, ticket) {
      try {
        const serverConfig = await serverDb.getServer(ticket.serverId);
  
        if (!serverConfig.tickets.transcriptChannelId) {
          return;
        }
  
        const transcriptChannel = await guild.channels.fetch(
          serverConfig.tickets.transcriptChannelId
        ).catch(() => null);
  
        if (!transcriptChannel) {
          return;
        }
  
        const ticketChannel = await guild.channels.fetch(ticket.channelId).catch(() => null);
  
        if (!ticketChannel) {
          return;
        }
  
        // Fetch messages
        const messages = await ticketChannel.messages.fetch({ limit: 100 });
        const sortedMessages = Array.from(messages.values()).reverse();
  
        // Create transcript text
        let transcript = `Ticket Transcript - ${ticket.subject}\n`;
        transcript += `Created by: ${ticket.metadata.userTag}\n`;
        transcript += `Created at: ${new Date(ticket.createdAt).toLocaleString()}\n`;
        transcript += `Closed at: ${new Date(ticket.closedAt).toLocaleString()}\n`;
        transcript += `\n${'='.repeat(50)}\n\n`;
  
        for (const message of sortedMessages) {
          const timestamp = new Date(message.createdAt).toLocaleString();
          transcript += `[${timestamp}] ${message.author.tag}:\n${message.content}\n\n`;
        }
  
        // Create file
        const buffer = Buffer.from(transcript, 'utf-8');
  
        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle(`📄 Ticket Transcript - ${ticket.subject}`)
          .addFields(
            {
              name: 'Ticket ID',
              value: ticket.id,
              inline: true
            },
            {
              name: 'Created By',
              value: `<@${ticket.userId}>`,
              inline: true
            },
            {
              name: 'Messages',
              value: sortedMessages.length.toString(),
              inline: true
            }
          )
          .setTimestamp();
  
        await transcriptChannel.send({
          embeds: [embed],
          files: [{
            attachment: buffer,
            name: `ticket-${ticket.id}.txt`
          }]
        });
  
        logger.info('Transcript generated', { ticketId: ticket.id });
  
      } catch (error) {
        logger.error('Failed to generate transcript', { 
          ticketId: ticket.id, 
          error: error.message 
        });
      }
    }
  
    /**
     * Update ticket activity
     * @param {string} ticketId - Ticket ID
     */
    async updateActivity(ticketId) {
      try {
        await ticketsDb.updateActivity(ticketId);
      } catch (error) {
        logger.error('Failed to update ticket activity', { 
          ticketId, 
          error: error.message 
        });
      }
    }
  }
  
  module.exports = new TicketHandler();