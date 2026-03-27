import mongoose from 'mongoose';

const EmbedVaultSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    guildId: {
      type: String,
      required: true,
      index: true,
    },
    structure: {
      type: Object,
      required: true,
      default: {},
    },
    isBlueprint: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const EmbedVault = mongoose.models.EmbedVault || mongoose.model('EmbedVault', EmbedVaultSchema);
export default EmbedVault;
