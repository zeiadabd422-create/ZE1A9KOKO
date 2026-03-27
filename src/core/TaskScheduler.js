import mongoose from 'mongoose';
import GatewayConfig from '../modules/gateway/schema.js';
import Member from '../models/Member.js';

export default class TaskScheduler {
  constructor(client) {
    this.client = client;
    this.isRunning = false; // حماية لمنع تداخل المهام
    this.lastMemberSync = new Date(0);
  }

  start() {
    // تشغيل الفحص كل دقيقة مع حماية كاملة
    setInterval(async () => {
      if (this.isRunning) return; // إذا كانت المهمة السابقة لم تنتهِ، انتظر
      
      // الحماية: تخطي إذا كانت قاعدة البيانات غير متصلة
      if (mongoose.connection.readyState !== 1) {
        return console.warn('[SCHEDULER-GUARD] Database not ready. Skipping tick.');
      }

      this.isRunning = true;
      try {
        await this.runAllTasks();
      } catch (error) {
        console.error('[SCHEDULER-ERROR] Critical failure:', error);
      } finally {
        this.isRunning = false;
      }
    }, 60_000);

    console.log('[SCHEDULER] Ironclad Service Started (Interval: 60s)');
  }

  /**
   * دالة عالمية لتشغيل جميع المهام الخلفية (رتب، حظر مؤقت، إلخ)
   */
  async runAllTasks() {
    // 1. فحص الرتب المؤقتة المنتهية
    await this.checkExpiredRoles();

    // 2. فحص حالة العضو وحذف منسحبين
    await this.checkMemberStatusAndCleanup();

    // 3. فحص الحظر المؤقت (سيتم إضافته لاحقاً)
    // await this.checkExpiredBans();
  }

  async checkMemberStatusAndCleanup() {
    try {
      const now = new Date();
      if (now - this.lastMemberSync < 24 * 60 * 60 * 1000) {
        return; // only run once every 24 hours
      }
      this.lastMemberSync = now;

      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      for (const [guildId, guild] of this.client.guilds.cache) {
        const memberIdsInCache = new Set(guild.members.cache.map(m => m.id));

        // 1) Flag members as 'left' if they are no longer in cache
        await Member.updateMany(
          {
            guildId,
            status: { $ne: 'left' },
            userId: { $nin: Array.from(memberIdsInCache) },
          },
          {
            $set: {
              status: 'left',
              leftAt: now,
              lastSeen: now,
            },
          }
        );

        // 2) Delete records flagged left from previous 24h
        const deleteResult = await Member.deleteMany({
          guildId,
          status: 'left',
          leftAt: { $lte: twentyFourHoursAgo },
        });

        if (deleteResult.deletedCount > 0) {
          console.log(`[TaskScheduler] Removed ${deleteResult.deletedCount} left members from guild ${guildId}`);
        }
      }
    } catch (error) {
      console.error('[TaskScheduler] Error in checkMemberStatusAndCleanup:', error);
    }
  }

  async checkExpiredRoles() {
    // Optimized Query: Use find({ "userStates.tempRoles.expiresAt": { $lte: new Date() } })
    try {
      const configsWithExpiredRoles = await GatewayConfig.find({
        enabled: true,
        "userStates.tempRoles.expiresAt": { $lte: new Date() }
      }).select("guildId userStates");
      
      for (const config of configsWithExpiredRoles) {
        if (!config.userStates || typeof config.userStates !== 'object') continue;
        
        let hasChanges = false;
        const updates = {};
        
        const userStateEntries = config.userStates instanceof Map
          ? config.userStates.entries()
          : Object.entries(config.userStates || {});

        for (const [userId, userState] of userStateEntries) {
          if (!userState || !userState.tempRoles || !Array.isArray(userState.tempRoles)) continue;
          
          const activeTempRoles = userState.tempRoles.filter(role => {
            if (!role.expiresAt) return true; // Keep roles without expiration
            return new Date(role.expiresAt) > new Date(); // Keep if not expired
          });
          
          if (activeTempRoles.length !== userState.tempRoles.length) {
            updates[`userStates.${userId}.tempRoles`] = activeTempRoles;
            hasChanges = true;
            
            // Remove expired roles from the member if they're in the guild
            const expiredRoles = userState.tempRoles.filter(role => 
              role.expiresAt && new Date(role.expiresAt) <= new Date()
            );
            
            if (expiredRoles.length > 0) {
              try {
                const guild = this.client.guilds.cache.get(config.guildId);
                if (guild) {
                  const member = await guild.members.fetch(userId).catch(() => null);
                  if (member) {
                    for (const expiredRole of expiredRoles) {
                      if (member.roles.cache.has(expiredRole.roleId)) {
                        await member.roles.remove(expiredRole.roleId);
                        console.log(`[TaskScheduler] Removed expired temp role ${expiredRole.roleId} from user ${userId} in guild ${config.guildId}`);
                      }
                    }
                  }
                }
              } catch (err) {
                console.error(`[TaskScheduler] Failed to remove expired roles for user ${userId}:`, err.message);
              }
            }
          }
        }
        
        if (hasChanges) {
          await GatewayConfig.updateOne(
            { _id: config._id },
            { $set: updates }
          );
        }
      }
    } catch (error) {
      console.error('[TaskScheduler] Error in checkExpiredRoles:', error);
    }
  }
}