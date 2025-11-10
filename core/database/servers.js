/**
 * KS Bot - Server Database
 * 
 * Manages server configurations, settings, and permissions.
 */

const path = require('path');
const db = require('../../data/db_handler');
const { PATHS, TIERS } = require('../../shared/constants');
const { database: logger } = require('../../shared/utils/logger');

class ServerDatabase {
  getServerPath(serverId) {
    return path.join(PATHS.SERVERS, `${serverId}.json`);
  }

  async getServer(serverId) {
    try {
      const filePath = this.getServerPath(serverId);
      return await db.read(filePath);
    } catch (error) {
      logger.error('servers', 'getServer', error);
      return null;
    }
  }

  async createServer(serverId, serverData = {}) {
    try {
      const filePath = this.getServerPath(serverId);
      if (await this.exists(serverId)) throw new Error('Server already exists');

      const server = {
        serverId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tier: TIERS.FREE,
        subscriptionExpires: null,
        applications: {
          enabled: false,
          submissionChannelId: null,
          reviewChannelId: null,
          logChannelId: null,
          reviewerRoleIds: [],
          templates: [],
          dmApplicants: true
        },
        tickets: {
          enabled: false,
          createChannelId: null,
          categoryId: null,
          transcriptChannelId: null,
          supportRoleIds: [],
          maxOpenTickets: 3,
          autoCloseHours: 48,
          inactivityWarningHours: 24
        },
        roblox: {
          enabled: false,
          setupCompleted: false,
          submissionChannelId: null,
          syncLogChannelId: null,
          notificationChannelId: null
        },
        settings: {
          prefix: '/',
          language: 'en',
          timezone: 'UTC',
          embedColor: '#0099ff'
        },
        analytics: {
          totalApplications: 0,
          totalTickets: 0,
          totalRobloxSubmissions: 0
        },
        ...serverData
      };

      await db.write(filePath, server);
      logger.write('servers', 'createServer', 1, true, 0);
      return server;
    } catch (error) {
      logger.error('servers', 'createServer', error);
      throw error;
    }
  }

  async updateServer(serverId, updates) {
    try {
      const filePath = this.getServerPath(serverId);
      return await db.modify(filePath, server => {
        if (!server) throw new Error('Server not found');
        const merged = this.deepMerge(server, updates);
        merged.updatedAt = new Date().toISOString();
        return merged;
      });
    } catch (error) {
      logger.error('servers', 'updateServer', error);
      throw error;
    }
  }

  async deleteServer(serverId) {
    try {
      const filePath = this.getServerPath(serverId);
      await db.delete(filePath);
      logger.write('servers', 'deleteServer', 1, true, 0);
    } catch (error) {
      logger.error('servers', 'deleteServer', error);
      throw error;
    }
  }

  async exists(serverId) {
    return db.exists(this.getServerPath(serverId));
  }

  async getOrCreate(serverId) {
    let server = await this.getServer(serverId);
    if (!server) server = await this.createServer(serverId);
    return server;
  }

  deepMerge(target, source) {
    const output = { ...target };
    if (this.isObject(target) && this.isObject(source)) {
      for (const key of Object.keys(source)) {
        if (this.isObject(source[key])) {
          if (!(key in target)) output[key] = source[key];
          else output[key] = this.deepMerge(target[key], source[key]);
        } else output[key] = source[key];
      }
    }
    return output;
  }

  isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }
  async updateTicketSettings(serverId, ticketSettings) {
    try {
      return await this.updateServer(serverId, {
        tickets: ticketSettings
      });
    } catch (error) {
      logger.error('servers', 'updateTicketSettings', error);
      throw error;
    }
  }

  async updateApplicationSettings(serverId, applicationSettings) {
    try {
      return await this.updateServer(serverId, {
        applications: applicationSettings
      });
    } catch (error) {
      logger.error('servers', 'updateApplicationSettings', error);
      throw error;
    }
  }

  async updateRobloxSettings(serverId, robloxSettings) {
    try {
      return await this.updateServer(serverId, {
        roblox: robloxSettings
      });
    } catch (error) {
      logger.error('servers', 'updateRobloxSettings', error);
      throw error;
    }
  }

  async incrementAnalytics(serverId, field) {
    try {
      const server = await this.getServer(serverId);
      if (!server) return;
      
      server.analytics[field]++;
      return await this.updateServer(serverId, server);
    } catch (error) {
      logger.error('servers', 'incrementAnalytics', error);
      throw error;
    }
  }

  async getTemplates(serverId) {
    try {
      const server = await this.getServer(serverId);
      return server?.applications?.templates || [];
    } catch (error) {
      logger.error('servers', 'getTemplates', error);
      return [];
    }
  }

  async getTemplate(serverId, templateId) {
    try {
      const templates = await this.getTemplates(serverId);
      return templates.find(t => t.id === templateId);
    } catch (error) {
      logger.error('servers', 'getTemplate', error);
      return null;
    }
  }

  async addTemplate(serverId, template) {
    try {
      const server = await this.getServer(serverId);
      if (!server.applications.templates) {
        server.applications.templates = [];
      }
      server.applications.templates.push(template);
      return await this.updateServer(serverId, server);
    } catch (error) {
      logger.error('servers', 'addTemplate', error);
      throw error;
    }
  }

  async listServers() {
    try {
      const files = await db.listFiles(PATHS.SERVERS, '.json');
      return files.map(f => f.replace('.json', ''));
    } catch (error) {
      logger.error('servers', 'listServers', error);
      return [];
    }
  }
}


module.exports = new ServerDatabase();
