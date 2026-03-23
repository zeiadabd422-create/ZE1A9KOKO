export function calculateTrustScore(user, config) {
  let score = 30; // Initial score

  // Join Age Penalty: Calculate how many days the user has been in the server
  if (user.joinedAt) {
    const joinAgeMs = Date.now() - user.joinedAt.getTime();
    const joinAgeDays = joinAgeMs / (1000 * 60 * 60 * 24);

    // Penalty: 1 point per day unverified (max -20 points at 20 days)
    const penalty = Math.min(joinAgeDays * 1, 20);
    score -= penalty;
  }

  // Ensure score stays within 0-100 range
  score = Math.max(0, Math.min(100, score));
  return score;
}

/**
 * Calculate account age in days
 * @param {Object} user - Discord user object
 * @returns {number} Age in days
 */
export function getAccountAgeDays(user) {
  const createdAt = user.createdAt || new Date();
  const ageMsMs = Date.now() - createdAt.getTime();
  return ageMsMs / (1000 * 60 * 60 * 24);
}

/**
 * Check if trigger word matches (case-insensitive)
 * @param {string} messageContent - The message content
 * @param {string} triggerWord - The trigger word from config
 * @returns {boolean} True if message contains trigger word
 */
export function checkTriggerWord(messageContent, triggerWord) {
  if (!triggerWord || triggerWord.trim() === '') return false;
  const msg = (messageContent || '').toString().trim().toLowerCase();
  const word = triggerWord.toString().trim().toLowerCase();
  // require exact match (space-separated or entire message)
  return msg === word || msg.split(/\s+/).includes(word);
}

/**
 * Validate Raid Shield: Check if account is old enough
 * @param {Object} user - Discord user object (the user who joined, or the message author)
 * @param {Object} config - Gateway config
 * @returns {Object} { passed: boolean, reason: string }
 */
export function validateRaidShield(user, config) {
  // If raid mode is disabled, always pass
  if (!config.raidMode) {
    return { passed: true, reason: 'Raid mode disabled' };
  }

  const accountAgeDays = getAccountAgeDays(user);
  const minAge = config.minAccountAge || 7;

  if (accountAgeDays < minAge) {
    return {
      passed: false,
      reason: `Account too new. Minimum age: ${minAge} days. Your account: ${accountAgeDays.toFixed(1)} days`,
    };
  }

  return { passed: true, reason: 'Account age verified' };
}

/**
 * Comprehensive user verification check
 * @param {Object} user - Discord user object
 * @param {Object} member - Guild member object (if available)
 * @param {Object} config - Gateway config
 * @returns {Object} { verified: boolean, trustScore: number, raidShield: {}, errors: [] }
 */
export function performVerificationCheck(user, member, config) {
  const errors = [];
  const result = {
    verified: true,
    trustScore: 0,
    raidShield: {},
    errors,
  };

  // Calculate trust score
  if (member && member.joinedAt) {
    result.trustScore = calculateTrustScore(member, config);
  } else {
    result.trustScore = 30; // Default if no member data
  }

  // Check raid shield
  result.raidShield = validateRaidShield(user, config);

  // Determine overall verification status
  if (!result.raidShield.passed) {
    result.verified = false;
    errors.push(result.raidShield.reason);
  }

  return result;
}
