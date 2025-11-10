/**
 * KS Bot - Application Handler
 * 
 * Handles application submission, review, and notifications.
 */

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const serverDb = require('../../core/database/servers');
const applicationsDb = require('../../core/database/applications');
const { createApplicationEmbed } = require('../embeds/application_embeds');
const { formatApplicationResponses } = require('../../shared/utils/formatter');
const { discord: logger } = require('../../shared/utils/logger');
const { APPLICATION_SOURCE, APPLICATION_STATUS } = require('../../shared/constants');

class ApplicationHandler {
  /**
   * Show application modal to user
   * @param {Interaction} interaction - Button interaction
   * @param {string} templateId - Template ID
   */
  async showApplicationModal(interaction, templateId) {
    try {
      const serverId = interaction.guild.id;
      const template = await serverDb.getTemplate(serverId, templateId);

      if (!template) {
        return await interaction.reply({
          content: 'Application template not found.',
          ephemeral: true
        });
      }

      if (!template.enabled) {
        return await interaction.reply({
          content: 'This application is currently disabled.',
          ephemeral: true
        });
      }

      // Check cooldown
      const cooldown = await applicationsDb.checkCooldown(
        serverId,
        interaction.user.id,
        templateId,
        template.cooldownMinutes || 60
      );

      if (cooldown.onCooldown) {
        return await interaction.reply({
          content: `You must wait ${cooldown.remainingTime} minutes before submitting another application for this template.`,
          ephemeral: true
        });
      }

      // Check for pending application
      const hasPending = await applicationsDb.hasPendingApplication(
        serverId,
        interaction.user.id,
        templateId
      );

      if (hasPending) {
        return await interaction.reply({
          content: 'You already have a pending application for this template.',
          ephemeral: true
        });
      }

      // Create modal (Discord modals support up to 5 components)
      const modal = new ModalBuilder()
        .setCustomId(`application_submit_${templateId}`)
        .setTitle(template.name.substring(0, 45)); // Title limit

      // Add first 5 questions to modal
      const questionsToShow = template.questions.slice(0, 5);

      for (let i = 0; i < questionsToShow.length; i++) {
        const question = questionsToShow[i];
        
        const textInput = new TextInputBuilder()
          .setCustomId(`question_${question.id}`)
          .setLabel(question.question.substring(0, 45))
          .setStyle(
            question.type === 'long_text' 
              ? TextInputStyle.Paragraph 
              : TextInputStyle.Short
          )
          .setRequired(question.required !== false)
          .setMaxLength(question.validation?.maxLength || 1024);

        if (question.placeholder) {
          textInput.setPlaceholder(question.placeholder.substring(0, 100));
        }

        const row = new ActionRowBuilder().addComponents(textInput);
        modal.addComponents(row);
      }

      await interaction.showModal(modal);

    } catch (error) {
      logger.error('Failed to show application modal', { 
        guildId: interaction.guild?.id, 
        templateId, 
        error: error.message 
      });
      
      if (!interaction.replied) {
        await interaction.reply({
          content: 'Failed to open application form.',
          ephemeral: true
        });
      }
    }
  }

