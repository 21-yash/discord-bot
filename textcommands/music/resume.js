const { createErrorEmbed, createSuccessEmbed, createWarningEmbed } = require('../../utils/embed');

module.exports = {
    name: 'resume',
    description: 'Resume the currently paused song',
    usage: '',
    aliases: ['unpause'],
    user_perm: [],
    bot_perm: [],
    async execute(message, args, client, prefix) {
        
        const queue = client.distube.getQueue(message.guild.id);
        const member = message.member;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return message.reply({ embeds: [createErrorEmbed('Not in a Voice Channel', 'You must be in a voice channel to use this command.')] });
        }
        if (!queue) {
            return message.reply({ embeds: [createErrorEmbed('No Music Playing', 'There is no music currently playing!')] });
        }
        if (queue.voice.channel.id !== voiceChannel.id) {
            return message.reply({ embeds: [createErrorEmbed('Wrong Voice Channel', 'You must be in the same voice channel as me to use this command.')] });
        }

        if (!queue.paused) {
            return message.reply({ embeds: [createWarningEmbed('Not Paused', 'The music is not currently paused!')] });
        }

        try {
            queue.resume();
            message.reply({ embeds: [createSuccessEmbed('Music Resumed', 'The current song has been resumed.')] });
        } catch (error) {
            console.error('Resume error:', error);
            message.reply({ embeds: [createErrorEmbed('An Error Occurred', 'Failed to resume the music.')] });
        }
    }
};