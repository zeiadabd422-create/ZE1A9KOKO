export const THREAD_VERIFICATION_CONFIG = {
  THREAD_AUTO_ARCHIVE_DURATION: 60,
  SESSION_TIMEOUT_MS: 5 * 60 * 1000,
  THREAD_CLEANUP_DELAY_MS: 3000,
  RATE_LIMIT_WINDOW_MS: 30000,
  MAX_RETRY_ATTEMPTS: 3,
  MAX_RATE_LIMIT_ATTEMPTS: 3,

  THREAD_NAME_PREFIX: 'verify-',

  TIMEOUTS: {
    SESSION: 5 * 60 * 1000,
    THREAD_CLEANUP: 3000,
    RETRY_WINDOW: 30000,
  },

  PERMISSIONS: {
    REQUIRED_BOT_PERMISSIONS: ['CreatePublicThreads', 'ManageThreads', 'SendMessages'],
  },

  MESSAGES: {
    ARABIC: {
      THREAD_START_TITLE: '🔒 جلسة التحقق الخاصة بك',
      THREAD_START_DESC: 'اضغط على الزر أدناه لبدء عملية التحقق الأمان',
      START_BUTTON_LABEL: 'ابدأ التحقق',
      SUCCESS_TITLE: '✅ تم التحقق بنجاح!',
      SUCCESS_DESC: 'تم إضافتك إلى السيرفر بنجاح والآن لديك وصول كامل.',
      FAILURE_TITLE: '❌ فشلت المحاولة',
      FAILURE_DESC: (retries) => `لم تجتز هذه المحاولة. لديك ${retries} محاولات متبقية.`,
      EXHAUSTED_TITLE: '❌ انتهت محاولاتك',
      EXHAUSTED_DESC: 'لقد استنفدت جميع محاولاتك. يرجى الانتظار قليلاً والمحاولة مرة أخرى.',
      SESSION_EXISTS: '⚠️ عندك جلسة تحقق مفتوحة بالفعل. يرجى إكمالها أو الانتظار.',
      SESSION_TIMEOUT: '⏰ انتهت جلسة التحقق',
      SESSION_TIMEOUT_DESC: 'انتهت مهلة الوقت للتحقق. يرجى الانتظار والمحاولة في وقت لاحق.',
      NOT_YOUR_SESSION: '❌ هذه الجلسة خاصة بمستخدم آخر.',
      MEMBER_NOT_FOUND: '❌ لم يتمكن النظام من العثور على بيانات العضو.',
      INVALID_SESSION: '❌ لا توجد جلسة تحقق نشطة.',
      DM_ONLY_ERROR: '❌ هذا الأمر يعمل فقط في السيرفرات.',
      ERROR_CREATING_SESSION: '❌ حدث خطأ في إنشاء جلسة التحقق. يرجى المحاولة لاحقا.',
      ERROR_STARTING_VERIFICATION: '❌ حدث خطأ في بدء التحقق.',
      RETRY_BUTTON_LABEL: 'حاول مرة أخرى',
      VERIFICATION_STARTED: '✅ تم بدء عملية التحقق. اتبع التعليمات.',
      DM_SUCCESS: 'تم فتح جلسة التحقق لك في السيرفر',
      DM_SUCCESS_SUFFIX: 'انتظر رسالة التأكيد والزر في رسالتك الخاصة.',
    },
  },

  COLORS: {
    PRIMARY: 0x3498db,
    SUCCESS: 0x2ecc71,
    FAILURE: 0xe74c3c,
    WARNING: 0xf39c12,
    DANGER: 0xc0392b,
  },

  EMOJIS: {
    START: '✅',
    SUCCESS: '✅',
    FAILURE: '❌',
    TIMEOUT: '⏰',
    WARNING: '⚠️',
    LOCK: '🔒',
    RETRY: '🔄',
  },
};
