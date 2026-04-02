import { verificationSessions } from '../core/ThreadSessionManager.js';

export default {
  name: 'threadDelete',
  async execute(thread) {
    try {
      const threadId = thread.id;
      const session = verificationSessions.getSessionByThread(threadId);

      if (session) {
        verificationSessions.deleteSessionByThread(threadId);
        console.log(`[threadDelete] Cleaned up session for thread ${threadId}`);
      }
    } catch (error) {
      console.error('[threadDelete] Error handling thread deletion:', error);
    }
  },
};
