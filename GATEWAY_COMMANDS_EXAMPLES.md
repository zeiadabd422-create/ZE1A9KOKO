# 🎯 Gateway Commands - Practical Examples

## الأمثلة العملية التطبيقية

---

## 1️⃣  Setup Roles

### المثال الأساسي:
```
/gateway setup roles unverified_role:@Waiting verified_role:@Verified
```

### النتيجة:
```
✅ Role configuration saved
• Unverified: @Waiting
• Verified: @Verified
```

### الحالات الخاصة:

**إذا كنت تريد roles بأسماء معقدة:**
```
/gateway setup roles 
  unverified_role:@Members-Pending 
  verified_role:@Members-Verified
```

**إذا أعطيت نفس الرتبة:**
```
❌ Both roles cannot be the same
```

**إذا البوت لا يملك الصلاحيات:**
```
❌ Bot lacks "Manage Roles" permission
```

---

## 2️⃣  Setup Channel

### المثال الأساسي:
```
/gateway setup channel verification_channel:#verification
```

### النتيجة:
```
✅ Verification channel set: #verification
```

**ملاحظة**: هذه القناة تُستخدم كـ fallback فقط إذا فشل إرسال DM

---

## 3️⃣  Setup Messages

### مثال بسيط (welcome only):
```
/gateway setup messages 
  welcome_message:"Welcome to our server! Complete verification to access channels."
```

### مثال متقدم (مع placeholders):
```
/gateway setup messages 
  welcome_message:"Welcome to {guild}! {user}, please verify to continue. Your risk assessment: {risk}"
```

### مثال Embed JSON (verify_embed):
```
/gateway setup messages verify_embed:
{
  "title": "🔐 Server Verification",
  "description": "To prove you're human, answer the following challenge:",
  "color": 3498875,
  "fields": [
    {
      "name": "Challenge Type",
      "value": "Math Question",
      "inline": false
    }
  ],
  "footer": { "text": "You have 2 minutes to complete this" }
}
```

### مثال success_embed:
```
{
  "title": "✅ Verification Complete",
  "description": "{user} has successfully verified and can now access all channels.",
  "color": 2333763,
  "thumbnail": { "url": "https://emoji.gg/assets/emoji/check-mark.png" }
}
```

### مثال fail_embed:
```
{
  "title": "❌ Verification Failed",
  "description": "The verification process ended due to too many failed attempts.",
  "color": 15158332
}
```

---

## 4️⃣  Setup Flow

### Flow Level 1 - EASY (للمبتدئين):
```
/gateway setup flow mode:EASY steps_count:2
```
- 3 محاولات
- 4 دقائق timeout
- خطوتان فقط

### Flow Level 2 - NORMAL (الافتراضي):
```
/gateway setup flow mode:NORMAL steps_count:3
```
- 2 محاولة
- دقيقتان timeout
- 3 خطوات

### Flow Level 3 - HARD (للأمان العالي):
```
/gateway setup flow mode:HARD steps_count:4
```
- محاولة واحدة فقط!
- 1.5 دقيقة timeout
- أربع خطوات

### Flow Level 4 - HARD++ (قصوى الحماية):
```
/gateway setup flow mode:HARD++ steps_count:5
```
- محاولة واحدة فقط!
- دقيقة واحدة فقط!
- كل الخطوات الخمس!
- **kickOnFailure: true** ← سيتم طرد الشخص إذا فشل!

---

## 5️⃣  Start Verification

### بدء التحقق لمستخدم واحد:
```
/gateway start user:@John
```

### النتيجة:
```
✅ Verification started for John#1234
```

**الخطوات التي تحدث:**
1. يتم إرسال DM للمستخدم
2. تُنشأ جلسة تحقق
3. ينتظر المستخدم الإجابة على التحديات
4. عند النجاح → تُزال unverified role وتُضاف verified role

---

## 6️⃣  Status

### عرض الحالة الكاملة:
```
/gateway status
```

### النتيجة:
```
📊 Gateway System Status

📌 Sessions: Active: 2/5

❌ Failures: 1

🛡️ Security: Anti-Raid Mode: INACTIVE

👥 Members:
✅ Verified Members: 150
⏳ Pending Members: 5

⚙️ Configuration:
Mode: NORMAL
Verified Role: @Verified
Unverified Role: @Waiting
Fallback Channel: #verification
```

---

## 🔄 سيناريو كامل (Full Setup Walkthrough)

### الخطوة 1: إنشاء الرتب
```
(In Discord Channel)
Server Settings → Roles → Create Role "Waiting" (blue color)
Server Settings → Roles → Create Role "Verified" (green color)
```

### الخطوة 2: إنشاء قناة التحقق
```
(In Discord Channel)
Create new channel: #verification
Permissions: Only @Waiting can view
```

### الخطوة 3: تكوين الأدوار عبر الأمر
```
/gateway setup roles unverified_role:@Waiting verified_role:@Verified
```

