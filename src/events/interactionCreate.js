import { handleInteraction } from '../core/InteractionDispatcher.js';

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      // معالجة Modal submissions أولاً
      if (interaction.isModalSubmit?.()) {
        const gateway = interaction.client?.gateway;
        if (gateway?.handleModalSubmit) {
          try {
            const handled = await gateway.handleModalSubmit(interaction);
            if (handled) return;
          } catch (error) {
            console.error('[interactionCreate] Gateway modal handler failed:', error);
          }
        }
        // يمكن إضافة معالجات أخرى للـ modals هنا
      } else {
        // معالجة التفاعلات الأخرى
        await handleInteraction(interaction);
      }
    } catch (error) {
      console.error('[interactionCreate] Failed to handle interaction:', error);

      try {
        if (interaction.isRepliable?.() && !interaction.replied) {
          if (interaction.deferred) {
            await interaction.editReply({
              content: 'حدث خطأ أثناء معالجة تفاعلك.',
            });
          } else {
            await interaction.reply({
              content: 'حدث خطأ أثناء معالجة تفاعلك.',
              ephemeral: true,
            });
          }
        }
      } catch (replyError) {
        console.error('[interactionCreate] Failed to send error reply:', replyError);
      }
    }
  },
};
