// ==========================================
// FILE: discord/commands/application/deny.js
// ==========================================
const { SlashCommandBuilder } = require('discord.js');
const applicationHandler = require('../../handlers/application_handler');
const permissionHandler = require('../../handlers/permission_handler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('application')
    .setDescription('Application management')
    .addSubcommand(sub =>
      sub
        .setName('deny')
        .setDescription('Deny an application')
        .addStringOption(opt =>
          opt.setName('id')
            .setDescription('Application ID')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('reason')
            .setDescription('Denial reason')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const canReview = await permissionHandler.canReviewApplications(interaction.member);

    if (!canReview) {
      return await interaction.reply(permissionHandler.createPermissionError('review applications', 'staff'));
    }

    const applicationId = interaction.options.getString('id');
    const reason = interaction.options.getString('reason');

    await applicationHandler.denyApplication(interaction, applicationId, reason);
  }
};