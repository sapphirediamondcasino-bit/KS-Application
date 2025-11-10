/**
 * KS Bot - Core Bot Configuration
 * 
 * Main configuration file for the Discord bot.
 */

require('dotenv').config();

module.exports = {
  // Bot Information
  bot: {
    name: 'KS Bot',
    version: '2.0.0',
    description: 'Advanced Application & Ticket System with Roblox Integration',
    author: 'KS Bot Team',
    website: 'https://ksbot.com',
    supportServer: 'https://discord.gg/ksbot'
  },

  // Discord Configuration
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    ownerId: process.env.BOT_OWNER_ID,
    
    // Development settings
    devMode: process.env.DEV_MODE === 'true',
    testGuildId: process.env.TEST_GUILD_ID,
    
    // Bot presence
    presence: {
      status: 'online', // online, idle, dnd, invisible
      activity: {
        name: 'applications & tickets',
        type: 'WATCHING' // PLAYING, STREAMING, LISTENING, WATCHING, COMPETING
      }
    },
    
    // Command cooldowns (milliseconds)
    cooldowns: {
      default: 3000, // 3 seconds
      application: 5000, // 5 seconds
      ticket: 5000, // 5 seconds
      dashboard: 10000 // 10 seconds
    }
  },

  // Application System
  applications: {
    // Default settings for new servers
    defaults: {
      enabled: false,
      submissionChannelId: null,
      reviewChannelId: null,
      logChannelId: null,
      reviewerRoleIds: [],
      dmApplicants: true
    },
    
    // Application limits
    limits: {
      maxTemplates: 25,
      maxQuestions: 20,
      maxResponseLength: 5000,
      maxChoiceOptions: 25
    },
    
    // Cooldowns
    cooldowns: {
      defaultMinutes: 60,
      minMinutes: 5,
      maxMinutes: 1440 // 24 hours
    }
  },

  // Ticket System
  tickets: {
    // Default settings for new servers
    defaults: {
      enabled: false,
      createChannelId: null,
      categoryId: null,
      transcriptChannelId: null,
      supportRoleIds: [],
      maxOpenTickets: 3,
      autoCloseHours: 48,
      inactivityWarningHours: 24
    },
    
    // Ticket limits
    limits: {
      maxOpenPerUser: 5,
      maxTranscriptSize: 10485760, // 10MB
      maxParticipants: 50
    },
    
    // Naming
    naming: {
      channelPrefix: 'ticket-',
      categoryName: 'Tickets'
    }
  },

  // Embed Colors
  colors: {
    primary: 0x0099ff,
    success: 0x00ff00,
    error: 0xff0000,
    warning: 0xffaa00,
    info: 0x0099ff,
    neutral: 0x95a5a6,
    roblox: 0xe74c3c
  },

  // Emojis
  emojis: {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    loading: '⏱️',
    roblox: '🎮',
    application: '📄',
    ticket: '🎫',
    settings: '⚙️',
    stats: '📊'
  },

  // Permissions
  permissions: {
    // Required bot permissions
    required: [
      'SendMessages',
      'EmbedLinks',
      'AttachFiles',
      'ReadMessageHistory',
      'AddReactions',
      'UseExternalEmojis',
      'ManageMessages',
      'ManageChannels',
      'ManageRoles',
      'ViewChannel'
    ],
    
    // User permission levels
    levels: {
      owner: 10,
      admin: 8,
      moderator: 6,
      staff: 4,
      user: 1
    }
  },

  // Database
  database: {
    path: process.env.DB_PATH || './data',
    backupPath: process.env.BACKUP_PATH || './data/backups',
    backupEnabled: process.env.BACKUP_ENABLED !== 'false',
    backupInterval: parseInt(process.env.BACKUP_INTERVAL) || 86400000, // 24 hours
    maxBackups: parseInt(process.env.MAX_BACKUPS) || 7
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    toFile: process.env.LOG_TO_FILE !== 'false',
    path: process.env.LOG_PATH || './logs',
    
    // Log rotation
    rotation: {
      maxSize: '20m',
      maxFiles: '14d'
    }
  },

  // Security
  security: {
    // Rate limiting
    rateLimit: {
      enabled: true,
      commandsPerMinute: 20,
      applicationsPerHour: 3
    },
    
    // Content filtering
    filtering: {
      enabledProfanityFilter: false,
      enabledSpamDetection: true,
      maxMessageLength: 2000
    }
  },

  // Features
  features: {
    applications: true,
    tickets: true,
    robloxIntegration: true,
    analytics: true,
    autoBackup: true,
    autoModeration: false
  },

  // Maintenance
  maintenance: {
    mode: process.env.MAINTENANCE_MODE === 'true',
    message: 'KS Bot is currently undergoing maintenance. Please try again later.',
    allowedUsers: [process.env.BOT_OWNER_ID]
  },

  // Links
  links: {
    invite: 'https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands',
    support: 'https://discord.gg/ksbot',
    documentation: 'https://docs.ksbot.com',
    website: 'https://ksbot.com'
  },

  // API
  api: {
    enabled: true,
    port: parseInt(process.env.API_PORT) || 3000,
    host: process.env.API_HOST || '0.0.0.0',
    cors: {
      enabled: true,
      origins: ['https://www.roblox.com', 'https://roblox.com']
    }
  },

  // Notifications
  notifications: {
    // Discord DM notifications
    dm: {
      applicationApproved: true,
      applicationDenied: true,
      ticketClosed: true
    },
    
    // In-game notifications (Roblox)
    ingame: {
      applicationApproved: true,
      applicationDenied: true,
      roleUpdated: true
    }
  },

  // Analytics
  analytics: {
    enabled: true,
    trackCommands: true,
    trackApplications: true,
    trackTickets: true,
    trackRobloxSubmissions: true
  },

  // Performance
  performance: {
    // Cache settings
    cache: {
      enabled: true,
      ttl: 600, // 10 minutes
      checkPeriod: 120 // 2 minutes
    },
    
    // Batch processing
    batch: {
      enabled: true,
      size: 10,
      intervalMs: 5000
    }
  },

  // Development
  development: {
    debug: process.env.DEBUG === 'true',
    verbose: process.env.VERBOSE_LOGGING === 'true',
    mockData: false,
    skipVerification: false
  }
};