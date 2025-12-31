const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        default: 'No reason provided'
    },
    blacklistedBy: {
        type: String,
        required: true
    },
    blacklistedAt: {
        type: Date,
        default: Date.now
    },
    guildId: {
        type: String,
        required: false // Global blacklist if not specified
    }
}, {
    timestamps: true
});

// Index for faster queries
blacklistSchema.index({ userId: 1 });
blacklistSchema.index({ guildId: 1 });

module.exports = mongoose.model('Blacklist', blacklistSchema);
