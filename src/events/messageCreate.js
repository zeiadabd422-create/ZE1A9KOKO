export default {
  name: 'messageCreate',
  async execute(message) {
    try {
      if (message.author?.bot) return;
      const { client } = message;
      // Allow modules to handle messages if they expose handlers
      if (client && client.gateway && typeof client.gateway.handleMessage === 'function') {
        try {
          await client.gateway.handleMessage(message);
        } catch (err) {
          console.error('gateway.handleMessage error:', err);
        }
      }
    } catch (err) {
      console.error('messageCreate handler failed:', err);
    }
  },
};
