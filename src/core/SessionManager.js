const DEFAULT_MODE_SETTINGS = {
  EASY: {
    timeoutMs: 240_000,
    maxAttempts: 3,
    steps: ['BUTTON_STEP'],
    stepTimeoutMs: 30_000,
  },
  NORMAL: {
    timeoutMs: 120_000,
    maxAttempts: 3,
    steps: ['BUTTON_STEP', 'TEXT_CHALLENGE'],
    stepTimeoutMs: 20_000,
  },
  HARD: {
    timeoutMs: 90_000,
    maxAttempts: 3,
    steps: ['BUTTON_STEP', 'TEXT_CHALLENGE', 'EMOJI_CHALLENGE'],
    stepTimeoutMs: 15_000,
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

function buildSessionId(userId) {
  return `session_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default class SessionManager {
  constructor(cleanupIntervalMs = 5_000, maxSessions = 150) {
    this.sessionsByUser = new Map();
    this.sessionsById = new Map();
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), cleanupIntervalMs);
    this.maxSessions = Number(maxSessions) || 150;
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
    const stepTimeoutMs = Number(options.stepTimeoutMs ?? config.stepTimeoutMs);
    const sessionId = buildSessionId(userId);

    const session = {
      sessionId,
      userId,
      mode: normalizedMode,
      steps,
      stepIndex: 0,
      currentStep: steps[0],
      attemptsLeft: maxAttempts,
      maxAttempts,
      timeoutMs,
      stepTimeoutMs,
      expiresAt: Date.now() + timeoutMs,
      currentStepStartedAt: Date.now(),
      currentStepExpiresAt: Date.now() + stepTimeoutMs,
      startedAt: Date.now(),
      status: 'pending',
      failureReason: null,
      metadata: {
        suspiciousFlags: [],
        stepHistory: [],
      },
      lastInteractionAt: 0,
      trustAdjustment: 0,
      ...options.initialData,
    };

    this.cleanupExpired();
    if (this.sessionsByUser.size >= this.maxSessions) {
      this.cleanupOldestSessions();
    }

    if (options.persist !== false) {
      this.sessionsByUser.set(userId, session);
      this.sessionsById.set(sessionId, session);
    }

    return session;
  }

  getSessionByUser(userId) {
    this.cleanupExpired();
    return this.sessionsByUser.get(userId) || null;
  }

  getSessionById(sessionId) {
    this.cleanupExpired();
    return this.sessionsById.get(sessionId) || null;
  }

  updateSessionByUser(userId, data = {}) {
    const session = this.getSessionByUser(userId);
    if (!session) return null;
    return this.updateSession(session.sessionId, data);
  }

  updateSession(sessionId, data = {}) {
    const session = this.getSessionById(sessionId);
    if (!session) return null;
    const updated = {
      ...session,
      ...data,
    };
    this.sessionsByUser.set(updated.userId, updated);
    this.sessionsById.set(updated.sessionId, updated);
    return updated;
  }

  deleteSession(sessionId) {
    const session = this.getSessionById(sessionId);
    if (!session) return false;
    this.sessionsById.delete(sessionId);
    this.sessionsByUser.delete(session.userId);
    return true;
  }

  cleanupExpired() {
    const now = Date.now();
    const expiredIds = [];
    for (const [sessionId, session] of this.sessionsById.entries()) {
      if (session.expiresAt <= now || session.currentStepExpiresAt <= now) {
        expiredIds.push(sessionId);
      }
    }
    for (const sessionId of expiredIds) {
      this.deleteSession(sessionId);
    }
  }

  cleanupOldestSessions(target = 100) {
    const sessions = Array.from(this.sessionsById.values()).sort((a, b) => a.startedAt - b.startedAt);
    const toRemove = sessions.length - target;
    if (toRemove <= 0) return;
    for (let i = 0; i < toRemove; i += 1) {
      this.deleteSession(sessions[i].sessionId);
    }
  }

  getActiveSessionCount() {
    this.cleanupExpired();
    return this.sessionsById.size;
  }

  getAllSessions() {
    this.cleanupExpired();
    return Array.from(this.sessionsById.entries());
  }

  getAllSessionsList() {
    this.cleanupExpired();
    return Array.from(this.sessionsById.values());
  }

  getSessionsByUser(userId) {
    this.cleanupExpired();
    return this.getSessionByUser(userId);
  }

  createSession(userId, mode = 'NORMAL', options = {}) {
    const normalizedMode = normalizeMode(mode);
    const config = DEFAULT_MODE_SETTINGS[normalizedMode];
    const steps = options.steps || (normalizedMode === 'HARD' ? shuffleArray(config.steps) : [...config.steps]);
    const timeoutMs = Number(options.timeoutMs ?? config.timeoutMs);
    const maxAttempts = Number(options.maxAttempts ?? config.maxAttempts);
    const stepTimeoutMs = Number(options.stepTimeoutMs ?? config.stepTimeoutMs);
    const sessionId = buildSessionId(userId);

    const session = {
      sessionId,
      userId,
      mode: normalizedMode,
      steps,
      stepIndex: 0,
      currentStep: steps[0],
      attemptsLeft: maxAttempts,
      maxAttempts,
      timeoutMs,
      stepTimeoutMs,
      expiresAt: Date.now() + timeoutMs,
      currentStepStartedAt: Date.now(),
      currentStepExpiresAt: Date.now() + stepTimeoutMs,
      startedAt: Date.now(),
      status: 'pending',
      failureReason: null,
      metadata: {
        suspiciousFlags: [],
        stepHistory: [],
      },
      lastInteractionAt: 0,
      trustAdjustment: 0,
      ...options.initialData,
    };

    this.cleanupExpired();
    if (this.sessionsByUser.size >= this.maxSessions) {
      this.cleanupOldestSessions();
    }

    if (options.persist !== false) {
      this.sessionsByUser.set(userId, session);
      this.sessionsById.set(sessionId, session);
    }

    return session;
  }

  destroySession(sessionId) {
    return this.deleteSession(sessionId);
  }

  isRateLimited(userId, cooldownMs = 1_200) {
    const session = this.getSessionByUser(userId);
    if (!session) return false;
    const now = Date.now();
    return now - (session.lastInteractionAt || 0) < cooldownMs;
  }

  touchInteraction(userId) {
    const session = this.getSessionByUser(userId);
    if (!session) return null;
    return this.updateSessionByUser(userId, { lastInteractionAt: Date.now() });
  }
}
