/**
 * KS Bot - Roblox Dashboard Command
 * 
 * Manage Roblox integration settings through Discord.
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const serverDb = require('../../core/database/servers');
const robloxLinks = require('../../roblox/database/roblox_links');
const verification = require('../../roblox/utils/verification');
const roleSync = require('../../roblox/utils/role_sync');
const robloxAPI = require('../../roblox/utils/roblox_api');
const { createInfoEmbed, createSuccessEmbed, createErrorEmbed, createRobloxLinkEmbed } = require('../../shared/utils/formatter');
const { discord: logger } = require('../../shared/utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Manage bot settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup(group =>
      group
        .setName('roblox')
        .setDescription('Manage Roblox integration')
        .addSubcommand(sub =>
          sub
            .setName('setup')
            .setDescription('Setup Roblox integration')
            .addStringOption(opt =>
              opt
                .setName('group-id')
                .setDescription('Your Roblox group ID')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('verify')
            .setDescription('Verify Roblox group ownership')
        )
        .addSubcommand(sub =>
          sub
            .setName('status')
            .setDescription('View Roblox integration status')
        )
        .addSubcommand(sub =>
          sub
            .setName('addgame')
            .setDescription('Add a game place ID')
            .addStringOption(opt =>
              opt
                .setName('place-id')
                .setDescription('Roblox place ID')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('enable-template')
            .setDescription('Enable a template for in-game use')
            .addStringOption(opt =>
              opt
                .setName('template-id')
                .setDescription('Template ID to enable')
                .setRequired(true)
                .setAutocomplete(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('map-role')
            .setDescription('Map Discord role to Roblox rank')
            .addStringOption(opt =>
              opt
                .setName('template-id')
                .setDescription('Template ID')
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addRoleOption(opt =>
              opt
                .setName('discord-role')
                .setDescription('Discord role to assign')
                .setRequired(true)
            )
            .addIntegerOption(opt =>
              opt
                .setName('roblox-rank')
                .setDescription('Roblox group rank (0-255)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(255)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('sync-test')
            .setDescription('Test Roblox sync connection')
        )
        .addSubcommand(sub =>
          sub
            .setName('analytics')
            .setDescription('View Roblox integration analytics')
        )
        .addSubcommand(sub =>
          sub
            .setName('regenerate-key')
            .setDescription('Regenerate API key')
        )
        .addSubcommand(sub =>
          sub
            .setName('disable')
            .setDescription('Disable Roblox integration')
        )
    ),

  async execute(interaction, client) {
    try {
      const subcommandGroup = interaction.options.getSubcommandGroup();
      const subcommand = interaction.options.getSubcommand();

      if (subcommandGroup === 'roblox') {
        await this.handleRobloxCommands(interaction, subcommand);
      }
    } catch (error) {
      logger.error('Dashboard command error', { 
        guild: interaction.guild?.id, 
        user: interaction.user.id, 
        error: error.message 
      });

      const embed = createErrorEmbed(
        'Command Error',
        'An error occurred while executing this command.'
      );

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [embed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },

  async handleRobloxCommands(interaction, subcommand) {
    const serverId = interaction.guild.id;

    switch (subcommand) {
      case 'setup':
        await this.setupRoblox(interaction, serverId);
        break;
      case 'verify':
        await this.verifyRoblox(interaction, serverId);
        break;
      case 'status':
        await this.statusRoblox(interaction, serverId);
        break;
      case 'addgame':
        await this.addGame(interaction, serverId);
        break;
      case 'enable-template':
        await this.enableTemplate(interaction, serverId);
        break;
      case 'map-role':
        await this.mapRole(interaction, serverId);
        break;
      case 'sync-test':
        await this.syncTest(interaction, serverId);
        break;
      case 'analytics':
        await this.analytics(interaction, serverId);
        break;
      case 'regenerate-key':
        await this.regenerateKey(interaction, serverId);
        break;
      case 'disable':
        await this.disableRoblox(interaction, serverId);
        break;
      default:
        await interaction.reply({ 
          content: 'Unknown subcommand', 
          ephemeral: true 
        });
    }
  },

  async setupRoblox(interaction, serverId) {
    await interaction.deferReply({ ephemeral: true });

    const groupId = interaction.options.getString('group-id');

    // Validate group ID
    if (!/^\d+$/.test(groupId)) {
      const embed = createErrorEmbed(
        'Invalid Group ID',
        'Please provide a valid Roblox group ID (numbers only).'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    // Check if already setup
    const existingLink = await robloxLinks.getLink(serverId);
    if (existingLink) {
      const embed = createErrorEmbed(
        'Already Setup',
        'Roblox integration is already set up for this server. Use `/dashboard roblox disable` first if you want to change groups.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    // Validate group exists
    const groupValidation = await verification.validateGroup(groupId);
    
    if (!groupValidation.valid) {
      const embed = createErrorEmbed(
        'Invalid Group',
        groupValidation.error || 'Failed to validate group.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    // Get server settings
    const serverConfig = await serverDb.getServer(serverId);
    if (!serverConfig) {
      // Create if doesn't exist
      await serverDb.createServer(serverId);
    }

    // Start verification process
    const verif = await verification.startVerification(serverId, groupId, interaction.user.id);

    // Create Roblox link (pending verification)
    const link = await robloxLinks.createLink(serverId, {
      groupId,
      placeIds: []
    });

    // Update server config
    await serverDb.updateRobloxSettings(serverId, {
      enabled: false,
      setupCompleted: false
    });

    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle('🎮 Roblox Integration Setup')
      .setDescription(`**Group:** ${groupValidation.groupInfo.name}\n**ID:** ${groupId}`)
      .addFields(
        {
          name: '📋 Verification Instructions',
          value: verification.getVerificationInstructions(verif)
        },
        {
          name: '🔑 API Key',
          value: `\`\`\`${link.apiKey}\`\`\`\n⚠️ Save this key! It won't be shown again.`
        },
        {
          name: '⏰ Time Limit',
          value: 'You have 10 minutes to complete verification.',
          inline: true
        },
        {
          name: '🔄 Attempts',
          value: `${verif.maxAttempts} attempts remaining`,
          inline: true
        }
      )
      .setFooter({ text: 'Click Verify when you\'ve added the code to your group description' })
      .setTimestamp();

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('roblox_verify')
          .setLabel('Verify')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId('roblox_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );

    await interaction.editReply({ embeds: [embed], components: [row] });

    logger.info('Roblox setup started', { serverId, groupId, userId: interaction.user.id });
  },

  async verifyRoblox(interaction, serverId) {
    await interaction.deferReply({ ephemeral: true });

    const result = await verification.checkVerification(serverId);

    if (!result.success) {
      const embed = createErrorEmbed(
        'Verification Failed',
        result.error || 'Failed to verify group ownership.'
      );
      
      if (result.attemptsRemaining) {
        embed.addFields({
          name: 'Attempts Remaining',
          value: result.attemptsRemaining.toString()
        });
      }

      return await interaction.editReply({ embeds: [embed] });
    }

    // Verification successful - update link and server config
    await robloxLinks.verifyLink(serverId);
    await serverDb.updateRobloxSettings(serverId, {
      enabled: true,
      setupCompleted: true
    });

    const embed = createSuccessEmbed(
      'Verification Complete!',
      '✅ Your Roblox group has been verified successfully!\n\n' +
      '**Next Steps:**\n' +
      '• Use `/dashboard roblox addgame <place-id>` to add your game\n' +
      '• Use `/dashboard roblox enable-template` to enable templates for in-game use\n' +
      '• Use `/dashboard roblox map-role` to set up role synchronization\n' +
      '• Install the Roblox Studio plugin in your game'
    );

    await interaction.editReply({ embeds: [embed] });

    logger.info('Roblox verification completed', { serverId });
  },

  async statusRoblox(interaction, serverId) {
    await interaction.deferReply({ ephemeral: true });

    const link = await robloxLinks.getLink(serverId);

    if (!link) {
      const embed = createInfoEmbed(
        'Not Setup',
        'Roblox integration has not been set up yet.\n\nUse `/dashboard roblox setup` to get started.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    // Get group info
    const groupInfo = await robloxAPI.getGroupInfo(link.groupId);
    
    // Get sync stats
    const syncStats = await roleSync.getQueueStats(serverId);

    const embed = createRobloxLinkEmbed(link);
    
    if (groupInfo) {
      embed.addFields({
        name: '📊 Group Stats',
        value: `Members: ${groupInfo.memberCount?.toLocaleString() || 'Unknown'}\n` +
               `Owner: ${groupInfo.owner?.username || 'Unknown'}`,
        inline: true
      });
    }

    if (syncStats) {
      embed.addFields({
        name: '🔄 Sync Queue',
        value: `Pending: ${syncStats.queued + syncStats.retrying}\n` +
               `Completed: ${syncStats.completed}\n` +
               `Failed: ${syncStats.failed}`,
        inline: true
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },

  async addGame(interaction, serverId) {
    await interaction.deferReply({ ephemeral: true });

    const placeId = interaction.options.getString('place-id');

    // Validate place ID
    if (!/^\d+$/.test(placeId)) {
      const embed = createErrorEmbed(
        'Invalid Place ID',
        'Please provide a valid Roblox place ID (numbers only).'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    const link = await robloxLinks.getLink(serverId);

    if (!link) {
      const embed = createErrorEmbed(
        'Not Setup',
        'Roblox integration is not set up. Use `/dashboard roblox setup` first.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    if (link.placeIds.includes(placeId)) {
      const embed = createErrorEmbed(
        'Already Added',
        'This place ID is already added to your server.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    await robloxLinks.addPlaceId(serverId, placeId);

    const embed = createSuccessEmbed(
      'Game Added',
      `Successfully added place ID \`${placeId}\` to your server.\n\n` +
      `**Total Games:** ${link.placeIds.length + 1}\n\n` +
      `Make sure to add the API key to your game's settings!`
    );

    await interaction.editReply({ embeds: [embed] });

    logger.info('Place ID added', { serverId, placeId });
  },

  async enableTemplate(interaction, serverId) {
    await interaction.deferReply({ ephemeral: true });

    const templateId = interaction.options.getString('template-id');

    const link = await robloxLinks.getLink(serverId);

    if (!link || !link.verified) {
      const embed = createErrorEmbed(
        'Not Setup',
        'Roblox integration is not set up or not verified.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    const template = await serverDb.getTemplate(serverId, templateId);

    if (!template) {
      const embed = createErrorEmbed(
        'Template Not Found',
        'The specified template does not exist.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    if (link.enabledTemplates.includes(templateId)) {
      const embed = createErrorEmbed(
        'Already Enabled',
        'This template is already enabled for in-game use.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    await robloxLinks.enableTemplate(serverId, templateId);

    const embed = createSuccessEmbed(
      'Template Enabled',
      `Template **${template.name}** is now available for in-game submissions!\n\n` +
      `Players can now submit this application from within your Roblox game.`
    );

    await interaction.editReply({ embeds: [embed] });

    logger.info('Template enabled for in-game use', { serverId, templateId });
  },

  async mapRole(interaction, serverId) {
    await interaction.deferReply({ ephemeral: true });

    const templateId = interaction.options.getString('template-id');
    const discordRole = interaction.options.getRole('discord-role');
    const robloxRank = interaction.options.getInteger('roblox-rank');

    const link = await robloxLinks.getLink(serverId);

    if (!link || !link.verified) {
      const embed = createErrorEmbed(
        'Not Setup',
        'Roblox integration is not set up or not verified.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    const template = await serverDb.getTemplate(serverId, templateId);

    if (!template) {
      const embed = createErrorEmbed(
        'Template Not Found',
        'The specified template does not exist.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    // Verify rank exists in group
    const ranks = await roleSync.getAvailableRanks(serverId);
    const targetRank = ranks.find(r => r.rank === robloxRank);

    if (!targetRank) {
      const embed = createErrorEmbed(
        'Invalid Rank',
        `Rank ${robloxRank} does not exist in your Roblox group.\n\n` +
        `Use \`/dashboard roblox sync-test\` to see available ranks.`
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    await robloxLinks.setRoleMapping(serverId, templateId, {
      discordRoleId: discordRole.id,
      robloxRank
    });

    const embed = createSuccessEmbed(
      'Role Mapping Created',
      `Successfully mapped template **${template.name}**:\n\n` +
      `Discord Role: ${discordRole}\n` +
      `Roblox Rank: **${targetRank.name}** (${robloxRank})\n\n` +
      `When applications are approved, users will automatically receive:\n` +
      `• The Discord role\n` +
      `• The Roblox group rank`
    );

    await interaction.editReply({ embeds: [embed] });

    logger.info('Role mapping created', { serverId, templateId, discordRoleId: discordRole.id, robloxRank });
  },

  async syncTest(interaction, serverId) {
    await interaction.deferReply({ ephemeral: true });

    const result = await roleSync.testConnection(serverId);

    if (!result.success) {
      const embed = createErrorEmbed(
        'Connection Test Failed',
        result.error || 'Failed to connect to Roblox API.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    const ranks = await roleSync.getAvailableRanks(serverId);

    const embed = createSuccessEmbed(
      'Connection Test Passed',
      `Successfully connected to Roblox API!\n\n` +
      `**Group:** ${result.groupInfo.name}\n` +
      `**Members:** ${result.groupInfo.memberCount?.toLocaleString()}\n` +
      `**Roles Available:** ${result.roleCount}`
    );

    if (ranks.length > 0) {
      const rankList = ranks.slice(0, 10).map(r => 
        `• **${r.name}** (Rank ${r.rank}) - ${r.memberCount} members`
      ).join('\n');

      embed.addFields({
        name: 'Available Ranks',
        value: rankList + (ranks.length > 10 ? `\n...and ${ranks.length - 10} more` : '')
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },

  async analytics(interaction, serverId) {
    await interaction.deferReply({ ephemeral: true });

    const link = await robloxLinks.getLink(serverId);

    if (!link) {
      const embed = createErrorEmbed(
        'Not Setup',
        'Roblox integration is not set up.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    const syncStats = await roleSync.getQueueStats(serverId);
    const submissionsDb = require('../../roblox/database/submissions');
    const submissionStats = await submissionsDb.getStatistics(serverId, { days: 7 });

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📊 Roblox Integration Analytics')
      .addFields(
        {
          name: '📝 Submissions (Last 7 Days)',
          value: `Total: ${submissionStats.total}\n` +
                 `Successful: ${submissionStats.successful}\n` +
                 `Failed: ${submissionStats.failed}\n` +
                 `Unique Users: ${submissionStats.uniqueUsers}`,
          inline: true
        },
        {
          name: '🔄 Role Syncs (All Time)',
          value: `Total: ${link.analytics.totalSyncs}\n` +
                 `Failed: ${link.analytics.failedSyncs}\n` +
                 `Success Rate: ${link.analytics.totalSyncs > 0 ? 
                   ((link.analytics.totalSyncs - link.analytics.failedSyncs) / link.analytics.totalSyncs * 100).toFixed(1) : 0}%`,
          inline: true
        },
        {
          name: '⏳ Current Queue',
          value: syncStats ? 
                 `Pending: ${syncStats.queued + syncStats.retrying}\n` +
                 `In Progress: ${syncStats.inProgress}\n` +
                 `Completed: ${syncStats.completed}` :
                 'No data available',
          inline: true
        }
      );

    if (submissionStats.byTemplate && Object.keys(submissionStats.byTemplate).length > 0) {
      const templates = await serverDb.getTemplates(serverId);
      const templateStats = Object.entries(submissionStats.byTemplate)
        .slice(0, 5)
        .map(([id, count]) => {
          const template = templates.find(t => t.id === id);
          return `• ${template?.name || 'Unknown'}: ${count}`;
        })
        .join('\n');

      embed.addFields({
        name: '📋 Top Templates',
        value: templateStats || 'No data'
      });
    }

    if (link.analytics.lastSyncAt) {
      embed.setFooter({ 
        text: `Last sync: ${new Date(link.analytics.lastSyncAt).toLocaleString()}` 
      });
    }

    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },

  async regenerateKey(interaction, serverId) {
    await interaction.deferReply({ ephemeral: true });

    const link = await robloxLinks.getLink(serverId);

    if (!link) {
      const embed = createErrorEmbed(
        'Not Setup',
        'Roblox integration is not set up.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    // Confirm action
    const confirmEmbed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle('⚠️ Regenerate API Key')
      .setDescription(
        '**Warning:** This will invalidate your current API key!\n\n' +
        'You will need to update the API key in all your Roblox games.\n\n' +
        'Are you sure you want to continue?'
      );

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('roblox_regenerate_confirm')
          .setLabel('Yes, Regenerate')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('roblox_regenerate_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ embeds: [confirmEmbed], components: [row] });

    // Note: The button handler would be in the interactionCreate event handler
    // For now, we'll just show the confirmation
  },

  async disableRoblox(interaction, serverId) {
    await interaction.deferReply({ ephemeral: true });

    const link = await robloxLinks.getLink(serverId);

    if (!link) {
      const embed = createInfoEmbed(
        'Not Setup',
        'Roblox integration is not currently set up.'
      );
      return await interaction.editReply({ embeds: [embed] });
    }

    // Confirm action
    const confirmEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⚠️ Disable Roblox Integration')
      .setDescription(
        '**Warning:** This will:\n' +
        '• Disable all in-game application submissions\n' +
        '• Cancel pending role syncs\n' +
        '• Remove the Roblox link\n\n' +
        'You can re-enable it later with `/dashboard roblox setup`\n\n' +
        'Are you sure you want to continue?'
      );

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('roblox_disable_confirm')
          .setLabel('Yes, Disable')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('roblox_disable_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ embeds: [confirmEmbed], components: [row] });
  },

  // Autocomplete handler
  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'template-id') {
      const templates = await serverDb.getTemplates(interaction.guild.id);
      
      const choices = templates
        .filter(t => t.enabled)
        .map(t => ({
          name: `${t.name} (${t.questions.length} questions)`,
          value: t.id
        }))
        .slice(0, 25); // Discord limit

      await interaction.respond(choices);
    }
  }
};