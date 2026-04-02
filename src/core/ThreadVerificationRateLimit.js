import { verificationSessions } from '../core/ThreadSessionManager.js';

export class ThreadVerificationRateLimit {
  constructor() {
    this.userAttempts = new Map();
    this.RATE_LIMIT_WINDOW = 30000;
    this.MAX_ATTEMPTS = 3;
  }

  checkRateLimit(userId) {
    const now = Date.now();
    const record = this.userAttempts.get(userId);

    if (!record) {
      this.userAttempts.set(userId, { count: 1, resetAt: now + this.RATE_LIMIT_WINDOW });
      return true;
    }

    if (now > record.resetAt) {
      this.userAttempts.set(userId, { count: 1, resetAt: now + this.RATE_LIMIT_WINDOW });
      return true;
    }

    if (record.count >= this.MAX_ATTEMPTS) {
      return false;
    }

    record.count += 1;
    return true;
  }

  reset(userId) {
    this.userAttempts.delete(userId);
  }

  cleanup() {
    const now = Date.now();
    for (const [userId, record] of this.userAttempts.entries()) {
      if (now > record.resetAt) {
        this.userAttempts.delete(userId);
      }
    }
  }
}

export const threadVerificationRateLimit = new ThreadVerificationRateLimit();

setInterval(() => {
  threadVerificationRateLimit.cleanup();
}, 30000);
