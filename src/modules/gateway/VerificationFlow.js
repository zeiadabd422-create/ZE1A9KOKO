import SessionManager from '../../core/SessionManager.js';
import crypto from 'crypto';

const ALLOWED_MODES = ['EASY', 'NORMAL', 'HARD', 'HARD++'];
const DEFAULT_STEP_LIST = ['BUTTON_STEP', 'TEXT_CHALLENGE', 'EMOJI_CHALLENGE', 'TIMING_CHALLENGE', 'BEHAVIOR_CHALLENGE'];
const TEXT_WORDS = ['guardian', 'secure', 'verify', 'shield', 'signal', 'human', 'trust', 'access', 'portal', 'gate'];
const EMOJI_OPTIONS = [
  { label: 'Shield', emoji: '🛡️', value: 'shield' },
  { label: 'Lock', emoji: '🔒', value: 'lock' },
  { label: 'Sparkle', emoji: '✨', value: 'sparkle' },
  { label: 'Check', emoji: '✅', value: 'check' },
  { label: 'Key', emoji: '🔑', value: 'key' },
  { label: 'Eye', emoji: '👁️', value: 'eye' },
];
const HONEYPOT_TRAPS = ['fake_confirm', 'invisible_trap', 'bot_bait', 'auto_click'];
const BEHAVIOR_THRESHOLDS = {
  TOO_FAST: 500, // ms
  TOO_SLOW: 30000, // ms
  PERFECT_PATTERN: 0.95, // similarity score
  RANDOM_THRESHOLD: 0.3, // randomness score
};

function shuffleArray(items = []) {
  return items.slice().sort(() => Math.random() - 0.5);
}

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

function normalizeMode(mode) {
  if (!mode || typeof mode !== 'string') return 'NORMAL';
  const normalized = mode.trim().toUpperCase();
  return ALLOWED_MODES.includes(normalized) ? normalized : 'NORMAL';
}

function buildSafeCustomId(parts = []) {
  return ['gateway_v4', ...parts].map((part) => String(part).replace(/\s+/g, '_')).join('_');
}

function parseCustomId(customId = '') {
  const cleaned = customId.replace(/^gateway_v4_/, '');
  const parts = cleaned.split('_');
  const step = parts[0];
  if (!step) return { step: null, sessionId: null, answer: null, token: null };

  if (parts.length === 1) {
    return { step, sessionId: null, answer: null, token: null };
  }

  if (parts.length === 2) {
    return { step, sessionId: parts[1], answer: null, token: null };
  }

  const token = parts[parts.length - 1];
  const answer = parts[parts.length - 2];
  const sessionId = parts.slice(1, parts.length - 2).join('_');
  return { step, sessionId, answer, token };
}

function calculateBehaviorScore(session, interaction) {
  const now = Date.now();
  const stepLatency = now - session.currentStepStartedAt;
  let score = 0;
  let flags = [];

  // Too fast detection
  if (stepLatency < BEHAVIOR_THRESHOLDS.TOO_FAST) {
    score += 25;
    flags.push('too_fast');
  }

  // Too slow detection
  if (stepLatency > BEHAVIOR_THRESHOLDS.TOO_SLOW) {
    score += 15;
    flags.push('too_slow');
  }

  // Perfect timing (suspiciously consistent)
  const latencies = session.metadata.stepLatencies || [];
  latencies.push(stepLatency);
  session.metadata.stepLatencies = latencies;

  if (latencies.length > 2) {
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const variance = latencies.reduce((sum, lat) => sum + Math.pow(lat - avg, 2), 0) / latencies.length;
    const stdDev = Math.sqrt(variance);
    const consistency = stdDev / avg;

    if (consistency < 0.1) { // Very consistent timing
      score += 20;
      flags.push('perfect_timing');
    }
  }

  // Pattern repetition
  const answers = session.metadata.stepAnswers || [];
  answers.push(interaction.answer);
  session.metadata.stepAnswers = answers;

  if (answers.length > 3) {
    const uniqueAnswers = new Set(answers);
    if (uniqueAnswers.size === 1) {
      score += 15;
      flags.push('repetitive_answers');
    }
  }

  return { score, flags, latency: stepLatency };
}

export default class VerificationFlow {
  constructor(client) {
    this.client = client;
    this.sessionManager = new SessionManager();
    this.behaviorProfiles = new Map();
    this.honeypotTriggers = new Map();
    this.adaptiveDifficulty = new Map();
    this.securityLogger = new Map();
  }

