export class ThreadVerificationSession {
  constructor(userId, threadId, guildId) {
    this.userId = userId;
    this.threadId = threadId;
    this.guildId = guildId;
    this.createdAt = Date.now();
    this.expiresAt = Date.now() + 5 * 60 * 1000;
    this.attempts = 0;
    this.status = 'waiting';
    this.lastInteractionAt = Date.now();
  }

  isExpired() {
    return Date.now() > this.expiresAt;
  }

  updateInteractionTime() {
    this.lastInteractionAt = Date.now();
  }

  canRetry() {
    return this.attempts < 3;
  }

  incrementAttempts() {
    this.attempts += 1;
  }
}

export class ThreadSessionManager {
  constructor() {
    this.sessions = new Map();
    this.userSessions = new Map();
    this.threadSessions = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
  }

  createSession(userId, threadId, guildId) {
    if (this.userSessions.has(userId)) {
      return null;
    }

    const session = new ThreadVerificationSession(userId, threadId, guildId);
    const sessionId = `${userId}-${threadId}`;

    this.sessions.set(sessionId, session);
    this.userSessions.set(userId, sessionId);
    this.threadSessions.set(threadId, sessionId);

    return session;
  }

  getSessionByUser(userId) {
    const sessionId = this.userSessions.get(userId);
    if (!sessionId) return null;
    return this.sessions.get(sessionId);
  }

  getSessionByThread(threadId) {
    const sessionId = this.threadSessions.get(threadId);
    if (!sessionId) return null;
    return this.sessions.get(sessionId);
  }

  getSessionById(sessionId) {
    return this.sessions.get(sessionId);
  }

  deleteSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.sessions.delete(sessionId);
    this.userSessions.delete(session.userId);
    this.threadSessions.delete(session.threadId);
  }

  deleteSessionByUser(userId) {
    const sessionId = this.userSessions.get(userId);
    if (sessionId) {
      this.deleteSession(sessionId);
    }
  }

  deleteSessionByThread(threadId) {
    const sessionId = this.threadSessions.get(threadId);
    if (sessionId) {
      this.deleteSession(sessionId);
    }
  }

  cleanup() {
    const expiredIds = [];
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.isExpired()) {
        expiredIds.push(sessionId);
      }
    }
    for (const sessionId of expiredIds) {
      this.deleteSession(sessionId);
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
    this.userSessions.clear();
    this.threadSessions.clear();
  }
}

export const verificationSessions = new ThreadSessionManager();
