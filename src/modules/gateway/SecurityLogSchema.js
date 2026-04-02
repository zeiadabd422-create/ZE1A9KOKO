import mongoose from 'mongoose';

const SecurityLogSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    eventType: { type: String, required: true, enum: [
      'validation_failure',
      'step_success',
      'step_failure',
      'honeypot_triggered',
      'blacklist_user',
      'user_timeout',
      'user_kick',
      'verification_success',
      'verification_failed',
      'interaction_spam',
      'behavior_anomaly',
    ], index: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'extreme'], default: 'low' },
    reason: { type: String, default: '' },
    metadata: { type: Object, default: {} },
    timestamp: { type: Date, default: Date.now, index: true, expires: 2592000 }, // 30 days TTL
  },
  { timestamps: false }
);

SecurityLogSchema.index({ guildId: 1, userId: 1, timestamp: -1 });

export default mongoose.model('GatewaySecurityLog', SecurityLogSchema);
