import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('إدارة خزنة الإيمبد')
    .addSubcommand(subcommand =>
      subcommand.setName('manager').setDescription('فتح لوحة إدارة الإيمبد')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('vault').setDescription('Open vault selector with all saved embeds')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('send')
        .setDescription('إرسال إيمبد من الخزنة')
        .addStringOption(option => option.setName('name').setDescription('اسم الإيمبد').setRequired(true).setAutocomplete(true))
        .addChannelOption(option => option.setName('channel').setDescription('القناة المستهدفة').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('save')
        .setDescription('حفظ أو تحديث إيمبد في الخزنة')
        .addStringOption(option => option.setName('name').setDescription('اسم الإيمبد').setRequired(true).setAutocomplete(true))
        .addStringOption(option => option.setName('category').setDescription('الفئة').setRequired(true).addChoices(
          { name: 'Welcome', value: 'Welcome' },
          { name: 'Leave', value: 'Leave' },
          { name: 'Boost', value: 'Boost' },
          { name: 'Manual', value: 'Manual' }
        ))
        .addStringOption(option => option.setName('title').setDescription('العنوان').setRequired(false))
        .addStringOption(option => option.setName('description').setDescription('الوصف').setRequired(false))
        .addStringOption(option => option.setName('image').setDescription('رابط الصورة').setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('import')
        .setDescription('استيراد إيمبد من JSON (Discohook)')
        .addStringOption(option => option.setName('name').setDescription('اسم الإيمبد').setRequired(true))
        .addStringOption(option => option.setName('category').setDescription('الفئة').setRequired(true).addChoices(
          { name: 'Welcome', value: 'Welcome' },
          { name: 'Leave', value: 'Leave' },
          { name: 'Boost', value: 'Boost' },
          { name: 'Manual', value: 'Manual' }
        ))
        .addStringOption(option => option.setName('json').setDescription('نص JSON للإيمبد').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('link')
        .setDescription('ربط إيمبد بكود دعوة')
        .addStringOption(option => option.setName('name').setDescription('اسم الإيمبد').setRequired(true).setAutocomplete(true))
        .addStringOption(option => option.setName('invite_code').setDescription('كود الدعوة').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('احذف إيمبد من الخزنة')
        .addStringOption(option => option.setName('name').setDescription('اسم الإيمبد').setRequired(true).setAutocomplete(true))
    ),

  async execute(interaction) {
    try {
      const { client, guild, options } = interaction;
      const sub = options.getSubcommand();

      if (!interaction.memberPermissions?.has('Administrator')) {
        return interaction.reply({ content: '❌ Admin permission required.', ephemeral: true });
      }
      if (!client.embedVault) {
        return interaction.reply({ content: '❌ EmbedVault module is not loaded.', ephemeral: true });
      }

      if (sub === 'manager' || sub === 'vault') {
        const embeds = await client.embedVault.list(guild.id);
        if (!embeds || embeds.length === 0) {
          return interaction.reply({ content: 'سجل الإيمبد فارغ. استخدم /embed save لإضافة عناصر.', ephemeral: true });
        }

        const menu = new StringSelectMenuBuilder()
          .setCustomId('embedvault_manager_select')
          .setPlaceholder('اختر إيمبد من الخزنة')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(
            embeds.map(item => ({
              label: item.name,
              value: item.name,
              description: `فئة: ${item.category}`,
            }))
          );

        const menuRow = new ActionRowBuilder().addComponents(menu);
        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('embedvault_create').setLabel('Create New').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('embedvault_import').setLabel('Import JSON').setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
          content: `لوحة الخزنة الاحترافية (${embeds.length} عناصر). اختر للتعديل/الإرسال/الحذف.`,
          components: [menuRow, actionRow],
          ephemeral: true,
        });
      }

      if (sub === 'send') {
        const name = options.getString('name', true);
        const channel = options.getChannel('channel', true);

        const embedDoc = await client.embedVault.getByName(guild.id, name);
        if (!embedDoc) {
          return interaction.reply({ content: `Embed not found: ${name}`, ephemeral: true });
        }

        if (!channel || !channel.isTextBased()) {
          return interaction.reply({ content: 'Target channel must be a text channel.', ephemeral: true });
        }

        await channel.send({ embeds: [embedDoc.data] });
        return interaction.reply({ content: `✅ Sent **${name}** to <#${channel.id}>.`, ephemeral: true });
      }

      if (sub === 'save') {
        const name = options.getString('name', true);
        const title = options.getString('title');
        const description = options.getString('description');
        const image = options.getString('image');
        const category = options.getString('category', true);

        const data = { ...(title ? { title } : {}), ...(description ? { description } : {}), ...(image ? { image: { url: image } } : {}) };

        if (Object.keys(data).length === 0) {
          return interaction.reply({ content: 'Provide at least one of title/description/image.', ephemeral: true });
        }

        await client.embedVault.upsert(guild.id, name, data, category);
        return interaction.reply({ content: `✅ Saved **${name}** to vault under category **${category}**.`, ephemeral: true });
      }

      if (sub === 'import') {
        const name = options.getString('name', true);
        const category = options.getString('category', true);
        const rawJson = options.getString('json', true);

        let payload;
        try {
          payload = JSON.parse(rawJson);
          if (!payload || typeof payload !== 'object') throw new Error('Invalid payload');
        } catch (e) {
          return interaction.reply({ content: 'JSON غير صالح. يرجى التحقق والمحاولة مرة أخرى.', ephemeral: true });
        }

        await client.embedVault.upsert(guild.id, name, payload, category);
        return interaction.reply({ content: `✅ تم استيراد وحفظ **${name}**.`, ephemeral: true });
      }

      if (sub === 'link') {
        const name = options.getString('name', true);
        const inviteCode = options.getString('invite_code', true);

        const existing = await client.embedVault.getByName(guild.id, name);
        if (!existing) {
          return interaction.reply({ content: `Embed not found: ${name}`, ephemeral: true });
        }

        await client.embedVault.link(guild.id, name, inviteCode);
        return interaction.reply({ content: `✅ Linked **${name}** to invite code **${inviteCode}**.`, ephemeral: true });
      }

      if (sub === 'delete') {
        const name = options.getString('name', true);
        const existing = await client.embedVault.getByName(guild.id, name);
        if (!existing) {
          return interaction.reply({ content: `Embed not found: ${name}`, ephemeral: true });
        }
        await client.embedVault.delete(guild.id, name);
        return interaction.reply({ content: `✅ Deleted **${name}** from vault.`, ephemeral: true });
      }

      return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    } catch (err) {
      console.error('[embed command] Error:', err);
      try {
        if (interaction.isRepliable() && !interaction.replied) {
          await interaction.reply({ content: 'An error occurred processing the embed command.', ephemeral: true });
        }
      } catch (e) {
        console.error('[embed command] Reply error:', e);
      }
    }
  },
};
