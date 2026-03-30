import GatewayConfig from './schema.js';
import { VisualParser } from '../../core/VisualEngine/Parser.js';
import { evaluateRisk } from './RiskEvaluator.js';
import AntiRaidMonitor from './AntiRaidMonitor.js';
import VerificationFlow from './VerificationFlow.js';
import XPManager from '../leveling/XPManager.js';

export default function GatewayModule(client) {
  const parser = new VisualParser();
  const antiRaidMonitor = new AntiRaidMonitor(client);
  const verificationFlow = new VerificationFlow(client);
  const xpManager = new XPManager();

  async function loadConfig(guildId) {
    let config = await GatewayConfig.findOne({ guildId });
    if (!config) {
      config = await GatewayConfig.create({ guildId });
    }
    client.gateway = client.gateway || {};
    client.gateway.config = config;
    return config;
  }

  function renderVisual(payload, context = {}) {
    return parser.parse(payload, context);
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

  async function handleMemberAdd(member) {
    if (!member.guild || member.user.bot) return;

    const config = await loadConfig(member.guild.id);
    if (!config.enabled) return;

    const antiRaidData = antiRaidMonitor.trackJoin(member);
    const risk = evaluateRisk(member, antiRaidData.adjustment, config.riskThresholds);
    await xpManager.setRiskScore(member, risk.score).catch(() => {});

    const flow = verificationFlow.createFlow(member, risk, config);
    const payload = verificationFlow.buildPromptPayload(flow, member);
    const context = { user: member.user, guild: member.guild, flow, risk, antiRaid: antiRaidData };

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
    config.visualTemplates[templateType] = templatePayload;
    await config.save();
    return config;
  }

  async function getVisualTemplate(guildId, templateType) {
    const config = await loadConfig(guildId);
    return config.visualTemplates?.[templateType] || null;
  }

  async function simulateFlow(interaction, overrideMode = null, adjustment = 0) {
    const member = interaction.member;
    if (!member || !interaction.guild) {
      throw new Error('Unable to resolve guild member for simulation.');
    }

    const config = await loadConfig(interaction.guild.id);
    const risk = evaluateRisk(member, adjustment, config.riskThresholds);
    const flow = verificationFlow.createFlow(member, risk, config, overrideMode, false);
    const payload = verificationFlow.buildPromptPayload(flow, member);

    return { flow, payload, risk, config };
  }

  async function handleButtonInteraction(interaction) {
    if (!interaction.isButton()) return false;
    const customId = interaction.customId;
    if (!customId?.startsWith('gateway_v3_')) return false;

    const member = interaction.member;
    if (!member) {
      await interaction.reply({ content: 'Unable to resolve your member state.', ephemeral: true }).catch(() => {});
      return true;
    }

    await interaction.deferUpdate().catch(() => {});
    const flow = verificationFlow.getFlow(member.id);
    if (!flow) {
      const payload = verificationFlow.buildStatusPayload(null, 'missing');
      await interaction.editReply(payload).catch(() => {});
      return true;
    }

    const answer = customId === 'gateway_v3_easy_confirm' ? 'confirm' : customId.replace('gateway_v3_answer_', '');
    const result = verificationFlow.validateResponse(member.id, answer);

    if (result.status === 'success') {
      const successPayload = verificationFlow.buildStatusPayload(result.flow, 'success');
      await interaction.editReply(successPayload).catch(() => {});
      return true;
    }

    if (result.status === 'timeout') {
      const timeoutPayload = verificationFlow.buildStatusPayload(result.flow, 'timeout');
      await interaction.editReply(timeoutPayload).catch(() => {});
      return true;
    }

    if (result.status === 'failed') {
      const failedPayload = verificationFlow.buildStatusPayload(result.flow, 'failed');
      await interaction.editReply(failedPayload).catch(() => {});
      return true;
    }

    if (result.status === 'retry') {
      const retryPayload = verificationFlow.buildPromptPayload(result.flow, member);
      await interaction.editReply(retryPayload).catch(() => {});
      return true;
    }

    const missingPayload = verificationFlow.buildStatusPayload(null, 'missing');
    await interaction.editReply(missingPayload).catch(() => {});
    return true;
  }

  async function observeMessage(message) {
    await antiRaidMonitor.observeMessage(message);
  }

  return {
    handleMemberAdd,
    handleButtonInteraction,
    observeMessage,
    loadConfig,
    saveVisualTemplate,
    getVisualTemplate,
    simulateFlow,
  };
}
