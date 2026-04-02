# Thread-Based Verification System - Documentation

## نظام التحقق المتقدم عبر Threads

### 📋 الملفات الرئيسية:

```
src/
├── utils/normalizeText.js                      (Text normalization)
├── core/
│   ├── ThreadSessionManager.js                 (Session management)
│   ├── ThreadVerificationSystem.js             (Main verification logic)
│   ├── ThreadVerificationRateLimit.js          (Rate limiting)
│   ├── ThreadVerificationIntegration.js        (Gateway integration)
├── config/ThreadVerificationConfig.js          (Configuration)
├── events/
│   ├── messageCreate.js                        (DM trigger)
│   ├── interactionCreate.js                    (Button handler)
│   └── threadDelete.js                         (Cleanup)
```

---

## 🔄 آلية العمل:

### 1. المستخدم يكتب "ابدأ" في DM:
```
User: ابدأ
```

### 2. البوت ينشئ Thread في قناة Verification:
```
Thread: verify-username
```

### 3. البوت يرسل رسالة البداية مع زر:
```
Embed: جلسة التحقق الخاصة بك
Button: ابدأ التحقق
```

### 4. المستخدم يضغط الزر:
```
System: بدء تحديات التحقق
```

### 5. بعد النجاح:
```
✅ إزالة unverified role
✅ إضافة verified role
✅ حذف Thread
```

---

## 🎯 المميزات:

✅ **Text Normalization:**
- تحويل إلى lowercase
- إزالة التشكيل
- توحيد الأحرف العربية

✅ **Session Management:**
- منع duplicate sessions
- Timeout تلقائي (5 دقائق)
- Auto cleanup

✅ **Rate Limiting:**
- 3 محاولات / 30 ثانية
- إعادة محاولة مع Retry button

✅ **Thread Privacy:**
- Private threads (لو متاح)
- إضافة user + bot فقط
- حذف تلقائي بعد النجاح

✅ **Error Handling:**
- شامل مع try-catch
- Graceful fallbacks
- تنظيف عند الفشل

---

## 📊 Session Lifecycle:

```
DM "ابدأ" 
    ↓
Check existing session
    ↓
Create Thread
    ↓
Add permissions
    ↓
Send start message
    ↓ (User clicks button)
Start verification
    ↓
Success/Failure
    ↓
Update roles
    ↓
Delete Thread
    ↓
Cleanup session
```

---

## 🔒 الحماية:

1. **Rate Limiting:** 3 محاولات / 30 ثانية
2. **Session Timeout:** 5 دقائق من البداية
3. **Member Check:** التحقق من وجود العضو
4. **Permission Check:** التحقق من صلاحيات البوت
5. **User Verification:** فقط مالك الجلسة يمكنه التفاعل

---

## 🛠️ الاستخدام:

### تفعيل النظام:
```javascript
import { ThreadVerificationSystem } from './core/ThreadVerificationSystem.js';
import { verificationSessions } from './core/ThreadSessionManager.js';
```

### الحصول على جلسة:
```javascript
const session = verificationSessions.getSessionByUser(userId);
```

### معالجة النجاح:
```javascript
await ThreadVerificationSystem.handleVerificationSuccess(userId, threadId, guild);
```

### معالجة الفشل:
```javascript
await ThreadVerificationSystem.handleVerificationFailure(userId, threadId, guild);
```

---

## 📝 Configuration:

في `src/config/ThreadVerificationConfig.js`:

```javascript
THREAD_AUTO_ARCHIVE_DURATION: 60,
SESSION_TIMEOUT_MS: 5 * 60 * 1000,
THREAD_CLEANUP_DELAY_MS: 3000,
RATE_LIMIT_WINDOW_MS: 30000,
MAX_RETRY_ATTEMPTS: 3,
```

---

## 🐛 Troubleshooting:

### Thread لم ينشأ:
- تحقق من صلاحية `ManageThreads`
- تحقق من قناة verification موجودة

### DM trigger لم يشتغل:
- تأكد من كتابة "ابدأ"
- تحقق من `normalizeText` function

### Button لا يستجيب:
- تأكد من `customId: 'verify_thread_start'`
- تحقق من session موجودة

---

## 📚 Integrations:

النظام متكامل مع:
- ✅ Gateway Module (للـ roles والـ verification)
- ✅ Discord.js v14 (للـ threads والـ buttons)
- ✅ MessageCreate event (للـ DM trigger)
- ✅ InteractionCreate event (للـ buttons)

---
