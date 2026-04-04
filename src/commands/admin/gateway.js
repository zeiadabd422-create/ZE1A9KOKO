import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { gatewayConfigService } from '../../services/GatewayConfigService.js';

// =========================================
//  CONSTANTS & LOCALIZATION
// =========================================
const LOCALES = {
  AR: {
    validation_same_role: '❌ الرولين لا يمكن أن يكونا نفس الشيء',
    validation_no_permissions: '❌ البوت لا يملك صلاحية "Manage Roles"',
    validation_role_above: '❌ البوت لا يملك رتبة أعلى من الرول المحدد',
    setup_roles_success: '✅ تم حفظ الرتب بنجاح\n• **Unverified**: {unverified}\n• **Verified**: {verified}',
    setup_channel_success: '✅ تم تعيين قناة التحقق: {channel}',
    setup_messages_success: '✅ تم حفظ الرسائل بنجاح',
    setup_flow_success: '✅ تم حفظ إعدادات الفلو\n• **Mode**: {mode}\n• **Steps Count**: {steps}',
    start_already_session: '⚠️ المستخدم لديه جلسة تحقق نشطة بالفعل',
    start_no_user: '❌ لم يتم العثور على المستخدم في السيرفر',
    start_success: '✅ تم بدء التحقق لـ **{user}**',
    status_header: '📊 حالة نظام Gateway',
    status_sessions: '📌 الجلسات النشطة: **{active}/{total}**',
    status_failures: '❌ الفشل: **{fails}**',
    status_raid_active: '🚨 وضع مكافحة الغزو: **مُفعّل**',
    status_raid_inactive: '✅ وضع مكافحة الغزو: **معطّل**',
    status_verified: '✅ الأعضاء المتحققون: **{verified}**',
    status_unverified: '⏳ الأعضاء في الانتظار: **{unverified}**',
    error_command: '❌ حدث خطأ أثناء تنفيذ الأمر',
    error_gateway: '❌ وحدة Gateway غير متاحة',
    error_db: '❌ خطأ في قاعدة البيانات',
    ratelimit_exceeded: '⏰ قلت من الطلبات بسرعة كبيرة، انتظر قليلاً',
  },
  EN: {
    validation_same_role: '❌ Both roles cannot be the same',
    validation_no_permissions: '❌ Bot lacks "Manage Roles" permission',
    validation_role_above: '❌ Bot role is not above selected role',
    setup_roles_success: '✅ Role configuration saved\n• **Unverified**: {unverified}\n• **Verified**: {verified}',
    setup_channel_success: '✅ Verification channel set: {channel}',
    setup_messages_success: '✅ Messages saved successfully',
    setup_flow_success: '✅ Flow settings saved\n• **Mode**: {mode}\n• **Steps Count**: {steps}',
    start_already_session: '⚠️ User already has an active verification session',
    start_no_user: '❌ User not found in guild',
    start_success: '✅ Verification started for **{user}**',
    status_header: '📊 Gateway System Status',
    status_sessions: '📌 Active Sessions: **{active}/{total}**',
    status_failures: '❌ Failures: **{fails}**',
    status_raid_active: '🚨 Anti-Raid Mode: **ACTIVE**',
    status_raid_inactive: '✅ Anti-Raid Mode: **INACTIVE**',
    status_verified: '✅ Verified Members: **{verified}**',
    status_unverified: '⏳ Pending Members: **{unverified}**',
    error_command: '❌ Command execution failed',
    error_gateway: '❌ Gateway module unavailable',
    error_db: '❌ Database error',
    ratelimit_exceeded: '⏰ Rate limited. Please wait.',
  },
};

// Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_ATTEMPTS_PER_WINDOW = 5;

// =========================================
//  HELPER FUNCTIONS
// =========================================

function getLocale(interaction) {
  const userLocale = interaction.user?.locale || 'en-US';
  return userLocale.startsWith('ar') ? 'AR' : 'EN';
}

function t(interaction, key, replacements = {}) {
  const locale = getLocale(interaction);
  let text = LOCALES[locale][key] || LOCALES.EN[key] || key;

  for (const [tag, value] of Object.entries(replacements)) {
    text = text.replace(`{${tag}}`, value);
  }

  return text;
}

