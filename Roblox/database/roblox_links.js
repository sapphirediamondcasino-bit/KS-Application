/**
 * KS Bot - Roblox Links Database
 * 
 * Manages Roblox group and game links, API keys, and integration settings.
 */

const db = require('../../data/db_handler');
const { PATHS, ROBLOX_LINK_STATUS } = require('../../shared/constants');
const { roblox: logger } = require('../../shared/utils/logger');
const crypto = require('crypto');

class RobloxLinksDatabase {
  /**
   * Get all Roblox links
   * @returns {Promise<Object>}
   */
  async getAllLinks() {
    try {
      const links = await db.read(PATHS.ROBLOX.LINKS);
      return links || {};
    } catch (error) {
      logger.error('Failed to read Roblox links', { error });
      return {};
    }
  }

  /**
   * Get Roblox link for a server
   * @param {string} serverId - Discord server ID
   * @returns {Promise<Object|null>}
   */
  async getLink(serverId) {
    try {
      const links = await this.getAllLinks();
      return links[serverId] || null;
    } catch (error) {
      logger.error('Failed to get Roblox link', { serverId, error });
      return null;
    }
  }

  /**
   * Create new Roblox link
   * @param {string} serverId - Discord server ID
   * @param {Object} linkData - Link data
   * @returns {Promise<Object>}
   */
  async createLink(serverId, linkData) {
    try {
      // Generate API key
      const apiKey = this.generateApiKey(serverId);
      const hashedKey = this.hashApiKey(apiKey);

      const link = {
        serverId,
        groupId: linkData.groupId,
        placeIds: linkData.placeIds || [],
        
        // API authentication
        apiKeyHash: hashedKey,
        apiKeyCreated: new Date().toISOString(),
        apiKeyLastUsed: null,
        
        // Status
        status: ROBLOX_LINK_STATUS.PENDING_VERIFICATION,
        verified: false,
        verifiedAt: null,
        
        // Templates enabled for in-game use
        enabledTemplates: linkData.enabledTemplates || [],
        
        // Role mappings: templateId -> { discordRoleId, robloxRank }
        roleMappings: linkData.roleMappings || {},
        
        // Settings
        settings: {
          requirePlaytime: linkData.settings?.requirePlaytime || 60,
          rateLimitMinutes: linkData.settings?.rateLimitMinutes || 60,
          notificationsEnabled: linkData.settings?.notificationsEnabled !== false,
          autoSync: linkData.settings?.autoSync !== false,
          syncIntervalMinutes: linkData.settings?.syncIntervalMinutes || 5
        },
        
        // Analytics
        analytics: {
          totalSubmissions: 0,
          totalSyncs: 0,
          lastSyncAt: null,
          failedSyncs: 0
        },
        
        // Timestamps
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save link
      await db.modify(PATHS.ROBLOX.LINKS, (links) => {
        links[serverId] = link;
        return links;
      });

      logger.info('Roblox link created', { serverId, groupId: linkData.groupId });

      // Return link with plain API key (only time it's shown)
      return {
        ...link,
        apiKey // Plain key for user to copy
      };
    } catch (error) {
      logger.error('Failed to create Roblox link', { serverId, error });
      throw error;
    }
  }

  /**
   * Update Roblox link
   * @param {string} serverId - Discord server ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>}
   */
  async updateLink(serverId, updates) {
    try {
      const updatedLink = await db.modify(PATHS.ROBLOX.LINKS, (links) => {
        if (!links[serverId]) {
          throw new Error('Roblox link not found');
        }

        links[serverId] = {
          ...links[serverId],
          ...updates,
          updatedAt: new Date().toISOString()
        };

        return links;
      });

      logger.info('Roblox link updated', { serverId });
      return updatedLink[serverId];
    } catch (error) {
      logger.error('Failed to update Roblox link', { serverId, error });
      throw error;
    }
  }

  /**
   * Delete Roblox link
   * @param {string} serverId - Discord server ID
   * @returns {Promise<void>}
   */
  async deleteLink(serverId) {
    try {
      await db.modify(PATHS.ROBLOX.LINKS, (links) => {
        delete links[serverId];
        return links;
      });

      logger.info('Roblox link deleted', { serverId });
    } catch (error) {
      logger.error('Failed to delete Roblox link', { serverId, error });
      throw error;
    }
  }

  /**
   * Verify Roblox link
   * @param {string} serverId - Discord server ID
   * @returns {Promise<Object>}
   */
  async verifyLink(serverId) {
    try {
      return await this.updateLink(serverId, {
        status: ROBLOX_LINK_STATUS.VERIFIED,
        verified: true,
        verifiedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to verify Roblox link', { serverId, error });
      throw error;
    }
  }

  /**
   * Mark verification as failed
   * @param {string} serverId - Discord server ID
   * @returns {Promise<Object>}
   */
  async markVerificationFailed(serverId) {
    try {
      return await this.updateLink(serverId, {
        status: ROBLOX_LINK_STATUS.VERIFICATION_FAILED
      });
    } catch (error) {
      logger.error('Failed to mark verification failed', { serverId, error });
      throw error;
    }
  }

  /**
   * Add place ID to link
   * @param {string} serverId - Discord server ID
   * @param {string} placeId - Roblox place ID
   * @returns {Promise<Object>}
   */
  async addPlaceId(serverId, placeId) {
    try {
      const link = await this.getLink(serverId);
      
      if (!link) {
        throw new Error('Roblox link not found');
      }

      if (link.placeIds.includes(placeId)) {
        throw new Error('Place ID already added');
      }

      link.placeIds.push(placeId);

      return await this.updateLink(serverId, {
        placeIds: link.placeIds
      });
    } catch (error) {
      logger.error('Failed to add place ID', { serverId, placeId, error });
      throw error;
    }
  }

  /**
   * Remove place ID from link
   * @param {string} serverId - Discord server ID
   * @param {string} placeId - Roblox place ID
   * @returns {Promise<Object>}
   */
  async removePlaceId(serverId, placeId) {
    try {
      const link = await this.getLink(serverId);
      
      if (!link) {
        throw new Error('Roblox link not found');
      }

      return await this.updateLink(serverId, {
        placeIds: link.placeIds.filter(id => id !== placeId)
      });
    } catch (error) {
      logger.error('Failed to remove place ID', { serverId, placeId, error });
      throw error;
    }
  }

  /**
   * Enable template for in-game use
   * @param {string} serverId - Discord server ID
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>}
   */
  async enableTemplate(serverId, templateId) {
    try {
      const link = await this.getLink(serverId);
      
      if (!link) {
        throw new Error('Roblox link not found');
      }

      if (link.enabledTemplates.includes(templateId)) {
        throw new Error('Template already enabled');
      }

      link.enabledTemplates.push(templateId);

      return await this.updateLink(serverId, {
        enabledTemplates: link.enabledTemplates
      });
    } catch (error) {
      logger.error('Failed to enable template', { serverId, templateId, error });
      throw error;
    }
  }

  /**
   * Disable template for in-game use
   * @param {string} serverId - Discord server ID
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>}
   */
  async disableTemplate(serverId, templateId) {
    try {
      const link = await this.getLink(serverId);
      
      if (!link) {
        throw new Error('Roblox link not found');
      }

      return await this.updateLink(serverId, {
        enabledTemplates: link.enabledTemplates.filter(id => id !== templateId)
      });
    } catch (error) {
      logger.error('Failed to disable template', { serverId, templateId, error });
      throw error;
    }
  }

  /**
   * Add or update role mapping
   * @param {string} serverId - Discord server ID
   * @param {string} templateId - Template ID
   * @param {Object} mapping - { discordRoleId, robloxRank }
   * @returns {Promise<Object>}
   */
  async setRoleMapping(serverId, templateId, mapping) {
    try {
      const link = await this.getLink(serverId);
      
      if (!link) {
        throw new Error('Roblox link not found');
      }

      link.roleMappings[templateId] = mapping;

      return await this.updateLink(serverId, {
        roleMappings: link.roleMappings
      });
    } catch (error) {
      logger.error('Failed to set role mapping', { serverId, templateId, error });
      throw error;
    }
  }

  /**
   * Remove role mapping
   * @param {string} serverId - Discord server ID
   * @param {string} templateId - Template ID
   * @returns {Promise<Object>}
   */
  async removeRoleMapping(serverId, templateId) {
    try {
      const link = await this.getLink(serverId);
      
      if (!link) {
        throw new Error('Roblox link not found');
      }

      delete link.roleMappings[templateId];

      return await this.updateLink(serverId, {
        roleMappings: link.roleMappings
      });
    } catch (error) {
      logger.error('Failed to remove role mapping', { serverId, templateId, error });
      throw error;
    }
  }

  /**
   * Update link settings
   * @param {string} serverId - Discord server ID
   * @param {Object} settings - Settings to update
   * @returns {Promise<Object>}
   */
  async updateSettings(serverId, settings) {
    try {
      const link = await this.getLink(serverId);
      
      if (!link) {
        throw new Error('Roblox link not found');
      }

      return await this.updateLink(serverId, {
        settings: {
          ...link.settings,
          ...settings
        }
      });
    } catch (error) {
      logger.error('Failed to update settings', { serverId, error });
      throw error;
    }
  }

  /**
   * Increment analytics counter
   * @param {string} serverId - Discord server ID
   * @param {string} counter - Counter name
   * @param {number} amount - Amount to increment
   * @returns {Promise<Object>}
   */
  async incrementAnalytics(serverId, counter, amount = 1) {
    try {
      const link = await this.getLink(serverId);
      
      if (!link) {
        throw new Error('Roblox link not found');
      }

      if (!link.analytics[counter]) {
        link.analytics[counter] = 0;
      }

      link.analytics[counter] += amount;

      return await this.updateLink(serverId, {
        analytics: link.analytics
      });
    } catch (error) {
      logger.error('Failed to increment analytics', { serverId, counter, error });
      throw error;
    }
  }

  /**
   * Update last sync time
   * @param {string} serverId - Discord server ID
   * @param {boolean} success - Whether sync was successful
   * @returns {Promise<Object>}
   */
  async updateLastSync(serverId, success = true) {
    try {
      const link = await this.getLink(serverId);
      
      if (!link) {
        throw new Error('Roblox link not found');
      }

      link.analytics.lastSyncAt = new Date().toISOString();
      link.analytics.totalSyncs++;
      
      if (!success) {
        link.analytics.failedSyncs++;
      }

      return await this.updateLink(serverId, {
        analytics: link.analytics
      });
    } catch (error) {
      logger.error('Failed to update last sync', { serverId, error });
      throw error;
    }
  }

  /**
   * Update API key last used time
   * @param {string} serverId - Discord server ID
   * @returns {Promise<void>}
   */
  async updateApiKeyUsage(serverId) {
    try {
      await this.updateLink(serverId, {
        apiKeyLastUsed: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to update API key usage', { serverId, error });
    }
  }

  /**
   * Regenerate API key
   * @param {string} serverId - Discord server ID
   * @returns {Promise<Object>}
   */
  async regenerateApiKey(serverId) {
    try {
      const apiKey = this.generateApiKey(serverId);
      const hashedKey = this.hashApiKey(apiKey);

      const updatedLink = await this.updateLink(serverId, {
        apiKeyHash: hashedKey,
        apiKeyCreated: new Date().toISOString(),
        apiKeyLastUsed: null
      });

      logger.info('API key regenerated', { serverId });

      return {
        ...updatedLink,
        apiKey // Return plain key
      };
    } catch (error) {
      logger.error('Failed to regenerate API key', { serverId, error });
      throw error;
    }
  }

  /**
   * Validate API key
   * @param {string} apiKey - API key to validate
   * @returns {Promise<Object|null>} Link object if valid, null otherwise
   */
  async validateApiKey(apiKey) {
    try {
      const hashedKey = this.hashApiKey(apiKey);
      const links = await this.getAllLinks();

      for (const [serverId, link] of Object.entries(links)) {
        if (link.apiKeyHash === hashedKey) {
          // Update last used time
          await this.updateApiKeyUsage(serverId);
          return link;
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to validate API key', { error });
      return null;
    }
  }

  /**
   * Get link by group ID
   * @param {string} groupId - Roblox group ID
   * @returns {Promise<Object|null>}
   */
  async getLinkByGroupId(groupId) {
    try {
      const links = await this.getAllLinks();

      for (const link of Object.values(links)) {
        if (link.groupId === groupId) {
          return link;
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to get link by group ID', { groupId, error });
      return null;
    }
  }

  /**
   * Check if place ID is authorized
   * @param {string} placeId - Roblox place ID
   * @returns {Promise<Object|null>} Link object if authorized, null otherwise
   */
  async isPlaceAuthorized(placeId) {
    try {
      const links = await this.getAllLinks();

      for (const link of Object.values(links)) {
        if (link.placeIds.includes(placeId) && link.verified) {
          return link;
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to check place authorization', { placeId, error });
      return null;
    }
  }

  /**
   * Generate API key
   * @param {string} serverId - Discord server ID
   * @returns {string}
   */
  generateApiKey(serverId) {
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return `ks_roblox_${serverId}_${randomBytes}`;
  }

  /**
   * Hash API key
   * @param {string} apiKey - API key to hash
   * @returns {string}
   */
  hashApiKey(apiKey) {
    const salt = process.env.API_KEY_SALT || 'default_salt_change_this';
    return crypto
      .createHash('sha256')
      .update(apiKey + salt)
      .digest('hex');
  }

  /**
   * List all servers with Roblox links
   * @returns {Promise<Array<string>>}
   */
  async listLinkedServers() {
    try {
      const links = await this.getAllLinks();
      return Object.keys(links);
    } catch (error) {
      logger.error('Failed to list linked servers', { error });
      return [];
    }
  }

  /**
   * Get statistics
   * @returns {Promise<Object>}
   */
  async getStatistics() {
    try {
      const links = await this.getAllLinks();
      const linkArray = Object.values(links);

      return {
        totalLinks: linkArray.length,
        verifiedLinks: linkArray.filter(l => l.verified).length,
        pendingVerification: linkArray.filter(l => l.status === ROBLOX_LINK_STATUS.PENDING_VERIFICATION).length,
        totalSubmissions: linkArray.reduce((sum, l) => sum + l.analytics.totalSubmissions, 0),
        totalSyncs: linkArray.reduce((sum, l) => sum + l.analytics.totalSyncs, 0),
        totalGames: linkArray.reduce((sum, l) => sum + l.placeIds.length, 0)
      };
    } catch (error) {
      logger.error('Failed to get statistics', { error });
      return null;
    }
  }
}

// Export singleton instance
module.exports = new RobloxLinksDatabase();