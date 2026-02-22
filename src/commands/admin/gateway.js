/**
 * Gateway Admin Command
 * Allows admins to configure the Gateway verification module
 */

import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('gateway')
    .setDescription('Configure the gateway verification module')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Setup gateway verification for your server')
        .addStringOption(option =>
          option
            .setName('method')
            .setDescription('Verification method')
            .setRequired(true)
            .addChoices(
              { name: 'Button', value: 'button' },
              { name: 'Trigger', value: 'trigger' },
              { name: 'Slash', value: 'slash' },
              { name: 'Join', value: 'join-check' }
            )
        )
        .addRoleOption(option =>
          option
            .setName('verified_role')
            .setDescription('Role to give verified users')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('unverified_role')
            .setDescription('Penalty/unverified role to remove')
            .setRequired(true)
        )
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel where verification happens')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('trigger_word')
            .setDescription('Trigger word or password (for trigger method)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('success_dm')
            .setDescription('Custom DM message sent on successful verification')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('embed_title')
            .setDescription('Title for the verification embed')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('embed_description')
            .setDescription('Description for the verification embed')
            .setRequired(false)
        )
        .addChannelOption(option =>
          option
            .setName('slash_channel')
            .setDescription('Channel where /verify command is allowed')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('customize_ui')
        .setDescription('Customize the visual appearance of verification embeds')
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('Embed title')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Embed description')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('color_hex')
            .setDescription('Hex color code (e.g., #2ecc71)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('image_url')
            .setDescription('URL for banner image')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('trigger_emoji')
            .setDescription('Emoji for trigger method reactions')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('customize_logic')
        .setDescription('Customize verification messages and behavior')
        .addStringOption(option =>
          option
            .setName('already_verified_msg')
            .setDescription('Message when user is already verified')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('success_dm')
            .setDescription('Success message sent to user DM')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable gateway verification for your server')
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
        const verifiedRole = options.getRole('verified_role', true);
        const unverifiedRole = options.getRole('unverified_role', true);
        const channel = options.getChannel('channel', true);
        const triggerWord = options.getString('trigger_word') || '';
        const successDM = options.getString('success_dm') || undefined;
        const embedTitle = options.getString('embed_title') || undefined;
        const embedDescription = options.getString('embed_description') || undefined;
        const slashChannel = options.getChannel('slash_channel') || undefined;

        const result = await client.gateway.setupCommand(
          guild.id,
          method,
          verifiedRole.id,
          unverifiedRole.id,
          channel.id,
          triggerWord,
          successDM,
          embedTitle,
          embedDescription,
          slashChannel?.id || ''
        );

        if (result.success) {
          await interaction.reply({
            content: `✅ Gateway configured successfully!\n\n**Method:** ${method}\n**Channel:** <#${channel.id}>\n**Verified Role:** <@&${verifiedRole.id}>\n**Unverified Role:** <@&${unverifiedRole.id}>`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: `❌ Setup failed: ${result.error}`,
            ephemeral: true,
          });
        }
      } else if (subcommand === 'customize_ui') {
        const title = options.getString('title');
        const description = options.getString('description');
        const colorHex = options.getString('color_hex');
        const imageUrl = options.getString('image_url');
        const triggerEmoji = options.getString('trigger_emoji');

        const result = await client.gateway.customizeUICommand(
          guild.id,
          title,
          description,
          colorHex,
          imageUrl,
          triggerEmoji
        );

        if (result.success) {
          const updates = [];
          if (title) updates.push(`**Title:** ${title}`);
          if (description) updates.push(`**Description:** ${description}`);
          if (colorHex) updates.push(`**Color:** ${colorHex}`);
          if (imageUrl) updates.push(`**Image:** ${imageUrl}`);
          if (triggerEmoji) updates.push(`**Trigger Emoji:** ${triggerEmoji}`);

          await interaction.reply({
            content: `✅ UI customization updated!\n\n${updates.join('\n')}`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: `❌ Customization failed: ${result.error}`,
            ephemeral: true,
          });
        }
      } else if (subcommand === 'customize_logic') {
        const alreadyVerifiedMsg = options.getString('already_verified_msg');
        const successDM = options.getString('success_dm');

        const result = await client.gateway.customizeLogicCommand(
          guild.id,
          alreadyVerifiedMsg,
          successDM
        );

        if (result.success) {
          const updates = [];
          if (alreadyVerifiedMsg) updates.push(`**Already Verified Message:** ${alreadyVerifiedMsg}`);
          if (successDM) updates.push(`**Success DM:** ${successDM}`);

          await interaction.reply({
            content: `✅ Logic customization updated!\n\n${updates.join('\n')}`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: `❌ Customization failed: ${result.error}`,
            ephemeral: true,
          });
        }
      } else if (subcommand === 'disable') {
        const result = await client.gateway.disableCommand(guild.id);
        if (result.success) {
          await interaction.reply({
            content: '✅ Gateway has been disabled.',
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: `❌ Disable failed: ${result.error}`,
            ephemeral: true,
          });
        }
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
