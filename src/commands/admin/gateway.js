import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import GatewayConfig from '../../modules/gateway/schema.js';
import { createEmbed } from '../../modules/gateway/actions.js';

// track ephemeral preview message IDs keyed by user:guild:page
const _uiPreviewMap = new Map();

export default {
  data: new SlashCommandBuilder()
    .setName('gateway')
    .setDescription('إدارة وتكوين نظام التوثيق (يدعم الزر، الكلمة المحفزة، الأمر المائل)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('إعداد قناة التوثيق والرسالة الأولية')
        .addStringOption(option =>
          option
            .setName('method')
            .setDescription('طريقة التوثيق المراد تكوينها')
            .setRequired(true)
            .addChoices(
              { name: 'Button', value: 'button' },
              { name: 'Trigger Word', value: 'trigger' },
              { name: 'Slash Command (/verify)', value: 'slash' }
            )
        )
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('القناة المخصصة لهذه الطريقة (مطلوبة للزر والكلمة المحفزة والأمر المائل)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('trigger_word')
            .setDescription('الكلمة المحفزة (لطريقة الكلمة المحفزة فقط)')
            .setRequired(false)
        )
        .addRoleOption(option =>
          option
            .setName('verified_role')
            .setDescription('الرتبة الممنوحة للمستخدمين الموثقين (مطلوبة للإعداد الأولي)')
            .setRequired(false)
        )
        .addRoleOption(option =>
          option
            .setName('unverified_role')
            .setDescription('الرتبة غير الموثقة أو العقوبة المزالة (مطلوبة للإعداد الأولي)')
            .setRequired(false)
        )
        .addRoleOption(option =>
          option
            .setName('method_verified_role')
            .setDescription('الرتبة الموثقة الخاصة بهذه الطريقة (اختياري، يتجاوز الرتبة العامة)')
            .setRequired(false)
        )
        .addRoleOption(option =>
          option
            .setName('method_unverified_role')
            .setDescription('الرتبة غير الموثقة الخاصة بهذه الطريقة (اختياري، يتجاوز الرتبة العامة)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('customize_ui')
        .setDescription('تخصيص مظهر صفحات التوثيق والرسائل')
        .addStringOption(option =>
          option
            .setName('page')
            .setDescription('الصفحة أو الرسالة المراد تخصيصها')
            .setRequired(true)
            .addChoices(
              { name: 'Success (Response)', value: 'success' },
              { name: 'Already Verified (Response)', value: 'alreadyVerified' },
              { name: 'Error (Response)', value: 'error' },
              { name: 'DM (Direct Message)', value: 'dm' },
              { name: 'Prompt (Initial Message)', value: 'prompt' }
            )
        )
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('عنوان الرسالة المضمنة')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('desc')
            .setDescription('وصف الرسالة المضمنة')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('color')
            .setDescription('رمز اللون السداسي العشري (مثال: #2ecc71)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('image_url')
            .setDescription('رابط صورة البانر')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('customize_logic')
        .setDescription('تكوين منطق التوثيق والأدوار')
        .addStringOption(option =>
          option
            .setName('method')
            .setDescription('الطريقة المراد تخصيص الرسائل الأولية لها أو تحديث الإعدادات عليها')
            .setRequired(true)
            .addChoices(
              { name: 'Button', value: 'button' },
              { name: 'Trigger Word', value: 'trigger' },
              { name: 'Slash Command', value: 'slash' }
            )
        )
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('تغيير القناة المرتبطة بهذه الطريقة')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('trigger_word')
            .setDescription('الكلمة المحفزة (لطريقة الكلمة المحفزة فقط)')
            .setRequired(false)
        )
        .addRoleOption(option =>
          option
            .setName('verified_role')
            .setDescription('الرتبة الموثقة المراد منحها')
            .setRequired(false)
        )
        .addRoleOption(option =>
          option
            .setName('unverified_role')
            .setDescription('الرتبة غير الموثقة المراد إزالتها')
            .setRequired(false)
        )
        .addRoleOption(option =>
          option
            .setName('method_verified_role')
            .setDescription('الرتبة الموثقة الخاصة بهذه الطريقة')
            .setRequired(false)
        )
        .addRoleOption(option =>
          option
            .setName('method_unverified_role')
            .setDescription('الرتبة غير الموثقة الخاصة بهذه الطريقة')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('prompt_title')
            .setDescription('العنوان للرسالة الأولية للتوثيق')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('prompt_description')
            .setDescription('الوصف للرسالة الأولية للتوثيق')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('عرض جميع الطرق المكونة والإعدادات')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set_admin_log')
        .setDescription('تحديد قناة السجل الإداري لعمليات التوثيق')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('القناة المخصصة للسجلات الإدارية')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('lockdown')
        .setDescription('Set lockdown level for verification')
        .addIntegerOption(option =>
          option
            .setName('level')
            .setDescription('Lockdown level (0-3)')
            .setRequired(true)
            .addChoices(
              { name: 'Normal (0)', value: 0 },
              { name: 'DM Verification (1)', value: 1 },
              { name: 'Strict Gauntlet (2)', value: 2 },
              { name: 'Closed (3)', value: 3 }
            )
        )
    ),

  async execute(interaction) {
    try {
      const { client, guild, options } = interaction;

      if (!interaction.memberPermissions?.has('Administrator')) {
        await interaction.reply({
          content: '❌ You need Administrator permissions to use this command.',
          ephemeral: true,
        });
        return;
      }

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
        const channel = options.getChannel('channel');
        const triggerWord = options.getString('trigger_word') || '';
        const verifiedRole = options.getRole('verified_role');
        const unverifiedRole = options.getRole('unverified_role');
        const methodVerifiedRole = options.getRole('method_verified_role');
        const methodUnverifiedRole = options.getRole('method_unverified_role');

        // Validate: methods other than 'join' require a channel
        if (!channel) {
          await interaction.reply({
            content: `❌ Channel is required for ${method} method.`,
            ephemeral: true,
          });
          return;
        }

        // Validate: trigger needs a trigger word
        if (method === 'trigger' && !triggerWord?.trim()) {
          await interaction.reply({
            content: '❌ Trigger word is required for trigger method.',
            ephemeral: true,
          });
          return;
        }

        const result = await client.gateway.setupMethod(
          guild.id,
          method,
          channel?.id || '',
          triggerWord,
          verifiedRole?.id,
          unverifiedRole?.id,
          methodVerifiedRole?.id || '',
          methodUnverifiedRole?.id || ''
        );

        if (result.success) {
          const methodNames = {
            button: '🔘 Button',
            trigger: '💬 Trigger Word',
            slash: '⚡ Slash (/verify)',
            join: '✨ Join (automatic)',
          };
          const details = [];
          if (channel) details.push(`**Channel:** <#${channel.id}>`);
          if (triggerWord) details.push(`**Trigger Word:** \`${triggerWord}\``);
          if (verifiedRole) details.push(`**Global Verified Role:** <@&${verifiedRole.id}>`);
          if (unverifiedRole) details.push(`**Global Unverified Role:** <@&${unverifiedRole.id}>`);
          if (methodVerifiedRole) details.push(`**Method Verified Role:** <@&${methodVerifiedRole.id}>`);
          if (methodUnverifiedRole) details.push(`**Method Unverified Role:** <@&${methodUnverifiedRole.id}>`);

          await interaction.reply({
            content: `✅ **${methodNames[method]}** method configured!\n\n${details.join('\n')}${channel ? '\n✉️ Verification message sent to channel.' : ''}`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: `❌ Setup failed: ${result.error}`,
            ephemeral: true,
          });
        }
      } else if (subcommand === 'set_admin_log') {
        const channel = options.getChannel('channel', true);

        let cfg = await GatewayConfig.findOne({ guildId: guild.id });
        if (!cfg) {
          await interaction.reply({
            content: '❌ يجب إعداد البوابة أولاً باستخدام /gateway setup قبل تحديد قناة السجل.',
            ephemeral: true,
          });
          return;
        }

        cfg.adminLogChannel = channel.id;
        await cfg.save();

        await interaction.reply({
          content: `✅ Admin log channel set to <#${channel.id}>.`,
          ephemeral: true,
        });
      } else if (subcommand === 'customize_ui') {
        const page = options.getString('page', true);
        const title = options.getString('title');
        const description = options.getString('desc');
        const color = options.getString('color');
        const imageUrl = options.getString('image_url');

        // update the database (current implementation writes immediately)
        const result = await client.gateway.customizePageCommand(
          guild.id,
          page,
          title,
          description,
          color,
          imageUrl
        );

        // build a preview embed (color safety handled inside createEmbed via parseColor)

        // build a preview embed based on the resulting configuration
        let previewEmbed;
        if (result.success && result.config) {
          try {
            previewEmbed = await createEmbed(result.config, '', page, interaction.member);
          } catch (e) {
            console.error('[gateway command] Failed to build preview embed:', e);
          }
        }

        // manage preview message state
        const key = `${interaction.user.id}:${guild.id}:${page}`;
        let prevMsgId = _uiPreviewMap.get(key);
        let edited = false;

        if (prevMsgId && interaction.channel) {
          try {
            const prevMsg = await interaction.channel.messages.fetch(prevMsgId).catch(() => null);
            if (prevMsg) {
              const contentText = result.success
                ? `✅ **${page}** customization updated!`
                : `❌ Update failed: ${result.error}`;
              const editPayload = { content: contentText };
              if (previewEmbed) editPayload.embeds = [previewEmbed];
              await prevMsg.edit(editPayload);
              edited = true;
            }
          } catch (e) {
            // ignore fetch/edit errors, will send a new reply below
          }
        }

        if (!edited) {
          const replyOptions = previewEmbed ? { embeds: [previewEmbed] } : {};
          await interaction.reply({
            content: result.success ? `✅ **${page}** customization updated!` : `❌ Update failed: ${result.error}`,
            ...replyOptions,
            ephemeral: true,
          });
          // fetch the actual message object so we can track its id
          try {
            const sentMsg = await interaction.fetchReply();
            if (sentMsg && sentMsg.id) {
              _uiPreviewMap.set(key, sentMsg.id);
            }
          } catch (e) {
            // fetch may fail for ephemeral; ignore
          }
        }

        // optionally send additional status text if not using preview
        if (!previewEmbed) {
          if (result.success) {
            const updates = [];
            if (title) updates.push(`**Title:** ${title}`);
            if (description) updates.push(`**Description:** ${description}`);
            if (color) updates.push(`**Color:** ${color}`);
            if (imageUrl) updates.push(`**Image:** ${imageUrl}`);

            if (!edited) {
              await interaction.followUp({
                content: updates.join('\n') || 'No changes made.',
                ephemeral: true,
              });
            }
          } else if (!edited) {
            await interaction.followUp({
              content: `❌ Update failed: ${result.error}`,
              ephemeral: true,
            });
          }
        }
      } else if (subcommand === 'lockdown') {
        const level = options.getInteger('level', true);
        let cfg = await GatewayConfig.findOne({ guildId: guild.id });
        if (!cfg) {
          await interaction.reply({
            content: '❌ يجب إعداد البوابة أولاً باستخدام /gateway setup قبل تغيير مستوى القفل.',
            ephemeral: true,
          });
          return;
        }
        cfg.lockdownLevel = level;
        // keep backwards boolean for any legacy checks
        cfg.lockdownMode = level > 0;
        await cfg.save();
        const descriptions = ['Normal', 'Simple DM Gauntlet', 'Strict DM Gauntlet', 'System Closed'];
        await interaction.reply({
          content: `🔒 Lockdown level set to **${level} – ${descriptions[level] || 'Unknown'}**.`,
          ephemeral: true,
        });
      } else if (subcommand === 'customize_logic') {
        const method = options.getString('method', true);
        const channelOpt = options.getChannel('channel');
        const triggerWord = options.getString('trigger_word');
        const verifiedRole = options.getRole('verified_role');
        const unverifiedRole = options.getRole('unverified_role');
        const methodVerifiedRole = options.getRole('method_verified_role');
        const methodUnverifiedRole = options.getRole('method_unverified_role');
        const promptTitle = options.getString('prompt_title');
        const promptDesc = options.getString('prompt_description');

        const replyParts = [];
        let overallSuccess = true;

        // if any logic-related options were provided, update via setupMethod
        if (channelOpt || triggerWord || verifiedRole || unverifiedRole || methodVerifiedRole || methodUnverifiedRole) {
          const res1 = await client.gateway.setupMethod(
            guild.id,
            method,
            channelOpt?.id || '',
            triggerWord || '',
            verifiedRole?.id,
            unverifiedRole?.id,
            methodVerifiedRole?.id || '',
            methodUnverifiedRole?.id || ''
          );
          if (res1.success) {
            const details = [];
            if (channelOpt) details.push(`Channel → <#${channelOpt.id}>`);
            if (triggerWord) details.push(`Trigger Word → \`${triggerWord}\``);
            if (verifiedRole) details.push(`Global Verified Role → <@&${verifiedRole.id}>`);
            if (unverifiedRole) details.push(`Global Unverified Role → <@&${unverifiedRole.id}>`);
            if (methodVerifiedRole) details.push(`Method Verified Role → <@&${methodVerifiedRole.id}>`);
            if (methodUnverifiedRole) details.push(`Method Unverified Role → <@&${methodUnverifiedRole.id}>`);
            replyParts.push(`⚙️ Logic updated: ${details.join(', ')}`);
          } else {
            overallSuccess = false;
            replyParts.push(`❌ Logic update failed: ${res1.error}`);
          }
        }

        // prompts customization
        if (promptTitle || promptDesc) {
          const res2 = await client.gateway.customizeInitialMessageCommand(
            guild.id,
            method,
            promptTitle,
            promptDesc
          );
          if (res2.success) {
            const upd = [];
            if (promptTitle) upd.push(`Title → ${promptTitle}`);
            if (promptDesc) upd.push(`Description → ${promptDesc}`);
            replyParts.push(`✏️ Prompt updated (${upd.join(', ')})`);
          } else {
            overallSuccess = false;
            replyParts.push(`❌ Prompt update failed: ${res2.error}`);
          }
        }

        if (replyParts.length === 0) {
          replyParts.push('No options provided; nothing to change.');
        }

        await interaction.reply({
          content: `${overallSuccess ? '✅' : '⚠️'} ${replyParts.join('\n')}`,
          ephemeral: true,
        });
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

        const embed = new EmbedBuilder()
          .setColor(0x4f3ff0)
          .setTitle('🔐 Gateway Verification Dashboard')
          .setDescription('Complete verification system status');

        const methodsList = [];
        if (config.methods?.button?.enabled) {
          const vRole = config.methods.button.verifiedRole ? `<@&${config.methods.button.verifiedRole}>` : `<@&${config.verifiedRole}> (global)`;
          const uRole = config.methods.button.unverifiedRole ? `<@&${config.methods.button.unverifiedRole}>` : `<@&${config.unverifiedRole}> (global)`;
          methodsList.push(`🔘 **Button**\n└ Channel: <#${config.methods.button.channel}>\n└ Verified: ${vRole}\n└ Unverified: ${uRole}`);
        }
        if (config.methods?.trigger?.enabled) {
          const vRole = config.methods.trigger.verifiedRole ? `<@&${config.methods.trigger.verifiedRole}>` : `<@&${config.verifiedRole}> (global)`;
          const uRole = config.methods.trigger.unverifiedRole ? `<@&${config.methods.trigger.unverifiedRole}>` : `<@&${config.unverifiedRole}> (global)`;
          methodsList.push(`💬 **Trigger**\n└ Channel: <#${config.methods.trigger.channel}>\n└ Word: \`${config.methods.trigger.triggerWord}\`\n└ Verified: ${vRole}\n└ Unverified: ${uRole}`);
        }
        if (config.methods?.slash?.enabled) {
          const vRole = config.methods.slash.verifiedRole ? `<@&${config.methods.slash.verifiedRole}>` : `<@&${config.verifiedRole}> (global)`;
          const uRole = config.methods.slash.unverifiedRole ? `<@&${config.methods.slash.unverifiedRole}>` : `<@&${config.unverifiedRole}> (global)`;
          methodsList.push(`⚡ **Slash (/verify)**\n└ Channel: <#${config.methods.slash.channel}>\n└ Verified: ${vRole}\n└ Unverified: ${uRole}`);
        }
        if (config.methods?.join?.enabled) {
          methodsList.push(`✨ **Join** - Automatic on member join`);
        }

        embed.addFields(
          {
            name: '🔄 Active Methods',
            value: methodsList.length > 0 ? methodsList.join('\n\n') : 'No methods configured',
            inline: false,
          },
          { name: '🏠 Global Verified Role', value: `<@&${config.verifiedRole}>`, inline: true },
          { name: '🚫 Global Unverified Role', value: `<@&${config.unverifiedRole}>`, inline: true },
          { name: '🔒 Lockdown Level', value: `${config.lockdownLevel || 0} (${['Normal', 'Simple Gauntlet', 'Strict Gauntlet', 'System Closed'][config.lockdownLevel] || 'Unknown'})`, inline: true }
        );

        if (config.adminLogChannel) {
          embed.addFields({ name: '📋 Admin Log Channel', value: `<#${config.adminLogChannel}>`, inline: true });
        }
        
        // show configured initial prompts if available
        const promptLines = [];
        if (config.initialMessage) {
          ['button', 'trigger', 'slash'].forEach(m => {
            const im = config.initialMessage[m] || {};
            if (im.title || im.desc) {
              promptLines.push(`**${m}**: ${im.title || '<no title>'}`);
            }
          });
        }
        if (promptLines.length > 0) {
          embed.addFields({ name: '✉️ Custom Prompts', value: promptLines.join('\n'), inline: false });
        }

        embed.setFooter({ text: 'Use /gateway setup to configure methods | /gateway set_admin_log for logging' })
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
