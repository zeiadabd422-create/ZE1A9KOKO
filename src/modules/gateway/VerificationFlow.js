import SessionManager from '../../core/SessionManager.js';

const ALLOWED_MODES = ['EASY', 'NORMAL', 'HARD'];
const DEFAULT_STEP_LIST = ['BUTTON_STEP', 'TEXT_CHALLENGE', 'EMOJI_CHALLENGE'];
const TEXT_WORDS = ['guardian', 'secure', 'verify', 'shield', 'signal', 'human'];
const EMOJI_OPTIONS = [
  { label: 'Shield', emoji: '🛡️', value: 'shield' },
  { label: 'Lock', emoji: '🔒', value: 'lock' },
  { label: 'Sparkle', emoji: '✨', value: 'sparkle' },
  { label: 'Check', emoji: '✅', value: 'check' },
];

function shuffleArray(items = []) {
  return items.slice().sort(() => Math.random() - 0.5);
}

function normalizeMode(mode) {
  if (!mode || typeof mode !== 'string') return 'NORMAL';
  const normalized = mode.trim().toUpperCase();
  return ALLOWED_MODES.includes(normalized) ? normalized : 'NORMAL';
}

function buildSafeCustomId(parts = []) {
  return ['gateway_v4', ...parts].map((part) => String(part).replace(/\s+/g, '_')).join('_');
}

export default class VerificationFlow {
  constructor(client) {
    this.client = client;
    this.sessionManager = new SessionManager();
  }

  getFlow(memberId) {
    return this.sessionManager.getSession(memberId);
  }

  createFlow(member, risk, config = {}, overrideMode = null, persist = true) {
    const mode = normalizeMode(overrideMode || config.defaultMode || 'EASY');
    const modeConfig = config?.verification?.[mode.toLowerCase()] || {};
    const timeoutMs = Number(modeConfig.timeoutSeconds ?? modeConfig.timeoutMs ?? (mode === 'HARD' ? 90_000 : mode === 'NORMAL' ? 120_000 : 240_000));
    const maxAttempts = Number(modeConfig.retries ?? (mode === 'HARD' ? 3 : 3));
    const steps = mode === 'HARD' ? shuffleArray(DEFAULT_STEP_LIST) : DEFAULT_STEP_LIST.slice(0, mode === 'NORMAL' ? 2 : 1);

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
      },
    });

    const currentStepData = this.createStepData(session.currentStep);
    if (persist === false) {
      return {
        ...session,
        currentStepData,
        attemptsLeft: maxAttempts,
      };
    }

    return this.sessionManager.updateSession(member.id, {
      currentStepData,
      attemptsLeft: maxAttempts,
    });
  }

  createStepData(step) {
    switch (step) {
      case 'TEXT_CHALLENGE': {
        const correct = TEXT_WORDS[Math.floor(Math.random() * TEXT_WORDS.length)];
        const options = shuffleArray(
          TEXT_WORDS.map((word) => ({ label: word, value: word }))
        ).slice(0, 4);

        return {
          step,
          prompt: `Choose the correct textual answer: **${correct}**`,
          expectedAnswer: correct,
          components: [
            {
              type: 'select',
              customId: buildSafeCustomId([step]),
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
          prompt: `Click the emoji that matches the word **${target.label.toLowerCase()}**.`,
          expectedAnswer: target.value,
          components: options.map((option) => ({
            type: 'button',
            label: option.label,
            emoji: option.emoji,
            customId: buildSafeCustomId([step, option.value]),
            style: 'secondary',
          })),
        };
      }
      case 'BUTTON_STEP':
      default:
        return {
          step: 'BUTTON_STEP',
          prompt: 'Press the button that proves you are human.',
          expectedAnswer: 'confirm',
          components: [
            {
              type: 'button',
              label: 'Confirm Human',
              customId: buildSafeCustomId(['BUTTON_STEP', 'confirm']),
              style: 'success',
            },
          ],
        };
    }
  }

  extractAnswer(interaction) {
    if (interaction.isButton()) {
      const customId = interaction.customId || '';
      const parts = customId.replace(/^gateway_v4_/, '').split('_');
      const step = parts[0];
      const answer = parts.slice(1).join('_');
      return { step, answer };
    }

    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId || '';
      const parts = customId.replace(/^gateway_v4_/, '').split('_');
      const step = parts[0];
      const answer = interaction.values?.[0] || '';
      return { step, answer };
    }

    return { step: null, answer: null };
  }

  processInteraction(interaction) {
    const session = this.getFlow(interaction.member.id);
    if (!session) return { status: 'missing' };

    const now = Date.now();
    if (session.expiresAt <= now) {
      this.sessionManager.deleteSession(session.userId);
      return { status: 'timeout', session };
    }

    const { step, answer } = this.extractAnswer(interaction);
    if (!step || !answer) {
      return { status: 'missing', session };
    }

    if (step !== session.currentStep) {
      return { status: 'retry', session };
    }

    const normalizedAnswer = String(answer).trim().toLowerCase();
    const expectedAnswer = String(session.currentStepData.expectedAnswer).trim().toLowerCase();

    if (normalizedAnswer === expectedAnswer) {
      return this.advanceStep(session);
    }

    const remainingAttempts = Math.max(0, session.attemptsLeft - 1);
    if (remainingAttempts <= 0) {
      session.status = 'failed';
      session.failureReason = `Exhausted attempts for ${session.currentStep}.`;
      this.sessionManager.deleteSession(session.userId);
      return { status: 'failed', session };
    }

    this.sessionManager.updateSession(session.userId, {
      attemptsLeft: remainingAttempts,
    });

    return { status: 'retry', session: this.getFlow(session.userId) };
  }

  advanceStep(session) {
    const nextIndex = session.stepIndex + 1;
    if (nextIndex >= session.steps.length) {
      session.status = 'success';
      session.completedAt = Date.now();
      this.sessionManager.deleteSession(session.userId);
      return { status: 'success', session };
    }

    const nextStep = session.steps[nextIndex];
    const nextStepData = this.createStepData(nextStep);
    const updated = this.sessionManager.updateSession(session.userId, {
      stepIndex: nextIndex,
      currentStep: nextStep,
      currentStepData: nextStepData,
      attemptsLeft: session.maxAttempts,
      expiresAt: Date.now() + session.timeoutMs,
      status: 'pending',
    });

    return { status: 'advance', session: updated };
  }
}
