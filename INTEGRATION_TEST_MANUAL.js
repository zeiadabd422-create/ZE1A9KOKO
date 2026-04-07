#!/usr/bin/env node

/**
 * REAL INTEGRATION TEST MANUAL
 * 
 * This document outlines how to manually test the Gateway system
 * with the instrumentation system in place.
 * 
 * All interactions will be logged with full session context.
 */

const testGuide = `
╔════════════════════════════════════════════════════════════════════════════════╗
║                   GATEWAY INSTRUMENTATION TEST MANUAL                          ║
║                      Real Discord Server Testing                               ║
╚════════════════════════════════════════════════════════════════════════════════╝

⚠️  PREREQUISITES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Bot must be running: npm start
2. Bot connected to Discord server
3. Bot has these permissions:
   - View Channels
   - Manage Channels
   - Send Messages
   - Read Message History
4. Access to server logs/console

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEST 1: Real Discord Button Interaction
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEPS:
  1. In Discord, initiate verification (click button or type command)
  2. Bot creates verification channel
  3. Click the verification button in the channel
  4. Check terminal for logs

EXPECTED LOGS:
  ✓ [SESSION:yourId-timestamp] [SESSION] Session created
  ✓ [INTERACTION] Interaction received
  ✓ [PARSED] CustomId parsed: type=button, userId=..., step=start, action=accept
  ✓ [STEP] Step: start → accept
  ✓ [SUCCESS] Button handled: action=accept, success=true
  ✓ If advancing: [QUEUE:START] User started session (1/20 active)

FAILURE SIGNS:
  ✗ [ERROR] in logs = something went wrong
  ✗ No [SESSION] logs = interaction not reaching gateway
  ✗ [PARSE] failure = customId format incorrect
  ✗ [DUPLICATE] = Button clicked twice too fast

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEST 2: Spam Click Attack (Cooldown Protection)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEPS:
  1. Start a verification session
  2. RAPIDLY click the same button 10 times
  3. Check terminal for cooldown logs

EXPECTED LOGS:
  ✓ First click: [STEP] step executed
  ✓ 2nd-10th clicks: [ABUSE:COOLDOWN] User blocked by cooldown | remainingMs=...
  ✓ Each subsequent click shows decreasing remainingMs
  ✓ Only ONE button action actually executes
  ✓ [DUPLICATE] logs for blocked interactions

COOLDOWN BEHAVIOR:
  - Cooldown: 1500ms (1.5 seconds)
  - Logs show exact remaining milliseconds
  - User receives no visual feedback (cooldown is silent server-side)

FAILURE SIGNS:
  ✗ Multiple [STEP] logs = cooldown not working
  ✗ No [ABUSE:COOLDOWN] logs = protection disabled
  ✗ Different users can be cooldown'd = global cooldown (bad)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEST 3: Multi-User Concurrent Sessions (Queue Management)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEPS:
  1. Have 5-10 users start verification simultaneously
     (Ask friends or open multiple Discord accounts)
  2. Everyone clicks their buttons at the same time
  3. Watch terminal for queue operations

EXPECTED LOGS:
  ✓ First users: [QUEUE:START] User started session (1/20 active)
  ✓ Additional users: [QUEUE:ENQUEUE] User queued at position 2, 3, 4...
  ✓ As each user finishes: [QUEUE:FINISH] User session finished
  ✓ [QUEUE:NOTIFY] Next queued user is notified
  ✓ [QUEUE:STATE] Active sessions: 2/20, waiting: 8

QUEUE POSITION UPDATES:
  User 1: [QUEUE:START] - immediately active (1/20)
  User 2: [QUEUE:ENQUEUE] position=2 - queued
  User 3: [QUEUE:ENQUEUE] position=3 - queued
  ...
  When User 1 completes:
    User 2: [QUEUE:NOTIFY] - notified
    User 2: [QUEUE:START] - moves to active
    User 3: position updates (if visible)

FAILURE SIGNS:
  ✗ Users exceed maxConcurrent (20) = queue not limiting
  ✗ No [QUEUE:NOTIFY] = queue not advancing
  ✗ [ENQUEUE] for >1 user simultaneously = race condition
  ✗ Position numbers wrong = incorrect queue math

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEST 4: Channel Deletion Mid-Session
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEPS:
  1. Start verification (bot creates a channel)
  2. Immediately delete the channel in Discord
  3. Try to click the button (it's gone now)
  4. Check terminal for error handling

EXPECTED LOGS:
  ✓ [SESSION:userId-timestamp] Session created
  ✓ [QUEUE:START] Session started
  ✓ Channel is deleted in Discord
  ✓ When user tries action: [ERROR] Channel not found / deleted
  ✓ [SESSION:CLEANUP] Cleanup handler runs
  ✓ [SESSION:END] Session ended gracefully
  ✓ NO CRASH in bot logs

ERROR RECOVERY:
  - Error is caught and logged
  - Session is cleaned up
  - Bot continues running
  - User receives error message

FAILURE SIGNS:
  ✗ Bot crashes = no error boundary
  ✗ No [ERROR] logs = exception not caught
  ✗ Session left hanging = cleanup not called
  ✗ Bot offline = unhandled rejection

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEST 5: Session Timeout (5 minutes)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEPS (REAL TEST - 5 minutes):
  1. Start verification
  2. Wait 5 minutes without clicking anything
  3. Check terminal

STEPS (FAST TEST - use DEBUG mode):
  1. Edit GatewayEngine.js: change 5 * 60 * 1000 to 5 * 1000 (5 seconds)
  2. Restart bot
  3. Start verification
  4. Wait 5 seconds
  5. Check terminal

EXPECTED LOGS (after timeout):
  ✓ [SESSION:userId-timestamp] [SESSION:EXPIRE] Session expired
  ✓ [SESSION:CLEANUP] Starting session cleanup
  ✓ [QUEUE:FINISH] User session finished
  ✓ [SESSION:CLEANUP] Channel deleted
  ✓ [SESSION:END] Session ended

VERIFICATION:
  - After timeout, if you try to click button: [ERROR] Session not found
  - Queue continues normally
  - No resources leaked

FAILURE SIGNS:
  ✗ No [SESSION:EXPIRE] logs = timeout not firing
  ✗ Channel not deleted = cleanup not running
  ✗ Queue blocked = session not ending cleanly
  ✗ Memory leak if many sessions timeout

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEST 6: Permission Failure (Missing Manage Channels)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEPS:
  1. Remove "Manage Channels" permission from bot role
  2. Try to start verification
  3. Check terminal and Discord for error handling

EXPECTED LOGS:
  ✓ [SESSION:userId-timestamp] Session created
  ✓ [QUEUE:START] Session started
  ✓ When creating channel: [ERROR] Missing Permissions: Manage Channels
  ✓ Error includes: code=50013 (Discord permission code)
  ✓ [SESSION:END] Session ended
  ✓ User receives error message in Discord

DISCORD BEHAVIOR:
  - User sees error in Discord: "Bot missing permissions"
  - Bot continues running (no crash)
  - Next verification can be attempted with permissions restored

FAILURE SIGNS:
  ✗ Bot crashes = unhandled error
  ✗ No [ERROR] logs = error swallowed silently
  ✗ User sees no feedback in Discord
  ✗ Permission is retried indefinitely

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 LOG MONITORING GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WATCH FOR THESE PATTERNS:

Success Pattern:
  [SESSION:xxx] [SESSION] Session created
  [INTERACTION] Interaction received
  [PARSED] CustomId parsed
  [STEP] Step execution
  [SUCCESS] Handled successfully

Error Pattern:
  [ERROR] Error message
  Stack trace shown
  Context provided
  Clean recovery expected

Queue Pattern:
  [QUEUE:ENQUEUE] User added
  [QUEUE:NOTIFY] User notified
  [QUEUE:START] User started session
  [QUEUE:STATE] Current status

Cooldown Pattern:
  [ABUSE:COOLDOWN] User blocked
  Remaining milliseconds shown
  Multiple rapid clicks = multiple cooldown logs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 DEBUGGING TIPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Enable verbose logging:
  Edit .env: DEBUG_GATEWAY=true
  Restart bot: npm start
  Now you'll see [DEBUG] logs for routing

Search console for specific session:
  Logs include session ID, search for:
  [SESSION:USER_ID_HERE]

Filter by log type:
  Error only: grep "[ERROR]" (or search in console)
  Queue only: grep "[QUEUE]"
  Session only: grep "[SESSION]"

Watch queue health:
  [QUEUE:STATE] shows current active sessions
  Compare with maxConcurrent limit
  No spam = healthy queue

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 QUICK CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After each test, verify:

□ [SESSION] logs appear with unique ID
□ [INTERACTION] shows correct button/modal type
□ [PARSED] shows correct customId breakdown
□ [STEP] shows correct step and action
□ [ERROR] logs include full context
□ [QUEUE] logs show correct positions
□ [ABUSE:COOLDOWN] blocks rapid clicks
□ No unexpected [ERROR] logs
□ Bot remains online (no crashes)
□ Logs are timestamped correctly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ If all tests pass and logs look good, the system is production-ready!

Any anomalies in logs = bugs found = fix needed

`;

console.log(testGuide);