function checkRateLimit(userId) {
  const now = Date.now();
  const record = rateLimitMap.get(userId);

  if (!record) {
    rateLimitMap.set(userId, { attempts: 1, lastAttempt: now });
    return true;
  }

  if (now - record.lastAttempt > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(userId, { attempts: 1, lastAttempt: now });
    return true;
  }

  if (record.attempts >= MAX_ATTEMPTS_PER_WINDOW) {
    return false;
  }

  record.attempts += 1;
  return true;
}

async function validateRoles(interaction, unverifiedRole, verifiedRole) {
  const errors = [];

  if (unverifiedRole.id === verifiedRole.id) {
    errors.push(t(interaction, 'validation_same_role'));
  }

  if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    errors.push(t(interaction, 'validation_no_permissions'));
  }

  const botHighestRole = interaction.guild.members.me.roles.highest;
  if (botHighestRole.comparePositionTo(unverifiedRole) <= 0 || botHighestRole.comparePositionTo(verifiedRole) <= 0) {
    errors.push(t(interaction, 'validation_role_above'));
  }

  return errors;
}

async function getGuildConfig(guildId) {
  // Get config from service with MongoDB persistence
  return await gatewayConfigService.getConfig(guildId);
}

async function setGuildConfig(guildId, config) {
  // Set config via service with MongoDB persistence
  return await gatewayConfigService.setConfig(guildId, config);
}

async function getGuildStats(guildId) {
  let verified = 0, unverified = 0;

  try {
    const guild = global.client?.guilds.cache.get(guildId);
    if (guild) {
      const config = await getGuildConfig(guildId);

      if (config?.roles?.successRoleId) {
        verified = guild.roles.cache.get(config.roles.successRoleId)?.members.size || 0;
      }
      if (config?.roles?.failureRoleId) {
        unverified = guild.roles.cache.get(config.roles.failureRoleId)?.members.size || 0;
      }
    }
  } catch (error) {
    console.error('[Gateway] Stats fetch error:', error);
  }

  return { verified, unverified };
}

// =========================================
//  SLASH COMMAND DEFINITION
// =========================================

