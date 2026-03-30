export function getRiskLevel(score, thresholds = { lowToMedium: 34, mediumToHigh: 67 }) {
  if (score < thresholds.lowToMedium) return 'LOW';
  if (score < thresholds.mediumToHigh) return 'MEDIUM';
  return 'HIGH';
}

export function getRiskColor(level) {
  switch (level) {
    case 'LOW':
      return '#2ecc71';
    case 'MEDIUM':
      return '#f1c40f';
    case 'HIGH':
      return '#e74c3c';
    default:
      return '#95a5a6';
  }
}

export function evaluateRisk(member, adjustment = 0, thresholds = { lowToMedium: 34, mediumToHigh: 67 }) {
  const now = Date.now();
  const createdAt = member.user?.createdTimestamp || now;
  const accountAgeMs = Math.max(0, now - createdAt);
  const accountAgeDays = accountAgeMs / 86_400_000;

  let score = 40;

  if (accountAgeDays < 1) {
    score += 30;
  } else if (accountAgeDays < 7) {
    score += 16;
  } else if (accountAgeDays < 30) {
    score += 8;
  }

  if (!member.user?.avatar) {
    score += 10;
  }

  if (member.user?.bot) {
    score += 40;
  }

  if (member.user?.flags?.toArray?.().includes('DISCORD_EMPLOYEE')) {
    score -= 10;
  }

  score += Number(adjustment || 0);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const level = getRiskLevel(score, thresholds);
  const color = getRiskColor(level);

  return {
    score,
    level,
    color,
    meta: {
      accountAgeDays: Math.floor(accountAgeDays),
      hasAvatar: Boolean(member.user?.avatar),
      adjustment: Number(adjustment || 0),
      thresholds,
    },
  };
}
