/**
 * Server Database Module
 * Manages server-specific settings and configurations
 */

const db = require('../db_handler');

class ServerDatabase {
  /**
   * Get server settings by guild ID
   */
  async getServer(guildId) {
    const sql = 'SELECT * FROM servers WHERE guild_id = ?';
    return await db.get(sql, [guildId]);
  }

  /**
   * Create or update server settings
   */
  async upsertServer(guildId, settings = {}) {
    const existing = await this.getServer(guildId);

    if (existing) {
      // Update existing server
      const updates = [];
      const params = [];

      for (const [key, value] of Object.entries(settings)) {
        if (key !== 'guild_id') {
          updates.push(`${key} = ?`);
          params.push(value);
        }
      }

      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(guildId);

        const sql = `UPDATE servers SET ${updates.join(', ')} WHERE guild_id = ?`;
        return await db.run(sql, params);
      }
    } else {
      // Insert new server
      const sql = `INSERT INTO servers (guild_id, application_channel_id, ticket_channel_id, 
                   log_channel_id, staff_role_id, admin_role_id, prefix, roblox_group_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      
      return await db.run(sql, [
        guildId,
        settings.application_channel_id || null,
        settings.ticket_channel_id || null,
        settings.log_channel_id || null,
        settings.staff_role_id || null,
        settings.admin_role_id || null,
        settings.prefix || '!',
        settings.roblox_group_id || null
      ]);
    }
  }

  /**
   * Set application channel
   */
  async setApplicationChannel(guildId, channelId) {
    return await this.upsertServer(guildId, { application_channel_id: channelId });
  }

  /**
   * Set ticket channel
   */
  async setTicketChannel(guildId, channelId) {
    return await this.upsertServer(guildId, { ticket_channel_id: channelId });
  }

  /**
   * Set log channel
   */
  async setLogChannel(guildId, channelId) {
    return await this.upsertServer(guildId, { log_channel_id: channelId });
  }

  /**
   * Set staff role
   */
  async setStaffRole(guildId, roleId) {
    return await this.upsertServer(guildId, { staff_role_id: roleId });
  }

  /**
   * Set admin role
   */
  async setAdminRole(guildId, roleId) {
    return await this.upsertServer(guildId, { admin_role_id: roleId });
  }

  /**
   * Set prefix
   */
  async setPrefix(guildId, prefix) {
    return await this.upsertServer(guildId, { prefix });
  }

  /**
   * Set Roblox group ID
   */
  async setRobloxGroup(guildId, groupId) {
    return await this.upsertServer(guildId, { roblox_group_id: groupId });
  }

  /**
   * Get all servers
   */
  async getAllServers() {
    const sql = 'SELECT * FROM servers';
    return await db.all(sql);
  }

  /**
   * Delete server settings
   */
  async deleteServer(guildId) {
    const sql = 'DELETE FROM servers WHERE guild_id = ?';
    return await db.run(sql, [guildId]);
  }

  /**
   * Check if user has staff permissions
   */
  async isStaff(guildId, member) {
    const server = await this.getServer(guildId);
    if (!server || !server.staff_role_id) return false;
    
    return member.roles.cache.has(server.staff_role_id) || 
           member.permissions.has('Administrator');
  }

  /**
   * Check if user has admin permissions
   */
  async isAdmin(guildId, member) {
    const server = await this.getServer(guildId);
    if (!server || !server.admin_role_id) return member.permissions.has('Administrator');
    
    return member.roles.cache.has(server.admin_role_id) || 
           member.permissions.has('Administrator');
  }
}

// Export singleton instance
module.exports = new ServerDatabase();