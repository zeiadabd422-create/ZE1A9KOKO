import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import GuildConfig from '../../models/GuildConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('gateway')
    .setDescription('Configure Gateway Verification System')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Setup Gateway verification system')
        .addRoleOption((opt) =>
          opt
            .setName('verified_role')
            .setDescription('Role to assign after successful verification')
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName('unverified_role')
            .setDescription('Role for members waiting to verify')
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('log_channel')
            .setDescription('Optional: Channel for verification logs')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'setup') {
        await interaction.deferReply({ ephemeral: true });

        const verifiedRole = interaction.options.getRole('verified_role');
        const unverifiedRole = interaction.options.getRole('unverified_role');
        const logChannel = interaction.options.getChannel('log_channel');
        const guildId = interaction.guildId;

        // ===== VALIDATION =====
        const errors = [];

        // Check if roles are the same
        if (verifiedRole.id === unverifiedRole.id) {
          errors.push('❌ Verified and Unverified roles cannot be the same');
        }

        // Check bot permissions
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
          errors.push('❌ Bot lacks "Manage Roles" permission');
        }

        // Check bot role position
        const botHighestRole = interaction.guild.members.me.roles.highest;
        if (botHighestRole.comparePositionTo(verifiedRole) <= 0) {
          errors.push(`❌ Bot role must be above Verified role <@&${verifiedRole.id}>`);
        }
        if (botHighestRole.comparePositionTo(unverifiedRole) <= 0) {
          errors.push(`❌ Bot role must be above Unverified role <@&${unverifiedRole.id}>`);
        }

        // If there are errors, return them
        if (errors.length > 0) {
          return interaction.editReply({
            content: errors.join('\n'),
          });
        }

        // ===== SAVE TO DATABASE =====
        const gatewayConfig = {
          verifiedRoleId: verifiedRole.id,
          unverifiedRoleId: unverifiedRole.id,
          logChannelId: logChannel?.id || null,
        };

        await GuildConfig.updateOne(
          { guildId },
          { $set: { gateway: gatewayConfig } },
          { upsert: true }
        );

        // ===== SEND SUCCESS REPLY =====
        const embed = new EmbedBuilder()
          .setTitle('✅ تم إعداد نظام التحقق بنجاح')
          .setColor(0x2ecc71)
          .setDescription('Gateway Verification System configured successfully')
          .addFields([
            {
              name: '✔️ Verified Role',
              value: `<@&${verifiedRole.id}> • \`${verifiedRole.id}\``,
              inline: false,
            },
            {
              name: '⏳ Unverified Role',
              value: `<@&${unverifiedRole.id}> • \`${unverifiedRole.id}\``,
              inline: false,
            },
            {
              name: '📋 Log Channel',
              value: logChannel ? `<#${logChannel.id}> • \`${logChannel.id}\`` : '❌ Not Set (Optional)',
              inline: false,
            },
            {
              name: '💾 Database',
              value: `Saved to: \`guildConfig.gateway\``,
              inline: false,
            },
          ])
          .setFooter({ text: `Guild ID: ${guildId}` })
          .setTimestamp();

        await interaction.editReply({
          embeds: [embed],
        });

        console.log(`[Gateway] Setup completed for guild ${guildId}:`, gatewayConfig);
      }
    } catch (error) {
      console.error('[Gateway Command] Error:', error);

      if (interaction.deferred) {
        await interaction.editReply({
          content: '❌ An error occurred while processing the command.',
        });
      } else {
        await interaction.reply({
          content: '❌ An error occurred while processing the command.',
          ephemeral: true,
        });
      }
    }
  },
};
