import mongoose from 'mongoose';

const GuildConfigSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    welcome: {
      channelId: {
        type: String,
        default: '',
      },
      embedName: {
        type: String,
        default: '',
      },
      autoRoleId: {
        type: String,
        default: '',
      },
    },
    goodbye: {
      channelId: {
        type: String,
        default: '',
      },
      embedName: {
        type: String,
        default: '',
      },
    },
    boost: {
      channelId: {
        type: String,
        default: '',
      },
      embedName: {
        type: String,
        default: '',
      },
    },
    logs: {
      channelId: {
        type: String,
        default: '',
      },
    },
    partners: [{
      embedName: {
        type: String,
        default: '',
      },
      roleId: {
        type: String,
        default: '',
      },
      inviteLink: {
        type: String,
        default: '',
      },
    }],
  { timestamps: true }
);

export default mongoose.model('GuildConfig', GuildConfigSchema);
