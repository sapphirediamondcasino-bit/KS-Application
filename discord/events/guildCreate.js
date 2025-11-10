// ==========================================
// FILE: discord/events/guildCreate.js
// ==========================================
const serverDb = require('../../core/database/servers');
const { discord: logger } = require('../../shared/utils/logger');

module.exports = {
  name: 'guildCreate',
  
  async execute(guild, client) {
    try {
      logger.info('Bot joined new guild', {
        guildId: guild.id,
        guildName: guild.name,
        memberCount: guild.memberCount
      });

      // Create server configuration
      await serverDb.createServer(guild.id);

      // Try to send welcome message to system channel or first available channel
      const systemChannel = guild.systemChannel;
      const firstChannel = guild.channels.cache.find(
        channel => channel.type === 0 && 
        channel.permissionsFor(guild.members.me).has('SendMessages')
      );

      const targetChannel = systemChannel || firstChannel;

      if (targetChannel) {
        const { EmbedBuilder } = require('discord.js');
        
        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle('👋 Thanks for adding KS Bot!')
          .setDescription(
            'KS Bot is a powerful application and ticket management system with Roblox integration.\n\n' +
            '**Getting Started:**\n' +
            '• Use `/dashboard setup start` to begin setup\n' +
            '• Use `/ticket setup` to configure tickets\n' +
            '• Use `/dashboard applications` to manage applications\n' +
            '• Use `/dashboard roblox setup` for Roblox integration\n\n' +
            '**Need Help?**\n' +
            'Join our support server or use `/help` for more information.'
          )
          .addFields(
            {
              name: '📝 Applications',
              value: 'Manage applications with custom templates',
              inline: true
            },
            {
              name: '🎫 Tickets',
              value: 'Professional support ticket system',
              inline: true
            },
            {
              name: '🎮 Roblox',
              value: 'In-game application integration',
              inline: true
            }
          )
          .setFooter({ text: 'Use /help for more commands' })
          .setTimestamp();

        await targetChannel.send({ embeds: [embed] });
      }

    } catch (error) {
      logger.error('Error in guildCreate event', {
        guildId: guild.id,
        error: error.message
      });
    }
  }
};