  getFlowByUser(memberId) {
    return this.sessionManager.getSessionByUser(memberId);
  }

  getFlowById(sessionId) {
    return this.sessionManager.getSessionById(sessionId);
  }

  createFlow(member, risk, config = {}, overrideMode = null, persist = true) {
    const mode = normalizeMode(overrideMode || config.defaultMode || 'EASY');
    const modeConfig = config?.verification?.[mode.toLowerCase()] || {};
    const timeoutMs = Number(modeConfig.timeoutSeconds ?? modeConfig.timeoutMs ?? (mode === 'HARD++' ? 60_000 : mode === 'HARD' ? 90_000 : mode === 'NORMAL' ? 120_000 : 240_000));
    const maxAttempts = Number(modeConfig.retries ?? 3);
    
    // Dynamic flow randomization - randomize step order and count
    let steps = shuffleArray(DEFAULT_STEP_LIST);
    if (mode === 'HARD++') {
      steps = steps.slice(0, Math.min(5, steps.length));
    } else if (mode === 'HARD') {
      steps = steps.slice(0, Math.min(4, steps.length));
    } else if (mode === 'NORMAL') {
      steps = steps.slice(0, Math.min(3, steps.length));
    } else {
      steps = steps.slice(0, Math.min(2, steps.length));
    }

    // Add honeypot traps for HARD++ mode
    if (mode === 'HARD++') {
      const trapStep = shuffleArray(HONEYPOT_TRAPS)[0];
      steps.splice(Math.floor(Math.random() * steps.length), 0, `HONEYPOT_${trapStep.toUpperCase()}`);
    }

    const session = this.sessionManager.createSession(member.id, mode, {
      timeoutMs,
      maxAttempts,
      steps,
      persist,
      initialData: {
        guildId: member.guild.id,
        memberId: member.id,
        risk,
        config,
        tokens: new Map(),
        behaviorScore: 0,
        shadowFlags: [],
        honeypotTriggered: false,
      },
    });

    const currentStepData = this.createStepData(session.currentStep, session.sessionId);
    if (!persist) {
      return { ...session, currentStepData, attemptsLeft: maxAttempts };
    }

    return this.sessionManager.updateSession(session.sessionId, {
      currentStepData,
      attemptsLeft: maxAttempts,
    });
  }

  createStepData(step, sessionId) {
    const token = generateToken();
    const session = this.sessionManager.getSessionById(sessionId);
    if (session) {
      session.initialData.tokens.set(step, token);
    }

    switch (step) {
      case 'TEXT_CHALLENGE': {
        const correct = TEXT_WORDS[Math.floor(Math.random() * TEXT_WORDS.length)];
        const options = shuffleArray(TEXT_WORDS)
          .map((word) => ({ label: word, value: word }))
          .slice(0, 4);

        return {
          step,
          token,
          prompt: `Choose the correct textual answer: **${correct}**`,
          expectedAnswer: correct,
          components: [
            {
              type: 'select',
              customId: buildSafeCustomId([step, sessionId, 'select', token]),
              placeholder: 'Select the right text answer',
              options,
            },
          ],
        };
      }
      case 'EMOJI_CHALLENGE': {
        const options = shuffleArray(EMOJI_OPTIONS).slice(0, 4);
        const target = options[0];
        return {
          step,
          token,
          prompt: `Click the emoji that matches the word **${target.label.toLowerCase()}**.`,
          expectedAnswer: target.value,
          components: options.map((option) => ({
            type: 'button',
            label: option.label,
            emoji: option.emoji,
            customId: buildSafeCustomId([step, sessionId, option.value, token]),
            style: 'secondary',
          })),
        };
      }
      case 'TIMING_CHALLENGE': {
        const delay = Math.random() * 3000 + 1000; // 1-4 seconds
        return {
          step,
          token,
          prompt: `Wait for the button to appear, then click it immediately.`,
          expectedAnswer: 'timed_click',
          delay,
          components: [], // Will be added after delay
          customId: buildSafeCustomId([step, sessionId, 'timed_click', token]),
        };
      }
      case 'BEHAVIOR_CHALLENGE': {
        return {
          step,
          token,
          prompt: `Solve this simple math: What is ${Math.floor(Math.random() * 10) + 1} + ${Math.floor(Math.random() * 10) + 1}?`,
          expectedAnswer: 'math_answer', // Will be calculated
          components: [
            {
              type: 'button',
              label: 'Calculate',
              customId: buildSafeCustomId([step, sessionId, 'calculate', token]),
              style: 'primary',
            },
          ],
        };
      }
      default:
        if (step.startsWith('HONEYPOT_')) {
          const trapType = step.replace('HONEYPOT_', '').toLowerCase();
          return this.createHoneypotData(trapType, sessionId, token);
        }
        return {
          step: 'BUTTON_STEP',
          token,
          prompt: 'Press the button that proves you are human.',
          expectedAnswer: 'confirm',
          components: [
            {
              type: 'button',
              label: 'Confirm Human',
              customId: buildSafeCustomId(['BUTTON_STEP', sessionId, 'confirm', token]),
              style: 'success',
            },
          ],
        };
    }
  }

