/**
 * KS Bot - Database Handler
 * 
 * Handles JSON-based storage with caching, locks, and backups.
 */

const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const { main: logger, database: dbLogger } = require('../shared/utils/logger');
const { PATHS } = require('../shared/constants');

class DatabaseHandler {
  constructor() {
    this.cache = new Map();
    this.locks = new Map();
    this.initialized = false;
  }

  async initialize() {
    try {
      logger.info('Initializing database system...');
      await this.ensureDirectories();
      await this.initializeFiles();
      if (process.env.BACKUP_ENABLED !== 'false') this.setupAutoBackup();
      this.initialized = true;
      logger.info('Database system initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database', error);
      throw error;
    }
  }

  async ensureDirectories() {
    const dirs = [
      PATHS.DATA,
      PATHS.LOGS,
      PATHS.BACKUPS,
      PATHS.SERVERS,
      PATHS.APPLICATIONS,
      PATHS.TICKETS,
      path.dirname(PATHS.ROBLOX.LINKS),
      path.dirname(PATHS.ROBLOX.VERIFICATIONS),
      path.dirname(PATHS.ROBLOX.SUBMISSIONS),
      path.dirname(PATHS.ROBLOX.SYNC_QUEUE)
    ];
    for (const dir of dirs) await fs.ensureDir(dir);
    dbLogger.debug('All directories ensured');
  }

  async initializeFiles() {
    const files = [
      { path: PATHS.ROBLOX.LINKS, default: {} },
      { path: PATHS.ROBLOX.VERIFICATIONS, default: {} },
      { path: PATHS.ROBLOX.SUBMISSIONS, default: [] },
      { path: PATHS.ROBLOX.SYNC_QUEUE, default: [] }
    ];
    for (const file of files) {
      if (!await fs.pathExists(file.path)) await fs.writeJson(file.path, file.default, { spaces: 2 });
    }
  }

  async read(filePath, useCache = true) {
    if (useCache && this.cache.has(filePath)) {
      const cached = this.cache.get(filePath);
      if (Date.now() - cached.timestamp < 5000) return cached.data;
    }
    await this.waitForLock(filePath);
    const data = await fs.readJson(filePath);
    if (useCache) this.cache.set(filePath, { data, timestamp: Date.now() });
    dbLogger.read(path.basename(filePath), 'read', true, 0);
    return data;
  }

  async write(filePath, data, invalidateCache = true) {
    await this.acquireLock(filePath);
    await fs.ensureDir(path.dirname(filePath));
    const tempPath = `${filePath}.tmp`;
    await fs.writeJson(tempPath, data, { spaces: 2 });
    await fs.rename(tempPath, filePath);
    if (invalidateCache) this.cache.delete(filePath);
    this.releaseLock(filePath);
    dbLogger.write(path.basename(filePath), 'write', 1, true, 0);
  }

  async modify(filePath, modifier) {
    await this.acquireLock(filePath);
    let data = await this.read(filePath, false);
    if (!data) data = {};
    const modified = await modifier(data);
    await fs.writeJson(filePath, modified, { spaces: 2 });
    this.cache.delete(filePath);
    this.releaseLock(filePath);
    dbLogger.write(path.basename(filePath), 'modify', 1, true, 0);
    return modified;
  }

  async delete(filePath) {
    await this.acquireLock(filePath);
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
      this.cache.delete(filePath);
      dbLogger.write(path.basename(filePath), 'delete', 1, true, 0);
    }
    this.releaseLock(filePath);
  }

  async exists(filePath) {
    return fs.pathExists(filePath);
  }

  async listFiles(dirPath, extension = null) {
    const files = await fs.readdir(dirPath);
    return extension ? files.filter(f => f.endsWith(extension)) : files;
  }

  async acquireLock(filePath) {
    while (this.locks.get(filePath)) await new Promise(r => setTimeout(r, 10));
    this.locks.set(filePath, true);
  }

  releaseLock(filePath) {
    this.locks.delete(filePath);
  }

  async waitForLock(filePath) {
    while (this.locks.get(filePath)) await new Promise(r => setTimeout(r, 10));
  }

  async backupAll() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipPath = path.join(PATHS.BACKUPS, `backup-${timestamp}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(PATHS.DATA, 'data');
    await archive.finalize();
    dbLogger.write('backup', 'backupAll', 1, true, 0);
  }

  setupAutoBackup() {
    setInterval(() => this.backupAll().catch(console.error), 1000 * 60 * 60); // every hour
  }

  generateId() {
    return uuidv4();
  }

  async close() {
    try {
      // Clear cache
      this.cache.clear();
      this.locks.clear();
      
      // Perform final backup if enabled
      if (process.env.BACKUP_ENABLED !== 'false') {
        await this.backupAll();
      }
      
      logger.info('Database handler closed successfully');
    } catch (error) {
      logger.error('Error closing database handler', error);
    }
  }
}

module.exports = new DatabaseHandler();