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
      author_name: { type: String, default: '' },
      author_icon: { type: String, default: '' },
      thumbnail_toggle: { type: Boolean, default: false },
      thumbnail_url: { type: String, default: '' },
      footer_text: { type: String, default: '{server} • Welcome' },
      footer_image_url: { type: String, default: '' },
      image_url: { type: String, default: '' },
      channel: { type: String, default: '' },
    },
    goodbyeEmbed: {
      title: { type: String, default: 'Goodbye from Noodles & Pistacio' },
      description: { type: String, default: '{user} has left {server}.' },
      color: { type: String, default: '#ff4d4d' },
      author_name: { type: String, default: '' },
      author_icon: { type: String, default: '' },
      thumbnail_toggle: { type: Boolean, default: false },
      thumbnail_url: { type: String, default: '' },
      footer_text: { type: String, default: '{server} • Farewell' },
      footer_image_url: { type: String, default: '' },
      image_url: { type: String, default: '' },
      channel: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export default mongoose.model('WelcomeConfig', WelcomeSchema);
