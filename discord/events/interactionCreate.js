// ==========================================
// FILE: discord/events/interactionCreate.js
// ==========================================
const applicationHandler = require('../handlers/application_handler');
const ticketHandler = require('../handlers/ticket_handler');
const serverDb = require('../../core/database/servers');
const robloxLinks = require('../../roblox/database/roblox_links');
const verification = require('../../roblox/utils/verification');
const { discord: logger } = require('../../shared/utils/logger');

module.exports = {
  name: 'interactionCreate',
  
  async execute(interaction, client) {
    try {
      // Handle button interactions
      if (interaction.isButton()) {
        await handleButton(interaction);
      }
      
      // Handle modal submissions
      if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
      }
      
      // Handle autocomplete
      if (interaction.isAutocomplete()) {
        await handleAutocomplete(interaction);
      }

    } catch (error) {
      logger.error('Error in interactionCreate', {
        type: interaction.type,
        customId: interaction.customId,
        error: error.message
      });
    }
  }
};

async function handleButton(interaction) {
  const [action, subaction, id] = interaction.customId.split('_');

  // Application buttons
  if (action === 'application' || action === 'app') {
    if (subaction === 'apply' || subaction === 'submit') {
      await applicationHandler.showApplicationModal(interaction, id);
    } else if (subaction === 'approve') {
      await applicationHandler.approveApplication(interaction, id);
    } else if (subaction === 'deny') {
      // Show modal for denial reason
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
      
      const modal = new ModalBuilder()
        .setCustomId(`app_deny_reason_${id}`)
        .setTitle('Deny Application');

      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Reason for denial')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500);

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      await interaction.showModal(modal);
    } else if (subaction === 'view') {
      // View application details
      const applicationsDb = require('../../core/database/applications');
      const application = await applicationsDb.getApplication(id);
      
      if (application) {
        const template = await serverDb.getTemplate(application.serverId, application.templateId);
        const { createApplicationEmbed } = require('../embeds/application_embeds');
        const embed = createApplicationEmbed(application, template);
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  }

  // Ticket buttons
  if (action === 'ticket') {
    if (subaction === 'create') {
      // Show ticket creation modal
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
      
      const modal = new ModalBuilder()
        .setCustomId('ticket_create_modal')
        .setTitle('Create Support Ticket');

      const subjectInput = new TextInputBuilder()
        .setCustomId('subject')
        .setLabel('Subject')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(subjectInput),
        new ActionRowBuilder().addComponents(descInput)
      );

      await interaction.showModal(modal);
    } else if (subaction === 'close') {
      await ticketHandler.closeTicket(interaction, id);
    } else if (subaction === 'claim') {
      const ticketsDb = require('../../core/database/tickets');
      await ticketsDb.assignTicket(id, interaction.user.id);
      await interaction.reply({
        content: `✅ ${interaction.user} has claimed this ticket.`,
        ephemeral: false
      });
    }
  }

  // Roblox buttons
  if (action === 'roblox') {
    if (subaction === 'verify') {
      const result = await verification.checkVerification(interaction.guild.id);
      
      if (result.success) {
        await robloxLinks.verifyLink(interaction.guild.id);
        await serverDb.updateRobloxSettings(interaction.guild.id, {
          enabled: true,
          setupCompleted: true
        });
        
        await interaction.update({
          content: '✅ Verification successful! Roblox integration is now active.',
          components: []
        });
      } else {
        await interaction.reply({
          content: `❌ Verification failed: ${result.error}`,
          ephemeral: true
        });
      }
    } else if (subaction === 'cancel') {
      await verification.cancelVerification(interaction.guild.id);
      await interaction.update({
        content: '❌ Verification cancelled.',
        components: []
      });
    } else if (subaction === 'regenerate' && id === 'confirm') {
      const newLink = await robloxLinks.regenerateApiKey(interaction.guild.id);
      await interaction.update({
        content: `✅ API Key regenerated!\n\n**New Key:**\n\`\`\`${newLink.apiKey}\`\`\`\n⚠️ Save this key! It won't be shown again.`,
        components: []
      });
    } else if (subaction === 'disable' && id === 'confirm') {
      await robloxLinks.deleteLink(interaction.guild.id);
      await serverDb.updateRobloxSettings(interaction.guild.id, {
        enabled: false,
        setupCompleted: false
      });
      await interaction.update({
        content: '✅ Roblox integration disabled.',
        components: []
      });
    } else if ((subaction === 'regenerate' || subaction === 'disable') && id === 'cancel') {
      await interaction.update({
        content: 'Action cancelled.',
        components: []
      });
    }
  }
}

async function handleModalSubmit(interaction) {
  const [action, subaction, id] = interaction.customId.split('_');

  // Application modal submissions
  if (action === 'application' && subaction === 'submit') {
    await applicationHandler.handleModalSubmit(interaction);
  }

  // Application denial reason
  if (action === 'app' && subaction === 'deny' && id === 'reason') {
    const applicationId = interaction.customId.split('_')[3];
    const reason = interaction.fields.getTextInputValue('reason');
    await applicationHandler.denyApplication(interaction, applicationId, reason);
  }

  // Ticket creation
  if (action === 'ticket' && subaction === 'create' && id === 'modal') {
    const subject = interaction.fields.getTextInputValue('subject');
    const description = interaction.fields.getTextInputValue('description');
    await ticketHandler.createTicket(interaction, subject, description);
  }

  // Template creation
  if (action === 'template' && subaction === 'create') {
    const name = interaction.fields.getTextInputValue('template_name');
    const description = interaction.fields.getTextInputValue('template_description');

    await interaction.deferReply({ ephemeral: true });

    const template = {
      name,
      description,
      questions: [], // Would need to be added later
      enabled: false
    };

    await serverDb.addTemplate(interaction.guild.id, template);

    await interaction.editReply({
      content: `✅ Template "${name}" created!\n\nUse the dashboard to add questions to this template.`
    });
  }
}

async function handleAutocomplete(interaction) {
  const focusedOption = interaction.options.getFocused(true);

  // Template ID autocomplete
  if (focusedOption.name === 'template-id') {
    const templates = await serverDb.getTemplates(interaction.guild.id);
    
    const choices = templates
      .filter(t => t.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
      .map(t => ({
        name: `${t.name} (${t.questions.length} questions)`,
        value: t.id
      }))
      .slice(0, 25);

    await interaction.respond(choices);
  }

  // Application ID autocomplete
  if (focusedOption.name === 'application-id' || focusedOption.name === 'id') {
    const applicationsDb = require('../../core/database/applications');
    const applications = await applicationsDb.getServerApplications(interaction.guild.id);
    
    const choices = applications
      .filter(app => app.id.includes(focusedOption.value) || app.templateName.toLowerCase().includes(focusedOption.value.toLowerCase()))
      .slice(0, 25)
      .map(app => ({
        name: `${app.templateName} - ${app.status} - ${app.id.substring(0, 8)}`,
        value: app.id
      }));

    await interaction.respond(choices);
  }
}
