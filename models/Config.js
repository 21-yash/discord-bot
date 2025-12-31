const mongoose = require("mongoose");

const featureSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },       // Is the feature enabled?
  logEnabled: { type: Boolean, default: false },    // Is logging for this feature enabled?
  logChannel: { type: String, default: null },      // Channel ID for logs
}, { _id: false });

module.exports = mongoose.model("Config", new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  prefix: { type: String, default: "?" },
  levels: { type: featureSchema, default: () => ({}) },
  economy: { type: featureSchema, default: () => ({}) },
  moderation: { type: featureSchema, default: () => ({}) }
}));
