const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ticketsDb = require('../../../core/database/tickets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Manage bot settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup(group =>
      group
        .setName('tickets')
        .setDescription('Manage ticket system')
        .addSubcommand(sub =>
          sub
            .setName('stats')
            .setDescription('View ticket statistics')
        )
        .addSubcommand(sub =>
          sub
            .setName('settings')
            .setDescription('Configure ticket settings')
            .addIntegerOption(opt =>
              opt.setName('max-open')
                .setDescription('Max open tickets per user')
                .setMinValue(1)
                .setMaxValue(10)
            )
            .addIntegerOption(opt =>
              opt.setName('auto-close-hours')
                .setDescription('Auto-close after hours of inactivity')
                .setMinValue(1)
                .setMaxValue(168)
            )
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'stats') {
      await this.showStats(interaction);
    } else if (subcommand === 'settings') {
      await this.updateSettings(interaction);
    }
  },

  async showStats(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const stats = await ticketsDb.getStatistics(interaction.guild.id);

    if (!stats) {
      return await interaction.editReply({ content: 'No ticket statistics available.' });
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📊 Ticket Statistics')
      .addFields(
        {
          name: 'Total Tickets',
          value: stats.total.toString(),
          inline: true
        },
        {
          name: 'Open',
          value: stats.open.toString(),
          inline: true
        },
        {
          name: 'Closed',
          value: stats.closed.toString(),
          inline: true
        },
        {
          name: 'Average Messages',
          value: stats.averageMessagesPerTicket.toString(),
          inline: true
        },
        {
          name: 'Avg Resolution Time',
          value: `${stats.averageResolutionTime} hours`,
          inline: true
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },

  async updateSettings(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const maxOpen = interaction.options.getInteger('max-open');
    const autoCloseHours = interaction.options.getInteger('auto-close-hours');

    const serverDb = require('../../../core/database/servers');
    const serverConfig = await serverDb.getServer(interaction.guild.id);

    const updates = { ...serverConfig.tickets };
    if (maxOpen) updates.maxOpenTickets = maxOpen;
    if (autoCloseHours) updates.autoCloseHours = autoCloseHours;

    await serverDb.updateTicketSettings(interaction.guild.id, updates);

    await interaction.editReply({
      content: '✅ Ticket settings updated!'
    });
  }
};