import { handleInteraction } from '../core/InteractionDispatcher.js';
import { verificationSessions } from '../core/ThreadSessionManager.js';
import { ThreadVerificationSystem } from '../core/ThreadVerificationSystem.js';

export default {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      // معالجة Thread Verification Buttons
      if (interaction.isButton?.() && interaction.customId === 'verify_thread_start') {
        if (!interaction.guild) {
          return await interaction.reply({
            content: '❌ هذا الأمر يعمل فقط في السيرفرات.',
            ephemeral: true,
          });
        }

        const threadId = interaction.channelId;
        const session = verificationSessions.getSessionByThread(threadId);

        if (!session) {
          return await interaction.reply({
            content: '❌ لا توجد جلسة تحقق نشطة.',
            ephemeral: true,
          });
        }

        if (session.userId !== interaction.user.id) {
          return await interaction.reply({
            content: '❌ هذه الجلسة خاصة بمستخدم آخر.',
            ephemeral: true,
          });
        }

        let member = interaction.member;
        if (!member) {
          member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        }

        if (!member) {
          await interaction.reply({
            content: '❌ لم يتمكن النظام من العثور على بيانات العضو.',
            ephemeral: true,
          });
          return ThreadVerificationSystem.handleVerificationFailure(
            interaction.user.id,
            threadId,
            interaction.guild
          );
        }

        await interaction.deferReply();

        session.updateInteractionTime();
        session.incrementAttempts();

        try {
          const gateway = interaction.client?.gateway;
          if (!gateway?.startVerificationForUser) {
            throw new Error('Gateway verification not available');
          }

          await gateway.startVerificationForUser(interaction.user, interaction.guild);

          await interaction.editReply({
            content: '✅ تم بدء عملية التحقق. اتبع التعليمات.',
          });
        } catch (error) {
          console.error('[interactionCreate] Verification start failed:', error);
          await interaction.editReply({
            content: '❌ حدث خطأ في بدء التحقق.',
          });
          await ThreadVerificationSystem.handleVerificationFailure(
            interaction.user.id,
            threadId,
            interaction.guild
          );
        }

        return;
      }

      // معالجة Modal submissions
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
