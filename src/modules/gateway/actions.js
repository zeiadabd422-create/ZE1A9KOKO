import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import GatewayConfig from './schema.js';
import { calculateRiskScore, getRiskLevel } from './RiskEngine.js';
import { VisualParser } from '../../core/VisualEngine/Parser.js';

export const DEFAULT_ID_CARD = `**✅ Digital ID Pass Issued**

> 👤 **Member:** {user}
> 🏅 **Join Position:** #{join_pos}
> 📅 **Account Age:** {account_age} days
> 📥 **Joined Server:** {joined_at}
> 🟢 **Status:** Verified`;

const DEFAULT_TEMPLATE = {
  title: 'Verification Required',
  description: 'Please complete the verification to access the server.',
  color: '#2ecc71',
};

function buildContext(member, extra = {}) {
  return {
    user: member?.user ? `<@${member.user.id}>` : 'Unknown User',
    guild: member?.guild?.name || 'Unknown Guild',
    member_count: member?.guild?.memberCount ?? 0,
    join_pos: member?.guild?.memberCount ?? 0,
    account_age: member?.user?.createdTimestamp
      ? Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24))
      : 0,
    joined_at: member?.joinedAt ? member.joinedAt.toDateString() : 'Unknown',
    ...extra,
  };
}

async function renderVisual(payload, member, extraContext = {}) {
  const parser = new VisualParser();
  return await parser.parse(payload, buildContext(member, extraContext));
}

function resolveTemplate(config, pageKey = '', overrideMsg = '') {
  const pageTemplate = config?.[`${pageKey}UI`] || {};
  return {
    title:
      pageTemplate.title ||
      (pageKey === 'success' ? '✅ Verified' : pageKey === 'error' ? '❌ Error' : 'Notice'),
    description: overrideMsg || pageTemplate.desc || pageTemplate.description || DEFAULT_TEMPLATE.description,
    color: pageTemplate.color || '#2ecc71',
    image: pageTemplate.image || pageTemplate.imageUrl || undefined,
    footer:
      pageTemplate.footer && typeof pageTemplate.footer === 'string'
        ? { text: pageTemplate.footer }
        : pageTemplate.footer ||
          (pageTemplate.footerText ? { text: pageTemplate.footerText } : undefined),
    fields: pageTemplate.fields || [],
  };
}

export async function createEmbed(config, overrideMsg = '', pageKey = '', member = null) {
  try {
    const payload = {
      ...resolveTemplate(config, pageKey, overrideMsg),
      timestamp: new Date(),
    };
    const parsed = await renderVisual(payload, member);
    return parsed.embeds[0] || payload;
  } catch (error) {
    console.error('[GatewayActions] createEmbed failed:', error);
    return {
      title: pageKey === 'success' ? '✅ Verified' : pageKey === 'error' ? '❌ Error' : 'Notice',
      description: overrideMsg || 'An error occurred while generating the embed.',
      color: 0x2ecc71,
    };
  }
}

async function getMethodRoles(config, method) {
  return {
    verifiedRole: config?.methods?.[method]?.verifiedRole || config?.verifiedRole || config?.methods?.button?.verifiedRole || null,
    unverifiedRole: config?.methods?.[method]?.unverifiedRole || config?.unverifiedRole || config?.methods?.button?.unverifiedRole || null,
  };
}

async function assignVerifiedRoles(member, config, method = 'button') {
  const { verifiedRole, unverifiedRole } = await getMethodRoles(config, method);

  if (verifiedRole) {
    const role = member.guild.roles.cache.get(verifiedRole);
    if (role && !member.roles.cache.has(role.id)) {
      await member.roles.add(role).catch((err) => console.error('[GatewayActions] Failed to assign verified role:', err));
    }
  }

  if (unverifiedRole) {
    const role = member.guild.roles.cache.get(unverifiedRole);
    if (role && member.roles.cache.has(role.id)) {
      await member.roles.remove(role).catch((err) => console.error('[GatewayActions] Failed to remove unverified role:', err));
    }
  }
}

async function isAlreadyVerified(member, config, method = 'button') {
  const { verifiedRole } = await getMethodRoles(config, method);
  if (!verifiedRole) return false;
  return member.roles.cache.has(verifiedRole);
}

async function grantAccess(interaction, member) {
  try {
    await assignVerifiedRoles(member, interaction.config || {}, interaction.config?.method);
    const parsed = await renderVisual(
      {
        title: 'Verification Complete!',
        description: 'Welcome to the server! You now have access to all channels.',
        color: '#2ecc71',
      },
      member
    );
    await interaction.update({ embeds: parsed.embeds, components: [] });
  } catch (error) {
    console.error('[GatewayActions] grantAccess failed:', error);
    if (interaction?.isRepliable()) {
      await interaction.followUp({ content: 'Access granted, but there was an error updating your roles.', ephemeral: true });
    }
  }
}

