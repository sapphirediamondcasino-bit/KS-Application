const { EmbedBuilder } = require('discord.js');
const { formatRelativeTime, snakeToTitle } = require('../../shared/utils/formatter');
const { COLORS, EMOJIS } = require('../../shared/constants');

/**
 * Create Roblox link status embed
 * @param {Object} link - Roblox link data
 * @returns {EmbedBuilder}
 */
function createRobloxLinkEmbed(link) {
  const statusColors = {
    verified: COLORS.SUCCESS,
    pending_verification: COLORS.WARNING,
    verification_failed: COLORS.ERROR,
    suspended: COLORS.ERROR
  };

  const statusEmojis = {
    verified: EMOJIS.SUCCESS,
    pending_verification: EMOJIS.PENDING,
    verification_failed: EMOJIS.ERROR,
    suspended: EMOJIS.LOCK
  };

  const embed = new EmbedBuilder()
    .setColor(statusColors[link.status] || COLORS.NEUTRAL)
    .setTitle(`${EMOJIS.ROBLOX} Roblox Integration`)
    .addFields(
      {
        name: 'Group ID',
        value: link.groupId,
        inline: true
      },
      {
        name: 'Status',
        value: `${statusEmojis[link.status]} ${snakeToTitle(link.status)}`,
        inline: true
      },
      {
        name: 'Linked Games',
        value: link.placeIds.length.toString(),
        inline: true
      }
    );

  if (link.verified) {
    embed.addFields({
      name: 'Verified At',
      value: formatRelativeTime(link.verifiedAt),
      inline: true
    });
  }

  if (link.enabledTemplates && link.enabledTemplates.length > 0) {
    embed.addFields({
      name: `Enabled Templates (${link.enabledTemplates.length})`,
      value: link.enabledTemplates.map(t => `• ${t}`).join('\n').substring(0, 1024) || 'None',
      inline: false
    });
  }

  if (link.roleMappings && Object.keys(link.roleMappings).length > 0) {
    const mappings = Object.entries(link.roleMappings)
      .slice(0, 5)
      .map(([template, mapping]) => 
        `• ${template}: <@&${mapping.discordRoleId}> → Rank ${mapping.robloxRank}`
      )
      .join('\n');

    const remaining = Object.keys(link.roleMappings).length - 5;

    embed.addFields({
      name: `Role Mappings (${Object.keys(link.roleMappings).length})`,
      value: (mappings + (remaining > 0 ? `\n...and ${remaining} more` : '')).substring(0, 1024),
      inline: false
    });
  }

  embed.setFooter({ text: `API Key: ${link.apiKey ? link.apiKey.substring(0, 20) + '...' : 'Not set'}` });
  embed.setTimestamp();

  return embed;
}

/**
 * Create Roblox sync status embed
 * @param {Object} syncData - Sync status data
 * @returns {EmbedBuilder}
 */
function createRobloxSyncEmbed(syncData) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`${EMOJIS.ROBLOX} Role Sync Status`)
    .addFields(
      {
        name: 'Pending Syncs',
        value: syncData.pendingCount?.toString() || '0',
        inline: true
      },
      {
        name: 'Total Jobs',
        value: syncData.totalJobs?.toString() || '0',
        inline: true
      }
    );

  if (syncData.jobs && syncData.jobs.length > 0) {
    const jobsList = syncData.jobs.slice(0, 5).map(job => {
      return `• Rank ${job.newRank} - ${job.status}`;
    }).join('\n');

    embed.addFields({
      name: 'Recent Jobs',
      value: jobsList || 'None',
      inline: false
    });
  }

  embed.setTimestamp();

  return embed;
}

module.exports = {
  createRobloxLinkEmbed,
  createRobloxSyncEmbed
};