import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Embed Vault management')
    .addSubcommand(subcommand =>
      subcommand.setName('vault').setDescription('Open vault selector with all saved embeds')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('send')
        .setDescription('Send a vault embed to the channel')
        .addStringOption(option => option.setName('name').setDescription('Vault embed name').setRequired(true))
        .addChannelOption(option => option.setName('channel').setDescription('Target channel to send embed').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('save')
        .setDescription('Save or overwrite embed into vault')
        .addStringOption(option => option.setName('name').setDescription('Vault embed name').setRequired(true))
        .addStringOption(option => option.setName('category').setDescription('Embed category').setRequired(true).addChoices(
          { name: 'Welcome', value: 'Welcome' },
          { name: 'Leave', value: 'Leave' },
          { name: 'Boost', value: 'Boost' },
          { name: 'Manual', value: 'Manual' }
        ))
        .addStringOption(option => option.setName('title').setDescription('Embed title').setRequired(false))
        .addStringOption(option => option.setName('description').setDescription('Embed description').setRequired(false))
        .addStringOption(option => option.setName('image').setDescription('Embed image URL').setRequired(false))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('link')
        .setDescription('Bind a vault embed to an invite code')
        .addStringOption(option => option.setName('name').setDescription('Vault embed name').setRequired(true))
        .addStringOption(option => option.setName('invite_code').setDescription('Invite code to link').setRequired(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a vault embed slot')
        .addStringOption(option => option.setName('name').setDescription('Vault embed name').setRequired(true))
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

      if (sub === 'vault') {
        const embeds = await client.embedVault.list(guild.id);
        if (!embeds || embeds.length === 0) {
          return interaction.reply({ content: 'Vault is empty. Add entries with /embed save.', ephemeral: true });
        }

        const menu = new StringSelectMenuBuilder()
          .setCustomId('embedvault_select')
          .setPlaceholder('Select an embed from the vault')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(
            embeds.map(item => ({
              label: item.name,
              value: item.name,
              description: `${item.category} embed`,
            }))
          );

        const row = new ActionRowBuilder().addComponents(menu);

        return interaction.reply({
          content: `Vault has ${embeds.length} entries. Select one to inspect and manage.`,
          components: [row],
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
