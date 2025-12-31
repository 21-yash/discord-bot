const { createErrorEmbed, createSuccessEmbed, createWarningEmbed } = require('../../utils/embed');
const config = require('../../config/config.json');

module.exports = {
    name: 'clear',
    description: 'Clear all songs from the queue except the current one.',
    usage: '',
    aliases: ['cl'],
    user_perm: ['ManageMessages'],
    bot_perm: [],
    async execute(message, args, client, prefix) {

        const queue = client.distube.getQueue(message.guild.id);
        const member = message.member;
        const voiceChannel = member.voice.channel;

        // Standard voice channel and queue checks
        if (!voiceChannel) {
            return message.reply({ embeds: [createErrorEmbed('Not in a Voice Channel', 'You must be in a voice channel to use this command.')] });
        }
        if (!queue) {
            return message.reply({ embeds: [createErrorEmbed('No Music Playing', 'The queue is already empty!')] });
        }
        if (queue.voice.channel.id !== voiceChannel.id) {
            return message.reply({ embeds: [createErrorEmbed('Wrong Voice Channel', 'You must be in the same voice channel as me to use this command.')] });
        }

        // Check if there are any songs to clear (more than just the currently playing one)
        if (queue.songs.length <= 1) {
            return message.reply({ embeds: [createWarningEmbed('Queue is Empty', 'There are no upcoming songs to clear.')] });
        }

        try {
            const songsToRemove = queue.songs.length - 1;
            // Keep the first song (currently playing) and remove the rest
            queue.songs = [queue.songs[0]];
            
            const successEmbed = createSuccessEmbed(
                '✅ Queue Cleared',
                `Successfully removed **${songsToRemove}** songs from the queue.`
            );
            message.reply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Clear error:', error);
            message.reply({ embeds: [createErrorEmbed('An Error Occurred', 'Failed to clear the queue.')] });
        }
    }
};