import mongoose from 'mongoose';

const GatewaySchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Core roles for all methods
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

    // Multi-method configuration - each method can be independently enabled
    methods: {
      button: {
        enabled: { type: Boolean, default: false },
        channel: { type: String, default: '' },
      },
      trigger: {
        enabled: { type: Boolean, default: false },
        channel: { type: String, default: '' },
        triggerWord: { type: String, default: '' },
      },
      slash: {
        enabled: { type: Boolean, default: false },
        channel: { type: String, default: '' },
      },
      // join method removed; onboarding handled by Welcome module
    },

    // Initial message customization per method (the prompt sent to channel)
    initialMessage: {
      button: {
        title: { type: String, default: '🔐 Server Verification' },
        desc: { type: String, default: 'Click the button below to verify your account.' },
        image: { type: String, default: '' },
      },
      trigger: {
        title: { type: String, default: '🔐 Server Verification' },
        desc: { type: String, default: 'Send the trigger word to verify your account.' },
        image: { type: String, default: '' },
      },
      slash: {
        title: { type: String, default: '🔐 Server Verification' },
        desc: { type: String, default: 'Use /verify to verify your account.' },
        image: { type: String, default: '' },
      },
      // join initial message removed
    },

    // Legacy UI customization fields (will be superseded by templates)
    dmUI: {
      title: { type: String, default: '✅ Welcome' },
      desc: { type: String, default: 'You have been verified! Welcome to the server.' },
      color: { type: String, default: '#2ecc71' },
      image: { type: String, default: '' },
    },

    promptUI: {
      title: { type: String, default: '' },
      desc: { type: String, default: '' },
      color: { type: String, default: '' },
      image: { type: String, default: '' },
    },

    successUI: {
      title: { type: String, default: '✅ Success' },
      desc: { type: String, default: 'Verification successful! Welcome to the server.' },
      color: { type: String, default: '#2ecc71' },
      image: { type: String, default: '' },
    },
    alreadyVerifiedUI: {
      title: { type: String, default: '⏭️ Already Verified' },
      desc: { type: String, default: 'You are already verified in this server!' },
      color: { type: String, default: '#ffa500' },
      image: { type: String, default: '' },
    },
    errorUI: {
      title: { type: String, default: '❌ Error' },
      desc: { type: String, default: 'Verification failed.' },
      color: { type: String, default: '#ff0000' },
      image: { type: String, default: '' },
    },

    // New templates array for flexible embed configurations
    templates: {
      type: [
        {
          name: { type: String, required: true },
          title: { type: String, default: '' },
          description: { type: String, default: '' },
          color: { type: String, default: '' },
          author: { type: String, default: '' },
          footer: { type: String, default: '' },
          images: { type: [String], default: [] },
          buttons: {
            type: [
              {
                label: String,
                style: String,
                customId: String,
                url: String,
              },
            ],
            default: [],
          },
        },
      ],
      default: [],
      description: 'Array of named embed templates that can be referenced in the gateway flows',
    },

    // Track explicit verification state for users
    verifiedUsers: {
      type: [
        {
          userId: { type: String, required: true },
          verifiedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
      description: 'Historical log of users who have passed verification',
    },

    // Core settings
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
