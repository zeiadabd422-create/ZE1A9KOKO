/**
 * SessionManager - Single source of truth for user verification sessions
 * Map-based storage with guaranteed no duplicates
 */
import { gatewayLogger } from '../utils/GatewayLogger.js';

export class SessionManager {
  constructor() {
    this.sessions = new Map(); // userId -> Session
    this.maxConcurrentSessions = 50;
  }

  /**
   * Create a new session for a user
   */
  createSession(userId, guildId) {
      if (this.sessions.has(userId)) {
        gatewayLogger.log('WARN', null, 'Session duplicate rejected', { userId });
        return null;
      }

        const sessionId = `${userId}-${Date.now()}`;
        const session = {
                id: sessionId,
                userId,
                    guildId,
                        state: 'initializing',
                            currentStep: 'start',
                                attempts: 0,
                                    maxAttempts: 3,
                                        startedAt: Date.now(),
                                            lastActivityAt: Date.now(),
                                                data: {},
                                                    interactionIds: new Set(),
                                                        timeout: setTimeout(() => {
                                                                  if (this.onSessionExpired) {
                                                                    gatewayLogger.sessionExpired(sessionId, userId);
                                                                    this.onSessionExpired(userId, guildId);
                                                                  }
                                                        }, 5 * 60 * 1000)
        };

          this.sessions.set(userId, session);
          gatewayLogger.sessionCreated(userId, guildId, sessionId);
            return session;
}

  /**
   * Get session by user ID
   */
  getSession(userId) {
    const session = this.sessions.get(userId);
    if (session) {
      session.lastActivityAt = Date.now();
    }
    return session;
  }

  /**
   * Update session state
   */
  updateSessionState(userId, newState) {
    const session = this.getSession(userId);
    if (!session) throw new Error(`Session not found for user ${userId}`);
    
    session.state = newState;
    session.lastActivityAt = Date.now();
    return session;
  }

  /**
   * Update current step
   */
  updateStep(userId, step) {
    const session = this.getSession(userId);
    if (!session) throw new Error(`Session not found for user ${userId}`);
    
    session.currentStep = step;
    session.lastActivityAt = Date.now();
    return session;
  }

  /**
   * Increment attempts
   */
  incrementAttempts(userId) {
    const session = this.getSession(userId);
    if (!session) throw new Error(`Session not found for user ${userId}`);
    
    session.attempts++;
    return session.attempts;
  }

  /**
   * Check if interaction was already processed
   */
  hasProcessedInteraction(userId, interactionId) {
    const session = this.getSession(userId);
    if (!session) return false;
    return session.interactionIds.has(interactionId);
  }

  /**
   * Mark interaction as processed
   */
  markInteractionProcessed(userId, interactionId) {
    const session = this.getSession(userId);
    if (!session) throw new Error(`Session not found for user ${userId}`);
    session.interactionIds.add(interactionId);
  }

  /**
   * Update session data
   */
  updateSessionData(userId, key, value) {
    const session = this.getSession(userId);
    if (!session) throw new Error(`Session not found for user ${userId}`);
    
    session.data[key] = value;
    session.lastActivityAt = Date.now();
    return session;
  }

  /**
   * End session
   */
  endSession(userId) {
    const s = this.sessions.get(userId);
    if (!s) return false;
    
    const sessionId = s.id;
    if (s?.interactionIds) {
      s.interactionIds.clear();
    }
    if (s && s.timeout) {
      clearTimeout(s.timeout);
    }
    
    const deleted = this.sessions.delete(userId);
    if (deleted) {
      gatewayLogger.sessionEnded(sessionId, userId, 'cleanup');
    }
    return deleted;
  }

  /**
   * Cancel session
   */
  cancelSession(userId) {
    const session = this.sessions.get(userId);
    if (!session) return;

    clearTimeout(session.timeout);
    this.sessions.delete(userId);
  }

  /**
   * Get all active sessions
   */
  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  /**
   * Get count of active sessions
   */
  getActiveSessionCount() {
    return this.sessions.size;
  }

  /**
   * Check if user has active session
   */
  hasActiveSession(userId) {
    const session = this.sessions.get(userId);
    return session && session.state !== 'completed' && session.state !== 'failed';
  }

  /**
   * Cleanup expired sessions (older than 30 minutes)
   */
  cleanupExpiredSessions(maxAgeMs = 30 * 60 * 1000) {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, session] of this.sessions.entries()) {
      if (now - session.lastActivityAt > maxAgeMs) {
        this.sessions.delete(userId);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
