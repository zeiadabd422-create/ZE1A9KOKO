import { PLANS } from '../config/plans.js';

const guildConfigs = new Map();

export class GuildConfigService {

      static getConfig(guildId) {
            if (!guildConfigs.has(guildId)) {
                      guildConfigs.set(guildId, {
                                plan: 'free',
                                        usage: {
                                                      dailyVerifications: 0
                                        },
                                        activeSessions: 0,
                                        lastReset: Date.now()
                      });
            }

                return guildConfigs.get(guildId);
      }

      static checkReset(id) {
            const c = this.getConfig(id);
              const now = Date.now();
                if (now - c.lastReset > 86400000) {
                      c.usage.dailyVerifications = 0;
                          c.lastReset = now;
                }
      }

        static getPlan(guildId) {
                const config = this.getConfig(guildId);
                    return PLANS[config.plan];
        }

          static incrementUsage(guildId) {
                const config = this.getConfig(guildId);
                    config.usage.dailyVerifications++;
          }

            static canVerify(guildId) {
                    this.checkReset(guildId);
                    const config = this.getConfig(guildId);
                        const plan = this.getPlan(guildId);

                            return config.usage.dailyVerifications < plan.maxDailyVerifications;
            }

            static canStartSession(guildId) {
                    const config = this.getConfig(guildId);
                        const plan = this.getPlan(guildId);

                            return config.activeSessions < plan.maxConcurrentSessions;
            }

            static startSession(guildId) {
                    const config = this.getConfig(guildId);
                        config.activeSessions++;
            }

            static endSession(guildId) {
                    const config = this.getConfig(guildId);
                        config.activeSessions = Math.max(0, config.activeSessions - 1);
            }
}
