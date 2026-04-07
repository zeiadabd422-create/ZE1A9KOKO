import { sessionManager } from './src/core/SessionManager.js';
import { queueManager } from './src/core/QueueManager.js';
import { AntiAbuseService } from './src/services/AntiAbuseService.js';
import { GatewayController } from './src/modules/gateway/GatewayController.js';
import { GatewayEngine } from './src/core/GatewayEngine.js';

// Mock client
const mockClient = {
  container: {
    gatewayController: null
  }
};

// Create instances
const gatewayEngine = new GatewayEngine(mockClient);
const gatewayController = new GatewayController(mockClient, null, null, gatewayEngine, null);

mockClient.container.gatewayController = gatewayController;

// Set onSessionExpired for test (since test uses separate, but GatewayEngine sets it)
sessionManager.onSessionExpired = async (userId, guildId) => {
  console.log('[GatewayTest] Session expired for user ' + userId);
  await queueManager.finishSession(userId);
  console.log('[GatewayTest] Queue finished for user ' + userId);
  console.log('[GatewayTest] Guild session ended for guild ' + guildId);
  sessionManager.endSession(userId);
  console.log('[GatewayTest] Session ended for user ' + userId);
};

// Set queue maxConcurrent to 1 for test
queueManager.maxConcurrent = 1;

// Mock interaction base
const createMockInteraction = (type, customId, userId = 'user123') => ({
  customId,
  user: { id: userId },
  client: mockClient,
  isButton: () => type === 'button',
  isModalSubmit: () => type === 'modal',
  isChatInputCommand: () => false,
  isStringSelectMenu: () => false,
  isAutocomplete: () => false,
  fields: {
    fields: [
      { customId: 'response', value: 'test answer' }
    ]
  },
  reply: async (options) => console.log('[Mock] Reply:', options.content),
  deferUpdate: async () => console.log('[Mock] Defer update')
});

console.log('=== TEST 1: Interaction Flow ===');

// Create session for user123
sessionManager.createSession('user123', 'guild123');

// Button interaction
const buttonInteraction = createMockInteraction('button', 'gateway:button:user123:start:accept');
await gatewayController.handleInteraction(buttonInteraction);

// Modal interaction
const modalInteraction = createMockInteraction('modal', 'gateway:modal:user123:challenge:submit');
await gatewayController.handleInteraction(modalInteraction);

console.log('\n=== TEST 2: Invalid CustomId ===');
const invalidInteraction = createMockInteraction('button', 'gateway:broken');
await gatewayController.handleInteraction(invalidInteraction);

console.log('\n=== TEST 3: Session Duplicate ===');
const session1 = sessionManager.createSession('user456', 'guild123');
console.log('[GatewayTest] First session created:', !!session1);
const session2 = sessionManager.createSession('user456', 'guild123');
console.log('[GatewayTest] Second session created:', !!session2);

console.log('\n=== TEST 4: Timeout ===');
// Create session with short timeout for test
const testSession = sessionManager.createSession('user789', 'guild123');
if (testSession) {
  clearTimeout(testSession.timeout);
  testSession.timeout = setTimeout(() => {
    sessionManager.onSessionExpired?.('user789', 'guild123');
  }, 1000);
}

console.log('\n=== TEST 5: Queue ===');
// Start first session
queueManager.startSession('user1');
console.log('[GatewayTest] User1 started');

// Enqueue two more
queueManager.enqueue('user2');
queueManager.enqueue('user3');
console.log('[GatewayTest] User2 and User3 queued');

// Register callback for user2
queueManager.registerNotification('user2', async () => {
  console.log('[GatewayTest] User2 notified and starting');
  queueManager.startSession('user2');
});

// Finish user1, should notify user2
await queueManager.finishSession('user1');

console.log('\n=== TEST 6: Cooldown Abuse ===');
console.log('[GatewayTest] First call:', AntiAbuseService.isOnCooldown('user999'));
console.log('[GatewayTest] Second call (should trigger cooldown):', AntiAbuseService.isOnCooldown('user999'));

// Wait for cooldown to reset
setTimeout(() => {
  console.log('[GatewayTest] After cooldown:', AntiAbuseService.isOnCooldown('user999'));
}, 1600);

// Wait for all async operations
await new Promise(resolve => setTimeout(resolve, 3000));