  createHoneypotData(trapType, sessionId, token) {
    switch (trapType) {
      case 'fake_confirm':
        return {
          step: `HONEYPOT_${trapType.toUpperCase()}`,
          token,
          prompt: 'Click here to verify instantly!',
          expectedAnswer: 'honeypot_trigger',
          isTrap: true,
          components: [
            {
              type: 'button',
              label: 'Instant Verify',
              customId: buildSafeCustomId([`HONEYPOT_${trapType.toUpperCase()}`, sessionId, 'honeypot_trigger', token]),
              style: 'success',
            },
          ],
        };
      case 'invisible_trap':
        return {
          step: `HONEYPOT_${trapType.toUpperCase()}`,
          token,
          prompt: 'Complete the verification by clicking below.',
          expectedAnswer: 'honeypot_trigger',
          isTrap: true,
          components: [
            {
              type: 'button',
              label: 'Verify Now',
              customId: buildSafeCustomId([`HONEYPOT_${trapType.toUpperCase()}`, sessionId, 'honeypot_trigger', token]),
              style: 'primary',
            },
            {
              type: 'button',
              label: '', // Invisible button
              customId: buildSafeCustomId([`HONEYPOT_${trapType.toUpperCase()}`, sessionId, 'invisible_trigger', token]),
              style: 'secondary',
              emoji: '👻',
            },
          ],
        };
      case 'bot_bait':
        return {
          step: `HONEYPOT_${trapType.toUpperCase()}`,
          token,
          prompt: 'Bots click here for easy access!',
          expectedAnswer: 'honeypot_trigger',
          isTrap: true,
          components: [
            {
              type: 'button',
              label: 'Bot Access',
              customId: buildSafeCustomId([`HONEYPOT_${trapType.toUpperCase()}`, sessionId, 'honeypot_trigger', token]),
              style: 'danger',
            },
          ],
        };
      case 'auto_click':
        return {
          step: `HONEYPOT_${trapType.toUpperCase()}`,
          token,
          prompt: 'This button will auto-click itself!',
          expectedAnswer: 'honeypot_trigger',
          isTrap: true,
          components: [
            {
              type: 'button',
              label: 'Auto-Click',
              customId: buildSafeCustomId([`HONEYPOT_${trapType.toUpperCase()}`, sessionId, 'honeypot_trigger', token]),
              style: 'secondary',
            },
          ],
        };
      default:
        return {
          step: `HONEYPOT_${trapType.toUpperCase()}`,
          token,
          prompt: 'Suspicious button detected.',
          expectedAnswer: 'honeypot_trigger',
          isTrap: true,
          components: [
            {
              type: 'button',
              label: '???',
              customId: buildSafeCustomId([`HONEYPOT_${trapType.toUpperCase()}`, sessionId, 'honeypot_trigger', token]),
              style: 'secondary',
            },
          ],
        };
    }
  }

  extractInteractionData(interaction) {
    const customId = interaction.customId || '';
    const parsed = parseCustomId(customId);
    const answer = interaction.isStringSelectMenu() ? interaction.values?.[0] || parsed.answer : parsed.answer;
    return {
      step: parsed.step,
      sessionId: parsed.sessionId,
      answer,
      token: parsed.token,
    };
  }

