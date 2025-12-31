const mongoose = require('mongoose');

module.exports = mongoose.model('stickied', new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  message: { type: String, required: true },
  useEmbed: { type: Boolean, default: false },
  lastMessageId: { type: String, default: null }
}));