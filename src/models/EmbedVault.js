import mongoose from 'mongoose';

const StructureSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    color: { type: String, default: '#2f3136' },
    author: {
      name: { type: String, default: '' },
      iconURL: { type: String, default: '' },
      url: { type: String, default: '' },
    },
    footer: {
      text: { type: String, default: '' },
      iconURL: { type: String, default: '' },
    },
    thumbnail: { type: String, default: '' },
    image: { type: String, default: '' },
    fields: {
      type: [
        {
          name: { type: String, required: true },
          value: { type: String, required: true },
          inline: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

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
      index: true,
      unique: true,
    },
    tier: {
      type: String,
      enum: ['Common', 'Partner', 'VIP'],
      default: 'Common',
      required: true,
      index: true,
    },
    structure: {
      type: StructureSchema,
      required: true,
      default: () => ({}),
    },
    isBlueprint: {
      type: Boolean,
      default: false,
    },
    dynamicAssets: {
      type: Boolean,
      default: false,
    },
    // Compatibility/backfill from legacy embedVault schema
    data: {
      type: Object,
      default: {},
    },
    type: {
      type: String,
      enum: ['Welcome', 'Goodbye', 'Partner', 'Manual', 'Boost'],
      default: 'Manual',
    },
    linkedInviteCode: {
      type: String,
      default: '',
    },
    linkedPartnerRole: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

EmbedVaultSchema.index({ guildId: 1, name: 1 }, { unique: true });

export default mongoose.models.EmbedVault || mongoose.model('EmbedVault', EmbedVaultSchema);
