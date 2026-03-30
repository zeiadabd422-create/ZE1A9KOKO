import mongoose from 'mongoose';

const GatewaySchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: true },
    verifiedRole: { type: String, default: '' },
    unverifiedRole: { type: String, default: '' },
    antiRaid: {
      enabled: { type: Boolean, default: true },
      maxJoinBurst: { type: Number, default: 4 },
      joinWindowSeconds: { type: Number, default: 60 },
      spamWindowSeconds: { type: Number, default: 15 },
      spamThreshold: { type: Number, default: 5 },
      logChannel: { type: String, default: '' },
    },
    verification: {
      easy: {
        enabled: { type: Boolean, default: true },
        timeoutSeconds: { type: Number, default: 240 },
        retries: { type: Number, default: 3 },
      },
      normal: {
        enabled: { type: Boolean, default: true },
        timeoutSeconds: { type: Number, default: 120 },
        retries: { type: Number, default: 2 },
      },
      hard: {
        enabled: { type: Boolean, default: true },
        timeoutSeconds: { type: Number, default: 90 },
        retries: { type: Number, default: 1 },
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model('GatewayConfig', GatewaySchema);
