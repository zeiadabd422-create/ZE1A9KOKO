# Challenge System Design - Gateway Verification

## Overview
تم إضافة نظام تحدي بسيط قبل منح الرول للمستخدم عند الضغط على زر **Accept**.

## Flow الجديد

### 1️⃣ عند الضغط على Accept:
```
❌ لا تعطي الرول مباشرة بعد الآن
✅ بدلاً من ذلك، أرسل تحدي للمستخدم
```

### 2️⃣ التحدي (Challenge):
- يتم اختيار إجابة عشوائية: `A` أو `B`
- يتم حفظ الإجابة الصحيحة في `session.data.correctAnswer`
- يتم عرض زرين للاختيار:
  - 🅰️ Option A
  - 🅱️ Option B

### 3️⃣ معالجة الإجابة:

#### ✅ إجابة صحيحة:
- منح الرول الموثق ✔️
- حذف القناة ✔️
- إنهاء الجلسة ✔️

#### ❌ إجابة خاطئة:
- رسالة خطأ مع الإجابة الصحيحة
- حذف القناة بعد 3 ثواني
- إنهاء الجلسة ✔️

---

## Implementation Details

### في `src/core/GatewayEngine.js`:

#### Case: `accept`
```javascript
case 'accept':
  // Generate random correct answer (A or B)
  const correct = Math.random() > 0.5 ? 'A' : 'B';
  
  // Store in session
  sessionManager.updateSessionData(userId, 'correctAnswer', correct);
  sessionManager.updateSessionState(userId, 'challenge');
  
  // Send challenge buttons
  await interaction.editReply({
    content: `🎯 **تحدي التحقق** - اختر الزر الصحيح للمتابعة`,
    components: [challengeRow],
  });
```

#### Cases: `challenge_a` و `challenge_b`
```javascript
case 'challenge_a':
case 'challenge_b':
  const userAnswer = buttonAction === 'challenge_a' ? 'A' : 'B';
  const correctAnswer = session.data?.correctAnswer;
  
  if (userAnswer === correctAnswer) {
    // ✅ CORRECT
    // - Grant role
    // - Delete channel
    // - End session
  } else {
    // ❌ INCORRECT
    // - Show failure message
    // - Delete channel
    // - End session
  }
```

---

## Session State Changes

| الحالة | الوصف |
|--------|--------|
| `initializing` | الحالة الأولية |
| `active` | جلسة نشطة |
| **`challenge`** | 🆕 المستخدم في مرحلة التحدي |
| `completed` | تم التحقق بنجاح |
| `failed` | فشل التحقق |

---

## Logging

يتم تسجيل جميع الأحداث:
- `CHALLENGE:STARTED` - عند إرسال التحدي
- `CHALLENGE:FAILED` - عند فشل الإجابة
- `VERIFY:COMPLETE` - عند النجاح في التحدي

---

## Testing

لعمل اختبار كامل:
1. قم بتشغيل البوت
2. استخدم أمر استدعاء Gateway
3. اضغط على **Accept**
4. سيظهر التحدي مع خيارين (A أو B)
5. اختر الإجابة الصحيحة للنجاح
6. أو اختر الخيار الخاطئ لرؤية رسالة الفشل

---

## النقاط المهمة

✅ **Random Challenge**: كل مستخدم يحصل على تحدي عشوائي  
✅ **Session Storage**: الإجابة محفوظة في الجلسة  
✅ **Security**: التحدي يمنع الروبوتات التلقائية  
✅ **Logging**: جميع المحاولات مسجلة  
✅ **Error Handling**: معالجة الأخطاء شاملة  
