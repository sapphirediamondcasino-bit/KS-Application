// ==========================================
// FILE: discord/commands/dashboard/applications.js
// ==========================================
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const serverDb = require('../../core/database/servers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Manage bot settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup(group =>
      group
        .setName('applications')
        .setDescription('Manage application system')
        .addSubcommand(sub =>
          sub
            .setName('enable')
            .setDescription('Enable application system')
            .addChannelOption(opt =>
              opt.setName('submission-channel')
                .setDescription('Channel for application submissions')
                .setRequired(true)
            )
            .addChannelOption(opt =>
              opt.setName('review-channel')
                .setDescription('Channel for reviewing applications')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('create-template')
            .setDescription('Create a new application template')
        )
        .addSubcommand(sub =>
          sub
            .setName('list')
            .setDescription('List all application templates')
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'enable') {
      await this.enableApplications(interaction);
    } else if (subcommand === 'create-template') {
      await this.showTemplateCreationModal(interaction);
    } else if (subcommand === 'list') {
      await this.listTemplates(interaction);
    }
  },

  async enableApplications(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const submissionChannel = interaction.options.getChannel('submission-channel');
    const reviewChannel = interaction.options.getChannel('review-channel');

    await serverDb.updateApplicationSettings(interaction.guild.id, {
      enabled: true,
      submissionChannelId: submissionChannel.id,
      reviewChannelId: reviewChannel.id
    });

    await interaction.editReply({
      content: `✅ Application system enabled!\n\n` +
               `📝 Submission Channel: ${submissionChannel}\n` +
               `👀 Review Channel: ${reviewChannel}`
    });
  },

  async showTemplateCreationModal(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('template_create')
      .setTitle('Create Application Template');

    const nameInput = new TextInputBuilder()
      .setCustomId('template_name')
      .setLabel('Template Name')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const descInput = new TextInputBuilder()
      .setCustomId('template_description')
      .setLabel('Description')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(descInput)
    );

    await interaction.showModal(modal);
  },

  async listTemplates(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const templates = await serverDb.getTemplates(interaction.guild.id);

    if (templates.length === 0) {
      return await interaction.editReply({
        content: 'No application templates found. Use `/dashboard applications create-template` to create one.'
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📋 Application Templates')
      .setDescription(
        templates.map((t, i) => 
          `${i + 1}. **${t.name}** ${t.enabled ? '✅' : '❌'}\n` +
          `   Questions: ${t.questions.length} | Cooldown: ${t.cooldownMinutes}min\n` +
          `   ID: \`${t.id}\``
        ).join('\n\n')
      );

    await interaction.editReply({ embeds: [embed] });
  }
};