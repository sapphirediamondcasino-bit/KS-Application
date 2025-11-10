/**
 * KS Bot - Permission Handler
 * 
 * Handles permission checks for commands and features.
 */

const { PermissionFlagsBits } = require('discord.js');
const serverDb = require('../../core/database/servers');
const { discord: logger } = require('../../shared/utils/logger');

class PermissionHandler {
  /**
   * Check if user is server owner
   * @param {GuildMember} member - Guild member
   * @returns {boolean}
   */
  isServerOwner(member) {
    return member.guild.ownerId === member.id;
  }

  /**
   * Check if user is bot owner
   * @param {string} userId - User ID
   * @returns {boolean}
   */
  isBotOwner(userId) {
    return userId === process.env.BOT_OWNER_ID;
  }

  /**
   * Check if user has administrator permission
   * @param {GuildMember} member - Guild member
   * @returns {boolean}
   */
  isAdministrator(member) {
    return member.permissions.has(PermissionFlagsBits.Administrator);
  }

  /**
   * Check if user can manage applications
   * @param {GuildMember} member - Guild member
   * @returns {Promise<boolean>}
   */
  async canManageApplications(member) {
    try {
      // Owner and admins always have permission
      if (this.isServerOwner(member) || this.isAdministrator(member)) {
        return true;
      }

      const serverConfig = await serverDb.getServer(member.guild.id);
      
      if (!serverConfig) {
        return false;
      }

      // Check if user has reviewer role
      return member.roles.cache.some(role => 
        serverConfig.applications.reviewerRoleIds.includes(role.id)
      );
    } catch (error) {
      logger.error('Failed to check application permissions', { 
        userId: member.id, 
        guildId: member.guild.id, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Check if user can review applications
   * @param {GuildMember} member - Guild member
   * @returns {Promise<boolean>}
   */
  async canReviewApplications(member) {
    return await this.canManageApplications(member);
  }

  /**
   * Check if user can manage tickets
   * @param {GuildMember} member - Guild member
   * @returns {Promise<boolean>}
   */
  async canManageTickets(member) {
    try {
      // Owner and admins always have permission
      if (this.isServerOwner(member) || this.isAdministrator(member)) {
        return true;
      }

      const serverConfig = await serverDb.getServer(member.guild.id);
      
      if (!serverConfig) {
        return false;
      }

      // Check if user has support role
      return member.roles.cache.some(role => 
        serverConfig.tickets.supportRoleIds.includes(role.id)
      );
    } catch (error) {
      logger.error('Failed to check ticket permissions', { 
        userId: member.id, 
        guildId: member.guild.id, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Check if user can manage Roblox integration
   * @param {GuildMember} member - Guild member
   * @returns {boolean}
   */
  canManageRoblox(member) {
    return this.isServerOwner(member) || this.isAdministrator(member);
  }

  /**
   * Check if user can access ticket
   * @param {GuildMember} member - Guild member
   * @param {Object} ticket - Ticket data
   * @returns {Promise<boolean>}
   */
  async canAccessTicket(member, ticket) {
    try {
      // Ticket creator can always access
      if (ticket.userId === member.id) {
        return true;
      }

      // Check if user is in participants
      if (ticket.participants.includes(member.id)) {
        return true;
      }

      // Check if user can manage tickets
      return await this.canManageTickets(member);
    } catch (error) {
      logger.error('Failed to check ticket access', { 
        userId: member.id, 
        ticketId: ticket.id, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Check if user has specific Discord permission
   * @param {GuildMember} member - Guild member
   * @param {bigint} permission - Permission flag
   * @returns {boolean}
   */
  hasPermission(member, permission) {
    return member.permissions.has(permission);
  }

  /**
   * Check if user has any of the specified permissions
   * @param {GuildMember} member - Guild member
   * @param {Array<bigint>} permissions - Permission flags
   * @returns {boolean}
   */
  hasAnyPermission(member, permissions) {
    return permissions.some(permission => member.permissions.has(permission));
  }

  /**
   * Check if user has all of the specified permissions
   * @param {GuildMember} member - Guild member
   * @param {Array<bigint>} permissions - Permission flags
   * @returns {boolean}
   */
  hasAllPermissions(member, permissions) {
    return permissions.every(permission => member.permissions.has(permission));
  }

  /**
   * Get user permission level
   * @param {GuildMember} member - Guild member
   * @returns {Promise<string>}
   */
  async getPermissionLevel(member) {
    if (this.isBotOwner(member.id)) {
      return 'bot_owner';
    }

    if (this.isServerOwner(member)) {
      return 'server_owner';
    }

    if (this.isAdministrator(member)) {
      return 'administrator';
    }

    if (await this.canManageApplications(member) || await this.canManageTickets(member)) {
      return 'staff';
    }

    return 'user';
  }

  /**
   * Check if bot has required permissions in channel
   * @param {Channel} channel - Discord channel
   * @param {Array<bigint>} permissions - Required permissions
   * @returns {Object} { hasPermission, missing }
   */
  botHasChannelPermissions(channel, permissions) {
    const botMember = channel.guild.members.me;
    const channelPermissions = channel.permissionsFor(botMember);

    const missing = permissions.filter(permission => 
      !channelPermissions.has(permission)
    );

    return {
      hasPermission: missing.length === 0,
      missing
    };
  }

  /**
   * Check if bot has required permissions in guild
   * @param {Guild} guild - Discord guild
   * @param {Array<bigint>} permissions - Required permissions
   * @returns {Object} { hasPermission, missing }
   */
  botHasGuildPermissions(guild, permissions) {
    const botMember = guild.members.me;

    const missing = permissions.filter(permission => 
      !botMember.permissions.has(permission)
    );

    return {
      hasPermission: missing.length === 0,
      missing
    };
  }

  /**
   * Format missing permissions for display
   * @param {Array<bigint>} permissions - Permission flags
   * @returns {string}
   */
  formatPermissions(permissions) {
    return permissions.map(permission => {
      // Convert permission to readable name
      const name = Object.keys(PermissionFlagsBits).find(
        key => PermissionFlagsBits[key] === permission
      );
      
      // Convert from SCREAMING_SNAKE_CASE to Title Case
      return name ? name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown';
    }).join(', ');
  }

  /**
   * Create permission error embed
   * @param {string} action - Action being performed
   * @param {string} level - Required permission level
   * @returns {Object}
   */
  createPermissionError(action, level = 'administrator') {
    return {
      embeds: [{
        color: 0xff0000,
        title: '❌ Permission Denied',
        description: `You don't have permission to ${action}.`,
        fields: [{
          name: 'Required Permission',
          value: level.charAt(0).toUpperCase() + level.slice(1),
          inline: true
        }],
        footer: { text: 'Contact a server administrator for help' },
        timestamp: new Date().toISOString()
      }],
      ephemeral: true
    };
  }

  /**
   * Check command permissions
   * @param {Interaction} interaction - Command interaction
   * @param {string} requiredLevel - Required permission level
   * @returns {Promise<boolean>}
   */
  async checkCommandPermission(interaction, requiredLevel = 'user') {
    const member = interaction.member;

    if (!member) {
      return false;
    }

    const userLevel = await this.getPermissionLevel(member);

    const levels = {
      'user': 1,
      'staff': 5,
      'administrator': 8,
      'server_owner': 9,
      'bot_owner': 10
    };

    const userLevelValue = levels[userLevel] || 0;
    const requiredLevelValue = levels[requiredLevel] || 0;

    return userLevelValue >= requiredLevelValue;
  }

  /**
   * Middleware to check permissions before command execution
   * @param {string} requiredLevel - Required permission level
   * @returns {Function}
   */
  requirePermission(requiredLevel) {
    return async (interaction) => {
      const hasPermission = await this.checkCommandPermission(interaction, requiredLevel);

      if (!hasPermission) {
        await interaction.reply(this.createPermissionError(
          'use this command',
          requiredLevel
        ));
        return false;
      }

      return true;
    };
  }
}

module.exports = new PermissionHandler();