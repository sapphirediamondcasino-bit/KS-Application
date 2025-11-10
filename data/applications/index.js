/**
 * Applications Database Module
 * Manages job applications with Roblox integration
 */

const db = require('../db_handler');

class ApplicationsDatabase {
  /**
   * Create a new application
   */
  async createApplication(guildId, userId, username, data = {}) {
    const sql = `INSERT INTO applications 
                 (guild_id, user_id, username, roblox_username, roblox_id, 
                  questions, answers, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    return await db.run(sql, [
      guildId,
      userId,
      username,
      data.roblox_username || null,
      data.roblox_id || null,
      JSON.stringify(data.questions || []),
      JSON.stringify(data.answers || []),
      'pending'
    ]);
  }

  /**
   * Get application by ID
   */
  async getApplication(applicationId) {
    const sql = 'SELECT * FROM applications WHERE id = ?';
    const app = await db.get(sql, [applicationId]);
    
    if (app) {
      app.questions = JSON.parse(app.questions || '[]');
      app.answers = JSON.parse(app.answers || '[]');
    }
    
    return app;
  }

  /**
   * Get all applications for a user in a guild
   */
  async getUserApplications(guildId, userId) {
    const sql = `SELECT * FROM applications 
                 WHERE guild_id = ? AND user_id = ?
                 ORDER BY created_at DESC`;
    const apps = await db.all(sql, [guildId, userId]);
    
    return apps.map(app => {
      app.questions = JSON.parse(app.questions || '[]');
      app.answers = JSON.parse(app.answers || '[]');
      return app;
    });
  }

  /**
   * Get all pending applications for a guild
   */
  async getPendingApplications(guildId) {
    const sql = `SELECT * FROM applications 
                 WHERE guild_id = ? AND status = 'pending'
                 ORDER BY created_at ASC`;
    const apps = await db.all(sql, [guildId]);
    
    return apps.map(app => {
      app.questions = JSON.parse(app.questions || '[]');
      app.answers = JSON.parse(app.answers || '[]');
      return app;
    });
  }

  /**
   * Get all applications for a guild (with optional status filter)
   */
  async getApplicationsByGuild(guildId, status = null) {
    let sql = 'SELECT * FROM applications WHERE guild_id = ?';
    const params = [guildId];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY created_at DESC';
    const apps = await db.all(sql, params);
    
    return apps.map(app => {
      app.questions = JSON.parse(app.questions || '[]');
      app.answers = JSON.parse(app.answers || '[]');
      return app;
    });
  }

  /**
   * Update application status
   */
  async updateStatus(applicationId, status, reviewerId = null, notes = null) {
    const sql = `UPDATE applications 
                 SET status = ?, reviewer_id = ?, review_notes = ?, 
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`;
    
    return await db.run(sql, [status, reviewerId, notes, applicationId]);
  }

  /**
   * Approve application
   */
  async approveApplication(applicationId, reviewerId, notes = null) {
    return await this.updateStatus(applicationId, 'approved', reviewerId, notes);
  }

  /**
   * Deny application
   */
  async denyApplication(applicationId, reviewerId, notes = null) {
    return await this.updateStatus(applicationId, 'denied', reviewerId, notes);
  }

  /**
   * Check if user has pending application
   */
  async hasPendingApplication(guildId, userId) {
    const sql = `SELECT COUNT(*) as count FROM applications 
                 WHERE guild_id = ? AND user_id = ? AND status = 'pending'`;
    const result = await db.get(sql, [guildId, userId]);
    return result.count > 0;
  }

  /**
   * Get application statistics for a guild
   */
  async getStats(guildId) {
    const sql = `SELECT 
                   COUNT(*) as total,
                   SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                   SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                   SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied
                 FROM applications 
                 WHERE guild_id = ?`;
    
    return await db.get(sql, [guildId]);
  }

  /**
   * Delete application
   */
  async deleteApplication(applicationId) {
    const sql = 'DELETE FROM applications WHERE id = ?';
    return await db.run(sql, [applicationId]);
  }

  /**
   * Delete all applications for a user in a guild
   */
  async deleteUserApplications(guildId, userId) {
    const sql = 'DELETE FROM applications WHERE guild_id = ? AND user_id = ?';
    return await db.run(sql, [guildId, userId]);
  }

  /**
   * Search applications by Roblox username
   */
  async searchByRoblox(guildId, robloxUsername) {
    const sql = `SELECT * FROM applications 
                 WHERE guild_id = ? AND roblox_username LIKE ?
                 ORDER BY created_at DESC`;
    const apps = await db.all(sql, [guildId, `%${robloxUsername}%`]);
    
    return apps.map(app => {
      app.questions = JSON.parse(app.questions || '[]');
      app.answers = JSON.parse(app.answers || '[]');
      return app;
    });
  }
}

// Export singleton instance
module.exports = new ApplicationsDatabase();