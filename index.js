/**
 * KS Bot - Main Entry Point
 * 
 * Initializes and starts the Discord bot with all integrations.
 */

require('dotenv').config();

const bot = require('./core/bot.js');
const { main: logger } = require('./shared/utils/logger.js');

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { reason, promise });
  process.exit(1);
});

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await bot.shutdown('SIGINT received');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await bot.shutdown('SIGTERM received');
  process.exit(0);
});

/**
 * Main startup function
 */
async function main() {
  try {
    logger.info('='.repeat(60));
    logger.info('KS Bot - Application & Ticket System with Roblox Integration');
    logger.info('Version 2.0.0');
    logger.info('='.repeat(60));

    // Check required environment variables
    const requiredEnvVars = [
      'DISCORD_TOKEN',
      'DISCORD_CLIENT_ID'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      logger.error('Missing required environment variables:', { missing: missingVars });
      logger.error('Please check your .env file');
      process.exit(1);
    }

    // Initialize bot
    logger.info('Initializing bot...');
    await bot.initialize();

    // Register commands (optional - only if you want to update commands)
    if (process.argv.includes('--register-commands')) {
      logger.info('Registering slash commands...');
      await bot.registerCommands();
      logger.info('Commands registered successfully!');
      logger.info('You can now start the bot normally');
      process.exit(0);
    }

    // Login to Discord
    logger.info('Logging in to Discord...');
    await bot.login();

    // Bot is now running
    logger.info('='.repeat(60));
    logger.info('Bot is now online and ready!');
    logger.info('='.repeat(60));

  } catch (error) {
    logger.error('Failed to start bot', { 
      error: error.message, 
      stack: error.stack 
    });
    process.exit(1);
  }
}

// Start the bot
main();