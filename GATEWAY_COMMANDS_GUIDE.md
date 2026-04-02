# 🔐 Gateway Slash Commands - Complete Documentation

## 📋 Overview
The new Gateway command system provides full administrative control over the verification process with:
- **Multilingual support** (Arabic/English)
- **Complete role management**
- **Advanced configuration options**
- **Real-time status monitoring**
- **Rate limiting & safety**

---

## 🚀 Command Structure

### `/gateway setup roles`
**Purpose**: Configure unverified and verified roles

**Parameters:**
- `unverified_role` (Required) - Role applied upon member join
- `verified_role` (Required) - Role applied after successful verification

**Validations:**
1. ✅ Roles must be different
2. ✅ Bot must have "Manage Roles" permission
3. ✅ Bot role must be above both roles

**Example:**
```
/gateway setup roles unverified_role:@Waiting verified_role:@Verified
```

**Result:**
```
✅ Role configuration saved
• Unverified: @Waiting
• Verified: @Verified
```

---

### `/gateway setup channel`
**Purpose**: Set fallback channel when DM fails

**Parameters:**
- `verification_channel` (Required) - Channel for verification prompts

**Example:**
```
/gateway setup channel verification_channel:#verification
```

**Result:**
```
✅ Verification channel set: #verification
```

---

### `/gateway setup messages`
**Purpose**: Configure custom message templates with placeholder support

**Parameters (Optional):**
- `welcome_message` - Welcome DM text
  - Supported placeholders: `{user}`, `{guild}`, `{risk}`
- `verify_embed` - Verification stage embed (JSON)
- `success_embed` - Success message (JSON)
- `fail_embed` - Failure message (JSON)

**Placeholder Examples:**
```
welcome_message: "Welcome to {guild}! {user}, please complete verification to access the server. Your risk level: {risk}"
```

**JSON Embed Example:**
```json
{
  "title": "Verification Required",
  "description": "Challenge: What is 2+2?",
  "color": 3498875,
  "footer": { "text": "Answer carefully" }
}
```

**Example:**
```
/gateway setup messages welcome_message:"Welcome to our server!" verify_embed:"<json>"
```

---

### `/gateway setup flow`
**Purpose**: Configure verification difficulty and flow settings

**Parameters:**
- `mode` (Required) - Difficulty level:
  - `EASY` - 3 attempts, 4 min timeout
  - `NORMAL` - 2 attempts, 2 min timeout
  - `HARD` - 1 attempt, 1.5 min timeout
  - `HARD++` - 1 attempt, 1 min timeout, instant kick on failure

- `steps_count` (Optional) - Number of verification steps (1-5), default: 3

**Example:**
```
/gateway setup flow mode:NORMAL steps_count:3
```

**Result:**
```
✅ Flow settings saved
• Mode: NORMAL
• Steps Count: 3
```

---

### `/gateway start`
**Purpose**: Manually initiate verification for a specific user

**Parameters:**
- `user` (Required) - Target user to verify

**Validations:**
- User must exist in the guild
- User must not have an active session

**Example:**
```
/gateway start user:@John
```

**Result:**
```
✅ Verification started for John#1234
```

---

### `/gateway status`
**Purpose**: View comprehensive gateway system status

**Displays:**
- Active sessions count
- Total sessions
- Failure count
- Anti-raid mode status
- Verified/Unverified member count
- Current configuration

**Example:**
```
/gateway status
```

**Result:**
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

## 🌍 Localization

The system automatically detects user locale:
- **Arabic locale** → Arabic responses
- **Other locales** → English responses

### Command translations:
| Action | Arabic | English |
|--------|--------|---------|
| Setup success | ✅ تم الحفظ | ✅ Saved |
| Validation error | ❌ خطأ | ❌ Error |
| Rate limited | ⏰ سريع جدا | ⏰ Too fast |

---

## 🛡️ Safety Features

### Rate Limiting
- **Window**: 60 seconds
- **Max attempts**: 5 commands per window
- **Trigger message**: "⏰ Rate limited. Please wait."

### Validations
1. **Role checks**: Ensures bot can manage specified roles
2. **Position hierarchy**: Bot role must be above target roles
3. **Session check**: Prevents duplicate verification for same user
4. **Guild only**: Commands only work in guilds, not DMs

