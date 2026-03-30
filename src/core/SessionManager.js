const DEFAULT_MODE_SETTINGS = {
  EASY: {
    timeoutMs: 240_000,
    maxAttempts: 3,
    steps: ['BUTTON_STEP'],
  },
  NORMAL: {
    timeoutMs: 120_000,
    maxAttempts: 3,
    steps: ['BUTTON_STEP', 'TEXT_CHALLENGE'],
  },
  HARD: {
    timeoutMs: 90_000,
    maxAttempts: 3,
    steps: ['BUTTON_STEP', 'TEXT_CHALLENGE', 'EMOJI_CHALLENGE'],
  },
};

function shuffleArray(items = []) {
  return items.slice().sort(() => Math.random() - 0.5);
}

function normalizeMode(mode) {
  if (!mode || typeof mode !== 'string') return 'NORMAL';
  const normalized = mode.trim().toUpperCase();
  return DEFAULT_MODE_SETTINGS[normalized] ? normalized : 'NORMAL';
}

export default class SessionManager {
  constructor(cleanupIntervalMs = 5_000) {
    this.sessions = new Map();
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), cleanupIntervalMs);
    if (typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  createSession(userId, mode = 'NORMAL', options = {}) {
    const normalizedMode = normalizeMode(mode);
    const config = DEFAULT_MODE_SETTINGS[normalizedMode];
    const steps = options.steps || (normalizedMode === 'HARD' ? shuffleArray(config.steps) : [...config.steps]);
    const timeoutMs = Number(options.timeoutMs ?? config.timeoutMs);
    const maxAttempts = Number(options.maxAttempts ?? config.maxAttempts);

    const session = {
      userId,
      mode: normalizedMode,
      steps,
      stepIndex: 0,
      currentStep: steps[0],
      attemptsLeft: maxAttempts,
      maxAttempts,
      timeoutMs,
      expiresAt: Date.now() + timeoutMs,
      startedAt: Date.now(),
      status: 'pending',
      failureReason: null,
      metadata: {},
      ...options.initialData,
    };

    if (options.persist !== false) {
      this.sessions.set(userId, session);
    }

    return session;
  }

  getSession(userId) {
    this.cleanupExpired();
    return this.sessions.get(userId) || null;
  }

  updateSession(userId, data = {}) {
    const session = this.getSession(userId);
    if (!session) return null;
    const updated = {
      ...session,
      ...data,
    };
    this.sessions.set(userId, updated);
    return updated;
  }

  deleteSession(userId) {
    return this.sessions.delete(userId);
  }

  cleanupExpired() {
    const now = Date.now();
    for (const [userId, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(userId);
      }
    }
  }

  getActiveSessionCount() {
    this.cleanupExpired();
    return this.sessions.size;
  }
}
