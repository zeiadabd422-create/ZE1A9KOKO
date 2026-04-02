import { verificationSessions } from '../core/ThreadSessionManager.js';
import { ThreadVerificationSystem } from '../core/ThreadVerificationSystem.js';

export function initializeThreadVerificationIntegration(client) {
  const gateway = client?.gateway;
  if (!gateway) return;

  const originalSuccessHandler = gateway.handleVerificationSuccess;
  const originalFailureHandler = gateway.handleVerificationFailure;

  gateway.onThreadVerificationSuccess = async (member, session, guild) => {
    if (session?.threadId) {
      await ThreadVerificationSystem.handleVerificationSuccess(member.id, session.threadId, guild);
    }
  };

  gateway.onThreadVerificationFailure = async (member, session, guild) => {
    if (session?.threadId) {
      await ThreadVerificationSystem.handleVerificationFailure(member.id, session.threadId, guild);
    }
  };

  gateway.getThreadSession = (userId) => verificationSessions.getSessionByUser(userId);
  gateway.getActiveThreadSessions = () => verificationSessions.sessions.size;

  console.log('[ThreadVerification] Integration initialized');
}

export function cleanupThreadVerification() {
  verificationSessions.destroy();
  console.log('[ThreadVerification] Cleanup completed');
}
