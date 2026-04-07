const DEBUG_MODE = process.env.DEBUG_GATEWAY === 'true';

class GatewayLogger {
  constructor() {
    this.sessionLogs = new Map(); // sessionId -> logs array
  }

  /**
   * Log with session context
   */
  log(level, sessionId, message, data = {}) {
    const timestamp = new Date().toISOString();
    const sessionPrefix = sessionId ? `[SESSION:${sessionId}]` : '[GATEWAY]';
    const levelTag = `[${level}]`;
    
    const logEntry = {
      timestamp,
      level,
      sessionId,
      message,
      data
    };

    // Store in session log
    if (sessionId) {
      if (!this.sessionLogs.has(sessionId)) {
        this.sessionLogs.set(sessionId, []);
      }
      this.sessionLogs.get(sessionId).push(logEntry);
    }

    // Console output
    const output = `${timestamp} ${sessionPrefix} ${levelTag} ${message}${
      Object.keys(data).length > 0 ? ' | ' + JSON.stringify(data) : ''
    }`;

    if (level === 'ERROR') {
      console.error(output);
    } else if (level === 'WARN') {
      console.warn(output);
    } else if (level === 'DEBUG' && DEBUG_MODE) {
      console.log(output);
    } else if (level !== 'DEBUG') {
      console.log(output);
    }

    return logEntry;
  }

  /**
   * Interaction received
   */
  interaction(sessionId, interaction) {
    return this.log('INTERACTION', sessionId, 'Interaction received', {
      interactionId: interaction.id,
      type: interaction.customId?.split(':')[1] || 'unknown',
      customId: interaction.customId,
      userId: interaction.user?.id,
      timestamp: interaction.createdTimestamp
    });
  }

  /**
   * Custom ID parsed
   */
  parsed(sessionId, parsed) {
    return this.log('PARSED', sessionId, 'CustomId parsed', {
      type: parsed.type,
      userId: parsed.userId,
      step: parsed.step,
      action: parsed.action
    });
  }

  /**
   * Step execution
   */
  step(sessionId, step, action, state = null) {
    const data = { step, action };
    if (state) data.state = state;
    return this.log('STEP', sessionId, `Step: ${step} → ${action}`, data);
  }

  /**
   * Session created
   */
  sessionCreated(userId, guildId, sessionId) {
    return this.log('SESSION', sessionId, 'Session created', {
      userId,
      guildId,
      timestamp: Date.now()
    });
  }

  /**
   * Session expired
   */
  sessionExpired(sessionId, userId) {
    return this.log('SESSION:EXPIRE', sessionId, 'Session expired', {
      userId,
      reason: 'timeout'
    });
  }

  /**
   * Session ended
   */
  sessionEnded(sessionId, userId, reason = 'completed') {
    return this.log('SESSION:END', sessionId, 'Session ended', {
      userId,
      reason
    });
  }

  /**
   * Cooldown triggered
   */
  cooldown(userId, remainingMs) {
    return this.log('ABUSE:COOLDOWN', null, 'User blocked by cooldown', {
      userId,
      remainingMs,
      timestamp: Date.now()
    });
  }

  /**
   * Queue operations
   */
  queueEnqueue(userId, position) {
    return this.log('QUEUE:ENQUEUE', null, `User queued at position ${position}`, {
      userId,
      position,
      timestamp: Date.now()
    });
  }

  queueDequeue(userId, position) {
    return this.log('QUEUE:DEQUEUE', null, `User moved to position ${position}`, {
      userId,
      position,
      timestamp: Date.now()
    });
  }

  queueNotify(userId) {
    return this.log('QUEUE:NOTIFY', null, 'User notified from queue', {
      userId,
      timestamp: Date.now()
    });
  }

  /**
   * Error with context
   */
  error(sessionId, error, context = {}) {
    const errorData = {
      message: error.message,
      stack: error.stack?.split('\n')[1]?.trim() || 'No stack trace',
      code: error.code || 'UNKNOWN',
      ...context
    };

    return this.log('ERROR', sessionId, `Error: ${error.message}`, errorData);
  }

  /**
   * Get session logs
   */
  getSessionLogs(sessionId) {
    return this.sessionLogs.get(sessionId) || [];
  }

  /**
   * Print session summary
   */
  printSessionSummary(sessionId) {
    const logs = this.getSessionLogs(sessionId);
    if (logs.length === 0) return null;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`SESSION SUMMARY: ${sessionId}`);
    console.log(`${'='.repeat(60)}`);
    
    logs.forEach(log => {
      const dataStr = Object.keys(log.data).length > 0 ? 
        ` | ${JSON.stringify(log.data)}` : '';
      console.log(`${log.timestamp} [${log.level}] ${log.message}${dataStr}`);
    });

    console.log(`${'='.repeat(60)}\n`);
  }

  /**
   * Clear old session logs (older than 1 hour)
   */
  cleanup() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [sessionId, logs] of this.sessionLogs.entries()) {
      if (logs.length > 0 && new Date(logs[0].timestamp).getTime() < oneHourAgo) {
        this.sessionLogs.delete(sessionId);
      }
    }
  }
}

export const gatewayLogger = new GatewayLogger();
