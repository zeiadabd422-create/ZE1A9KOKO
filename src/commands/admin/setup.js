import { SlashCommandBuilder, ChannelType, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import GuildConfig from '../../modules/config/GuildConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('إعداد الخوادم • Configure server settings')
    .addSubcommand(subcommand =>
      subcommand
        .setName('welcome')
        .setDescription('إعداد رسالة الترحيب • Configure welcome message')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('قناة الترحيب • Welcome channel')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addRoleOption(option =>
          option
            .setName('auto_role')
            .setDescription('دور الأعضاء الجدد • Auto-assign role')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('goodbye')
        .setDescription('إعداد رسالة الوداع • Configure goodbye message')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('قناة الوداع • Goodbye channel')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('boost')
        .setDescription('إعداد رسالة تعزيز الخادم • Configure server boost message')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('قناة التعزيز • Boost event channel')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('logs')
        .setDescription('إعداد قناة السجلات • Configure logs channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('قناة السجلات • Logs channel')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('partner')
        .setDescription('إعداد شراكة • Configure partner setup')
    ),

  async execute(interaction) {
    try {
      if (!interaction.memberPermissions?.has('Administrator')) {
        return interaction.reply({ content: '❌ Admin permission required.', flags: [MessageFlags.Ephemeral] });
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'welcome') {
        const channel = interaction.options.getChannel('channel');
        const autoRole = interaction.options.getRole('auto_role');

        const config = await GuildConfig.findOneAndUpdate(
          { guildId: interaction.guildId },
          {
            $set: {
              'welcome.channelId': channel.id,
              'welcome.autoRoleId': autoRole.id,
            },
          },
          { upsert: true, new: true }
        );

        // Get embeds for select menu
        if (!interaction.client.embedVault) {
          return interaction.reply({ content: '❌ EmbedVault module is not loaded.', flags: [MessageFlags.Ephemeral] });
        }

        const embeds = await interaction.client.embedVault.list(interaction.guildId);
        if (embeds.length === 0) {
          return interaction.reply({ content: '❌ No embeds found in vault. Create some embeds first.', flags: [MessageFlags.Ephemeral] });
        }

        const options = embeds.map(embed => ({
          label: embed.name.length > 100 ? embed.name.substring(0, 97) + '...' : embed.name,
          value: embed.name,
        }));

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`setup_embed_select:welcome`)
          .setPlaceholder('Choose the welcome embed')
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        return interaction.reply({
          content: `✅ **Welcome Setup Started!**\n📢 Channel: ${channel}\n🔑 Auto-Role: ${autoRole}\n\n🎯 **Select the embed to use for welcome messages:**`,
          components: [row],
          flags: [MessageFlags.Ephemeral],
        });
      }

      if (sub === 'goodbye') {
        const channel = interaction.options.getChannel('channel');

        const config = await GuildConfig.findOneAndUpdate(
          { guildId: interaction.guildId },
          {
            $set: {
              'goodbye.channelId': channel.id,
            },
          },
          { upsert: true, new: true }
        );

        // Get embeds for select menu
        if (!interaction.client.embedVault) {
          return interaction.reply({ content: '❌ EmbedVault module is not loaded.', flags: [MessageFlags.Ephemeral] });
        }

        const embeds = await interaction.client.embedVault.list(interaction.guildId);
        if (embeds.length === 0) {
          return interaction.reply({ content: '❌ No embeds found in vault. Create some embeds first.', flags: [MessageFlags.Ephemeral] });
        }

        const options = embeds.map(embed => ({
          label: embed.name.length > 100 ? embed.name.substring(0, 97) + '...' : embed.name,
          value: embed.name,
        }));

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`setup_embed_select:goodbye`)
          .setPlaceholder('Choose the goodbye embed')
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        return interaction.reply({
          content: `✅ **Goodbye Setup Started!**\n📢 Channel: ${channel}\n\n🎯 **Select the embed to use for goodbye messages:**`,
          components: [row],
          flags: [MessageFlags.Ephemeral],
        });
      }

      if (sub === 'boost') {
        const channel = interaction.options.getChannel('channel');

        const config = await GuildConfig.findOneAndUpdate(
          { guildId: interaction.guildId },
          {
            $set: {
              'boost.channelId': channel.id,
            },
          },
          { upsert: true, new: true }
        );

        // Get embeds for select menu
        if (!interaction.client.embedVault) {
          return interaction.reply({ content: '❌ EmbedVault module is not loaded.', flags: [MessageFlags.Ephemeral] });
        }

        const embeds = await interaction.client.embedVault.list(interaction.guildId);
        if (embeds.length === 0) {
          return interaction.reply({ content: '❌ No embeds found in vault. Create some embeds first.', flags: [MessageFlags.Ephemeral] });
        }

        const options = embeds.map(embed => ({
          label: embed.name.length > 100 ? embed.name.substring(0, 97) + '...' : embed.name,
          value: embed.name,
        }));

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`setup_embed_select:boost`)
          .setPlaceholder('Choose the boost embed')
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        return interaction.reply({
          content: `✅ **Boost Setup Started!**\n📢 Channel: ${channel}\n\n🎯 **Select the embed to use for boost messages:**`,
          components: [row],
          flags: [MessageFlags.Ephemeral],
        });
      }

      if (sub === 'logs') {
        const channel = interaction.options.getChannel('channel');

        const config = await GuildConfig.findOneAndUpdate(
          { guildId: interaction.guildId },
          {
            $set: {
              'logs.channelId': channel.id,
            },
          },
          { upsert: true, new: true }
        );

        return interaction.reply({
          content: `✅ **Logs Setup Complete!**\n📋 Channel: ${channel}`,
          flags: [MessageFlags.Ephemeral],
        });
      }

      if (sub === 'partner') {
        // Get embeds for select menu
        if (!interaction.client.embedVault) {
          return interaction.reply({ content: '❌ EmbedVault module is not loaded.', flags: [MessageFlags.Ephemeral] });
        }

        const embeds = await interaction.client.embedVault.list(interaction.guildId);
        if (embeds.length === 0) {
          return interaction.reply({ content: '❌ No embeds found in vault. Create some embeds first.', flags: [MessageFlags.Ephemeral] });
        }

        const options = embeds.map(embed => ({
          label: embed.name.length > 100 ? embed.name.substring(0, 97) + '...' : embed.name,
          value: embed.name,
        }));

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`setup_partner_embed_select`)
          .setPlaceholder('Choose the partner embed')
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        return interaction.reply({
          content: `🎯 **Partner Setup Started!**\n\n**Step 1:** Select the embed to use for partner messages:`,
          components: [row],
          flags: [MessageFlags.Ephemeral],
        });
      }
    } catch (err) {
      console.error('[setup command] Error:', err);
      try {
        if (interaction.isRepliable() && !interaction.replied) {
          await interaction.reply({ content: '❌ An error occurred during setup.', flags: [MessageFlags.Ephemeral] });
        }
      } catch (e) {
        console.error('[setup command] Reply error:', e);
      }
    }
  },
};