async function startVerificationProcess(interaction, member, riskLevel) {
  const payload = {
    title: 'Verification Required',
    description: 'Please complete the verification to access the server.',
    color: riskLevel === 'MEDIUM' ? '#f39c12' : '#e74c3c',
    fields: [
      { name: 'Risk Level', value: riskLevel, inline: false },
      { name: 'Next Step', value: riskLevel === 'MEDIUM' ? 'Solve a simple captcha or answer a question.' : 'Complete a stricter verification flow.', inline: false },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: ButtonStyle.Primary,
            customId: riskLevel === 'MEDIUM' ? 'verify_captcha' : 'gateway_verify_hard',
            label: riskLevel === 'MEDIUM' ? 'Start Verification' : 'Start Strict Verification',
          },
          {
            type: 2,
            style: ButtonStyle.Secondary,
            customId: 'verify_cancel',
            label: 'Cancel',
          },
        ],
      },
    ],
  };

  const parsed = await renderVisual(payload, member);
  await interaction.update({ embeds: parsed.embeds, components: parsed.components });
}

export async function verifyMember(interactionOrMember, maybeConfig, maybeMethod = 'button') {
  let interaction = null;
  let member = null;
  let config = null;
  let method = maybeMethod;

  if (interactionOrMember?.isRepliable || interactionOrMember?.customId || interactionOrMember?.commandName) {
    interaction = interactionOrMember;
    member = maybeConfig;
    config = maybeMethod;
  } else {
    member = interactionOrMember;
    config = maybeConfig;
    method = maybeMethod;
  }

  if (!member && interaction?.member) member = interaction.member;
  if (!config && interaction?.guildId) config = await GatewayConfig.findOne({ guildId: interaction.guildId });

  if (!member || !config) {
    return { success: false, message: 'Verification request is missing required data.' };
  }

  if (await isAlreadyVerified(member, config, method)) {
    return { alreadyVerified: true, message: 'You are already verified.' };
  }

  const riskScore = calculateRiskScore(member);
  const riskLevel = getRiskLevel(riskScore);

  if (riskLevel === 'LOW') {
    await assignVerifiedRoles(member, config, method);
    if (interaction) {
      await grantAccess(interaction, member);
      return { success: true, riskScore, riskLevel };
    }
    return { success: true, riskScore, riskLevel };
  }

  if (interaction) {
    await startVerificationProcess(interaction, member, riskLevel);
    return { processing: true, riskScore, riskLevel };
  }

  return {
    success: false,
    message: 'Verification requires an interactive session. Please retry using a valid verification method.',
  };
}

export async function startStrictGauntlet(interaction, member) {
  try {
    const payload = {
      title: 'Strict Verification Required',
      description: 'Please complete the following verification steps:',
      color: '#e74c3c',
      fields: [
        { name: 'Step 1', value: 'Answer the security question below', inline: false },
        { name: 'Security Question', value: 'What is 2 + 2?', inline: false },
      ],
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: ButtonStyle.Primary, customId: 'gauntlet_answer_4', label: '4' },
            { type: 2, style: ButtonStyle.Secondary, customId: 'gauntlet_answer_5', label: '5' },
            { type: 2, style: ButtonStyle.Secondary, customId: 'gauntlet_answer_6', label: '6' },
          ],
        },
      ],
    };

    const parsed = await renderVisual(payload, member);
    await interaction.update({ embeds: parsed.embeds, components: parsed.components });
  } catch (error) {
    console.error('[GatewayActions] startStrictGauntlet failed:', error);
  }
}

export async function getLockdownResponse(member, config, method) {
  if (!config?.lockdownLevel || config.lockdownLevel <= 0) {
    return null;
  }

  const response = {
    lockdown: config.lockdownLevel,
    message: 'Security lockdown is active. Verification requires additional checks.',
  };

  if (config.lockdownLevel === 2) {
    response.token = `LOCK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  return response;
}

export async function sendVerificationPrompt(channel, config, method) {
  try {
    const messageTemplate = config?.initialMessage?.[method] || {
      title: '🔐 Server Verification',
      desc: 'Follow the instructions to verify your account.',
      image: '',
    };

    const payload = {
      title: messageTemplate.title,
      description: messageTemplate.desc,
      color: '#5865f2',
      image: messageTemplate.image || undefined,
    };

    const parsed = await renderVisual(payload, channel.guild?.me ? channel.guild.me : { guild: channel.guild });
    const message = await channel.send({ embeds: parsed.embeds, components: parsed.components });
    return { success: true, message };
  } catch (error) {
    console.error('[GatewayActions] sendVerificationPrompt failed:', error);
    return { success: false, error: error.message || 'Failed to send verification prompt.' };
  }
}

export async function startDMVerification(member, config) {
  try {
    const payload = {
      title: 'Verification Required',
      description: 'Please complete the verification steps sent to your DMs.',
      color: '#f39c12',
    };

    const parsed = await renderVisual(payload, member);
    const dm = await member.createDM();
    const message = await dm.send({ embeds: parsed.embeds, components: parsed.components });
    return { success: true, message };
  } catch (error) {
    console.error('[GatewayActions] startDMVerification failed:', error);
    return { success: false, dmFailed: true, dmErrorCode: error.code, error: error.message };
  }
}
