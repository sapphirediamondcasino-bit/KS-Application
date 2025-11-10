/**
 * KS Bot Main Entry
 */

const { Client, Collection, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const ServerDatabase = require('../data/servers');
const db = require('../data/db_handler');
const { main: logger } = require('../shared/utils/logger');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();
client.prefix = process.env.PREFIX || '!';

/**
 * Initialize the bot
 */
async function initialize() {
  logger.info('Initializing database system...');
  await db.initialize();
  
  // Load commands dynamically (recursively from all subfolders)
  const commandsPath = path.join(__dirname, '..', 'discord');
  if (fs.existsSync(commandsPath)) {
    const commandFiles = loadCommandFilesRecursively(commandsPath);
    logger.info(`Loading ${commandFiles.length} command files...`);
    
    let loadedCount = 0;
    for (const filePath of commandFiles) {
      try {
        const command = require(filePath);
        
        // Handle slash commands (with .data property)
        if (command.data && command.data.name) {
          client.commands.set(command.data.name, command);
          logger.debug(`Loaded slash command: ${command.data.name} (${path.relative(commandsPath, filePath)})`);
          loadedCount++;
        }
        // Handle prefix commands (with .name property)
        else if (command.name) {
          client.commands.set(command.name, command);
          logger.debug(`Loaded prefix command: ${command.name} (${path.relative(commandsPath, filePath)})`);
          loadedCount++;
        }
      } catch (err) {
        logger.error(`Failed to load command ${path.basename(filePath)}`, { error: err.message });
      }
    }
    logger.info(`Successfully loaded ${loadedCount} commands`);
  }

  // Setup event handlers AFTER commands are loaded
  setupEventHandlers();
}

/**
 * Recursively load all .js files from a directory
 */
function loadCommandFilesRecursively(dir) {
  const files = [];
  
  function walk(directory) {
    const items = fs.readdirSync(directory, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(directory, item.name);
      
      if (item.isDirectory()) {
        walk(fullPath);
      } else if (item.isFile() && item.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

/**
 * Setup Discord event handlers
 */
function setupEventHandlers() {
  // Message handler (for prefix commands)
  client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(client.prefix)) return;

    const args = message.content.slice(client.prefix.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    const command = client.commands.get(cmdName);

    if (!command || !command.execute) return;

    try {
      await command.execute(message, args, client, ServerDatabase);
    } catch (err) {
      logger.error('Command execution error', { 
        command: cmdName, 
        error: err.message 
      });
      message.reply('An error occurred while executing that command.');
    }
  });

  // Interaction handler (for slash commands)
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error('Slash command execution error', { 
        command: interaction.commandName, 
        error: err.message,
        stack: err.stack
      });
      
      const errorMessage = 'An error occurred while executing that command.';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  });

  // Ready handler (using clientReady to avoid deprecation warning)
  client.once('clientReady', () => {
    logger.info(`Logged in as ${client.user.tag}!`);
    logger.info(`Serving ${client.guilds.cache.size} guilds`);
  });

  // Error handler
  client.on('error', error => {
    logger.error('Discord client error', { error: error.message });
  });
}

/**
 * Login to Discord
 */
async function login() {
  return await client.login(process.env.DISCORD_TOKEN);
}

/**
 * Shutdown the bot gracefully
 */
async function shutdown(reason = 'Unknown') {
  logger.info(`Shutting down bot: ${reason}`);
  
  try {
    // Close database connections (if close method exists)
    if (db.close && typeof db.close === 'function') {
      await db.close();
    }
    
    // Destroy Discord client
    client.destroy();
    
    logger.info('Bot shutdown complete');
  } catch (err) {
    logger.error('Error during shutdown', { error: err.message });
  }
}

/**
 * Register slash commands with Discord API
 */
async function registerCommands() {
  const commands = [];
  
  // Get all commands with .data property (slash commands)
  for (const [name, command] of client.commands) {
    if (command.data) {
      commands.push(command.data.toJSON());
    }
  }
  
  if (commands.length === 0) {
    logger.warn('No slash commands found to register');
    return;
  }
  
  logger.info(`Registering ${commands.length} slash commands with Discord...`);
  
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  
  try {
    let result;
    
    if (process.env.GUILD_ID) {
      logger.info(`Registering to guild ${process.env.GUILD_ID}...`);
      result = await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      );
      logger.info(`✅ Successfully registered ${result.length} guild commands!`);
    } else {
      logger.info('Registering commands globally...');
      result = await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
        { body: commands }
      );
      logger.info(`✅ Successfully registered ${result.length} global commands!`);
      logger.info('Note: Global commands may take up to 1 hour to appear');
    }
  } catch (error) {
    logger.error('Failed to register commands with Discord', { error: error.message, stack: error.stack });
    throw error;
  }
}

// Export functions
module.exports = {
  initialize,
  login,
  shutdown,
  registerCommands,
  client
};