### Error Handling
- Database errors caught and reported
- Gateway module availability check
- Try-catch wrappers on all operations
- Graceful fallbacks

---

## ⚙️ Configuration Storage

All settings are stored in MongoDB `GatewayConfig`:

```javascript
{
  guildId: "123456789",
  enabled: true,
  verifiedRole: "role_id",
  unverifiedRole: "role_id",
  verificationChannel: "channel_id",
  defaultMode: "NORMAL",
  visualTemplates: {
    welcome: { content: "...", placeholders: [...] },
    verification: { verify_start: {...}, verify_success: {...} }
  }
}
```

---

## 🔄 Flow Integration

### How verification works:

1. **Member joins** → Receives `unverified_role`
2. **Receives DM** → With verification prompt (or fallback to channel)
3. **Clicks button or types start** → Session created
4. **Completes challenges** → According to configured `mode`
5. **Success** → `unverified_role` removed + `verified_role` added
6. **Failure** → Session timeout, can retry on rejoin

---

## 📊 Status Metrics

### Sessions
- **Total**: All active verification sessions
- **Active**: Sessions in "pending" status only

### Members
- **Verified**: Count of users with `verified_role`
- **Unverified**: Count of users with `unverified_role`

### Security
- **Anti-Raid Mode**: Shows if active based on join rate
- **Failures**: Number of failed verifications

---

## 🚨 Error Messages

### English
```
❌ Bot lacks "Manage Roles" permission
❌ Both roles cannot be the same
❌ Bot role is not above selected role
❌ User not found in guild
❌ User already has an active verification session
❌ Command execution failed
❌ Database error
⏰ Rate limited. Please wait.
```

### Arabic
```
❌ البوت لا يملك صلاحية "Manage Roles"
❌ الرولين لا يمكن أن يكونا نفس الشيء
❌ البوت لا يملك رتبة أعلى من الرول المحدد
❌ لم يتم العثور على المستخدم في السيرفر
⚠️ المستخدم لديه جلسة تحقق نشطة بالفعل
❌ حدث خطأ أثناء تنفيذ الأمر
❌ خطأ في قاعدة البيانات
⏰ قلت من الطلبات بسرعة كبيرة، انتظر قليلاً
```

---

## 🔧 Setup Example (Full Walkthrough)

### Step 1: Configure Roles
```
/gateway setup roles 
  unverified_role:@Waiting 
  verified_role:@Verified
```

### Step 2: Set Fallback Channel
```
/gateway setup channel 
  verification_channel:#verification
```

### Step 3: Configure Messages
```
/gateway setup messages 
  welcome_message:"Welcome to {guild}! Complete verification to continue."
```

### Step 4: Set Flow
```
/gateway setup flow 
  mode:NORMAL 
  steps_count:3
```

### Step 5: Check Status
```
/gateway status
```

### Step 6: Manual Start (Optional)
```
/gateway start user:@NewMember
```

---

## 📝 Notes

1. **Permissions**: Only server administrators can use `setup` subcommands
2. **Role order**: Higher role hierarchy → stricter verification
3. **JSON validation**: Invalid JSON in embeds will be rejected
4. **Locale detection**: Based on user's Discord language setting
5. **Fallback behavior**: If DM fails → message sent to `verification_channel`

---

## 🐛 Troubleshooting

### Commands not appearing?
- Run `node deploy-commands.js` to register
- Check CLIENT_ID and GUILD_ID in .env

### Rate limited?
- Wait 60 seconds between command batches
- Max 5 commands per minute per user

### Database errors?
- Ensure MongoDB is running
- Check MONGO_URI in .env

### Bot can't manage roles?
- Check bot has "Manage Roles" permission
- Ensure bot role is above target roles

---

## 📦 Dependencies

- `discord.js` (v14+)
- `mongoose` (for GatewayConfig)
- SlashCommandBuilder from discord.js

---

## 🎯 Summary

The new Gateway Command system provides:
✅ Complete Arabic/English support
✅ Role validation and management
✅ Advanced configuration options
✅ Real-time status monitoring
✅ Rate limiting for safety
✅ Database persistence
✅ Comprehensive error handling
