import { SlashCommandBuilder, MessageFlags } from 'discord.js';

// Autocomplete handler function
async function handleNameAutocomplete(interaction) {
  try {
    if (!interaction.client.embedVault) {
      await interaction.respond([]);
      return;
    }

    const embeds = await interaction.client.embedVault.list(interaction.guildId);
    const focusedValue = interaction.options.getFocused();

    const filtered = embeds
      .filter(embed => embed.name.toLowerCase().includes(focusedValue.toLowerCase()))
      .slice(0, 25)
      .map(embed => ({
        name: embed.name.length > 50 ? embed.name.substring(0, 47) + '...' : embed.name,
        value: embed.name,
      }));

    await interaction.respond(filtered);
  } catch (err) {
    console.error('[embed autocomplete] Error:', err);
    await interaction.respond([]).catch(() => {});
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('إدارة قبو الإيمبد مع محرر مرئي • Manage embed vault with visual editor')
    .addSubcommand(subcommand =>
      subcommand
        .setName('manager')
        .setDescription('فتح مدير الإيمبد المرئي • Open visual embed manager')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('bind')
        .setDescription('ربط إيمبد برمز دعوة للتتبع الشريك • Link embed to invite code for partner tracking')
        .addStringOption(option =>
          option
            .setName('name')
            .setDescription('اسم الإيمبد • Embed name')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(option =>
          option
            .setName('invite_code')
            .setDescription('رمز الدعوة إلى Discord • Discord invite code')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('partner_role')
            .setDescription('دور الشريك (اختياري) • Partner role (optional)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('حذف إيمبد من الخزنة الإمبراطورية • Delete an embed from the vault')
        .addStringOption(option =>
          option
            .setName('name')
            .setDescription('اسم الإيمبد المراد حذفه • Embed name to delete')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction) {
    const option = interaction.options.getFocused(true);
    if (option.name === 'name') {
      await handleNameAutocomplete(interaction);
    }
  },

  async execute(interaction) {
    try {
      const { client } = interaction;
      const sub = interaction.options.getSubcommand();

      if (!interaction.memberPermissions?.has('Administrator')) {
        return interaction.editReply({ content: '❌ مطلوب صلاحية المسؤول.' });
      }
      if (!client.embedVault) {
        return interaction.editReply({ content: '❌ لم يتم تحميل وحدة EmbedVault.' });
      }

      if (sub === 'manager') {
        return await client.embedVault.openManager(interaction);
      }

      if (sub === 'bind') {
        const name = interaction.options.getString('name').trim();
        const inviteCode = interaction.options.getString('invite_code').trim();
        const partnerRole = interaction.options.getRole('partner_role');

        // Validate invite code format
        if (inviteCode.length < 2) {
          return interaction.editReply({
            content: '❌ صيغة رمز الدعوة غير صحيحة.',
          });
        }

        const updated = await client.embedVault.bindInviteWithRole(
          interaction.guildId,
          name,
          inviteCode,
          partnerRole?.id || null
        );
        if (!updated) {
          return interaction.editReply({
            content: `❌ لم يتم العثور على الإمبد **${name}** في الخزنة.`,
          });
        }

        let confirmMsg = `✅ تم ربط **${updated.name}** برمز الدعوة: \`${inviteCode}\`\nعندما يستخدم الأعضاء رمز الدعوة هذا للانضمام، سيتم إرسال هذا الإمبد!`;
        if (partnerRole) {
          confirmMsg += `\n🔗 دور الشريك المرتبط: ${partnerRole}`;
        }

        return interaction.editReply({
          content: confirmMsg,
        });
      }

      if (sub === 'delete') {
        const name = interaction.options.getString('name').trim();
        const deleted = await client.embedVault.delete(interaction.guildId, name);

        if (!deleted) {
          return interaction.editReply({
            content: `❌ لم يتم العثور على الإمبد **${name}** في الخزنة.`,
          });
        }

        return interaction.editReply({
          content: `✅ تم حذف **${name}** من الخزنة.`,
        });
      }

      return interaction.editReply({ content: 'أمر فرعي غير معروف.' });
    } catch (err) {
      console.error('[embed command] Error:', err);
      try {
        if (interaction.isRepliable()) {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: 'حدث خطأ في معالجة أمر الإمبد.' }).catch(() => {});
          } else {
            await interaction.reply({ content: 'حدث خطأ في معالجة أمر الإمبد.', flags: [MessageFlags.Ephemeral] });
          }
        }
      } catch (e) {
        console.error('[embed command] Reply error:', e);
      }
    }
  },
};
