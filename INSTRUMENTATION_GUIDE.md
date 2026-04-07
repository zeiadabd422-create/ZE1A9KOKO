/**
 * INTEGRATION TEST GUIDE - Real Discord Testing
 * 
 * This guide explains how to test the Gateway system with real Discord interactions.
 * All logging will be captured with comprehensive session tracing.
 */

console.log(`
╔════════════════════════════════════════════════════════════════════════════════╗
║                  GATEWAY INSTRUMENTATION SYSTEM - READY                        ║
║                          Real Discord Testing Guide                            ║
╚════════════════════════════════════════════════════════════════════════════════╝

📋 LOGGING FEATURES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Session Tracing:
   Every interaction is tagged with a unique session ID
   Format: [SESSION:user123-1712345678] Log Message
   
✅ Interaction Flow:
   [INTERACTION] Button/Modal received with customId
   [PARSED] CustomId breakdown: type, userId, step, action
   [STEP] Step execution with current state
   
✅ Cooldown Protection:
   [ABUSE:COOLDOWN] User blocked if clicking too fast
   Shows remaining cooldown time in milliseconds
   
✅ Queue Management:
   [QUEUE:ENQUEUE] User added to queue with position
   [QUEUE:START] User moved from queue to active session
   [QUEUE:NOTIFY] Next user in queue is notified
   [QUEUE:STATE] Current queue status (2/20 active)

✅ Error Boundary:
   [ERROR] Any exception caught with full context
   Stack trace and surrounding context logged
   System continues without crashing

✅ Debug Mode:
   Set DEBUG_GATEWAY=true in .env for detailed logs
   Shows internal routing and state changes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 TEST SCENARIOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEST 1: Real Discord Interaction
   1. Run the bot: npm start
   2. Join your Discord server
   3. Initiate verification (e.g., type /verify or click a verification button)
   4. Check console for these logs:
      
      [SESSION:user123-TIME] Session created
      [INTERACTION] Button/Modal received
      [PARSED] customId breakdown
      [STEP] step=start action=accept
      [SUCCESS] Step completed

TEST 2: Spam Click Attack (Cooldown Test)
   1. Start a verification session
   2. Click the same button 10 times rapidly
   3. Expected logs:
      
      [FIRST CLICK] Log: normal flow
      [SUBSEQUENT CLICKS] Log: 
         [ABUSE:COOLDOWN] user123 blocked (cooldown 1450ms)
         [ABUSE:COOLDOWN] user123 blocked (cooldown 1340ms)
         etc.
      
      Only the first click processes, rest are blocked.

TEST 3: Multi-User Concurrent Sessions
   1. Have 5-10 users join and start verification simultaneously
   2. Watch for these logs:
      
      [QUEUE:ENQUEUE] user1 position=1
      [QUEUE:ENQUEUE] user2 position=2
      [QUEUE:START] user1 (1/20 active)
      [QUEUE:START] user2 (2/20 active)
      [QUEUE:STATE] Active sessions: 5/20

TEST 4: Channel Deleted Mid-Session
   1. Start verification (this creates a channel)
   2. Manually delete the channel in Discord
   3. Attempt to click a verification button
   4. Expected logs:
      
      [ERROR] Error message shows channel not found
      Session continues gracefully
      No crash occurs

TEST 5: Bot Restart During Session
   1. Start verification
   2. Kill the bot (Ctrl+C)
   3. Restart the bot
   4. Expected logs on restart:
      
      Previous sessions are cleanup on startup
      New interactions create fresh sessions
      No orphaned session data

TEST 6: Permission Failure (Bot lacks Manage Channels)
   1. Remove "Manage Channels" permission from the bot
   2. Try to start verification
   3. Expected logs:
      
      [ERROR] Missing permissions: Manage Channels
      [SESSION:userX] Channel creation failed
      Error message sent to user
      No crash, graceful fallback

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 LOG OUTPUT EXAMPLES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Normal Flow Example:
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2024-04-05T10:30:45.123Z [SESSION:user123-1712345445123] [SESSION] Session  │
│ created | userId=user123, guildId=guild456, timestamp=1712345445123         │
│                                                                              │
│ 2024-04-05T10:30:46.234Z [INTERACTION] Interaction received | interaction   │
│ Id=inter789, type=button, customId=gateway:button:user123:start:accept,     │
│ userId=user123, timestamp=1712345446234                                     │
│                                                                              │
│ 2024-04-05T10:30:46.345Z [PARSED] CustomId parsed | type=button,           │
│ userId=user123, step=start, action=accept                                   │
│                                                                              │
│ 2024-04-05T10:30:46.456Z [SESSION:user123-1712345445123] [STEP] Step:       │
│ start → accept | step=start, action=accept, state=active                    │
│                                                                              │
│ 2024-04-05T10:30:46.567Z [SESSION:user123-1712345445123] [SUCCESS] Button   │
│ handled | action=accept, success=true                                       │
└─────────────────────────────────────────────────────────────────────────────┘

Cooldown Example:
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2024-04-05T10:30:47.100Z [ABUSE:COOLDOWN] User blocked by cooldown |        │
│ userId=user123, remainingMs=1450, timestamp=1712345447100                   │
│                                                                              │
│ 2024-04-05T10:30:47.101Z [ABUSE:COOLDOWN] User blocked by cooldown |        │
│ userId=user123, remainingMs=1449, timestamp=1712345447101                   │
└─────────────────────────────────────────────────────────────────────────────┘

Queue Example:
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2024-04-05T10:30:48.000Z [QUEUE:ENQUEUE] User queued at position 2 |        │
│ userId=user456, position=2, timestamp=1712345448000                         │
│                                                                              │
│ 2024-04-05T10:30:50.000Z [QUEUE:START] User started session (2/20 active) │
│ userId=user456, activeSessions=2, timestamp=1712345450000                   │
└─────────────────────────────────────────────────────────────────────────────┘

Error Example:
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2024-04-05T10:30:51.000Z [ERROR] Error: Missing permissions | message=      │
│ Missing permissions, stack=at ChannelManager.createChannel, code=MISSING_   │
│ PERMISSIONS, context=channel_delete, userId=user789                         │
└─────────────────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 QUICK START:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Enable Debug Mode (Optional):
   
   Edit .env:
   DEBUG_GATEWAY=true
   
   This shows [DEBUG] messages for internal routing.

2. Start the Bot:
   
   npm start
   
   Watch console for [GATEWAY] logs.

3. Test Interaction:
   
   Initiate verification in Discord.
   All interactions will be logged with session context.

4. Monitor Logs:
   
   Search in console for:
   - [SESSION] for session lifecycle
   - [STEP] for step progression
   - [QUEUE] for queue activity
   - [ABUSE] for spam protection
   - [ERROR] for any issues

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 TIPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Session ID follows pattern: userId-timestamp
  This ensures uniqueness and helps track in logs.

• Always watch for ERROR logs - any exception is logged before propagating.

• Queue position is recalculated after each user completes.

• Cooldown timer is individual per user (not global).

• Duplicate interactions are detected and blocked immediately.

• All errors include context (userId, step, action) for debugging.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ Ready for real-world testing. Any bug will be visible immediately in logs!

`);
