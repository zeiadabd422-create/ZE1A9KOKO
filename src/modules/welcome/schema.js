import mongoose from 'mongoose';

const WelcomeSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    welcomeChannel: { type: String, default: '' },
    welcomeMessage: { type: String, default: 'Welcome to Noodles & Pistacio, {user}!' },
    welcomeImage: { type: String, default: '' },
    autoRole: { type: String, default: '' }, // Unverified role assigned on join
    enabled: { type: Boolean, default: true },
    welcomeEmbed: {
      title: { type: String, default: 'Welcome to Noodles & Pistacio' },
      description: { type: String, default: 'Hello {user}, welcome to {server}!' },
      color: { type: String, default: '#4f3ff0' },
      thumbnail_toggle: { type: Boolean, default: false },
      footer_text: { type: String, default: '{server} • Welcome' },
      image_url: { type: String, default: '' },
      channel: { type: String, default: '' },
    },
    goodbyeEmbed: {
      title: { type: String, default: 'Goodbye from Noodles & Pistacio' },
      description: { type: String, default: '{user} has left {server}.' },
      color: { type: String, default: '#ff4d4d' },
      thumbnail_toggle: { type: Boolean, default: false },
      footer_text: { type: String, default: '{server} • Farewell' },
      image_url: { type: String, default: '' },
      channel: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export default mongoose.model('WelcomeConfig', WelcomeSchema);
