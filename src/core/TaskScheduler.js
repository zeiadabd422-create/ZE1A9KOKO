import GatewayConfig from '../modules/gateway/schema.js';

/**
 * Simple task scheduler that periodically scans the gateway configuration
 * documents for expired temporary roles and purges them.  This is intended
 * to run as part of the bot process and keep the state map clean.
 */
class TaskScheduler {
  constructor() {
    this.interval = null;
  }

  start() {
    if (this.interval) return;
    // run every minute
    this.interval = setInterval(async () => {
      try {
        const now = new Date();
        const configs = await GatewayConfig.find({});
        for (const cfg of configs) {
          if (cfg.userStates && cfg.userStates.size) {
            let changed = false;
            for (const [userId, state] of cfg.userStates.entries()) {
              if (state.tempRoles && state.tempRoles.length) {
                const originalLength = state.tempRoles.length;
                state.tempRoles = state.tempRoles.filter((r) => {
                  return r.expiresAt && r.expiresAt > now;
                });
                if (state.tempRoles.length !== originalLength) {
                  changed = true;
                }
              }
            }
            if (changed) {
              // save only if something changed
              try {
                await cfg.save();
              } catch (e) {
                console.error('[Scheduler] Failed to save gateway config:', e);
              }
            }
          }
        }
      } catch (e) {
        console.error('[Scheduler] error checking temp roles', e);
      }
    }, 60 * 1000);
  }
}

export default new TaskScheduler();
