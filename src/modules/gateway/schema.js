import mongoose from 'mongoose';

const GatewaySchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    method: {
      type: String,
      enum: ['button', 'trigger', 'slash', 'join'],
      default: 'button',
      description: 'Verification method: button, trigger, slash, or join',
    },
    channel: {
      type: String,
      required: true,
      description: 'Channel where verification method is active',
    },
    verifiedRole: {
      type: String,
      required: true,
      description: 'Role ID to add when user is verified',
    },
    unverifiedRole: {
      type: String,
      required: true,
      description: 'Role ID to remove when user is verified (penalty role)',
    },
    triggerWord: {
      type: String,
      default: '',
      description: 'Word/phrase that triggers verification (for trigger method)',
    },
    successDM: {
      type: String,
      default: 'You have been verified! Welcome to the server.',
      description: 'Private message sent to user upon successful verification',
    },
    alreadyVerifiedMsg: {
      type: String,
      default: 'You are already verified in this server!',
      description: 'Message sent when user is already verified',
    },
    embedTitle: {
      type: String,
      default: '🔐 Server Verification',
      description: 'Title for the verification embed sent to channel',
    },
    embedDescription: {
      type: String,
      default: 'Click the button below to verify your account and gain access to the server.',
      description: 'Description for the verification embed',
    },
    embedColor: {
      type: String,
      default: '#2ecc71',
      description: 'Hex color code for verification embeds (default: green)',
    },
    embedImage: {
      type: String,
      default: '',
      description: 'URL for banner/thumbnail image in verification embeds',
    },
    // Theme: main bot theme used as fallback for specific pages
    theme: {
      title: {
        type: String,
        default: '🔐 Server Verification',
      },
      description: {
        type: String,
        default: 'Click the button below to verify your account and gain access to the server.',
      },
      color: {
        type: String,
        default: '#2ecc71',
      },
      image: {
        type: String,
        default: '',
      },
    },

    // Page-specific UI overrides
    successUI: {
      title: { type: String, default: '' },
      desc: { type: String, default: '' },
      color: { type: String, default: '' },
      image: { type: String, default: '' },
    },
    alreadyVerifiedUI: {
      title: { type: String, default: '' },
      desc: { type: String, default: '' },
      color: { type: String, default: '' },
      image: { type: String, default: '' },
    },
    errorUI: {
      title: { type: String, default: '' },
      desc: { type: String, default: '' },
      color: { type: String, default: '' },
      image: { type: String, default: '' },
    },

    enabled: {
      type: Boolean,
      default: true,
      description: 'Whether gateway is enabled for this guild',
    },

    raidMode: {
      type: Boolean,
      default: false,
      description: 'Enable account age validation (raid shield)',
    },
    minAccountAge: {
      type: Number,
      default: 7,
      description: 'Minimum account age in days for raid shield',
    },
  },
  { timestamps: true }
);

export default mongoose.model('GatewayConfig', GatewaySchema);