  validateSessionForInteraction(interaction) {
    const { step, sessionId, token } = this.extractInteractionData(interaction);
    if (!step || !sessionId) return { valid: false, reason: 'invalid_custom_id' };

    const session = this.getFlowById(sessionId);
    if (!session) return { valid: false, reason: 'session_missing' };
    if (interaction.user.id !== session.userId) return { valid: false, reason: 'user_mismatch' };
    if (session.expiresAt <= Date.now()) {
      this.sessionManager.deleteSession(sessionId);
      return { valid: false, reason: 'session_expired' };
    }
    if (session.currentStepExpiresAt <= Date.now()) {
      this.sessionManager.deleteSession(sessionId);
      return { valid: false, reason: 'step_timeout' };
    }
    if (step !== session.currentStep) return { valid: false, reason: 'step_mismatch' };

    // Token validation
    const expectedToken = session.initialData.tokens.get(step);
    if (!expectedToken || expectedToken !== token) {
      return { valid: false, reason: 'token_mismatch' };
    }

    return { valid: true, session };
  }

  processInteraction(interaction) {
    const validation = this.validateSessionForInteraction(interaction);
    if (!validation.valid) {
      this.logSecurityEvent('validation_failure', {
        reason: validation.reason,
        userId: interaction.user.id,
        guildId: interaction.guild?.id,
        customId: interaction.customId,
      });
      return { status: 'missing', reason: validation.reason };
    }

    const session = validation.session;
    const { answer, token } = this.extractInteractionData(interaction);
    const now = Date.now();

    // Behavior profiling
    const behaviorAnalysis = calculateBehaviorScore(session, { answer, timestamp: now });
    session.initialData.behaviorScore += behaviorAnalysis.score;
    session.metadata.suspiciousFlags.push(...behaviorAnalysis.flags);

    // Shadow security layer - increase difficulty silently
    if (behaviorAnalysis.score > 20) {
      session.initialData.shadowFlags.push('high_behavior_score');
      this.adaptiveDifficulty.set(session.sessionId, (this.adaptiveDifficulty.get(session.sessionId) || 1) + 0.5);
    }

    // Honeypot detection
    if (session.currentStep.startsWith('HONEYPOT_')) {
      session.initialData.honeypotTriggered = true;
      this.honeypotTriggers.set(session.sessionId, true);
      this.logSecurityEvent('honeypot_triggered', {
        userId: session.userId,
        guildId: session.initialData.guildId,
        trapType: session.currentStep,
        behaviorScore: session.initialData.behaviorScore,
      });
      return this.handleAdaptivePunishment(session, 'honeypot', interaction);
    }

    // Token consumption - expire after use
    session.initialData.tokens.delete(session.currentStep);

    const stepLatency = behaviorAnalysis.latency;
    session.metadata.stepHistory.push({
      step: session.currentStep,
      answer: answer || 'no_answer',
      latency: stepLatency,
      behaviorFlags: behaviorAnalysis.flags,
      timestamp: now,
    });

    // Multi-layer verification check
    const isCorrect = this.validateAnswer(session, answer, interaction);
    if (!isCorrect) {
      return this.handleIncorrectAnswer(session, interaction);
    }

    // Success path
    this.logSecurityEvent('step_success', {
      userId: session.userId,
      guildId: session.initialData.guildId,
      step: session.currentStep,
      latency: stepLatency,
      behaviorScore: session.initialData.behaviorScore,
      totalFlags: session.metadata.suspiciousFlags.length,
    });

    return this.advanceStep(session);
  }

  validateAnswer(session, answer, interaction) {
    if (!answer) return false;

    const normalizedAnswer = String(answer).trim().toLowerCase();
    const expectedAnswer = String(session.currentStepData.expectedAnswer).trim().toLowerCase();

    // Special handling for different challenge types
    if (session.currentStep === 'BEHAVIOR_CHALLENGE') {
      // For math challenges, we need to calculate the expected answer
      const prompt = session.currentStepData.prompt;
      const match = prompt.match(/What is (\d+) \+ (\d+)\?/);
      if (match) {
        const expected = parseInt(match[1]) + parseInt(match[2]);
        return normalizedAnswer === expected.toString();
      }
    }

    return normalizedAnswer === expectedAnswer;
  }

