import mongoose from 'mongoose';
import Member from '../models/Member.js';

export default class TaskScheduler {
  constructor(client) {
    this.client = client;
    this.isRunning = false;
    this.lastMemberSync = new Date(0);
  }

  start() {
    setInterval(async () => {
      if (this.isRunning) return;

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

  async runAllTasks() {
    await this.checkMemberStatusAndCleanup();
  }

  async checkMemberStatusAndCleanup() {
    try {
      const now = new Date();
      if (now - this.lastMemberSync < 24 * 60 * 60 * 1000) {
        return;
      }
      this.lastMemberSync = now;

      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      for (const [guildId, guild] of this.client.guilds.cache) {
        const memberIdsInCache = new Set(guild.members.cache.map((m) => m.id));

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
}
