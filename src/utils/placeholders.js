export async function parsePlaceholders(text, member) {
      if (!text || typeof text !== 'string') return text;
        let result = text;
          if (member) {
                if (member.user) {
                          result = result.replace(/{user}/g, `<@${member.id}>`).replace(/{user_name}/g, member.user.username || '');
                                // account_age = days since Discord account creation
                                const ageDays = Math.floor((Date.now() - member.user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
                                      result = result.replace(/{account_age}/g, ageDays.toString());
                }
                    const guild = member.guild;
                        if (guild) {
                                  result = result.replace(/{server}/g, guild.name).replace(/{member_count}/g, guild.memberCount.toString());
                                        try {
                                                    // calculate join position accurately by fetching all members if cache is partial
                                                    // use only cached members to avoid hitting rate limits
                                                    const membersArray = Array.from(guild.members.cache.values());
                                                    membersArray.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
                                                    const joinPos = membersArray.findIndex(m => m.id === member.id) + 1;
                                                                    result = result.replace(/{join_pos}/g, joinPos > 0 ? joinPos.toString() : 'Unknown');
                                        } catch {
                                            result = result.replace(/{join_pos}/g, 'Unknown');
                                        }
                        }
                // joined_at formatted placeholder DD/MM/YYYY - HH:mm
                if (member.joinedAt) {
                    const d = member.joinedAt;
                    const pad = n => String(n).padStart(2, '0');
                    const formatted = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} - ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    result = result.replace(/{joined_at}/g, formatted);
                }
          }
            return result;
}
