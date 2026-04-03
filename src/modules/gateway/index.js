import GatewayConfig from './schema.js';
import SecurityLog from './SecurityLogSchema.js';
import { VisualParser } from '../../core/VisualEngine/Parser.js';
import { evaluateRisk, recordJoin, observeBehavior, updateRisk, updateTrust } from './RiskEvaluator.js';
import AntiRaidMonitor from './AntiRaidMonitor.js';
import VerificationFlow from './VerificationFlow.js';
import DashboardManager from '../../core/DashboardManager.js';
import XPManager from '../leveling/XPManager.js';

const DEFAULT_TEMPLATES = {
  verify_start: {
    embeds: [
      {
        title: 'Guardian Gateway Verification',
        description: 'Welcome **{user.username}**! Complete the current step to continue.',
        color: '{risk.color}',
        fields: [
          { name: 'Mode', value: '{flow.mode}', inline: true },
          { name: 'Risk Level', value: '{risk.level}', inline: true },
          { name: 'Current Step', value: '{flow.currentStep}', inline: true },
          { name: 'Attempts Remaining', value: '{flow.attemptsLeft}/{flow.maxAttempts}', inline: true },
          { name: 'Behavior Score', value: '{flow.initialData.behaviorScore || 0}', inline: true },
          { name: 'Challenge', value: '{flow.currentStepData.prompt}', inline: false },
        ],
        footer: { text: 'This verification session expires if not completed in time.' },
      },
    ],
  },
  verify_step: {
    embeds: [
      {
        title: 'Guardian Gateway Verification',
        description: 'Step complete. Proceed with the next verification challenge.',
        color: '{risk.color}',
        fields: [
          { name: 'Mode', value: '{flow.mode}', inline: true },
          { name: 'Risk Level', value: '{risk.level}', inline: true },
          { name: 'Current Step', value: '{flow.currentStep}', inline: true },
          { name: 'Attempts Remaining', value: '{flow.attemptsLeft}/{flow.maxAttempts}', inline: true },
          { name: 'Behavior Score', value: '{flow.initialData.behaviorScore || 0}', inline: true },
          { name: 'Challenge', value: '{flow.currentStepData.prompt}', inline: false },
        ],
        footer: { text: 'Answer carefully; failing too many attempts will end the flow.' },
      },
    ],
  },
  verify_success: {
    embeds: [
      {
        title: '✅ Verification Passed',
        description: '{user.username} has successfully completed verification.',
        color: '#2ecc71',
      },
    ],
  },
  verify_fail: {
    embeds: [
      {
        title: '❌ Verification Failed',
        description: 'Verification has ended due to failed attempts or timeout.',
        color: '#e74c3c',
      },
    ],
  },
  verify_timeout: {
    embeds: [
      {
        title: '⌛ Verification Timed Out',
        description: 'The verification window expired. Please rejoin for a fresh challenge.',
        color: '#f39c12',
      },
    ],
  },
};

