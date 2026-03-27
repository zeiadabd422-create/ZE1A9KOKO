import mongoose from 'mongoose';
import crypto from 'crypto';

const memberSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  guildId: { type: String, required: true, index: true },
  lastSeen: { type: Date, default: Date.now },
  isVerified: { type: Boolean, default: false },
  changeHash: { type: String, required: true },
  status: { type: String, enum: ['active', 'left'], default: 'active' },
  leftAt: { type: Date },
  inviteCode: { type: String, default: null },
}, {
  timestamps: true,
});

// Compound index for O(1) queries by user+guild
memberSchema.index({ userId: 1, guildId: 1 }, { unique: true });

memberSchema.statics.computeChangeHash = function (user) {
  if (!user) return null;
  const data = `${user.username || ''}#${user.discriminator || ''}:${user.displayAvatarURL?.({ extension: 'png', size: 256, forceStatic: false }) || ''}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

export default mongoose.models.Member || mongoose.model('Member', memberSchema);
