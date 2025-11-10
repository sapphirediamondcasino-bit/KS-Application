// ==========================================
// FILE: discord/commands/application/view.js
// ==========================================
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const applicationsDb = require('../../core/database/applications');
const { createApplicationEmbed } = require('../embeds/application_embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('application')
    .setDescription('Application management')
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('View an application')
        .addStringOption(opt =>
          opt.setName('id')
            .setDescription('Application ID')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const applicationId = interaction.options.getString('id');
    const application = await applicationsDb.getApplication(applicationId);

    if (!application) {
      return await interaction.editReply({ content: 'Application not found.' });
    }

    if (application.serverId !== interaction.guild.id) {
      return await interaction.editReply({ content: 'Application not found in this server.' });
    }

    const template = await serverDb.getTemplate(application.serverId, application.templateId);
    const embed = createApplicationEmbed(application, template);

    await interaction.editReply({ embeds: [embed] });
  }
};