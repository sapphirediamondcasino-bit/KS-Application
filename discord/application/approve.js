// ==========================================
// FILE: discord/commands/application/approve.js
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
        .setName('approve')
        .setDescription('Approve an application')
        .addStringOption(opt =>
          opt.setName('id')
            .setDescription('Application ID')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('reason')
            .setDescription('Approval reason (optional)')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const canReview = await permissionHandler.canReviewApplications(interaction.member);

    if (!canReview) {
      return await interaction.reply(permissionHandler.createPermissionError('review applications', 'staff'));
    }

    const applicationId = interaction.options.getString('id');
    const reason = interaction.options.getString('reason');

    await applicationHandler.approveApplication(interaction, applicationId, reason);
  }
};