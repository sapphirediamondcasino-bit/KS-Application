// ==========================================
// FILE: discord/commands/ticket/setup.js
// ==========================================
const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const serverDb = require('../../core/database/servers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system management')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Setup ticket system')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel for ticket creation button')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('category')
            .setDescription('Category for ticket channels')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('support-role')
            .setDescription('Support role')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('channel');
    const category = interaction.options.getChannel('category');
    const supportRole = interaction.options.getRole('support-role');

    // Update server config
    await serverDb.updateTicketSettings(interaction.guild.id, {
      enabled: true,
      createChannelId: channel.id,
      categoryId: category.id,
      supportRoleIds: [supportRole.id]
    });

    // Create ticket creation button
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🎫 Support Tickets')
      .setDescription(
        'Need help? Create a support ticket!\n\n' +
        'Click the button below to open a new ticket.\n' +
        'Our support team will assist you as soon as possible.'
      )
      .addFields({
        name: 'How it works',
        value: '1. Click "Create Ticket"\n2. Describe your issue\n3. Wait for support team response'
      })
      .setFooter({ text: 'Tickets are private between you and staff' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_create')
          .setLabel('Create Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫')
      );

    await channel.send({ embeds: [embed], components: [row] });

    await interaction.editReply({
      content: `✅ Ticket system configured!\n\n` +
               `📝 Create Channel: ${channel}\n` +
               `📁 Category: ${category}\n` +
               `👥 Support Role: ${supportRole}`
    });
  }
};