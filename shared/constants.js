// shared/constants.js

const path = require('path');

// Base paths
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');

module.exports = {
  // Logger constants
  LOG_LEVELS: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug'
  },

  // Colors for console output
  COLORS: {
    RESET: '\x1b[0m',
    RED: '\x1b[31m',
    YELLOW: '\x1b[33m',
    GREEN: '\x1b[32m',
    BLUE: '\x1b[34m',
    CYAN: '\x1b[36m',
    MAGENTA: '\x1b[35m'
  },

  // File and directory paths
  PATHS: {
    // Root directories
    ROOT: ROOT_DIR,
    DATA: DATA_DIR,
    LOGS: LOGS_DIR,
    BACKUPS: BACKUPS_DIR,

    // Data subdirectories
    SERVERS: path.join(DATA_DIR, 'servers'),
    APPLICATIONS: path.join(DATA_DIR, 'applications'),
    TICKETS: path.join(DATA_DIR, 'tickets'),

    // Roblox integration paths
    ROBLOX: {
      LINKS: path.join(DATA_DIR, 'roblox', 'links.json'),
      VERIFICATIONS: path.join(DATA_DIR, 'roblox', 'verifications.json'),
      SUBMISSIONS: path.join(DATA_DIR, 'roblox', 'submissions.json'),
      SYNC_QUEUE: path.join(DATA_DIR, 'roblox', 'sync_queue.json')
    }
  },

  // Bot configuration
  BOT: {
    PREFIX: process.env.PREFIX || '!',
    VERSION: '2.0.0'
  },

  // Subscription tiers
  TIERS: {
    FREE: 'free',
    PREMIUM: 'premium',
    ENTERPRISE: 'enterprise'
  },

  // Application constants
  APPLICATION_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    DENIED: 'denied',
    CANCELLED: 'cancelled'
  },

  APPLICATION_SOURCE: {
    DISCORD: 'discord',
    ROBLOX: 'roblox'
  },

  // Ticket constants
  TICKET_STATUS: {
    OPEN: 'open',
    CLOSED: 'closed',
    LOCKED: 'locked',
    ARCHIVED: 'archived'
  },

  TICKET_PRIORITY: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
  }
};