  handleIncorrectAnswer(session, interaction) {
    const remainingAttempts = Math.max(0, session.attemptsLeft - 1);
    const updated = this.sessionManager.updateSession(session.sessionId, {
      attemptsLeft: remainingAttempts,
      metadata: session.metadata,
    });

    // Fail trap system - randomize next challenge harder
    if (remainingAttempts > 0) {
      this.failTrapSystem(updated);
    }

    this.logSecurityEvent('step_failure', {
      userId: session.userId,
      guildId: session.initialData.guildId,
      step: session.currentStep,
      remainingAttempts,
      behaviorScore: session.initialData.behaviorScore,
    });

    if (remainingAttempts <= 0) {
      updated.status = 'failed';
      updated.failureReason = `Exhausted attempts for ${session.currentStep}.`;
      this.sessionManager.deleteSession(session.sessionId);
      return { status: 'failed', session: updated };
    }

    return { status: 'retry', session: updated };
  }

  handleAdaptivePunishment(session, reason, interaction) {
    const severity = this.calculatePunishmentSeverity(session, reason);
    
    switch (severity) {
      case 'extreme':
        // Blacklist user
        this.logSecurityEvent('blacklist_user', {
          userId: session.userId,
          guildId: session.initialData.guildId,
          reason,
          behaviorScore: session.initialData.behaviorScore,
        });
        // Implement blacklist logic here
        break;
      case 'high':
        // Kick immediately
        this.kickUser(session, interaction, reason);
        return { status: 'failed', session };
      case 'medium':
        // Timeout
        this.timeoutUser(session, interaction);
        return { status: 'failed', session };
      case 'low':
      default:
        // Just retry
        return { status: 'retry', session };
    }
  }

  calculatePunishmentSeverity(session, reason) {
    let score = session.initialData.behaviorScore;

    if (reason === 'honeypot') score += 50;
    if (session.metadata.suspiciousFlags.includes('too_fast')) score += 20;
    if (session.metadata.suspiciousFlags.includes('perfect_timing')) score += 15;

    if (score >= 80) return 'extreme';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  kickUser(session, interaction, reason) {
    if (interaction.guild?.members?.me?.permissions.has('KickMembers')) {
      interaction.guild.members.fetch(session.userId).then((member) => {
        if (member.kickable) {
          member.kick(`Security violation: ${reason}`).catch(() => {});
        }
      }).catch(() => {});
    }
  }

  timeoutUser(session, interaction) {
    // Implement timeout logic
    this.logSecurityEvent('user_timeout', {
      userId: session.userId,
      guildId: session.initialData.guildId,
      duration: 300000, // 5 minutes
    });
  }

  failTrapSystem(session) {
    // Make next challenge harder by adding more randomization
    const difficulty = this.adaptiveDifficulty.get(session.sessionId) || 1;
    this.adaptiveDifficulty.set(session.sessionId, difficulty + 0.3);
    
    // Could add extra steps or reduce time limits
    session.metadata.failTraps = (session.metadata.failTraps || 0) + 1;
  }

  logSecurityEvent(eventType, data) {
    const logEntry = {
      timestamp: Date.now(),
      eventType,
      ...data,
    };

    const key = `${data.guildId}:${data.userId}`;
    if (!this.securityLogger.has(key)) {
      this.securityLogger.set(key, []);
    }
    this.securityLogger.get(key).push(logEntry);

    // Keep only last 100 entries per user
    const logs = this.securityLogger.get(key);
    if (logs.length > 100) {
      logs.shift();
    }

    console.log(`[SecurityLogger] ${eventType}:`, data);
  }

  getSecurityLogs(guildId, userId) {
    const key = `${guildId}:${userId}`;
    return this.securityLogger.get(key) || [];
  }

  advanceStep(session) {
    const nextIndex = session.stepIndex + 1;
    if (nextIndex >= session.steps.length) {
      const completeSession = { ...session, status: 'success', completedAt: Date.now() };
      this.sessionManager.deleteSession(session.sessionId);
      return { status: 'success', session: completeSession };
    }

    const nextStep = session.steps[nextIndex];
    const nextStepData = this.createStepData(nextStep, session.sessionId);
    const updatedSession = this.sessionManager.updateSession(session.sessionId, {
      stepIndex: nextIndex,
      currentStep: nextStep,
      currentStepData: nextStepData,
      attemptsLeft: session.maxAttempts,
      currentStepStartedAt: Date.now(),
      currentStepExpiresAt: Date.now() + session.stepTimeoutMs,
      expiresAt: Date.now() + session.timeoutMs,
      status: 'pending',
      metadata: session.metadata,
    });

    return { status: 'advance', session: updatedSession };
  }
}
