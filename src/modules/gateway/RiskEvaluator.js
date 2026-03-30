const joinHistory = new Map();
const behaviorHistory = new Map();

const DEFAULT_THRESHOLDS = { easy: 30, normal: 70 };

function normalizeThresholds(thresholds = {}) {
  return {
    easy: Number(thresholds.easy ?? thresholds.lowToMedium ?? DEFAULT_THRESHOLDS.easy),
    normal: Number(thresholds.normal ?? thresholds.mediumToHigh ?? DEFAULT_THRESHOLDS.normal),
  };
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildBehaviorKey(member) {
  const guildId = member.guild?.id || 'unknown';
  return `${guildId}:${member.id}`;
}

export function getRiskLevel(score, thresholds = DEFAULT_THRESHOLDS) {
  if (score < thresholds.easy) return 'EASY';
  if (score < thresholds.normal) return 'NORMAL';
  return 'HARD';
}

export function getRiskColor(level) {
  switch (level) {
    case 'EASY':
      return '#2ecc71';
    case 'NORMAL':
      return '#f1c40f';
    case 'HARD':
      return '#e74c3c';
    default:
      return '#95a5a6';
  }
}

export function recordJoin(member) {
  const key = buildBehaviorKey(member);
  const now = Date.now();
  const recent = (joinHistory.get(key) || []).filter((ts) => ts > now - 300_000);
  const lastJoin = recent[recent.length - 1] || null;
  recent.push(now);
  joinHistory.set(key, recent);

  const result = {
    adjustment: 0,
    reasons: [],
    rejoinMs: lastJoin ? now - lastJoin : null,
  };

  if (lastJoin && now - lastJoin < 180_000) {
    result.adjustment += 18;
    result.reasons.push('Rapid rejoin detected after leaving the server.');
  }

  return result;
}

export function observeBehavior(member, eventType = 'message') {
  const key = buildBehaviorKey(member);
  const now = Date.now();
  const entry = behaviorHistory.get(key) || { messages: [], interactions: [], signals: {} };
  const config = { messageWindowMs: 30_000, interactionWindowMs: 15_000, interactionThreshold: 4 };
  let adjustment = 0;
  let reason = null;

  if (eventType === 'message') {
    entry.messages = entry.messages.filter((ts) => ts > now - config.messageWindowMs);
    entry.messages.push(now);

    if (!entry.signals.quickFirstMessage && entry.messages.length === 1) {
      const joins = joinHistory.get(key) || [];
      const lastJoin = joins[joins.length - 1];
      if (lastJoin && now - lastJoin < 30_000) {
        entry.signals.quickFirstMessage = true;
        adjustment += 10;
        reason = 'First message arrived quickly after join.';
      }
    }
  }

  if (eventType === 'interaction') {
    entry.interactions = entry.interactions.filter((ts) => ts > now - config.interactionWindowMs);
    entry.interactions.push(now);

    if (!entry.signals.rapidInteractionSpam && entry.interactions.length >= config.interactionThreshold) {
      entry.signals.rapidInteractionSpam = true;
      adjustment += 14;
      reason = 'Rapid interaction spam was detected.';
    }
  }

  behaviorHistory.set(key, entry);
  return { adjustment, reason, signals: entry.signals };
}

export function evaluateRisk(member, options = {}) {
  const now = Date.now();
  const createdAt = member.user?.createdTimestamp || now;
  const accountAgeMs = Math.max(0, now - createdAt);
  const accountAgeDays = accountAgeMs / 86_400_000;
  const thresholds = normalizeThresholds(options.thresholds);
  const reasons = [];

  let score = 20;

  if (accountAgeDays < 1) {
    score += 30;
    reasons.push('Account age is less than one day.');
  } else if (accountAgeDays < 7) {
    score += 16;
    reasons.push('Account age is less than one week.');
  } else if (accountAgeDays < 30) {
    score += 8;
    reasons.push('Account age is less than one month.');
  }

  if (!member.user?.avatar) {
    score += 10;
    reasons.push('Missing avatar increases verification risk.');
  }

  if (member.user?.bot) {
    score += 40;
    reasons.push('Bot accounts receive elevated risk scores.');
  }

  if (member.user?.flags?.toArray?.().includes('DISCORD_EMPLOYEE')) {
    score -= 10;
    reasons.push('Verified staff account lowered the risk score.');
  }

  if (options.rejoinAdjustment) {
    score += Number(options.rejoinAdjustment);
    reasons.push('Rejoin detection increased the risk score.');
  }

  if (Array.isArray(options.reasons)) {
    reasons.push(...options.reasons);
  }

  if (options.adjustment) {
    score += Number(options.adjustment);
    reasons.push('Custom adjustment applied to the risk score.');
  }

  const key = buildBehaviorKey(member);
  const behavior = behaviorHistory.get(key);
  if (behavior?.signals?.quickFirstMessage) {
    score += 10;
    reasons.push('Quick first message detected after join.');
  }
  if (behavior?.signals?.rapidInteractionSpam) {
    score += 14;
    reasons.push('Rapid interaction behavior detected.');
  }

  score = clampScore(score);
  const level = getRiskLevel(score, thresholds);
  const color = getRiskColor(level);

  return {
    score,
    level,
    color,
    reasons,
    meta: {
      accountAgeDays: Math.floor(accountAgeDays),
      hasAvatar: Boolean(member.user?.avatar),
      bot: Boolean(member.user?.bot),
      thresholds,
      behaviorSignals: behavior?.signals || {},
    },
  };
}
