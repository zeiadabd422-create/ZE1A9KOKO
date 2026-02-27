import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Welcome & goodbye module administration - Configure member onboarding')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Set the welcome channel and auto-role (Unverified)')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to post welcome messages (required)')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('auto_role')
            .setDescription('Role to assign new members (usually "Unverified")')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Edit welcome or goodbye messages with Mimu-style editor')
        .addStringOption(option =>
          option
            .setName('embed_type')
            .setDescription('Which embed to edit')
            .setRequired(true)
            .addChoices(
              { name: '👋 Welcome', value: 'welcome' },
              { name: '👋 Goodbye', value: 'goodbye' }
            )
        )
    ),

  async execute(interaction) {
    try {
      // Verify administrator permission
      if (!interaction.memberPermissions?.has('Administrator')) {
        try {
          await interaction.reply({
            content: '❌ You need **Administrator** permissions to use this command.',
            ephemeral: true,
          });
        } catch (replyErr) {
          console.error('[welcome command] Failed to send permission error:', replyErr);
        }
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'setup') {
        try {
          const channel = interaction.options.getChannel('channel');
          const autoRole = interaction.options.getRole('auto_role');

          if (!channel || !autoRole) {
            try {
              await interaction.reply({
                content: '❌ Channel and Auto-role are required.',
                ephemeral: true,
              });
            } catch (replyErr) {
              console.error('[welcome command] Failed to send error:', replyErr);
            }
            return;
          }

          if (!interaction.client.welcome) {
            try {
              await interaction.reply({
                content: '❌ Welcome module is not loaded. Please contact bot administrator.',
                ephemeral: true,
              });
            } catch (replyErr) {
              console.error('[welcome command] Failed to send module error:', replyErr);
            }
            return;
          }

          try {
            const result = await interaction.client.welcome.setup(
              interaction.guild.id,
              channel.id,
              autoRole.id
            );

            if (result.success) {
              try {
                await interaction.reply({
                  content: `✅ **Welcome Module Configured**

**Welcome Channel:** <#${channel.id}>
**Auto Role (Unverified):** <@&${autoRole.id}>

New members will automatically receive the "${autoRole.name}" role on join. Gateway will remove this role after successful verification.`,
                  ephemeral: true,
                });
              } catch (replyErr) {
                console.error('[welcome command] Failed to send success reply:', replyErr);
              }
            } else {
              try {
                await interaction.reply({
                  content: `❌ Setup failed: ${result.error}`,
                  ephemeral: true,
                });
              } catch (replyErr) {
                console.error('[welcome command] Failed to send error reply:', replyErr);
              }
            }
          } catch (setupErr) {
            console.error('[welcome command] Setup execution error:', setupErr);
            try {
              await interaction.reply({
                content: `❌ An error occurred during setup: ${setupErr.message}`,
                ephemeral: true,
              });
            } catch (replyErr) {
              console.error('[welcome command] Failed to send exception reply:', replyErr);
            }
          }
        } catch (subErr) {
          console.error('[welcome command] Setup subcommand error:', subErr);
          try {
            if (!interaction.replied) {
              await interaction.reply({
                content: '❌ An error occurred processing your request.',
                ephemeral: true,
              });
            }
          } catch (replyErr) {
            console.error('[welcome command] Failed to send final error reply:', replyErr);
          }
        }
      } else if (sub === 'edit') {
        try {
          const embedType = interaction.options.getString('embed_type');

          // Mimu-style embed with editing buttons
          const isWelcome = embedType === 'welcome';
          const embed = new EmbedBuilder()
            .setColor(isWelcome ? 0x4f3ff0 : 0xff4d4d)
            .setTitle(`${isWelcome ? '👋 Edit Welcome' : '👋 Edit Goodbye'} Embed`)
            .setDescription('Choose what to customize:')
            .setFooter({ text: '💡 Tip: Use {user}, {server}, {member_count} placeholders in text' });

          // 4 separate buttons - Mimu style
          const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`welcome_${embedType}_basicinfo`)
              .setLabel('edit basic information (color / title / description)')
              .setStyle(ButtonStyle.Primary)
          );

          const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`welcome_${embedType}_author`)
              .setLabel('edit author')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(`welcome_${embedType}_footer`)
              .setLabel('edit footer')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(`welcome_${embedType}_images`)
              .setLabel('edit images')
              .setStyle(ButtonStyle.Secondary)
          );

          try {
            await interaction.reply({
              embeds: [embed],
              components: [row1, row2],
              ephemeral: true,
            });
          } catch (replyErr) {
            console.error('[welcome command] Failed to send edit embed:', replyErr);
            try {
              await interaction.reply({
                content: '❌ Failed to open the editor.',
                ephemeral: true,
              });
            } catch (fallbackErr) {
              console.error('[welcome command] Failed to send fallback error:', fallbackErr);
            }
          }
        } catch (editErr) {
          console.error('[welcome command] Edit subcommand error:', editErr);
          try {
            if (!interaction.replied) {
              await interaction.reply({
                content: '❌ An error occurred opening the editor.',
                ephemeral: true,
              });
            }
          } catch (replyErr) {
            console.error('[welcome command] Failed to send error reply:', replyErr);
          }
        }
      }
    } catch (err) {
      console.error('[welcome command] Execute error:', err);
      try {
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred executing the command.',
            ephemeral: true,
          });
        }
      } catch (replyErr) {
        console.error('[welcome command] Failed to send final error reply:', replyErr);
      }
    }
  },
};