  /**
   * Handle application modal submission
   * @param {Interaction} interaction - Modal submit interaction
   */
  async handleModalSubmit(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const serverId = interaction.guild.id;
      const templateId = interaction.customId.split('_')[2];

      const template = await serverDb.getTemplate(serverId, templateId);

      if (!template) {
        return await interaction.editReply({
          content: 'Application template not found.'
        });
      }

      // Extract responses from modal
      const responses = {};
      
      for (const question of template.questions.slice(0, 5)) {
        const response = interaction.fields.getTextInputValue(`question_${question.id}`);
        responses[question.id] = response;
      }

      // If there are more than 5 questions, we'd need a follow-up system
      // For now, we'll handle the first 5

      // Create application
      const application = await applicationsDb.createApplication({
        serverId,
        userId: interaction.user.id,
        templateId,
        templateName: template.name,
        source: APPLICATION_SOURCE.DISCORD,
        responses,
        userTag: interaction.user.tag,
        channelId: interaction.channel?.id
      });

      // Update analytics
      await serverDb.incrementAnalytics(serverId, 'totalApplications');

      // Send confirmation to user
      await interaction.editReply({
        content: `✅ Your application for **${template.name}** has been submitted!\n\nApplication ID: \`${application.id}\`\n\nYou will be notified when it is reviewed.`
      });

      // Post to review channel
      await this.postToReviewChannel(interaction.guild, application, template);

      logger.application('submit', application.id, interaction.user.id, serverId);

    } catch (error) {
      logger.error('Failed to handle modal submit', { 
        guildId: interaction.guild?.id, 
        error: error.message 
      });
      
      await interaction.editReply({
        content: 'Failed to submit application. Please try again.'
      });
    }
  }

  /**
   * Post application to review channel
   * @param {Guild} guild - Discord guild
   * @param {Object} application - Application data
   * @param {Object} template - Template data
   */
  async postToReviewChannel(guild, application, template) {
    try {
      const serverConfig = await serverDb.getServer(guild.id);
      
      if (!serverConfig.applications.reviewChannelId) {
        return;
      }

      const channel = await guild.channels.fetch(serverConfig.applications.reviewChannelId);
      
      if (!channel) {
        return;
      }

      const embed = createApplicationEmbed(application, template);

      const row = new ActionRowBuilder()
        .addComponents(
          {
            type: 2,
            style: 3,
            label: 'Approve',
            custom_id: `app_approve_${application.id}`,
            emoji: '✅'
          },
          {
            type: 2,
            style: 4,
            label: 'Deny',
            custom_id: `app_deny_${application.id}`,
            emoji: '❌'
          },
          {
            type: 2,
            style: 1,
            label: 'View Details',
            custom_id: `app_view_${application.id}`,
            emoji: '📄'
          }
        );

      await channel.send({ embeds: [embed], components: [row] });

    } catch (error) {
      logger.error('Failed to post to review channel', { 
        applicationId: application.id, 
        error: error.message 
      });
    }
  }

  /**
   * Approve application
   * @param {Interaction} interaction - Button interaction
   * @param {string} applicationId - Application ID
   * @param {string} reason - Approval reason (optional)
   */
  async approveApplication(interaction, applicationId, reason = null) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const application = await applicationsDb.getApplication(applicationId);

      if (!application) {
        return await interaction.editReply({
          content: 'Application not found.'
        });
      }

      if (application.status !== APPLICATION_STATUS.PENDING) {
        return await interaction.editReply({
          content: `This application has already been ${application.status}.`
        });
      }

      // Approve
      await applicationsDb.approveApplication(
        applicationId,
        interaction.user.id,
        reason
      );

      // Assign role if configured
      await this.assignApplicationRole(interaction.guild, application);

      // Send DM to applicant
      await this.notifyApplicant(interaction.guild, application, true, reason);

      // Sync Roblox role if applicable
      if (application.source === APPLICATION_SOURCE.ROBLOX) {
        const roleSync = require('../../roblox/utils/role_sync');
        await roleSync.syncFromApplication(application, interaction.client);
      }

      await interaction.editReply({
        content: `✅ Application approved successfully!`
      });

      // Update review message
      if (interaction.message) {
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x00ff00)
          .addFields({
            name: '✅ Approved',
            value: `By: <@${interaction.user.id}>\nAt: <t:${Math.floor(Date.now() / 1000)}:R>`
          });

        await interaction.message.edit({ 
          embeds: [updatedEmbed], 
          components: [] 
        });
      }

      logger.application('approve', applicationId, interaction.user.id, application.serverId);

    } catch (error) {
      logger.error('Failed to approve application', { 
        applicationId, 
        error: error.message 
      });
      
      await interaction.editReply({
        content: 'Failed to approve application.'
      });
    }
  }

  /**
   * Deny application
   * @param {Interaction} interaction - Button interaction
   * @param {string} applicationId - Application ID
   * @param {string} reason - Denial reason
   */
  async denyApplication(interaction, applicationId, reason) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const application = await applicationsDb.getApplication(applicationId);

      if (!application) {
        return await interaction.editReply({
          content: 'Application not found.'
        });
      }

      if (application.status !== APPLICATION_STATUS.PENDING) {
        return await interaction.editReply({
          content: `This application has already been ${application.status}.`
        });
      }

      // Deny
      await applicationsDb.denyApplication(
        applicationId,
        interaction.user.id,
        reason
      );

      // Send DM to applicant
      await this.notifyApplicant(interaction.guild, application, false, reason);

      await interaction.editReply({
        content: `❌ Application denied.`
      });

      // Update review message
      if (interaction.message) {
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0xff0000)
          .addFields({
            name: '❌ Denied',
            value: `By: <@${interaction.user.id}>\nReason: ${reason}\nAt: <t:${Math.floor(Date.now() / 1000)}:R>`
          });

        await interaction.message.edit({ 
          embeds: [updatedEmbed], 
          components: [] 
        });
      }

      logger.application('deny', applicationId, interaction.user.id, application.serverId);

    } catch (error) {
      logger.error('Failed to deny application', { 
        applicationId, 
        error: error.message 
      });
      
      await interaction.editReply({
        content: 'Failed to deny application.'
      });
    }
  }

  /**
   * Assign role to approved applicant
   * @param {Guild} guild - Discord guild
   * @param {Object} application - Application data
   */
  async assignApplicationRole(guild, application) {
    try {
      const template = await serverDb.getTemplate(application.serverId, application.templateId);
      
      if (!template.roleId) {
        return;
      }

      const member = await guild.members.fetch(application.userId);
      const role = await guild.roles.fetch(template.roleId);

      if (member && role) {
        await member.roles.add(role);
        logger.info('Role assigned', { 
          userId: application.userId, 
          roleId: template.roleId 
        });
      }
    } catch (error) {
      logger.error('Failed to assign role', { 
        applicationId: application.id, 
        error: error.message 
      });
    }
  }

  /**
   * Notify applicant of decision
   * @param {Guild} guild - Discord guild
   * @param {Object} application - Application data
   * @param {boolean} approved - Whether approved
   * @param {string} reason - Reason for decision
   */
  async notifyApplicant(guild, application, approved, reason) {
    try {
      const serverConfig = await serverDb.getServer(application.serverId);
      
      if (!serverConfig.applications.dmApplicants) {
        return;
      }

      const user = await guild.client.users.fetch(application.userId);

      if (!user) {
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(approved ? 0x00ff00 : 0xff0000)
        .setTitle(`Application ${approved ? 'Approved' : 'Denied'}`)
        .setDescription(`Your application for **${application.templateName}** in **${guild.name}** has been ${approved ? 'approved' : 'denied'}.`)
        .addFields({
          name: 'Application ID',
          value: application.id,
          inline: true
        })
        .setTimestamp();

      if (reason) {
        embed.addFields({
          name: approved ? 'Note' : 'Reason',
          value: reason
        });
      }

      await user.send({ embeds: [embed] }).catch(() => {
        logger.warn('Could not DM user', { userId: application.userId });
      });

    } catch (error) {
      logger.error('Failed to notify applicant', { 
        applicationId: application.id, 
        error: error.message 
      });
    }
  }
}

module.exports = new ApplicationHandler();