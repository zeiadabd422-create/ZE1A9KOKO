import mongoose from 'mongoose';

const GatewayConfigSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  roles: {
    successRoleId: { type: String, default: null },
    failureRoleId: { type: String, default: null }
  },
  settings: {
    enabled: { type: Boolean, default: true },
    verificationChannel: { type: String, default: null },
    difficulty: { type: String, default: 'NORMAL' }
  },
  visualTemplates: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

const GatewayConfig = mongoose.model('GatewayConfig', GatewayConfigSchema);

export default GatewayConfig;