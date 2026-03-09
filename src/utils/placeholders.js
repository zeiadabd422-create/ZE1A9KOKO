export async function parsePlaceholders(text, member) {
      if (!text || typeof text !== 'string') return text;
        let result = text;
          if (member) {
                if (member.user) {
                          result = result.replace(/{user}/g, `<@${member.id}>`).replace(/{user_name}/g, member.user.username || '');
                                const ageDays = Math.floor((Date.now() - member.user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
                                      result = result.replace(/{account_age}/g, ageDays.toString());
                }
                    const guild = member.guild;
                        if (guild) {
                                  result = result.replace(/{server}/g, guild.name).replace(/{member_count}/g, guild.memberCount.toString());
                                        try {
                                                    const members = Array.from(guild.members.cache.values()).sort((a, b) => a.joinedAt - b.joinedAt);
                                                            const joinPos = members.findIndex(m => m.id === member.id) + 1;
                                                                    result = result.replace(/{join_pos}/g, joinPos.toString());
                                        } catch { result = result.replace(/{join_pos}/g, 'Unknown'); }
                        }
          }
            return result;
}
