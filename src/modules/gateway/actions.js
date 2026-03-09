import { parseColor } from '../../utils/parseColor.js';
import { render as renderEmbed } from '../../core/embedEngine.js';
import { parsePlaceholders } from '../../utils/placeholders.js';

export async function createEmbed(config, overrideMessage = '', pageKey = '', member = null, customData = null) {
      const isDynamic = pageKey === 'success' && overrideMessage.includes('{');
        let template = config[`${pageKey}UI`] || {};
          const data = await renderEmbed(template, member);
            
              if (overrideMessage) {
                    data.description = member ? await parsePlaceholders(overrideMessage, member) : overrideMessage;
              }
                if (pageKey === 'success' && member?.user) {
                        data.thumbnail = { url: member.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: false }) };
                }
                  return data;
}

export async function verifyMember(member, config, method) {
      if (!member.roles.cache.has(config.unverifiedRole)) {
            return { success: false, message: config.alreadyVerifiedMsg || 'Already Verified!', alreadyVerified: true };
      }
        try {
                await member.roles.add(config.verifiedRole);
                    await member.roles.remove(config.unverifiedRole);
                        return { success: true, alreadyVerified: false };
        } catch (err) {
                return { success: false, message: 'Role error.' };
        }
}
