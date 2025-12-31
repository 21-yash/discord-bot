const { createErrorEmbed, createSuccessEmbed, createWarningEmbed } = require('../../utils/embed');
const config = require('../../config/config.json');

module.exports = {
    name: 'shuffle',
    description: 'Shuffle the songs in the queue',
    usage: '',
    aliases: ['sh'],
    user_perm: [],
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
            return message.reply({ embeds: [createErrorEmbed('No Music Playing', 'The queue is empty!')] });
        }
        if (queue.voice.channel.id !== voiceChannel.id) {
            return message.reply({ embeds: [createErrorEmbed('Wrong Voice Channel', 'You must be in the same voice channel as me to use this command.')] });
        }

        // Check if there are enough songs to shuffle (1 playing + at least 2 in queue)
        if (queue.songs.length <= 2) {
            return message.reply({ embeds: [createWarningEmbed('Not Enough Songs', 'You need at least two songs in the queue (after the current one) to shuffle.')] });
        }

        try {
            await queue.shuffle();
            
            const successEmbed = createSuccessEmbed(
                '🔀 Queue Shuffled',
                `Successfully shuffled the upcoming songs in the queue.`
            );
            message.reply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Shuffle error:', error);
            message.reply({ embeds: [createErrorEmbed('An Error Occurred', 'Failed to shuffle the queue.')] });
        }
    }
};