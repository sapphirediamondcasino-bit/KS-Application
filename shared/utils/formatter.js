/**
 * Formatting utilities for bot responses
 */

/**
 * Format a date to a readable string
 * @param {Date|string} date - Date to format
 * @returns {string}
 */
function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format a timestamp to relative time (e.g., "2 hours ago")
 * @param {Date|string} date - Date to format
 * @returns {string}
 */
function formatRelativeTime(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

/**
 * Format duration in milliseconds to readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string}
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Format a number with commas
 * @param {number} num - Number to format
 * @returns {string}
 */
function formatNumber(num) {
  return num.toLocaleString('en-US');
}

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string}
 */
function truncate(text, maxLength = 100) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format status with emoji
 * @param {string} status - Status string
 * @returns {string}
 */
function formatStatus(status) {
  const statusMap = {
    pending: '🟡 Pending',
    approved: '✅ Approved',
    denied: '❌ Denied',
    cancelled: '⚫ Cancelled',
    open: '🟢 Open',
    closed: '🔴 Closed',
    locked: '🔒 Locked',
    archived: '📦 Archived'
  };
  
  return statusMap[status.toLowerCase()] || status;
}

/**
 * Format priority with emoji
 * @param {string} priority - Priority string
 * @returns {string}
 */
function formatPriority(priority) {
  const priorityMap = {
    low: '🟢 Low',
    medium: '🟡 Medium',
    high: '🟠 High',
    urgent: '🔴 Urgent'
  };
  
  return priorityMap[priority.toLowerCase()] || priority;
}

/**
 * Format a list with bullet points
 * @param {Array<string>} items - Items to format
 * @returns {string}
 */
function formatList(items) {
  return items.map(item => `• ${item}`).join('\n');
}

/**
 * Format boolean as Yes/No
 * @param {boolean} value - Boolean value
 * @returns {string}
 */
function formatBoolean(value) {
  return value ? '✅ Yes' : '❌ No';
}

/**
 * Format user mention
 * @param {string} userId - User ID
 * @returns {string}
 */
function formatUserMention(userId) {
  return `<@${userId}>`;
}

/**
 * Format role mention
 * @param {string} roleId - Role ID
 * @returns {string}
 */
function formatRoleMention(roleId) {
  return `<@&${roleId}>`;
}

/**
 * Format channel mention
 * @param {string} channelId - Channel ID
 * @returns {string}
 */
function formatChannelMention(channelId) {
  return `<#${channelId}>`;
}

/**
 * Pluralize a word based on count
 * @param {number} count - Count
 * @param {string} singular - Singular form
 * @param {string} plural - Plural form (optional)
 * @returns {string}
 */
function pluralize(count, singular, plural = null) {
  if (count === 1) return singular;
  return plural || `${singular}s`;
}

/**
 * Format percentage
 * @param {number} value - Value
 * @param {number} total - Total
 * @param {number} decimals - Decimal places
 * @returns {string}
 */
function formatPercentage(value, total, decimals = 1) {
  if (total === 0) return '0%';
  const percent = (value / total) * 100;
  return `${percent.toFixed(decimals)}%`;
}

module.exports = {
  formatDate,
  formatRelativeTime,
  formatDuration,
  formatNumber,
  truncate,
  formatStatus,
  formatPriority,
  formatList,
  formatBoolean,
  formatUserMention,
  formatRoleMention,
  formatChannelMention,
  pluralize,
  formatPercentage
};