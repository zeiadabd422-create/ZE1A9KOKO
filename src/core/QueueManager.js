/**
 * QueueManager - Manages waiting users and concurrent session limits
 */
import { gatewayLogger } from '../utils/GatewayLogger.js';

export class QueueManager {
  constructor(maxConcurrent = 20) {
    this.waitingQueue = []; // userId[]
    this.activeSessions = new Set(); // userId
    this.maxConcurrent = maxConcurrent;
    this.notificationCallbacks = new Map(); // userId -> callback
  }

  /**
   * Add user to queue
   */
  enqueue(userId) {
    if (this.activeSessions.has(userId) || this.waitingQueue.includes(userId)) {
      throw new Error(`User ${userId} already in queue or active`);
    }

    this.waitingQueue.push(userId);
    const position = this.getQueuePosition(userId);
    gatewayLogger.queueEnqueue(userId, position);
    return position;
  }

  /**
   * Start verification for user (mark as active)
   */
  startSession(userId) {
    // Remove from waiting queue if present
    const index = this.waitingQueue.indexOf(userId);
    if (index !== -1) {
      this.waitingQueue.splice(index, 1);
    }

    this.activeSessions.add(userId);
    gatewayLogger.log('QUEUE:START', null, `User started session (${this.activeSessions.size}/${this.maxConcurrent} active)`, {
      userId,
      activeSessions: this.activeSessions.size
    });
    return true;
  }

  /**
   * Finish session and notify next user
   */
  async finishSession(userId) {
      gatewayLogger.log('QUEUE:FINISH', null, `User session finished`, { userId });
      this.activeSessions.delete(userId);
      gatewayLogger.log('QUEUE:STATE', null, `Active sessions: ${this.activeSessions.size}/${this.maxConcurrent}`, {
        activeSessions: this.activeSessions.size,
        waiting: this.waitingQueue.length
      });

        if (this.waitingQueue.length > 0 && this.activeSessions.size < this.maxConcurrent) {
                const nextId = this.waitingQueue.shift();
                gatewayLogger.queueNotify(nextId);
                    const cb = this.notificationCallbacks.get(nextId);
                        this.notificationCallbacks.delete(nextId);

                            if (cb) {
                                      try {
                                                await cb();
                                                console.log('[GatewayTest] Callback executed for ' + nextId);
                                      } catch (e) {
                                                console.error('[Queue] Notification failed:', e);
                                      }
                            }
        }
}

  /**
   * Remove user from queue
   */
  dequeue(userId) {
    const index = this.waitingQueue.indexOf(userId);
    if (index !== -1) {
      this.waitingQueue.splice(index, 1);
      this.notificationCallbacks.delete(userId);
      return true;
    }
    return false;
  }

  /**
   * Get queue position (1-indexed)
   */
  getQueuePosition(userId) {
    const index = this.waitingQueue.indexOf(userId);
    return index === -1 ? -1 : index + 1;
  }

  /**
   * Get remaining wait estimate (in seconds)
   */
  getWaitEstimate(userId) {
    const position = this.getQueuePosition(userId);
    if (position === -1) return -1;

    // Assume ~30-60 seconds per session
    return position * 45;
  }

  /**
   * Check if user is next in queue
   */
  isNextInQueue(userId) {
    return this.waitingQueue[0] === userId;
  }

  /**
   * Check if can start a session (under max concurrent)
   */
  canStartSession() {
    return this.activeSessions.size < this.maxConcurrent;
  }

  /**
   * Register notification callback
   */
  registerNotification(userId, callback) {
    this.notificationCallbacks.set(userId, callback);
  }

  /**
   * Get queue stats
   */
  getStats() {
    return {
      waitingCount: this.waitingQueue.length,
      activeCount: this.activeSessions.size,
      maxConcurrent: this.maxConcurrent,
      utilizationPercent: Math.round((this.activeSessions.size / this.maxConcurrent) * 100),
    };
  }

  /**
   * Clear all (for testing/reset)
   */
  clear() {
    this.waitingQueue = [];
    this.activeSessions.clear();
    this.notificationCallbacks.clear();
  }
}

// Export singleton instance
export const queueManager = new QueueManager(20);
