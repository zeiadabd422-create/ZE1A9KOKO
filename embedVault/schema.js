import mongoose from 'mongoose';

const EmbedVaultSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    data: {
      type: Object,
      required: true,
      default: {},
      description: 'Full embed object (title, description, color, image, etc.)',
    },
    type: {
      type: String,
      required: true,
      enum: ['Welcome', 'Goodbye', 'Partner', 'Manual'],
      default: 'Manual',
    },
    linkedInviteCode: {
      type: String,
      default: '',
      description: 'Optional invite code that triggers this embed when used by a joiner',
    },
    authorName: {
      type: String,
      default: '',
      trim: true,
      description: 'Embed author name with placeholder support',
    },
    authorIcon: {
      type: String,
      default: '',
      description: 'Embed author icon URL with placeholder support',
    },
    footerText: {
      type: String,
      default: '',
      trim: true,
      description: 'Embed footer text with placeholder support',
    },
    footerIcon: {
      type: String,
      default: '',
      description: 'Embed footer icon URL with placeholder support',
    },
    includeTimestamp: {
      type: Boolean,
      default: false,
      description: 'Whether to include a timestamp in the embed',
    },
  },
  { timestamps: true }
);

EmbedVaultSchema.index({ guildId: 1, name: 1 }, { unique: true });

export default mongoose.model('EmbedVault', EmbedVaultSchema);
