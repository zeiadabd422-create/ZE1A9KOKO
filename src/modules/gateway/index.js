import GatewayConfig from './schema.js';
import { VisualParser } from '../../core/VisualEngine/Parser.js';
import { evaluateRisk, recordJoin, observeBehavior, updateRisk } from './RiskEvaluator.js';
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

    const antiRaidData = antiRaidMonitor.trackJoin(member, config);
    const rejoinSignal = recordJoin(member);
    const risk = evaluateRisk(member, {
      rejoinAdjustment: rejoinSignal.adjustment,
      reasons: rejoinSignal.reasons,
      adjustment: antiRaidData.adjustment,
      thresholds: config.riskThresholds,
    });

    // Isolation hardening - remove all permissions before verification
    if (config.unverifiedRole) {
      try {
        const unverifiedRole = member.guild.roles.cache.get(config.unverifiedRole);
        if (unverifiedRole && member.guild.members.me.permissions.has('ManageRoles')) {
          await member.roles.add(unverifiedRole);
        }
      } catch (error) {
        console.warn('[GatewayModule] Failed to add unverified role:', error.message);
      }
    }

    await xpManager.setRiskScore(member, risk.score).catch(() => {});

    const overrideMode = antiRaidData.forceHardMode || gatewayState.shouldForceHardMode(member.guild.id) ? 'HARD++' : null;
    const flow = verificationFlow.createFlow(member, risk, config, overrideMode, true);
    dashboardManager?.trackGuild(member.guild.id);

    const context = buildContext(member, flow, risk, antiRaidData);
    const payload = buildVisualPayload('verify_start', config, context);

    try {
      await sendRichMessage(member, payload, context);
    } catch (error) {
      console.warn('[GatewayModule] DM failed, falling back to system channel:', error.message || error);
      const fallbackChannel = member.guild.systemChannel || member.guild.channels.cache.find((c) => c.isTextBased() && c.permissionsFor(member.guild.members.me).has('SendMessages'));
      if (fallbackChannel) {
        await sendRichMessage(fallbackChannel, payload, context).catch(() => {});
      }
    }
  }

  async function handleVerificationSuccess(member, session) {
    const config = await loadConfig(member.guild.id);
    
    // Isolation hardening - assign verified role only after full success
    if (config.verifiedRole) {
      try {
        const verifiedRole = member.guild.roles.cache.get(config.verifiedRole);
        if (verifiedRole && member.guild.members.me.permissions.has('ManageRoles')) {
          await member.roles.add(verifiedRole);
          
          // Remove unverified role
          if (config.unverifiedRole) {
            const unverifiedRole = member.guild.roles.cache.get(config.unverifiedRole);
            if (unverifiedRole) {
              await member.roles.remove(unverifiedRole);
            }
          }
        }
      } catch (error) {
        console.warn('[GatewayModule] Failed to assign verified role:', error.message);
      }
    }

    // Update trust score positively
    updateTrust({ member }, 10);

    // Log successful verification
    verificationFlow.logSecurityEvent('verification_success', {
      userId: member.id,
      guildId: member.guild.id,
      totalSteps: session.steps.length,
      behaviorScore: session.initialData.behaviorScore,
      suspiciousFlags: session.metadata.suspiciousFlags.length,
      completionTime: Date.now() - session.createdAt,
    });
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
    if (!interaction.customId?.startsWith('gateway_v4_')) return false;
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: 'Unable to resolve your member state.', ephemeral: true }).catch(() => {});
      return true;
    }

    if (interaction.customId.startsWith('gateway_dashboard_')) {
      return dashboardManager.handleControlAction(interaction);
    }

    const flowData = verificationFlow.extractInteractionData(interaction);
    if (!flowData.sessionId) {
      await interaction.reply({ content: 'Invalid verification token.', ephemeral: true }).catch(() => {});
      return true;
    }

    const session = verificationFlow.getFlowById(flowData.sessionId);
    if (!session) {
      await interaction.reply({ content: 'This verification session is no longer valid.', ephemeral: true }).catch(() => {});
      return true;
    }

    if (session.userId !== interaction.user.id) {
      await interaction.reply({ content: 'This verification flow is not yours.', ephemeral: true }).catch(() => {});
      return true;
    }

    if (verificationFlow.sessionManager.isRateLimited(interaction.user.id)) {
      await interaction.reply({ content: 'Please wait a moment before interacting again.', ephemeral: true }).catch(() => {});
      return true;
    }

    verificationFlow.sessionManager.touchInteraction(interaction.user.id);
    await interaction.deferUpdate().catch(() => {});

    const config = await loadConfig(interaction.guild.id);
    const antiRaidStatus = antiRaidMonitor.getRaidStatus(interaction.guild.id);

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
      if (activeSession?.config?.verification?.[activeSession.mode.toLowerCase()]?.kickOnFailure && interaction.guild.members.me?.permissions.has('KickMembers')) {
        interaction.guild.members.fetch(activeSession.userId).then((guildMember) => {
          if (guildMember.kickable) {
            guildMember.kick('Failed verification flow.').catch(() => {});
          }
        }).catch(() => {});
      }
      await animateVerification(interaction, payload);
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

    const payload = buildVisualPayload('verify_fail', config, buildContext(interaction.member, activeSession, computedRisk, antiRaidStatus));
    await interaction.editReply(payload).catch(() => {});
    return true;
  }

  async function handleButtonInteraction(interaction) {
    if (!interaction.isButton()) return false;
    return handleGatewayInteraction(interaction);
  }

  async function handleSelectMenuInteraction(interaction) {
    if (!interaction.isStringSelectMenu()) return false;
    return handleGatewayInteraction(interaction);
  }

  async function observeMessage(message) {
    if (!message.guild || message.author.bot) return;
    await antiRaidMonitor.observeMessage(message);
    const config = await loadConfig(message.guild.id);
    const riskUpdate = updateRisk(message.member, { eventType: 'message', thresholds: config?.riskThresholds });
    if (riskUpdate.risk.level === 'HARD' || riskUpdate.trustLevel === 'LOW') {
      gatewayState.hardMode = true;
    }
    dashboardManager?.trackGuild(message.guild.id);
  }

  dashboardManager = new DashboardManager(client, verificationFlow.sessionManager, antiRaidMonitor, gatewayApi);
  gatewayApi.handleDashboardAction = handleDashboardAction;

  // Start self-recovery monitoring
  setInterval(() => {
    gatewayState.checkSelfRecovery();
  }, gatewayState.recoveryInterval);

  return {
    handleMemberAdd,
    handleButtonInteraction,
    handleSelectMenuInteraction,
    observeMessage,
    loadConfig,
    saveVisualTemplate,
    getVisualTemplate,
    simulateFlow,
    getSecurityLogs: (guildId, userId) => verificationFlow.getSecurityLogs(guildId, userId),
  };
}