export default {
  data: new SlashCommandBuilder()
    .setName('gateway')
    .setDescription('Gateway verification system configuration and management')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)

    // Setup Subcommand Group
    .addSubcommandGroup((group) =>
      group
        .setName('setup')
        .setDescription('Configure Gateway verification settings')

        // Setup Roles
        .addSubcommand((sub) =>
          sub
            .setName('roles')
            .setDescription('Configure unverified and verified roles (AR: إعداد الرتب)')
            .addRoleOption((opt) =>
              opt.setName('unverified_role')
                .setDescription('Role before verification (رتبة المنتظرين)')
                .setRequired(true)
            )
            .addRoleOption((opt) =>
              opt.setName('verified_role')
                .setDescription('Role after verification (رتبة المتحققين)')
                .setRequired(true)
            )
        )

        // Setup Channel
        .addSubcommand((sub) =>
          sub
            .setName('channel')
            .setDescription('Set fallback verification channel (قناة التحقق)')
            .addChannelOption((opt) =>
              opt.setName('verification_channel')
                .setDescription('Channel used when DM fails')
                .setRequired(true)
            )
        )

        // Setup Messages
        .addSubcommand((sub) =>
          sub
            .setName('messages')
            .setDescription('Configure message templates (الرسائل والـ Embeds)')
            .addStringOption((opt) =>
              opt.setName('welcome_message')
                .setDescription('Welcome text - Supports {user}, {guild}, {risk} placeholders')
                .setRequired(false)
            )
            .addStringOption((opt) =>
              opt.setName('verify_embed')
                .setDescription('Verification stage embed (JSON format)')
                .setRequired(false)
            )
            .addStringOption((opt) =>
              opt.setName('success_embed')
                .setDescription('Success embed (JSON format)')
                .setRequired(false)
            )
            .addStringOption((opt) =>
              opt.setName('fail_embed')
                .setDescription('Failure embed (JSON format)')
                .setRequired(false)
            )
        )

        // Setup Flow
        .addSubcommand((sub) =>
          sub
            .setName('flow')
            .setDescription('Configure verification flow difficulty')
            .addStringOption((opt) =>
              opt.setName('mode')
                .setDescription('Difficulty level')
                .setRequired(true)
                .addChoices(
                  { name: 'EASY - 3 attempts, 4 min', value: 'EASY' },
                  { name: 'NORMAL - 2 attempts, 2 min', value: 'NORMAL' },
                  { name: 'HARD - 1 attempt, 1.5 min', value: 'HARD' },
                  { name: 'HARD++ - 1 attempt, 1 min, kick', value: 'HARD++' }
                )
            )
            .addIntegerOption((opt) =>
              opt.setName('steps_count')
                .setDescription('Number of verification steps (1-5)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(5)
            )
        )
    )

    // Start Verification
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('Manually initiate verification for a user (بدء التحقق)')
        .addUserOption((opt) =>
          opt.setName('user')
            .setDescription('Target user to verify')
            .setRequired(true)
        )
    )

    // Status
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('View gateway system status and statistics (الحالة)')
    ),

  // =========================================
  //  EXECUTION
  // =========================================

  async execute(interaction) {
    try {
      // Rate limit
      if (!checkRateLimit(interaction.user.id)) {
        return interaction.reply({
          content: t(interaction, 'ratelimit_exceeded'),
          ephemeral: true,
        });
      }

      // Get gateway module
      const gateway = interaction.client?.container?.gateway;
      if (!gateway) {
        return interaction.reply({
          content: t(interaction, 'error_gateway'),
          ephemeral: true,
        });
      }

      const guildId = interaction.guildId;
      const subcommandGroup = interaction.options.getSubcommandGroup(false);
      const subcommand = interaction.options.getSubcommand(false);

      await interaction.deferReply({ ephemeral: true });

      // ===== SETUP GROUP =====
      if (subcommandGroup === 'setup') {
        const config = await getGuildConfig(guildId);

        switch (subcommand) {
          // Setup Roles
          case 'roles': {
            const unverifiedRole = interaction.options.getRole('unverified_role');
            const verifiedRole = interaction.options.getRole('verified_role');

            const errors = await validateRoles(interaction, unverifiedRole, verifiedRole);
            if (errors.length > 0) {
              return interaction.editReply(errors.join('\n'));
            }

            await gatewayConfigService.updateRoles(guildId, {
              successRoleId: verifiedRole.id,
              failureRoleId: unverifiedRole.id,
            });

            return interaction.editReply({
              content: t(interaction, 'setup_roles_success', {
                unverified: `<@&${unverifiedRole.id}>`,
                verified: `<@&${verifiedRole.id}>`,
              }),
            });
          }

          // Setup Channel
          case 'channel': {
            const channel = interaction.options.getChannel('verification_channel');

            await setGuildConfig(guildId, { 'settings.verificationChannel': channel.id });

            return interaction.editReply({
              content: t(interaction, 'setup_channel_success', {
                channel: `<#${channel.id}>`,
              }),
            });
          }

          // Setup Messages
          case 'messages': {
            const welcome = interaction.options.getString('welcome_message');
            const verify = interaction.options.getString('verify_embed');
            const success = interaction.options.getString('success_embed');
            const fail = interaction.options.getString('fail_embed');

            config.visualTemplates = config.visualTemplates || {};

            if (welcome) {
              config.visualTemplates.welcome = {
                content: welcome,
                placeholders: ['{user}', '{guild}', '{risk}'],
              };
            }

            if (verify) {
              try {
                config.visualTemplates.verification = config.visualTemplates.verification || {};
                config.visualTemplates.verification.verify_start = JSON.parse(verify);
              } catch (err) {
                return interaction.editReply('❌ Invalid JSON in verify_embed');
              }
            }

            if (success) {
              try {
                config.visualTemplates.verification = config.visualTemplates.verification || {};
                config.visualTemplates.verification.verify_success = JSON.parse(success);
              } catch (err) {
                return interaction.editReply('❌ Invalid JSON in success_embed');
              }
            }

            if (fail) {
              try {
                config.visualTemplates.verification = config.visualTemplates.verification || {};
                config.visualTemplates.verification.verify_fail = JSON.parse(fail);
              } catch (err) {
                return interaction.editReply('❌ Invalid JSON in fail_embed');
              }
            }

            await setGuildConfig(guildId, { visualTemplates: config.visualTemplates });

            return interaction.editReply({
              content: t(interaction, 'setup_messages_success'),
            });
          }

          // Setup Flow
          case 'flow': {
            const mode = interaction.options.getString('mode');
            const stepsCount = interaction.options.getInteger('steps_count') || 3;

            await setGuildConfig(guildId, { 'settings.difficulty': mode });

            return interaction.editReply({
              content: t(interaction, 'setup_flow_success', {
                mode,
                steps: stepsCount,
              }),
            });
          }

          default:
            return interaction.editReply('❌ Unknown setup command');
        }
      }

      // ===== START COMMAND =====
      if (subcommand === 'start') {
        const user = interaction.options.getUser('user');

        if (!user) {
          return interaction.editReply(t(interaction, 'start_no_user'));
        }

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
          return interaction.editReply(t(interaction, 'start_no_user'));
        }

        // Check active sessions
        const sessionMgr = gateway.verificationFlow?.sessionManager;
        if (sessionMgr) {
          const userSessions = Array.from(sessionMgr.sessionsById?.values?.() || []).filter(
            (s) => s.userId === user.id
          );
          if (userSessions.length > 0) {
            return interaction.editReply(t(interaction, 'start_already_session'));
          }
        }

        try {
          const result = await gateway.startVerification(user, interaction.guild);

          if (!result?.success && !result?.queued) {
            return interaction.editReply({
              content: '❌ Failed to start verification. Please try again.',
            });
          }

          return interaction.editReply({
            content: result.queued 
              ? `⏳ User added to verification queue at position #${result.position}`
              : t(interaction, 'start_success', { user: user.tag }),
          });
        } catch (error) {
          console.error('[Gateway] Start verification error:', error);
          return interaction.editReply(t(interaction, 'error_command'));
        }
      }

      // ===== STATUS COMMAND =====
      if (subcommand === 'status') {
        try {
          const status = gateway.getStatus();
          const stats = await getGuildStats(guildId);

          const embed = new EmbedBuilder()
            .setTitle(t(interaction, 'status_header'))
            .setColor(0x3498db)
            .addFields([
              {
                name: '📌 Sessions',
                value: t(interaction, 'status_sessions', {
                  active: status.activeSessions || 0,
                  total: status.sessions || 0,
                }),
                inline: true,
              },
              {
                name: '❌ Failures',
                value: t(interaction, 'status_failures', {
                  fails: status.failCount || 0,
                }),
                inline: true,
              },
              {
                name: '🛡️ Security',
                value:
                  status.raidStatus?.active || false
                    ? t(interaction, 'status_raid_active')
                    : t(interaction, 'status_raid_inactive'),
                inline: false,
              },
              {
                name: '👥 Members',
                value: [
                  t(interaction, 'status_verified', { verified: stats.verified || 0 }),
                  t(interaction, 'status_unverified', { unverified: stats.unverified || 0 }),
                ].join('\n'),
                inline: false,
              },
              {
                name: '⚙️ Configuration',
                value: [
                  `**Mode**: ${config.settings?.difficulty || 'EASY'}`,
                  `**Verified Role**: ${config.roles?.successRoleId ? `<@&${config.roles.successRoleId}>` : 'Not Set'}`,
                  `**Unverified Role**: ${config.roles?.failureRoleId ? `<@&${config.roles.failureRoleId}>` : 'Not Set'}`,
                  `**Fallback Channel**: ${config.settings?.verificationChannel ? `<#${config.settings.verificationChannel}>` : 'Not Set'}`,
                ].join('\n'),
                inline: false,
              },
            ])
            .setFooter({ text: 'Last updated at' })
            .setTimestamp();

          return interaction.editReply({
            embeds: [embed],
          });
        } catch (error) {
          console.error('[Gateway] Status error:', error);
          return interaction.editReply(t(interaction, 'error_command'));
        }
      }

      return interaction.editReply('❌ Unknown command');
    } catch (error) {
      console.error('[Gateway Command] Critical error:', error);

      if (interaction.deferred) {
        return interaction.editReply(t(interaction, 'error_command'));
      }

      return interaction.reply({
        content: t(interaction, 'error_command'),
        ephemeral: true,
      });
    }
  },
};
