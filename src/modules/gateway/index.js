import GatewayConfig from './schema.js';
import { VisualParser } from '../../core/VisualEngine/Parser.js';
import { evaluateRisk, recordJoin, observeBehavior } from './RiskEvaluator.js';
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
  let dashboardManager = null;

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

    const overrideMode = antiRaidData.forceHardMode ? 'HARD' : null;
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

  async function handleGatewayInteraction(interaction) {
    const customId = interaction.customId;
    if (!customId?.startsWith('gateway_v4_')) return false;

    const member = interaction.member;
    if (!member || !interaction.guild) {
      await interaction.reply({ content: 'Unable to resolve your member state.', ephemeral: true }).catch(() => {});
      return true;
    }

    await interaction.deferUpdate().catch(() => {});
    const config = await loadConfig(interaction.guild.id);
    const antiRaidStatus = antiRaidMonitor.getRaidStatus(interaction.guild.id);
    const flowBehavior = observeBehavior(member, 'interaction');

    const result = verificationFlow.processInteraction(interaction);
    const session = result.session || null;
    const risk = session?.risk || { score: 0, level: 'EASY', color: '#2ecc71', reasons: [] };
    if (flowBehavior.adjustment && session) {
      session.risk = {
        ...risk,
        score: clampScore((risk.score || 0) + flowBehavior.adjustment),
        reasons: [...new Set([...(risk.reasons || []), flowBehavior.reason].filter(Boolean))],
      };
    }

    const context = buildContext(member, session || { currentStep: 'unknown' }, risk, antiRaidStatus);

    if (result.status === 'missing') {
      const payload = buildVisualPayload('verify_fail', config, context);
      await interaction.editReply(payload).catch(() => {});
      return true;
    }

    if (result.status === 'timeout') {
      const payload = buildVisualPayload('verify_timeout', config, context);
      await dashboardManager?.recordFailedAttempt(interaction.guild.id);
      await animateVerification(interaction, payload);
      return true;
    }

    if (result.status === 'failed') {
      const payload = buildVisualPayload('verify_fail', config, context);
      dashboardManager?.recordFailedAttempt(interaction.guild.id);
      if (session?.config?.verification?.[session.mode.toLowerCase()]?.kickOnFailure && interaction.guild.members.me?.permissions.has('KickMembers')) {
        interaction.guild.members.fetch(member.id).then((guildMember) => {
          if (guildMember.kickable) {
            guildMember.kick('Failed verification flow.').catch(() => {});
          }
        }).catch(() => {});
      }
      await animateVerification(interaction, payload);
      return true;
    }

    if (result.status === 'success') {
      const payload = buildVisualPayload('verify_success', config, context);
      await animateVerification(interaction, payload);
      return true;
    }

    if (result.status === 'advance' || result.status === 'retry') {
      const payload = buildVisualPayload('verify_step', config, context);
      await interaction.editReply(payload).catch(() => {});
      return true;
    }

    const payload = buildVisualPayload('verify_fail', config, context);
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
    observeBehavior(message.member, 'message');
    dashboardManager?.trackGuild(message.guild.id);
  }

  dashboardManager = new DashboardManager(client, verificationFlow.sessionManager, antiRaidMonitor, { loadConfig });

  return {
    handleMemberAdd,
    handleButtonInteraction,
    handleSelectMenuInteraction,
    observeMessage,
    loadConfig,
    saveVisualTemplate,
    getVisualTemplate,
    simulateFlow,
  };
}