### الخطوة 4: تكوين القناة
```
/gateway setup channel verification_channel:#verification
```

### الخطوة 5: تكوين الرسائل
```
/gateway setup messages welcome_message:"مرحبا في السيرفر! {user}، يرجى إكمال التحقق للمتابعة."
```

### الخطوة 6: تكوين مستوى الصعوبة
```
/gateway setup flow mode:NORMAL steps_count:3
```

### الخطوة 7: التحقق من الحالة
```
/gateway status
```

---

## 🚨 Troubleshooting Examples

### المسألة: "Both roles cannot be the same"
```
❌ Wrong:
/gateway setup roles unverified_role:@Verified verified_role:@Verified

✅ Correct:
/gateway setup roles unverified_role:@Waiting verified_role:@Verified
```

### المسألة: "Bot role is not above selected role"
```
This happens when:
- Bot role position < Unverified role position
- OR Bot role position < Verified role position

Solution: In Server Settings → Roles
Move bot role HIGHER in the list than both roles
```

### المسألة: Rate Limited
```
❌ Wrong (too fast):
/gateway setup roles ...
/gateway setup roles ...
/gateway setup roles ...
(5 commands within 60 seconds)

✅ Correct:
Wait 60 seconds between batches of 5 commands
```

### المسألة: User Already Has Session
```
❌ Wrong:
/gateway start user:@John
(John already has active verification)

✅ Correct:
Wait for John to complete or timeout
Check with: /gateway status
```

---

## 💾 Localization Examples

### أوامر بالعربية (لمستخدم عربي):

```
/gateway setup roles
  unverified_role:@في_الانتظار
  verified_role:@موثق
```

النتيجة (بالعربي):
```
✅ تم حفظ الرتب بنجاح
• Unverified: @في_الانتظار
• Verified: @موثق
```

### أوامر بالإنجليزية (لمستخدم إنجليزي):

```
/gateway setup roles
  unverified_role:@Waiting
  verified_role:@Verified
```

النتيجة (بالإنجليزي):
```
✅ Role configuration saved
• Unverified: @Waiting
• Verified: @Verified
```

---

## 📋 JSON Examples for Advanced Embeds

### مثال 1: Embed احترافي للتحقق
```json
{
  "title": "🔐 Server Verification Challenge",
  "description": "Please answer the following question to gain access to the server.",
  "color": 0x3498DB,
  "fields": [
    {
      "name": "Question",
      "value": "What is the capital of France?",
      "inline": false
    },
    {
      "name": "Difficulty",
      "value": "Easy",
      "inline": true
    },
    {
      "name": "Time Limit",
      "value": "2 minutes",
      "inline": true
    }
  ],
  "footer": {
    "text": "Answer carefully - limited attempts available"
  }
}
```

### مثال 2: Success Embed
```json
{
  "title": "✅ Verification Successful",
  "description": "Congratulations! You are now verified and can access all channels.",
  "color": 0x2ECC71,
  "fields": [
    {
      "name": "Status",
      "value": "Verified ✓",
      "inline": true
    },
    {
      "name": "Time Taken",
      "value": "45 seconds",
      "inline": true
    }
  ],
  "thumbnail": {
    "url": "https://emoji.gg/assets/emoji/green-checkmark.png"
  }
}
```

### مثال 3: Failure Embed
```json
{
  "title": "❌ Verification Failed",
  "description": "Unfortunately, you did not pass the verification.",
  "color": 0xE74C3C,
  "fields": [
    {
      "name": "Reason",
      "value": "Too many incorrect attempts",
      "inline": false
    },
    {
      "name": "What To Do",
      "value": "Leave and rejoin to try again",
      "inline": false
    }
  ]
}
```

---

## 🎨 Placeholder Examples

### welcome_message مع جميع المتغيرات:
```
Welcome to {guild}!

Hey {user}, thanks for joining!

Your risk level: {risk}

Please complete verification to access all channels.
```

**ستصبح:**
```
Welcome to My Server!

Hey John#1234, thanks for joining!

Your risk level: Low

Please complete verification to access all channels.
```

---

## ⚡ Quick Reference

| أمر | الغرض | الوقت |
|-----|-------|-------|
| `/gateway setup roles` | تعيين الرتب | فوري |
| `/gateway setup channel` | تعيين القناة | فوري |
| `/gateway setup messages` | الرسائل | فوري |
| `/gateway setup flow` | مستوى الصعوبة | فوري |
| `/gateway start @user` | بدء التحقق | فوري |
| `/gateway status` | عرض الحالة | فوري |

---

## 📚 Resources

- ملف التوثيق الكامل: `GATEWAY_COMMANDS_GUIDE.md`
- ملف التطبيق: `GATEWAY_COMMANDS_IMPLEMENTATION.md`
- كود الأمر: `src/commands/admin/gateway.js`

---

الآن أنت جاهز! 🚀
