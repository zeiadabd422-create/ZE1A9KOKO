/**
 * Placeholder Parser - Replaces tokens in text with actual values
 * Supported tokens: {user}, {server}, {member_count}
 */

export function parsePlaceholders(text, member, guild) {
  if (!text || typeof text !== 'string') return text;

  let result = text;

  // {user} -> member mention
  if (member && member.user) {
    result = result.replace(/{user}/g, `<@${member.id}>`);
  }

  // {server} -> guild name
  if (guild && guild.name) {
    result = result.replace(/{server}/g, guild.name);
  }

  // {member_count} -> guild member count
  if (guild && guild.memberCount) {
    result = result.replace(/{member_count}/g, guild.memberCount.toString());
  }

  return result;
}
