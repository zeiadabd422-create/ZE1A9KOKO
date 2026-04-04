import { GatewayController } from './GatewayController.js';
import { ChannelManager } from '../../core/ChannelManager.js';
import { RoleManager } from '../../core/RoleManager.js';
import { DMHandler } from '../../core/DMHandler.js';
import { keywordEngine } from '../../core/KeywordEngine.js';
import { GatewayEngine } from '../../core/GatewayEngine.js';

const GATEWAY_CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Gateway Module Loader
 * Integrates the complete verification gateway system into the bot
 * Initializes all managers: ChannelManager, RoleManager, DMHandler
 */
export default async function initializeGateway(client) {
  // Initialize managers
  const channelManager = new ChannelManager(client);
  const roleManager = new RoleManager(client);
  const gatewayEngine = new GatewayEngine(client, channelManager, roleManager);
  const dmHandler = new DMHandler(keywordEngine, gatewayEngine);

  // Create controller with all managers
  const controller = new GatewayController(client, channelManager, roleManager, dmHandler);

  // Attach to client for easy access
  client.gateway = controller;
  client.channelManager = channelManager;
  client.roleManager = roleManager;
  client.dmHandler = dmHandler;
  client.keywordEngine = keywordEngine;

  // Setup cleanup job for sessions
  setInterval(() => {
    try {
      const cleaned = controller.engine.cleanupSessions();
      if (cleaned > 0) {
        console.log(`[Gateway] Cleaned up ${cleaned} expired sessions`);
      }
    } catch (error) {
      console.error('[Gateway] Session cleanup error:', error);
    }
  }, GATEWAY_CLEANUP_INTERVAL_MS);

  // Setup cleanup job for channels
  setInterval(async () => {
    try {
      const cleaned = await channelManager.cleanupExpiredChannels();
      if (cleaned > 0) {
        console.log(`[Gateway] Cleaned up ${cleaned} expired verification channels`);
      }
    } catch (error) {
      console.error('[Gateway] Channel cleanup error:', error);
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  // Setup cleanup job for temporary roles
  setInterval(async () => {
    try {
      const cleaned = await roleManager.cleanupExpiredRoles();
      if (cleaned > 0) {
        console.log(`[Gateway] Cleaned up ${cleaned} expired temporary roles`);
      }
    } catch (error) {
      console.error('[Gateway] Role cleanup error:', error);
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  console.log('[Gateway] Module initialized successfully');
  console.log(`[Gateway] Keywords: ${keywordEngine.formatKeywordsForDisplay()}`);
  console.log('[Gateway] Max concurrent verifications: configured by QueueManager');
  console.log('[Gateway] Max concurrent channels: configured by ChannelManager');

  return controller;
}
