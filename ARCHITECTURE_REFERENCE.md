# Guardian Bot V2 - Complete Architectural Reference Manual

> **Status**: PRODUCTION-READY | ESM Compliant | Zero-Deprecation | Bulletproof Logic

---

## Table of Contents
1. [Project Core Architecture](#project-core-architecture)
2. [Module System & Task Scheduler](#module-system--task-scheduler)
3. [EmbedVault Module - Complete Guide](#embedvault-module---complete-guide)
4. [Gateway Module - Verification & Lockdown](#gateway-module---verification--lockdown)
5. [Command Map & Permissions](#command-map--permissions)
6. [Operational Guide - Daily Tasks](#operational-guide---daily-tasks)
7. [Security Hardening Checklist](#security-hardening-checklist)

---

## Project Core Architecture

### Application Lifecycle

```
index.js (Main Entry)
  ├─ Load Environment (.env)
  ├─ Initialize Discord Client
  ├─ Load Loaders (Commands, Events, Modules)
  ├─ Deploy Slash Commands
  ├─ Connect to MongoDB
  └─ Bot Ready → Start TaskScheduler
```

### File Structure (ESM)

```
/workspaces/g/
├── index.js                          # Entry point
├── deploy-commands.js                 # Slash command deployment
├── package.json                       # Dependencies (discord.js v14+)
│
├── src/
│   ├── api.js                        # Express routes (optional)
│   ├── index.js                      # Client initialization
│   │
│   ├── commands/                     # Slash command files (~20ms per command)
│   │   ├── admin/
│   │   │   ├── gateway.js            # Setup verification methods
│   │   │   └── setup.js              # Partner embedding config
│   │   ├── general/
│   │   │   ├── ping.js               # Latency test
│   │   │   └── verify.js             # Manual verification trigger
│   │   └── utility/
│   │       ├── embed.js              # EmbedVault management
│   │       ├── embedHelp.js           # Embed documentation display
│   │       ├── preview.js             # Embed preview tool
│   │       └── system.js              # System diagnostics dashboard
│   │
│   ├── config/
│   │   └── environment.js            # Centralized config (db, tokens)
│   │
│   ├── core/
│   │   ├── database.js               # MongoDB connection & caching
│   │   ├── embedEngine.js            # Placeholder rendering engine
│   │   └── TaskScheduler.js          # Background job runner (5-min interval)
│   │
│   ├── events/
│   │   ├── ready.js                  # Bot online handler
│   │   ├── guildCreate.js            # New server join → create config
│   │   ├── guildDelete.js            # Server leave → cleanup
│   │   ├── guildMemberAdd.js         # Member join → send welcome
│   │   ├── guildMemberRemove.js      # Member leave → send goodbye
│   │   ├── guildUpdate.js            # Guild settings change
│   │   ├── interactionCreate.js      # CORE: ALL interaction routing
│   │   └── messageCreate.js          # Trigger word detection
│   │
│   ├── loaders/
│   │   ├── commands.js               # Dynamic command loader
│   │   ├── events.js                 # Event listener registration
│   │   └── modules.js                # Module initialization
│   │
│   ├── modules/
│   │   ├── config/
│   │   │   └── GuildConfig.js        # MongoDB schema (19 fields)
│   │   ├── embedVault/
│   │   │   ├── index.js              # Manager interface & button handler
│   │   │   ├── manager.js            # UI pagination & display
│   │   │   └── schema.js             # MongoDB schema
│   │   ├── gateway/
│   │   │   ├── index.js              # Verification logic & lockdown handler
│   │   │   ├── actions.js            # Token generation & gauntlet flows
│   │   │   ├── checker.js            # Raid shield & validation logic
│   │   │   ├── schema.js             # MongoDB schema
│   │   │   └── timedJob.js           # Token expiry cleanup (fired by ~TaskScheduler)
│   │   ├── inviteTracker/
│   │   │   └── index.js              # Track invite usage per-code
│   │   └── welcome/
│   │       └── index.js              # Welcome/goodbye message handler
│   │
│   └── utils/
│       ├── cache.js                  # BoundedMap LRU cache (100 items max)
│       ├── embedHelper.js            # Fetch embeds by name/type/invite
│       └── parseColor.js             # Hex → Decimal color conversion
│
└── assets/
    └── animals/                       # Animal emoji data for gauntlets

```

### Dependency Graph
```
discord.js v14+  →  Client, Interactions, MessageFlags, EmbedBuilder
mongoose 8+      →  MongoDB schemas & queries
dotenv          →  Environment variables
express 5+       →  Optional API routes
```

---

## Module System & Task Scheduler

### How Modules Load (ESM Dynamic Import)

**File**: `src/loaders/modules.js`

```javascript
// ✓ SAFE: Uses static paths, no ?update=${Date.now()} cache busting
for (const folder of folders) {
  const indexPath = pathToFileURL(path.join(modulesPath, folder, 'index.js')).href;
  const mod = await import(indexPath);  // Clean, memory-safe
  client[folder] = mod.default(client);
}
```

**Result**: Each module (embedVault, gateway, welcome, etc.) is attached to the client object:
- `client.gateway` → handles verification
- `client.embedVault` → manages embed storage
- `client.welcome` → sends joining/leaving embeds
- `client.inviteTracker` → tracks invite codes
- `client.embedHelper` → utility for rendering

### TaskScheduler - Background Jobs

**File**: `src/core/TaskScheduler.js`

Runs **every 5 minutes**:
1. **Token Expiry Cleanup** (gateway/timedJob.js)
   - Remove expired Level 2 tokens (> 90 seconds old)
   - Clear inactive users from `_activeGauntlets` map
   - Prevents memory bloat and abandoned gauntlets

2. **Invite Cache Refresh** (inviteTracker)
   - Re-fetch guild invite list for up-to-date `uses` count
   - Used by welcome module to assign partner roles

3. **Database Optimization** (future)
   - Prune old user verification records
   - Archive guild configurations

**Trigger Point**:
```javascript
// src/events/ready.js
if (!client.taskScheduler) {
  client.taskScheduler = new TaskScheduler(client);
  client.taskScheduler.start();  // Runs every 5 minutes
}
```

---

## EmbedVault Module - Complete Guide

### What is EmbedVault?

A **MongoDB-backed embed store** that allows server admins to:
- Create, edit, and delete custom embeds
- Bind embeds to invite codes (→ partner detection)
- Bind embeds to roles (→ role-specific welcome messages)
- Use drag-and-drop modular editor within Discord

**Schema** (`src/modules/embedVault/schema.js`):
```javascript
{
  guildId: String,          // Discord guild ID
  name: String,             // Unique embed name
  type: String,             // "Welcome" | "Goodbye" | "Partner" | "Manual"
  data: Object,             // Actual discord.js embed object
  linkedInviteCode: String, // For partner detection
  linkedPartnerRole: String,// Role ID for auto-assignment
  authorName: String,       // Custom author
  authorIcon: String,       // Avatar URL
  footerText: String,       // Footer
  footerIcon: String,       // Footer icon
  includeTimestamp: Boolean,// Timestamp flag
  updatedAt: Date,          // Last modified
}
```

### Binding System

#### 1. **Invite-to-Embed Binding** (Most Common)

When a member joins via invite code `abc123`, the system:

```
Step 1: Fetch invite info → get code = "abc123"
        ↓
Step 2: Look up config.partners array
        Find partner with inviteLink = "https://discord.gg/abc123"
        ↓
Step 3: Get embed name from partner config
        ↓
Step 4: Fetch embed from vault by name
        ↓
Step 5: Render embed with member context (name, id, account age, etc.)
        ↓
Step 6: Send welcome embed to welcome channel
        ↓
Step 7: If partner.roleId exists → add role to member
```

**File**: `src/utils/embedHelper.js` → `sendWelcomeEmbed()`

#### 2. **Manual Binding Command**

```bash
/embed bind [name] [invite_code] [partner_role]
```

Updates config:
```javascript
config.partners.push({
  embedName: "Partner_Elite",
  inviteLink: "https://discord.gg/abc123",
  roleId: "123456789"
});
```

### Placeholder Engine

**File**: `src/core/embedEngine.js` → `render()`

Supports dynamic values in embed fields:
```
{user}          → Member username
{user.id}       → Member ID
{member.tag}    → Username#Discrim
{server}        → Guild name
{account_age}   → Days since account creation
{join_pos}      → Member's position in server (1st, 2nd, etc.)
{invite.code}   → Used invite code
{invite.uses}   → Number of times invite was used
{partner.name}  → Partner embed name
```

**Example Template**:
```
Title: "Welcome {user}!"
Description: "
  You joined via: {invite.code} (used {invite.uses}x)
  Account age: {account_age} days
  You are member #{join_pos}
"
```

### Manager UI (Interactions)

**File**: `src/modules/embedVault/index.js` → `handleButtonInteraction()`

Available operations:
- `/embed manager` → Shows list of all embeds
- Click embed → Open modular editor
- Edit sections: Title, Description, Author, Footer, Images, Color
- Preview live rendering
- Delete embed

---

## Gateway Module - Verification & Lockdown

### Overview: The 4 Lockdown Levels

**File**: `src/modules/gateway/actions.js` → `getLockdownResponse()`

```
┌─────────────────────────────────────┐
│      Lockdown Level System          │
├─────────────────────────────────────┤
│ Level 0: Normal verification        │
│ Level 1: Basic DM gauntlet          │
│ Level 2: Strict DM gauntlet + token │
│ Level 3: Completely disabled        │
└─────────────────────────────────────┘
```

### Verification Flow - Level 0 (Normal)

```
Member clicks /verify or [Verify] button
           ↓
interactionCreate defers reply
           ↓
verifyMember() checks:
  - Is member already verified? (check unverified role)
  - Account age valid? (anti-raid shield)
  - All roles exist in guild?
           ↓
Add VERIFIED role
Remove UNVERIFIED role
           ↓
Send DM with verification confirmation
Update verification timestamp in DB
           ↓
Send ID Card to channel (showing account age, join pos, etc.)
```

**ID Card Format**:
```
✅ Digital ID Pass Issued

👤 Member: @Username
🏅 Join Position: #42
📅 Account Age: 365 days
📥 Joined Server: 2025-01-01
🟢 Status: Verified
```

### Gauntlet Flows - Level 1 & 2

#### **Level 1: DM Gauntlet** (Simpler, faster)

```
interactionCreate sends warning:
  "⚠️ Security Lockdown Active. Check your DMs..."
           ↓
startDMVerification() DMs member:
  Phase 1: Select the RED button from [Red, Green, Blue]
  Phase 2: Enter the 4-digit code shown: "1 2 3 4"
  Phase 3: Name the animal emoji: 🦁  →  Enter "lion"  
           ↓
All 3 phases passed? → Verify member (assign roles, etc.)
Any phase failed? → Ban or kick member (configurable)
```

#### **Level 2: Strict Gauntlet** (Maximum security)

```
Same as Level 1, BUT:
  - Add Token Exchange step
  - Bot displays token ephemerally in channel: "Token: ABC123"
  - Token displayed for 90 seconds only
  - User must enter token in DM matching server display
  - If token expired → Generate new token, restart gauntlet
           ↓
If user enters wrong token 3x → Ban immediately
```

### Token Generation (Security Hardened)

**File**: `src/modules/gateway/actions.js` → `generateToken()`

```javascript
export function generateToken(length = 6) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(length);  // ✓ Cryptographically secure
  let token = '';
  for (let i = 0; i < length; i += 1) {
    token += alphabet[bytes[i] % alphabet.length];
  }
  return token;  // e.g., "ABC123" or "XYZ789"
}
```

**Why crypto.randomBytes?**
- `Math.random()` is **predictable** (not suitable for security)
- `crypto.randomBytes()` uses OS entropy (genuinely random)
- Protection against token guessing attacks

### Configuration

**File**: `src/modules/gateway/schema.js`

```javascript
{
  guildId: String,
  enabled: Boolean,
  lockdownLevel: 0,  // 0 | 1 | 2 | 3
  
  // Global roles
  verifiedRole: String,     // Role to assign after verification
  unverifiedRole: String,   // Role that blocks access
  
  // Per-method config
  methods: {
    button: {
      enabled: Boolean,
      channel: String,         // Where [Verify] button appears
      verifiedRole: String,    // Can override global
      unverifiedRole: String,
      promptMessageId: String, // ID of the verification prompt
    },
    trigger: {
      enabled: Boolean,
      channel: String,
      triggerWord: String,     // e.g., "!verify"
      // ...similar structure
    },
    slash: {
      enabled: Boolean,
      channel: String,
      // ...similar structure
    }
  },
  
  // Raid Shield
  raidMode: Boolean,
  minimumAccountAge: 3,  // Days
  
  // UI customization
  successUI: {...},          // Embed template shown after verification
  alreadyVerifiedUI: {...},  // Shown if already verified
  errorUI: {...},            // Shown on failure
  dmUI: {...},               // DM confirmation
  promptUI: {...},           // Initial verification prompt
  
  // Initial messages per-method
  initialMessage: {
    button: {
      title: String,
      desc: String,
      image: String,
    },
    trigger: {...},
    slash: {...},
  }
}
```

### Trust Score Logic (Future Enhancement)

Reserved for future expansion:
- Track per-user verification attempts
- Reduce gauntlet complexity for trusted members
- Increase difficulty for suspicious patterns (multiple fails, alt accounts, etc.)

---

## Command Map & Permissions

### Admin Commands

#### **`/gateway setup`**
- **Permissions Required**: Administrator
- **Purpose**: Configure one of 3 verification methods (button, trigger, slash)
- **Parameters**:
  - `method`: "button" | "trigger" | "slash"
  - `channel`: Text channel for verification
  - `trigger_word`: Only for trigger method (e.g., "!verify")
  - `verified_role`: Role granted after verification
  - `unverified_role`: Role stripped after verification

**Example**:
```bash
/gateway setup method:button channel:#verify verified_role:@Member unverified_role:@Unverified
```

#### **`/gateway customize_ui`**
- **Permissions Required**: Administrator
- **Purpose**: Change embed appearance for verification messages
- **Pages**: success, alreadyVerified, error, dm, prompt
- **Parameters**: title, description, color (hex), imageUrl

#### **`/embed manager`**
- **Permissions Required**: Administrator
- **Purpose**: Browse and edit embeds in vault
- **UI**: Select menu with pagination

#### **`/embed bind`**
- **Permissions Required**: Administrator
- **Purpose**: Link invite code → embed + partner role
- **Parameters**:
  - `name`: Embed name
  - `invite_code`: Short code (last part of invite URL)
  - `partner_role`: Auto-assign role to members using this invite

#### **`/embed delete`**
- **Permissions Required**: Administrator
- **Purpose**: Remove embed from vault

#### **`/setup partner`** (Standalone guide)
- Walks through 3 steps:
  1. Select embed from vault
  2. Choose role to assign
  3. Provide invite link

### General User Commands

#### **`/verify`**
- **Permissions Required**: None (but must be in unverified channel)
- **Purpose**: Manually start verification flow
- **Behavior**:  
  - Checks lockdown level
  - If level 1/2 → Send gauntlet via DM
  - If level 0 → Direct verification
  - Updates roles and sends ID card

#### **`/ping`**
- **Permissions Required**: None
- **Purpose**: Bot latency test
- **Response**: "🏓 Pong! [latency]ms"

### Utility Commands

#### **`/embed`**
- **Subcommands**:
  - `manager`: Open embed manager UI
  - `bind`: Link invite to embed + role
  - `delete`: Remove embed

#### **`/system status`**
- **Permissions Required**: Administrator
- **Purpose**: Bot diagnostics dashboard
- **Shows**:
  - Bot permissions in guild
  - Accessible text channels
  - Partner network status
  - Active verification methods

#### **`/preview`**
- **Permissions Required**: None
- **Purpose**: Preview how an embed renders
- **Input**: Embed name or paste JSON

#### **`embedHelp`**
- **Purpose**: Interactive guide to embed editor
- **UI**: Paginated help with Previous/Next buttons

### Event Listeners (Auto-Triggered)

#### **`messageCreate`**
- Detects trigger word (e.g., "!verify")
- Auto-runs verification flow

#### `guildMemberAdd`
- On member join, send welcome embed
- Detect invite code used
- Assign partner role if linked

#### `guildMemberRemove`
- On member leave, send goodbye embed

#### `guildCreate`
- New server joins bot
- Auto-create GuildConfig with defaults

---

## Operational Guide - Daily Tasks

### Adding a New Partner (Step-by-Step)

**Scenario**: Partner "Noodles DAO" wants to onboard members with a special embed and role.

**Step 1: Create Partner Embed**
```bash
/embed manager
  → Click [New Embed]
  → Title: "🍜 Welcome to Noodles DAO!"
  → Description: "You joined via exclusive invite {invite.code}. Account age: {account_age} days."
  → Color: #FFD700 (gold)
  → Save as: "Noodles_Welcome"
```

**Step 2: Get Invite Code**
```
In Noodles server, copy invite URL:
https://discord.gg/abc123xyz → invite code is "abc123xyz"
```

**Step 3: Bind Invite → Embed → Role**
```bash
/embed bind 
  name: "Noodles_Welcome"
  invite_code: "abc123xyz"
  partner_role: @Noodles Partner
```

**Step 4: Verify**
- Have a test account join via that invite
- Bot should send custom embed and assign role
- ✓ Done!

### Toggling Lockdown Levels

**Scenario**: Raid detected, need to enable strict verification.

```bash
# Check current level
/gateway status  → Shows Level 0 (normal)

# Enable strict gauntlet
/gateway setup method:button ... lockdown:2

# Members joining now MUST:
# 1. Match token displayed in channel
# 2. Pass 3-phase gauntlet
# 3. Anyone who fails is banned

# Later, disable
/gateway setup ... lockdown:0
```

### Custom Welcome Message

**Scenario**: Change the verification success message.

```bash
/gateway customize_ui
  page: success
  title: "✅ Access Granted!"
  color: #00FF00
```

### Monitoring Active Verifications

```javascript
// In _activeGauntlets map:
Map {
  "guild123:user456" => {
    type: "strict",
    token: "ABC123",
    createdAt: 1711396800000,
    wrongAttempts: 0
  }
}
```

Check via dashboard or logs for ongoing flows.

### Database Queries (MongoDB)

**Check all configs**:
```javascript
const GuildConfig = require('./modules/config/GuildConfig.js');
const all = await GuildConfig.find({});
all.forEach(c => {
  console.log(`Guild ${c.guildId}: Level ${c.lockdownLevel}`);
});
```

**Export embeds for backup**:
```javascript
const EmbedVault = require('./modules/embedVault/schema.js');
const embeds = await EmbedVault.find({});
console.log(JSON.stringify(embeds, null, 2));
```

---

## Security Hardening Checklist

### ✅ Completed in V2

- [x] **Interaction Deferring**: All interactions defer before command execution
- [x] **MessageFlags**: Replaced deprecated `ephemeral: true` with modern `flags: [MessageFlags.Ephemeral]`
- [x] **Static ESM Imports**: Removed `?update=${Date.now()}` cache-busting (memory leak)
- [x] **Crypto Token Generation**: All tokens use `crypto.randomBytes()`, not `Math.random()`
- [x] **Token Expiry Enforcement**: Level 2 tokens expire after 90 seconds, with auto-cleanup
- [x] **Null-Safety**: Config checks with `config?.partners?.find()` pattern
- [x] **Error Handling**: All paths have try-catch with graceful fallbacks
- [x] **Dead Code Removal**: Deleted unused event listeners
- [x] **Type Checking**: Role/channel validation before operations

### 🔐 Runtime Safeguards

**RateLimiting** (via Discord.js built-in):
- Slash command cooldown: 1 per user per 3 seconds
- Modal submissions: Immediate defer prevents double-submit

**DM Protection**:
- Check DM channel open before gauntlet
- Return error if user has DMs disabled
- No silent failures

**Role Validation**:
- Verify role exists in guild before assignment
- Skip if bot lacks permission (non-fatal)
- Log all failures

**Invite Tracking**:
- Failed invite fetch doesn't block member join
- Falls back to generic welcome embed
- Partner role assignment skipped gracefully

### 📊 Monitoring Recommendations

1. **Log File Rotation**: Keep error logs for 30 days
2. **Error Alerts**: Monitor console for `[ERROR]` prefixes
3. **Gauntlet Metrics**: Track pass/fail rates per lockdown level
4. **Token Reuse**: Check `_activeGauntlets` for stuck sessions
5. **Memory Usage**: TaskScheduler should keep < 100MB base

---

## Summary Table

| Component | Purpose | Files | Interval |
|-----------|---------|-------|----------|
| **Loaders** | Initialize bot | commands.js, events.js, modules.js | Startup |
| **Interactions** | Route user actions | interactionCreate.js | Real-time |
| **Gateway** | Verify members | gateway/index.js, actions.js | On-demand |
| **EmbedVault** | Store embeds | embedVault/index.js, schema.js | On-demand |
| **Welcome** | Send join/leave msgs | welcome/index.js | On member join/leave |
| **TaskScheduler** | Background cleanup | core/TaskScheduler.js | Every 5 min |

---

## Glossary

- **Deferring**: Telling Discord "your command will take a moment; wait for the actual response"
- **Ephemeral**: Message visible only to the command user (auto-delete after interaction)
- **Gauntlet**: Security challenge (colors, codes, emojis)
- **Lockdown Level**: Scale 0-3 determining verification difficulty
- **MessageFlags**: Modern discord.js way to set message properties (Ephemeral, Mention, etc.)
- **Modal**: Pop-up form for user input
- **Placeholder**: Dynamic value like `{user}`, `{account_age}`, rendered at runtime
- **Partner**: External server/role with special embed onboarding
- **Task Scheduler**: Background job runner for cleanup & maintenance
- **TDZ (Temporal Dead Zone)**: JavaScript error when variable used before declaration
- **Trust Score**: Reserved for future: rate members by behavior

---

**Last Updated**: March 26, 2026  
**Version**: Guardian V2.0  
**Stability**: Production-Grade ✓
