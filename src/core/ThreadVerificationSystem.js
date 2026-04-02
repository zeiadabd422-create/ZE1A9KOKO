import { ChannelType, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, bold } from 'discord.js';
import { verificationSessions } from './ThreadSessionManager.js';
import GatewayConfig from '../modules/gateway/schema.js';

export class ThreadVerificationSystem {
  static async startVerificationFromDM(user, client) {
    if (!user.isDMChannel && !user.isDM) return null;

    const guilds = client.guilds.cache;
    if (guilds.size === 0) return null;

    const guild = guilds.first();
    const config = await GatewayConfig.findOne({ guildId: guild.id });

    if (!config?.verificationChannel) {
      return null;
    }

    const channel = guild.channels.cache.get(config.verificationChannel);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return null;
    }

    if (!channel.permissionsFor(guild.members.me).has(PermissionFlagsBits.CreatePublicThreads)) {
      return null;
    }

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return null;
    }

    const existingSession = verificationSessions.getSessionByUser(user.id);
    if (existingSession && !existingSession.isExpired()) {
      return { error: 'session_exists' };
    }

    try {
      const threadName = `verify-${user.username}`;

      const thread = await channel.threads.create({
        name: threadName,
        autoArchiveDuration: 60,
        type: ChannelType.PrivateThread,
        reason: `Verification thread for ${user.tag}`,
      });

      await thread.members.add(user.id);

      const session = verificationSessions.createSession(user.id, thread.id, guild.id);
      if (!session) {
        await thread.delete('Session creation failed');
        return { error: 'session_failed' };
      }

      const embed = new EmbedBuilder()
        .setTitle('🔒 جلسة التحقق الخاصة بك')
        .setDescription('اضغط على الزر أدناه لبدء عملية التحقق الأمان')
        .setColor(0x3498db)
        .addFields([
          { name: 'المستخدم', value: bold(user.tag), inline: true },
          { name: 'السيرفر', value: bold(guild.name), inline: true },
          { name: 'الوقت', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: false },
        ])
        .setFooter({ text: 'هذه الجلسة خاصة وآمنة' });

      const startBtn = new ButtonBuilder()
        .setCustomId('verify_thread_start')
        .setLabel('ابدأ التحقق')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✅');

      const row = new ActionRowBuilder().addComponents(startBtn);

      await thread.send({ embeds: [embed], components: [row] });

      await user
        .send({
          content: `✅ تم فتح جلسة التحقق لك في السيرفر ${bold(guild.name)}\n\nانتظر رسالة التأكيد والزر في رسالتك الخاصة.`,
        })
        .catch(() => {});

      return { thread, session };
    } catch (error) {
      console.error('[ThreadVerification] Thread creation failed:', error);
      return { error: 'thread_creation_failed' };
    }
  }

  static async handleVerificationSuccess(userId, threadId, guild) {
    const session = verificationSessions.getSessionByThread(threadId);
    if (!session) return false;

    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return false;

      const config = await GatewayConfig.findOne({ guildId: guild.id });
      if (!config) return false;

      if (config.unverifiedRole) {
        await member.roles.remove(config.unverifiedRole, 'Verification passed').catch(() => {});
      }

      if (config.verifiedRole) {
        await member.roles.add(config.verifiedRole, 'Verification passed').catch(() => {});
      }

      const thread = guild.channels.cache.get(threadId);
      if (thread) {
        const successEmbed = new EmbedBuilder()
          .setTitle('✅ تم التحقق بنجاح!')
          .setDescription('تم إضافتك إلى السيرفر بنجاح والآن لديك وصول كامل.')
          .setColor(0x2ecc71)
          .setFooter({ text: 'شكراً لك على التحقق' });

        await thread.send({ embeds: [successEmbed] }).catch(() => {});

        setTimeout(async () => {
          try {
            await thread.delete('Verification completed');
          } catch (err) {
            console.error('[ThreadVerification] Thread deletion failed:', err);
          }
        }, 3000);
      }

      verificationSessions.deleteSessionByUser(userId);
      return true;
    } catch (error) {
      console.error('[ThreadVerification] Success handler error:', error);
      return false;
    }
  }

  static async handleVerificationFailure(userId, threadId, guild) {
    const session = verificationSessions.getSessionByThread(threadId);
    if (!session) return false;

    try {
      const thread = guild.channels.cache.get(threadId);
      if (!thread) {
        verificationSessions.deleteSessionByUser(userId);
        return false;
      }

      if (session.canRetry()) {
        const retryEmbed = new EmbedBuilder()
          .setTitle('❌ فشلت المحاولة')
          .setDescription(
            `لم تجتز هذه المحاولة. لديك ${3 - session.attempts} محاولات متبقية.\n\nاضغط الزر أدناه للمحاولة مرة أخرى.`,
          )
          .setColor(0xe74c3c);

        const retryBtn = new ButtonBuilder()
          .setCustomId('verify_thread_start')
          .setLabel('حاول مرة أخرى')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔄');

        const row = new ActionRowBuilder().addComponents(retryBtn);
        await thread.send({ embeds: [retryEmbed], components: [row] }).catch(() => {});
      } else {
        const failEmbed = new EmbedBuilder()
          .setTitle('❌ انتهت محاولاتك')
          .setDescription('لقد استنفدت جميع محاولاتك. يرجى الانتظار قليلاً والمحاولة مرة أخرى.')
          .setColor(0xc0392b);

        await thread.send({ embeds: [failEmbed] }).catch(() => {});

        setTimeout(async () => {
          try {
            await thread.delete('Verification failed');
          } catch (err) {
            console.error('[ThreadVerification] Thread deletion failed:', err);
          }
        }, 5000);

        verificationSessions.deleteSessionByUser(userId);
      }

      return true;
    } catch (error) {
      console.error('[ThreadVerification] Failure handler error:', error);
      return false;
    }
  }

  static async closeExpiredSession(threadId) {
    const session = verificationSessions.getSessionByThread(threadId);
    if (!session) return;

    try {
      const guild = await global.client.guilds.fetch(session.guildId).catch(() => null);
      if (!guild) {
        verificationSessions.deleteSessionByThread(threadId);
        return;
      }

      const thread = guild.channels.cache.get(threadId);
      if (thread) {
        const timeoutEmbed = new EmbedBuilder()
          .setTitle('⏰ انتهت جلسة التحقق')
          .setDescription('انتهت مهلة الوقت للتحقق. يرجى الانتظار والمحاولة في وقت لاحق.')
          .setColor(0xf39c12);

        await thread.send({ embeds: [timeoutEmbed] }).catch(() => {});

        setTimeout(async () => {
          try {
            await thread.delete('Session timeout');
          } catch (err) {
            console.error('[ThreadVerification] Thread deletion failed:', err);
          }
        }, 3000);
      }

      verificationSessions.deleteSessionByThread(threadId);
    } catch (error) {
      console.error('[ThreadVerification] Session close error:', error);
    }
  }
}
