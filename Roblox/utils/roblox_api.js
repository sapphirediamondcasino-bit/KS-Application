/**
 * KS Bot - Roblox API Wrapper
 * 
 * Handles all interactions with Roblox APIs including authentication,
 * rate limiting, caching, and error handling.
 */

const axios = require('axios');
const NodeCache = require('node-cache');
const { roblox: logger } = require('../../shared/utils/logger');
const { ROBLOX_API } = require('../../shared/constants');

class RobloxAPI {
  constructor() {
    this.cookie = process.env.ROBLOX_COOKIE || '';
    this.cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
    this.rateLimits = new Map();
    
    // Create axios instance
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'KS-Bot/2.0',
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        config.metadata = { startTime: Date.now() };
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for logging and rate limiting
    this.client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime;
        logger.apiCall(response.config.url, response.config.method, response.status, duration);
        return response;
      },
      (error) => {
        if (error.response) {
          const duration = Date.now() - error.config.metadata.startTime;
          logger.apiCall(error.config.url, error.config.method, error.response.status, duration);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Make authenticated request to Roblox API
   * @param {string} url - API endpoint URL
   * @param {Object} options - Request options
   * @returns {Promise<Object>}
   */
  async makeRequest(url, options = {}) {
    try {
      // Check rate limit
      await this.checkRateLimit(url);

      const config = {
        url,
        method: options.method || 'GET',
        ...options
      };

      // Add cookie if available
      if (this.cookie && options.authenticated !== false) {
        config.headers = {
          ...config.headers,
          'Cookie': `.ROBLOSECURITY=${this.cookie}`
        };
      }

      const response = await this.client(config);
      return response.data;
    } catch (error) {
      this.handleError(error, url);
    }
  }

  /**
   * Get group information
   * @param {string} groupId - Roblox group ID
   * @param {boolean} useCache - Whether to use cache
   * @returns {Promise<Object>}
   */
  async getGroupInfo(groupId, useCache = true) {
    const cacheKey = `group_info_${groupId}`;

    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const url = `${ROBLOX_API.BASE}${ROBLOX_API.ENDPOINTS.GROUP_INFO.replace('{groupId}', groupId)}`;
    const data = await this.makeRequest(url, { authenticated: false });

    if (useCache) {
      this.cache.set(cacheKey, data, 3600); // Cache for 1 hour
    }

    return data;
  }

  /**
   * Get group roles
   * @param {string} groupId - Roblox group ID
   * @param {boolean} useCache - Whether to use cache
   * @returns {Promise<Array>}
   */
  async getGroupRoles(groupId, useCache = true) {
    const cacheKey = `group_roles_${groupId}`;

    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const url = `${ROBLOX_API.BASE}${ROBLOX_API.ENDPOINTS.GROUP_ROLES.replace('{groupId}', groupId)}`;
    const data = await this.makeRequest(url, { authenticated: false });

    const roles = data.roles || [];

    if (useCache) {
      this.cache.set(cacheKey, roles, 3600); // Cache for 1 hour
    }

    return roles;
  }

  /**
   * Get group members
   * @param {string} groupId - Roblox group ID
   * @param {number} limit - Number of members to fetch
   * @param {string} cursor - Pagination cursor
   * @returns {Promise<Object>}
   */
  async getGroupMembers(groupId, limit = 100, cursor = null) {
    let url = `${ROBLOX_API.BASE}${ROBLOX_API.ENDPOINTS.GROUP_MEMBERS.replace('{groupId}', groupId)}?limit=${limit}`;
    
    if (cursor) {
      url += `&cursor=${cursor}`;
    }

    return await this.makeRequest(url, { authenticated: false });
  }

  /**
   * Set user rank in group
   * @param {string} groupId - Roblox group ID
   * @param {string} userId - Roblox user ID
   * @param {number} roleId - Role ID to set
   * @returns {Promise<Object>}
   */
  async setUserRank(groupId, userId, roleId) {
    if (!this.cookie) {
      throw new Error('Roblox cookie not configured');
    }

    const url = `${ROBLOX_API.BASE}${ROBLOX_API.ENDPOINTS.SET_RANK.replace('{groupId}', groupId).replace('{userId}', userId)}`;
    
    return await this.makeRequest(url, {
      method: 'PATCH',
      data: { roleId },
      authenticated: true
    });
  }

  /**
   * Get user information
   * @param {string} userId - Roblox user ID
   * @param {boolean} useCache - Whether to use cache
   * @returns {Promise<Object>}
   */
  async getUserInfo(userId, useCache = true) {
    const cacheKey = `user_info_${userId}`;

    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const url = `${ROBLOX_API.USERS}${ROBLOX_API.ENDPOINTS.USER_INFO.replace('{userId}', userId)}`;
    const data = await this.makeRequest(url, { authenticated: false });

    if (useCache) {
      this.cache.set(cacheKey, data, 1800); // Cache for 30 minutes
    }

    return data;
  }

  /**
   * Get user's groups
   * @param {string} userId - Roblox user ID
   * @returns {Promise<Array>}
   */
  async getUserGroups(userId) {
    const url = `${ROBLOX_API.USERS}${ROBLOX_API.ENDPOINTS.USER_GROUPS.replace('{userId}', userId)}`;
    const data = await this.makeRequest(url, { authenticated: false });
    return data.data || [];
  }

  /**
   * Get user's role in group
   * @param {string} userId - Roblox user ID
   * @param {string} groupId - Roblox group ID
   * @returns {Promise<Object|null>}
   */
  async getUserRoleInGroup(userId, groupId) {
    const groups = await this.getUserGroups(userId);
    const group = groups.find(g => g.group.id.toString() === groupId.toString());
    return group ? group.role : null;
  }

  /**
   * Check if user is in group
   * @param {string} userId - Roblox user ID
   * @param {string} groupId - Roblox group ID
   * @returns {Promise<boolean>}
   */
  async isUserInGroup(userId, groupId) {
    const role = await this.getUserRoleInGroup(userId, groupId);
    return role !== null;
  }

  /**
   * Get group description
   * @param {string} groupId - Roblox group ID
   * @returns {Promise<string>}
   */
  async getGroupDescription(groupId) {
    const groupInfo = await this.getGroupInfo(groupId, false); // Don't cache for verification
    return groupInfo.description || '';
  }

  /**
   * Update group description (requires authentication)
   * @param {string} groupId - Roblox group ID
   * @param {string} description - New description
   * @returns {Promise<Object>}
   */
  async updateGroupDescription(groupId, description) {
    if (!this.cookie) {
      throw new Error('Roblox cookie not configured');
    }

    const url = `${ROBLOX_API.BASE}${ROBLOX_API.ENDPOINTS.GROUP_DESCRIPTION.replace('{groupId}', groupId)}`;
    
    return await this.makeRequest(url, {
      method: 'PATCH',
      data: { description },
      authenticated: true
    });
  }

  /**
   * Get user thumbnail
   * @param {string} userId - Roblox user ID
   * @param {string} size - Thumbnail size (48x48, 60x60, 150x150, etc.)
   * @returns {Promise<string>} Thumbnail URL
   */
  async getUserThumbnail(userId, size = '150x150') {
    const url = `${ROBLOX_API.THUMBNAILS}/users/avatar?userIds=${userId}&size=${size}&format=Png`;
    const data = await this.makeRequest(url, { authenticated: false });
    
    if (data.data && data.data.length > 0) {
      return data.data[0].imageUrl;
    }
    
    return null;
  }

  /**
   * Get group icon
   * @param {string} groupId - Roblox group ID
   * @param {string} size - Icon size
   * @returns {Promise<string>} Icon URL
   */
  async getGroupIcon(groupId, size = '150x150') {
    const url = `${ROBLOX_API.THUMBNAILS}/groups/icons?groupIds=${groupId}&size=${size}&format=Png`;
    const data = await this.makeRequest(url, { authenticated: false });
    
    if (data.data && data.data.length > 0) {
      return data.data[0].imageUrl;
    }
    
    return null;
  }

  /**
   * Batch get user information
   * @param {Array<string>} userIds - Array of Roblox user IDs
   * @returns {Promise<Array>}
   */
  async getBatchUserInfo(userIds) {
    // Roblox API limits batch requests to 100 users
    const batches = [];
    for (let i = 0; i < userIds.length; i += 100) {
      batches.push(userIds.slice(i, i + 100));
    }

    const results = [];
    
    for (const batch of batches) {
      const url = `${ROBLOX_API.USERS}/users`;
      const data = await this.makeRequest(url, {
        method: 'POST',
        data: { userIds: batch },
        authenticated: false
      });
      
      results.push(...(data.data || []));
    }

    return results;
  }

  /**
   * Check rate limit for endpoint
   * @param {string} url - API endpoint URL
   * @returns {Promise<void>}
   */
  async checkRateLimit(url) {
    const key = new URL(url).pathname;
    const limit = this.rateLimits.get(key);

    if (!limit) {
      this.rateLimits.set(key, {
        count: 1,
        resetAt: Date.now() + 60000 // 1 minute
      });
      return;
    }

    // Reset if window expired
    if (Date.now() > limit.resetAt) {
      this.rateLimits.set(key, {
        count: 1,
        resetAt: Date.now() + 60000
      });
      return;
    }

    // Check if rate limited
    if (limit.count >= 60) { // 60 requests per minute
      const waitTime = limit.resetAt - Date.now();
      logger.warn('Rate limited, waiting', { endpoint: key, waitTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Reset after waiting
      this.rateLimits.set(key, {
        count: 1,
        resetAt: Date.now() + 60000
      });
      return;
    }

    // Increment count
    limit.count++;
    this.rateLimits.set(key, limit);
  }

  /**
   * Handle API errors
   * @param {Error} error - Error object
   * @param {string} url - API endpoint URL
   * @throws {Error}
   */
  handleError(error, url) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      logger.error('Roblox API error', {
        url,
        status,
        error: data
      });

      switch (status) {
        case 400:
          throw new Error(`Bad request: ${data.errors?.[0]?.message || 'Invalid request'}`);
        case 401:
          throw new Error('Unauthorized: Invalid or expired Roblox cookie');
        case 403:
          throw new Error('Forbidden: Insufficient permissions');
        case 404:
          throw new Error('Not found: Resource does not exist');
        case 429:
          throw new Error('Rate limited: Too many requests');
        case 500:
        case 502:
        case 503:
          throw new Error('Roblox API is currently unavailable');
        default:
          throw new Error(`Roblox API error: ${status}`);
      }
    } else if (error.request) {
      logger.error('No response from Roblox API', { url, error: error.message });
      throw new Error('Failed to connect to Roblox API');
    } else {
      logger.error('Request error', { url, error: error.message });
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  /**
   * Clear cache
   * @param {string} pattern - Cache key pattern (optional)
   */
  clearCache(pattern = null) {
    if (pattern) {
      const keys = this.cache.keys().filter(key => key.includes(pattern));
      this.cache.del(keys);
      logger.debug('Cleared cache', { pattern, count: keys.length });
    } else {
      this.cache.flushAll();
      logger.debug('Cleared all cache');
    }
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Test API connection
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      await this.makeRequest(`${ROBLOX_API.USERS}/1`, { authenticated: false });
      return true;
    } catch (error) {
      logger.error('API connection test failed', { error });
      return false;
    }
  }

  /**
   * Verify cookie is valid
   * @returns {Promise<boolean>}
   */
  async verifyCookie() {
    if (!this.cookie) {
      return false;
    }

    try {
      const url = `${ROBLOX_API.USERS}/authenticated-user`;
      await this.makeRequest(url, { authenticated: true });
      return true;
    } catch (error) {
      logger.error('Cookie verification failed', { error });
      return false;
    }
  }
}

// Export singleton instance
module.exports = new RobloxAPI();