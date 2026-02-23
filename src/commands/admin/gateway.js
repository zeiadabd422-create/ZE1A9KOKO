/**
 * Gateway Admin Command - Simplified Single-Method Setup
 * Simple Efficiency: One method per setup
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('gateway')
    .setDescription('Configure and manage the gateway verification module')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Setup gateway verification: Choose one method (Button, Trigger, Slash, or Join)')
        .addStringOption(option =>
          option
            .setName('method')
            .setDescription('Verification method')
            .setRequired(true)
            .addChoices(
              { name: 'Button', value: 'button' },
              { name: 'Trigger Word', value: 'trigger' },
              { name: 'Slash Command (/verify)', value: 'slash' },
              { name: 'Join (automatic)', value: 'join' }
            )
        )
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel for this verification method')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('role_to_give')
            .setDescription('Role to give verified users')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('role_to_remove')
            .setDescription('Unverified/penalty role to remove')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('trigger_word')
            .setDescription('Trigger word (required if method is Trigger)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('customize_ui')
        .setDescription('Customize the visual appearance of specific verification pages')
        .addStringOption(option =>
          option
            .setName('page')
            .setDescription('Which page to customize')
            .setRequired(true)
            .addChoices(
              { name: 'Success', value: 'success' },
              { name: 'AlreadyVerified', value: 'alreadyVerified' },
              { name: 'Error', value: 'error' }
            )
        )
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('Embed title for this page')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Embed description for this page')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('color')
            .setDescription('Hex color code (e.g., #2ecc71) for this page')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('image_url')
            .setDescription('Banner image URL for this page')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('customize_ui')
        .setDescription('Customize the visual appearance of verification responses')
        .addStringOption(option =>
          option
            .setName('page')
            .setDescription('Which page to customize')
            .setRequired(true)
            .addChoices(
              { name: 'Success', value: 'success' },
              { name: 'Already Verified', value: 'alreadyVerified' },
              { name: 'Error', value: 'error' }
            )
        )
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('Embed title for this page')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Embed description for this page')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('color')
            .setDescription('Hex color code (e.g., #2ecc71)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('image_url')
            .setDescription('Banner image URL for this page')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Display gateway configuration and active method')
    ),

  async execute(interaction) {
    try {
      const { client, guild, options } = interaction;

      // Check if user has admin permissions
      if (!interaction.memberPermissions?.has('Administrator')) {
        await interaction.reply({
          content: '❌ You need Administrator permissions to use this command.',
          ephemeral: true,
        });
        return;
      }

      // Check if gateway module is loaded
      if (!client.gateway) {
        await interaction.reply({
          content: '❌ Gateway module is not loaded.',
          ephemeral: true,
        });
        return;
      }

      const subcommand = options.getSubcommand();

      if (subcommand === 'setup') {
        const method = options.getString('method', true);
        const channel = options.getChannel('channel', true);
        const roleToGive = options.getRole('role_to_give', true);
        const roleToRemove = options.getRole('role_to_remove', true);
        const triggerWord = options.getString('trigger_word') || '';

        // Validate trigger word if method is trigger
        if (method === 'trigger' && !triggerWord?.trim()) {
          await interaction.reply({
            content: '❌ Trigger word is required when using Trigger method.',
            ephemeral: true,
          });
          return;
        }

        const result = await client.gateway.setupCommand(
          guild.id,
          method,
          channel.id,
          roleToGive.id,
          roleToRemove.id,
          triggerWord
        );

        if (result.success) {
          const methodNames = {
            button: '🔘 Button',
            trigger: '💬 Trigger Word',
            slash: '⚡ Slash Command (/verify)',
            join: '✨ Join (automatic)',
          };

          await interaction.reply({
            content: `✅ **Gateway configured successfully!**\n\n**Method:** ${methodNames[method]}\n**Channel:** <#${channel.id}>\n**Verified Role:** <@&${roleToGive.id}>\n**Unverified Role (to remove):** <@&${roleToRemove.id}>${triggerWord ? `\n**Trigger Word:** \`${triggerWord}\`` : ''}`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: `❌ Setup failed: ${result.error}`,
            ephemeral: true,
          });
        }
      } else if (subcommand === 'customize_ui') {
        const page = options.getString('page', true);
        const title = options.getString('title');
        const description = options.getString('description');
        const color = options.getString('color');
        const imageUrl = options.getString('image_url');

        const result = await client.gateway.customizePageCommand(
          guild.id,
          page,
          title,
          description,
          color,
          imageUrl
        );

        if (result.success) {
          const updates = [];
          if (title) updates.push(`**Title:** ${title}`);
          if (description) updates.push(`**Description:** ${description}`);
          if (color) updates.push(`**Color:** ${color}`);
          if (imageUrl) updates.push(`**Image:** ${imageUrl}`);

          await interaction.reply({
            content: `✅ **${page}** page customization updated!\n\n${updates.join('\n') || 'No changes made.'}`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: `❌ Update failed: ${result.error}`,
            ephemeral: true,
          });
        }
      } else if (subcommand === 'status') {
        const GatewayConfig = (await import('../../modules/gateway/schema.js')).default;
        const config = await GatewayConfig.findOne({ guildId: guild.id });

        if (!config || !config.enabled) {
          await interaction.reply({
            content: '❌ Gateway is not configured for this server.\n\nUse `/gateway setup` to configure it.',
            ephemeral: true,
          });
          return;
        }

        // Build status embed
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🔐 Gateway Verification Status')
          .setDescription('Current configuration of your verification method')
          .addFields(
            { name: '🔄 Active Method', value: config.method === 'button' ? '🔘 Button' : (config.method === 'trigger' ? '💬 Trigger Word' : (config.method === 'slash' ? '⚡ Slash Command (/verify)' : '✨ Join (automatic)')), inline: true },
            { name: '📍 Channel', value: `<#${config.channel}>`, inline: true },
            { name: '✅ Verified Role', value: `<@&${config.verifiedRole}>`, inline: true },
            { name: '❌ Unverified Role', value: `<@&${config.unverifiedRole}>`, inline: true }
          );

        if (config.triggerWord) {
          embed.addFields(
            { name: '🔑 Trigger Word', value: `\`${config.triggerWord}\``, inline: true }
          );
        }

        embed.setFooter({ text: 'Use /gateway customize_ui for custom colors and images' })
          .setTimestamp();

        await interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      }
    } catch (err) {
      console.error('[gateway command] Error:', err);
      try {
        if (interaction.isRepliable() && !interaction.replied) {
          await interaction.reply({
            content: '❌ An error occurred while executing this command.',
            ephemeral: true,
          });
        }
      } catch (replyErr) {
        console.error('[gateway command] Failed to send error reply:', replyErr);
      }
    }
  },
};
