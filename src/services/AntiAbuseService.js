const userCooldowns = new Map(); // userId -> timestamp

import { gatewayLogger } from '../utils/GatewayLogger.js';

export class AntiAbuseService {

      static isOnCooldown(userId) {
            const now = Date.now();
                const last = userCooldowns.get(userId) || 0;

                    // 1.5 ثانية cooldown
                        if (now - last < 1500) {
                                  const remainingMs = 1500 - (now - last);
                                  gatewayLogger.cooldown(userId, remainingMs);
                                  userCooldowns.set(userId, now);
                                    return true;
                        }

                            userCooldowns.set(userId, now);
                                return false;
      }
}