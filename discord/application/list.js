// ==========================================
// FILE: discord/commands/application/list.js
// ==========================================
const { SlashCommandBuilder } = require('discord.js');
const applicationsDb = require('../../core/database/applications');
const { createListEmbed } = require('../../shared/utils/formatter');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('application')
    .setDescription('Application management')
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List applications')
        .addStringOption(opt =>
          opt.setName('status')
            .setDescription('Filter by status')
            .setRequired(false)
            .addChoices(
              { name: 'Pending', value: 'pending' },
              { name: 'Approved', value: 'approved' },
              { name: 'Denied', value: 'denied' }
            )
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const status = interaction.options.getString('status');
    const serverId = interaction.guild.id;

    const applications = status
      ? await applicationsDb.getApplicationsByStatus(serverId, status)
      : await applicationsDb.getServerApplications(serverId);

    if (applications.length === 0) {
      return await interaction.editReply({ content: 'No applications found.' });
    }

    const embed = createListEmbed(
      `Applications${status ? ` (${status})` : ''}`,
      applications.slice(0, 10),
      0,
      10,
      (app) => `**${app.templateName}** - <@${app.userId}> (${app.status}) - \`${app.id}\``
    );

    await interaction.editReply({ embeds: [embed] });
  }
};