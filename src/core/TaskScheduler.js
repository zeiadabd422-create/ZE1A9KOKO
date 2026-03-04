/**
 * ─── src/core/TaskScheduler.js ────────────────────────────────────────────────
 * GUARDIAN V2 - GLOBAL TASK SCHEDULER (IRONCLAD)
 * المصدر: مراجعة المدير التقني لضمان استقرار المهام الخلفية
 */

import mongoose from 'mongoose';

export default class TaskScheduler {
  constructor(client) {
    this.client = client;
    this.isRunning = false; // حماية لمنع تداخل المهام
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
    
    // 2. فحص الحظر المؤقت (سيتم إضافته لاحقاً)
    // await this.checkExpiredBans();
  }

  async checkExpiredRoles() {
    // هنا سنضع منطق البحث في الداتابيز عن الرتب المنتهية وسحبها
    // سيتم برمجتها عند البدء في ميزة Temporary Roles
  }
}
