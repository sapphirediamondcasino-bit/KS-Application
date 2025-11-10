// ==========================================
// FILE: discord/commands/dashboard/setup.js
// ==========================================
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const serverDb = require('../../core/database/servers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Manage bot settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup(group =>
      group
        .setName('setup')
        .setDescription('Initial setup')
        .addSubcommand(sub =>
          sub
            .setName('start')
            .setDescription('Start initial server setup')
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const serverId = interaction.guild.id;

    // Create or get server config
    const serverConfig = await serverDb.getOrCreate(serverId);

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('⚙️ KS Bot Setup')
      .setDescription(
        'Welcome to KS Bot! Let\'s get your server configured.\n\n' +
        '**Available Features:**\n' +
        '• Application System\n' +
        '• Ticket System\n' +
        '• Roblox Integration\n\n' +
        '**Quick Start:**\n' +
        '1. Use `/ticket setup` to configure tickets\n' +
        '2. Use `/dashboard applications` to manage applications\n' +
        '3. Use `/dashboard roblox setup` for Roblox integration'
      )
      .addFields(
        {
          name: '📝 Applications',
          value: serverConfig.applications.enabled ? '✅ Enabled' : '❌ Disabled',
          inline: true
        },
        {
          name: '🎫 Tickets',
          value: serverConfig.tickets.enabled ? '✅ Enabled' : '❌ Disabled',
          inline: true
        },
        {
          name: '🎮 Roblox',
          value: serverConfig.roblox.enabled ? '✅ Enabled' : '❌ Disabled',
          inline: true
        }
      )
      .setFooter({ text: 'Use /dashboard for more options' });

    await interaction.editReply({ embeds: [embed] });
  }
};