export default function GatewayModule(client) {
  const parser = new VisualParser();
  const antiRaidMonitor = new AntiRaidMonitor(client);
  const verificationFlow = new VerificationFlow(client);
  const xpManager = new XPManager();
  const configCache = new Map();
  
  // Tracking: DM entry flow
  const dmEntryTracking = new Map(); // userId -> { attempts: number, lastAttempt: timestamp }

  const gatewayState = {
    hardMode: false,
    lockdown: false,
    failCount: 0,
    maxFailsafeCount: 6,
    lastRecoveryCheck: Date.now(),
    recoveryInterval: 300000, // 5 minutes
    crashDetected: false,
    updateFailCount() {
      this.failCount += 1;
      if (this.failCount >= this.maxFailsafeCount) {
        this.hardMode = true;
      }
    },
    reset() {
      this.hardMode = false;
      this.lockdown = false;
      this.failCount = 0;
      this.crashDetected = false;
    },
    shouldForceHardMode(guildId) {
      return this.hardMode || antiRaidMonitor.getRaidStatus(guildId)?.active;
    },
    checkConcurrentSessions() {
      const currentCount = verificationFlow.sessionManager.getActiveSessionCount();
      return currentCount < maxConcurrentSessions;
    },
    checkInteractionSpam(userId) {
      const now = Date.now();
      const windowMs = 10_000; // 10 second window
      if (!interactionFrequency.has(userId)) {
        interactionFrequency.set(userId, { timestamps: [] });
      }
      const entry = interactionFrequency.get(userId);
      entry.timestamps = entry.timestamps.filter((ts) => ts > now - windowMs);
      return entry.timestamps.length;
    },
    recordInteraction(userId) {
      const now = Date.now();
      if (!interactionFrequency.has(userId)) {
        interactionFrequency.set(userId, { timestamps: [] });
      }
      interactionFrequency.get(userId).timestamps.push(now);
    },
    checkDmSpam(userId) {
      const now = Date.now();
      const windowMs = 60_000; // 1 minute
      const maxAttempts = 2;
      if (!dmEntryTracking.has(userId)) {
        dmEntryTracking.set(userId, { attempts: 0, lastAttempt: 0 });
      }
      const entry = dmEntryTracking.get(userId);
      if (now - entry.lastAttempt > windowMs) {
        entry.attempts = 0;
      }
      return entry.attempts >= maxAttempts;
    },
    recordDmAttempt(userId) {
      const now = Date.now();
      if (!dmEntryTracking.has(userId)) {
        dmEntryTracking.set(userId, { attempts: 0, lastAttempt: 0 });
      }
      const entry = dmEntryTracking.get(userId);
      entry.attempts += 1;
      entry.lastAttempt = now;
      dmEntryTracking.set(userId, entry);
    },
    checkSelfRecovery() {
      const now = Date.now();
      if (now - this.lastRecoveryCheck > this.recoveryInterval) {
        this.lastRecoveryCheck = now;
        
        // Check for crashed sessions
        const activeSessions = verificationFlow.sessionManager.getAllSessions();
        let recoveredCount = 0;
        
        for (const [sessionId, session] of activeSessions) {
          if (session.expiresAt < now) {
            verificationFlow.sessionManager.deleteSession(sessionId);
            recoveredCount++;
          }
        }
        
        if (recoveredCount > 0) {
          console.log(`[GatewayRecovery] Recovered ${recoveredCount} expired sessions`);
        }
        
        // Reset overload state
        if (this.crashDetected) {
          this.crashDetected = false;
          console.log('[GatewayRecovery] Recovered from overload state');
        }
        
        // Cleanup old interaction frequency records
        const cutoffTime = now - 60_000;
        for (const [userId, entry] of interactionFrequency.entries()) {
          entry.timestamps = entry.timestamps.filter((ts) => ts > cutoffTime);
          if (entry.timestamps.length === 0) {
            interactionFrequency.delete(userId);
          }
        }

        // Cleanup old DM tracking
        for (const [userId, entry] of dmEntryTracking.entries()) {
          if (now - entry.lastAttempt > 300_000) { // 5 minutes
            dmEntryTracking.delete(userId);
          }
        }
      }
    },
  };

  let dashboardManager = null;
  const gatewayApi = {
    loadConfig,
    handleDashboardAction: async () => {},
  };

  async function loadConfig(guildId) {
    if (!guildId) return null;
    if (configCache.has(guildId)) {
      return configCache.get(guildId);
    }

    let config = await GatewayConfig.findOne({ guildId });
    if (!config) {
      config = await GatewayConfig.create({ guildId });
    }

    configCache.set(guildId, config);
    client.gateway = client.gateway || {};
    client.gateway.configCache = client.gateway.configCache || configCache;
    return config;
  }

  function renderVisual(payload, context = {}) {
    return parser.parse(payload, context);
  }

  function getTemplate(config, templateType) {
    return config?.visualTemplates?.verification?.[templateType] || DEFAULT_TEMPLATES[templateType];
  }

  function buildContext(member, flow, risk, antiRaid) {
    return {
      user: member.user,
      guild: member.guild,
      flow,
      risk,
      antiRaid,
      state: flow?.currentStep || 'initial',
    };
  }

  function clampScore(value) {
    return Math.max(0, Math.min(100, Math.round(value || 0)));
  }

  function buildVisualPayload(templateType, config, context) {
    const template = JSON.parse(JSON.stringify(getTemplate(config, templateType) || DEFAULT_TEMPLATES.verify_start));
    if (context.flow?.currentStepData?.components) {
      template.components = context.flow.currentStepData.components;
    }
    return renderVisual(template, context);
  }

  async function sendRichMessage(target, payload, context = {}) {
    const rendered = renderVisual(payload, context);
    if (!rendered || (!rendered.embeds?.length && !rendered.components?.length)) {
      return null;
    }
    return target.send(rendered).catch((error) => {
      console.error('[GatewayModule] sendRichMessage failed:', error.message || error);
      return null;
    });
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function animateVerification(interaction, finalPayload) {
    try {
      await interaction.editReply({ content: '🔄 Verifying...', embeds: [], components: [] });
      await delay(700);
      await interaction.editReply({ content: '⏳ Processing...', embeds: [], components: [] });
      await delay(700);
      await interaction.editReply(finalPayload);
    } catch (error) {
      console.error('[GatewayModule] animateVerification failed:', error.message || error);
      await interaction.editReply(finalPayload).catch(() => {});
    }
  }

  async function handleMemberAdd(member) {
    if (!member.guild || member.user.bot) return;
    if (gatewayState.lockdown) {
      dashboardManager?.trackGuild(member.guild.id);
      return;
    }

    const config = await loadConfig(member.guild.id);
    if (!config?.enabled) return;

    // إضافة دور unverified
    if (config.unverifiedRole) {
      try {
        const unverifiedRole = member.guild.roles.cache.get(config.unverifiedRole);
        if (unverifiedRole && member.guild.members.me.permissions.has('ManageRoles')) {
          await member.roles.add(unverifiedRole, '[Gateway] Unverified member');
        }
      } catch (error) {
        console.warn('[GatewayModule] Failed to add unverified role:', error.message);
      }
    }

    // إرسال رسالة DM الترحيب
    try {
      const dmMessage = config?.visualTemplates?.welcome && Object.keys(config.visualTemplates.welcome).length > 0
        ? config.visualTemplates.welcome
        : {
            embeds: [
              {
                title: '👋 أهلاً في السيرفر!',
                description: 'لتتمكن من الوصول للسيرفر، اكتب **"ابدأ"** في هذه الرسالة الخاصة للبدء بالتحقق.',
                color: 0x3498db,
                footer: { text: 'هذه عملية مرة واحدة فقط للأمان.' },
              },
            ],
          };
      
      await member.send(dmMessage).catch(async (error) => {
        console.warn('[GatewayModule] Failed to send DM to member:', error.message);

        const channelId = config?.verificationChannel;
        const fallbackChannel = channelId ? member.guild.channels.cache.get(channelId) : null;
        const candidate = fallbackChannel || member.guild.channels.cache.find((c) => c.name.toLowerCase().includes('verification') && c.isTextBased());

        if (candidate) {
          const fallbackEmbed = {
            title: '👋 مرحباً!',
            description: 'من فضلك افتح الرسائل الخاصة ثم اضغط زر البداية أو اضغط هنا لبدء التحقق.',
            color: 0x3498db,
          };

          await candidate.send({
            content: `${member}`,
            embeds: [fallbackEmbed],
            components: [{
              type: 1,
              components: [{
                type: 2,
                label: 'ابدأ التحقق',
                custom_id: `gateway_entry_${member.id}`,
                style: 3,
              }],
            }],
          }).catch(() => {});
        }
      });
    } catch (error) {
      console.warn('[GatewayModule] DM handler error:', error.message);
    }

    dashboardManager?.trackGuild(member.guild.id);
  }

  async function startVerification(member) {
    const config = await loadConfig(member.guild.id);
    if (!config?.enabled) return;

    const antiRaidData = antiRaidMonitor.trackJoin(member, config);
    const rejoinSignal = recordJoin(member);
    const risk = evaluateRisk(member, {
      rejoinAdjustment: rejoinSignal.adjustment,
      reasons: rejoinSignal.reasons,
      adjustment: antiRaidData.adjustment,
      thresholds: config.riskThresholds,
    });

    await xpManager.setRiskScore(member, risk.score).catch(() => {});

    // Check global concurrent session limit
    if (!gatewayState.checkConcurrentSessions()) {
      const response = {
        embeds: [{
          title: '⚠️ Server Overloaded',
          description: 'Too many verification sessions are active. Please try again in a moment.',
          color: 0xf39c12,
        }],
      };
      try {
        await sendRichMessage(member, response, {});
      } catch {}
      return;
    }

    const overrideMode = antiRaidData.forceHardMode || gatewayState.shouldForceHardMode(member.guild.id) ? 'HARD++' : null;
    const flow = verificationFlow.createFlow(member, risk, config, overrideMode, true);
    dashboardManager?.trackGuild(member.guild.id);

    const context = buildContext(member, flow, risk, antiRaidData);
    const payload = buildVisualPayload('verify_start', config, context);

    try {
      await sendRichMessage(member, payload, context);
    } catch (error) {
      console.warn('[GatewayModule] Failed to send verification start:', error.message);
    }
  }

  async function handleVerificationSuccess(member, session) {
    if (!member || !member.guild) return;
    const config = await loadConfig(member.guild.id);
    const unverifiedRoleId = config?.unverifiedRole;
    const verifiedRoleId = config?.verifiedRole;

    try {
      if (unverifiedRoleId && member.roles.cache.has(unverifiedRoleId)) {
        await member.roles.remove(unverifiedRoleId, '[Gateway] Verification passed').catch(() => {});
      }
      if (verifiedRoleId) {
        await member.roles.add(verifiedRoleId, '[Gateway] Verification passed').catch(() => {});
      }
    } catch (error) {
      console.error('[GatewayModule] handleVerificationSuccess role update failed:', error.message);
    }

    await verificationFlow.sessionManager?.deleteSession?.(session?.sessionId);
  }

  async function handleVerificationFailure(member, session) {
    if (!member || !member.guild) return;
    const config = await loadConfig(member.guild.id);
    const modeSettings = config?.verification?.[session?.mode?.toLowerCase()] || {};

    if (modeSettings.kickOnFailure && member.guild.members.me?.permissions.has('KickMembers')) {
      member.kick('[Gateway] Failed verification').catch(() => {});
      return;
    }

    if (member.guild.members.me?.permissions.has('ModerateMembers')) {
      member.timeout(90_000, '[Gateway] Failed verification').catch(() => {});
    }

    await verificationFlow.sessionManager?.deleteSession?.(session?.sessionId);
  }

  async function saveVisualTemplate(guildId, templateType, templatePayload) {
    const config = await loadConfig(guildId);
    if (!config.visualTemplates) config.visualTemplates = {};
    if (!config.visualTemplates.verification) config.visualTemplates.verification = {};
    config.visualTemplates.verification[templateType] = templatePayload;
    await config.save();
    configCache.set(guildId, config);
    return config;
  }

  async function getVisualTemplate(guildId, templateType) {
    const config = await loadConfig(guildId);
    return config.visualTemplates?.verification?.[templateType] || null;
  }

  async function simulateFlow(interaction, overrideMode = null, adjustment = 0) {
    const member = interaction.member;
    if (!member || !interaction.guild) {
      throw new Error('Unable to resolve guild member for simulation.');
    }

    const config = await loadConfig(interaction.guild.id);
    const rejoinSignal = recordJoin(member);
    const risk = evaluateRisk(member, {
      rejoinAdjustment: rejoinSignal.adjustment,
      reasons: rejoinSignal.reasons,
      adjustment,
      thresholds: config.riskThresholds,
    });

    const flow = verificationFlow.createFlow(member, risk, config, overrideMode, false);
    const context = buildContext(member, flow, risk, antiRaidMonitor.getRaidStatus(interaction.guild.id));
    const payload = buildVisualPayload('verify_start', config, context);

    return { flow, payload, risk, config };
  }

  async function handleDashboardAction(interaction, action) {
    const guildId = interaction.guild?.id;
    if (!guildId) return false;

    switch (action) {
      case 'lockdown':
        gatewayState.lockdown = true;
        await interaction.reply({ content: 'Gateway is now in lockdown mode. New verification sessions will be paused.', ephemeral: true }).catch(() => {});
        break;
      case 'unlock':
        gatewayState.lockdown = false;
        gatewayState.failCount = 0;
        await interaction.reply({ content: 'Gateway lockdown has been lifted.', ephemeral: true }).catch(() => {});
        break;
      case 'forcehard':
        gatewayState.hardMode = true;
        await interaction.reply({ content: 'Gateway will now prioritize HARD mode for new flows.', ephemeral: true }).catch(() => {});
        break;
      case 'reset':
        gatewayState.reset();
        dashboardManager?.failedAttempts.delete(guildId);
        await interaction.reply({ content: 'Gateway statistics and failsafe state have been reset.', ephemeral: true }).catch(() => {});
        break;
      default:
        await interaction.reply({ content: 'Unknown dashboard action.', ephemeral: true }).catch(() => {});
        return false;
    }

    dashboardManager?.trackGuild(guildId);
    return true;
  }

  async function handleGatewayInteraction(interaction) {
    // معالجة زرار البداية من الخاص
    if (interaction.customId?.startsWith('gateway_start_verify_')) {
      const userId = interaction.customId.replace('gateway_start_verify_', '');
      if (userId !== interaction.user.id) {
        await interaction.reply({ content: 'هذا الزر ليس لك.', ephemeral: true }).catch(() => {});
        return true;
      }

      try {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
        if (member) {
          await startVerification(member);
          await interaction.editReply({ content: '✅ تم بدء التحقق! تحقق من الرسائل الخاصة.' }).catch(() => {});
        } else {
          await interaction.editReply({ content: '❌ خطأ: لم يتمكن من الحصول على بيانات العضو.' }).catch(() => {});
        }
      } catch (error) {
        console.error('[GatewayModule] Start verification error:', error.message);
        await interaction.editReply({ content: '❌ حدث خطأ أثناء بدء التحقق.' }).catch(() => {});
      }
      return true;
    }

    // معالجة زرار الدخول (من Channel fallback)
    if (interaction.customId?.startsWith('gateway_entry_')) {
      const userId = interaction.customId.replace('gateway_entry_', '');
      if (userId !== interaction.user.id) {
        await interaction.reply({ content: 'هذا الزر ليس لك.', ephemeral: true }).catch(() => {});
        return true;
      }

      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      await startVerification(interaction.member);
      await interaction.editReply({ content: '✅ تم بدء التحقق! تحقق من الرسائل الخاصة.' }).catch(() => {});
      return true;
    }

    // معالجة زرار لوحة التحكم
    if (interaction.customId?.startsWith('gateway_dashboard_')) {
      return dashboardManager?.handleControlAction(interaction) || false;
    }

    // التحقق من الأساسيات
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: 'لم يتمكن من تحديد حالة العضو.', ephemeral: true }).catch(() => {});
      return true;
    }

    if (!interaction.customId?.startsWith('gateway_v4_')) {
      return false;
    }

    // استخراج بيانات التحقق
    const flowData = verificationFlow.extractInteractionData(interaction);
    if (!flowData.sessionId) {
      await interaction.reply({ content: '❌ رمز التحقق غير صحيح.', ephemeral: true }).catch(() => {});
      return true;
    }

    // الحصول على الـ session
    const session = verificationFlow.getFlowById(flowData.sessionId);
    if (!session) {
      await interaction.reply({ content: '❌ جلسة التحقق لم تعد صحيحة.', ephemeral: true }).catch(() => {});
      return true;
    }

    // التحقق من الملكية
    if (session.userId !== interaction.user.id) {
      await interaction.reply({ content: '❌ هذا التحقق ليس لك.', ephemeral: true }).catch(() => {});
      return true;
    }

    // Anti-spam soft limit: عد التفاعلات ولكن لا توقف العملية تماماً
    const spamCount = gatewayState.checkInteractionSpam(interaction.user.id);
    gatewayState.recordInteraction(interaction.user.id);
    if (spamCount >= 5) {
      await interaction.reply({ content: '⚠️ أنت تتفاعل بسرعة، الرجاء التمهل قليلاً.', ephemeral: true }).catch(() => {});
      await SecurityLog.create({
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        eventType: 'interaction_spam',
        severity: 'low',
        reason: 'Soft limit reached for rapid interactions',
        metadata: { sessionId: session?.sessionId, spamCount },
      }).catch(() => {});
      // allow continued processing with hardened checks.
    }

    // Rate limiting
    if (verificationFlow.sessionManager.isRateLimited(interaction.user.id)) {
      await interaction.reply({ content: 'يرجى الانتظار قليلاً قبل التفاعل مرة أخرى.', ephemeral: true }).catch(() => {});
      return true;
    }

    verificationFlow.sessionManager.touchInteraction(interaction.user.id);
    
    try {
      await interaction.deferUpdate().catch(() => {});
    } catch {}

    const config = await loadConfig(interaction.guild.id);
    const antiRaidStatus = antiRaidMonitor.getRaidStatus(interaction.guild.id);

    // معالجة التفاعل
    const result = verificationFlow.processInteraction(interaction);
    const activeSession = result.session || session;
    const computedRisk = activeSession?.risk || { score: 0, level: 'EASY', color: '#2ecc71', reasons: [] };

    if (result.status === 'missing') {
      const payload = buildVisualPayload('verify_fail', config, buildContext(interaction.member, activeSession, computedRisk, antiRaidStatus));
      await interaction.editReply(payload).catch(() => {});
      return true;
    }

    if (result.status === 'timeout') {
      gatewayState.updateFailCount();
      dashboardManager?.recordFailedAttempt(interaction.guild.id);
      const payload = buildVisualPayload('verify_timeout', config, buildContext(interaction.member, activeSession, computedRisk, antiRaidStatus));
      await animateVerification(interaction, payload);
      return true;
    }

    if (result.status === 'failed') {
      gatewayState.updateFailCount();
      dashboardManager?.recordFailedAttempt(interaction.guild.id);
      const payload = buildVisualPayload('verify_fail', config, buildContext(interaction.member, activeSession, computedRisk, antiRaidStatus));
      await animateVerification(interaction, payload);
      await handleVerificationFailure(interaction.member, activeSession).catch(() => {});
      return true;
    }

    if (result.status === 'success') {
      const payload = buildVisualPayload('verify_success', config, buildContext(interaction.member, activeSession, computedRisk, antiRaidStatus));
      await animateVerification(interaction, payload);
      await handleVerificationSuccess(interaction.member, activeSession);
      return true;
    }

    if (result.status === 'advance' || result.status === 'retry') {
      const payload = buildVisualPayload('verify_step', config, buildContext(interaction.member, activeSession, computedRisk, antiRaidStatus));
      await interaction.editReply(payload).catch(() => {});
      return true;
    }

    // Default fallback
    const payload = buildVisualPayload('verify_fail', config, buildContext(interaction.member, activeSession, computedRisk, antiRaidStatus));
    await interaction.editReply(payload).catch(() => {});
    return true;
  }

  async function handleButtonInteraction(interaction) {
    if (!interaction.isButton()) return false;
    try {
      return await handleGatewayInteraction(interaction);
    } catch (error) {
      console.error('[GatewayModule] Button interaction error:', error);
      return true; // Mark as handled even on error
    }
  }

  async function handleSelectMenuInteraction(interaction) {
    if (!interaction.isStringSelectMenu()) return false;
    try {
      return await handleGatewayInteraction(interaction);
    } catch (error) {
      console.error('[GatewayModule] Select menu interaction error:', error);
      return true; // Mark as handled even on error
    }
  }

  dashboardManager = new DashboardManager(client, verificationFlow.sessionManager, antiRaidMonitor, gatewayApi);
  gatewayApi.handleDashboardAction = handleDashboardAction;

  // Start self-recovery monitoring
  setInterval(() => {
    gatewayState.checkSelfRecovery();
  }, gatewayState.recoveryInterval);

  async function setConfig(guildId, updates = {}) {
    if (!guildId) return null;
    const config = await GatewayConfig.findOneAndUpdate({ guildId }, { $set: updates }, { new: true, upsert: true });
    configCache.set(guildId, config);
    return config;
  }

  async function getStatus(guildId) {
    const config = await loadConfig(guildId);
    const sessions = verificationFlow.sessionManager.getAllSessionsList();
    const guildSessions = sessions.filter((s) => s.initialData?.guildId === guildId);
    const raidStatus = antiRaidMonitor.getRaidStatus(guildId);
    return {
      guildId,
      enabled: config?.enabled ?? false,
      sessions: guildSessions.length,
      activeSessions: guildSessions.filter((s) => s.status === 'pending').length,
      raidStatus,
    };
  }

  async function startVerificationForUser(user, guild) {
    if (!user || !guild) return null;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return null;
    await startVerification(member);
    return member;
  }

  return {
    handleMemberAdd,
    handleButtonInteraction,
    handleSelectMenuInteraction,
    handleModalSubmit: async (interaction) => {
      try {
        if (!interaction.isModalSubmit?.()) return false;
        if (!interaction.customId?.startsWith('gateway_v4_')) return false;
        return await handleGatewayInteraction(interaction);
      } catch (error) {
        console.error('[GatewayModule] Modal submission error:', error);
        return true;
      }
    },
    loadConfig,
    saveVisualTemplate,
    getVisualTemplate,
    simulateFlow,
    startVerification,
    startVerificationForUser,
    setConfig,
    getStatus,
    getSecurityLogs: (guildId, userId) => verificationFlow.getSecurityLogs(guildId, userId),
  };
}
