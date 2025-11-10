const { EmbedBuilder } = require('discord.js');
const { formatRelativeTime, snakeToTitle, truncate } = require('../../shared/utils/formatter');
const { COLORS, EMOJIS } = require('../../shared/constants');

/**
 * Create application embed
 * @param {Object} application - Application data
 * @param {Object} template - Template data (optional)
 * @returns {EmbedBuilder}
 */
function createApplicationEmbed(application, template = null) {
  const statusColors = {
    pending: COLORS.PENDING,
    approved: COLORS.APPROVED,
    denied: COLORS.DENIED,
    under_review: COLORS.WARNING
  };

  const statusEmojis = {
    pending: EMOJIS.PENDING,
    approved: EMOJIS.SUCCESS,
    denied: EMOJIS.ERROR,
    under_review: EMOJIS.LOADING
  };

  const embed = new EmbedBuilder()
    .setColor(statusColors[application.status] || COLORS.NEUTRAL)
    .setTitle(`${EMOJIS.APPLICATION} Application: ${application.templateName}`)
    .addFields(
      {
        name: 'Status',
        value: `${statusEmojis[application.status]} ${snakeToTitle(application.status)}`,
        inline: true
      },
      {
        name: 'Applicant',
        value: `<@${application.userId}>`,
        inline: true
      },
      {
        name: 'Submitted',
        value: formatRelativeTime(application.submittedAt),
        inline: true
      }
    );

  if (application.source === 'roblox') {
    embed.addFields({
      name: 'Source',
      value: `${EMOJIS.ROBLOX} Roblox\nUser ID: ${application.robloxUserId}\nUsername: ${application.robloxUsername}`,
      inline: false
    });
  }

  // Add responses if template provided
  if (template && template.questions) {
    template.questions.slice(0, 5).forEach(question => {
      const answer = application.responses[question.id] || 'No response';
      embed.addFields({
        name: truncate(question.question, 100),
        value: truncate(answer, 1024),
        inline: false
      });
    });
  }

  if (application.reviewedBy) {
    embed.addFields(
      {
        name: 'Reviewed By',
        value: `<@${application.reviewedBy}>`,
        inline: true
      },
      {
        name: 'Reviewed At',
        value: formatRelativeTime(application.reviewedAt),
        inline: true
      }
    );
  }

  if (application.reason) {
    embed.addFields({
      name: application.status === 'approved' ? 'Note' : 'Reason',
      value: truncate(application.reason, 500),
      inline: false
    });
  }

  embed.setFooter({ text: `Application ID: ${application.id}` });
  embed.setTimestamp(new Date(application.submittedAt));

  return embed;
}

/**
 * Create application submission button embed
 * @param {Object} template - Template data
 * @param {string} customImage - Custom server emblem/image URL (optional)
 * @returns {EmbedBuilder}
 */
function createApplicationButtonEmbed(template, customImage = null) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${EMOJIS.APPLICATION} ${template.name}`)
    .setDescription(template.description || 'Click the button below to apply.');

  if (template.questions && template.questions.length > 0) {
    embed.addFields({
      name: 'Questions',
      value: `${template.questions.length} question${template.questions.length !== 1 ? 's' : ''}`,
      inline: true
    });
  }

  if (template.cooldownMinutes) {
    embed.addFields({
      name: 'Cooldown',
      value: `${template.cooldownMinutes} minutes`,
      inline: true
    });
  }

  // Add custom server image/emblem if provided
  if (customImage) {
    embed.setImage(customImage);
  } else if (template.customImage) {
    embed.setImage(template.customImage);
  }

  // Add thumbnail for department/role icon if configured
  if (template.thumbnailUrl) {
    embed.setThumbnail(template.thumbnailUrl);
  }

  return embed;
}

/**
 * Create application list embed
 * @param {Array} applications - Array of applications
 * @param {string} title - Embed title
 * @returns {EmbedBuilder}
 */
function createApplicationListEmbed(applications, title = 'Applications') {
  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`${EMOJIS.APPLICATION} ${title}`)
    .setTimestamp();

  if (applications.length === 0) {
    embed.setDescription('No applications found.');
    return embed;
  }

  const description = applications.slice(0, 10).map((app, i) => {
    const statusEmoji = {
      pending: EMOJIS.PENDING,
      approved: EMOJIS.SUCCESS,
      denied: EMOJIS.ERROR
    }[app.status] || '•';

    return `${statusEmoji} **${app.templateName}**\n` +
           `   Applicant: <@${app.userId}>\n` +
           `   Status: ${snakeToTitle(app.status)}\n` +
           `   ID: \`${app.id}\``;
  }).join('\n\n');

  embed.setDescription(description);

  if (applications.length > 10) {
    embed.setFooter({ text: `Showing 10 of ${applications.length} applications` });
  }

  return embed;
}

module.exports = {
  createApplicationEmbed,
  createApplicationButtonEmbed,
  createApplicationListEmbed
};