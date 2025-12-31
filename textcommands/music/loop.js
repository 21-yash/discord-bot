const { createErrorEmbed, createSuccessEmbed, createWarningEmbed } = require('../../utils/embed');
const config = require('../../config/config.json');

module.exports = {
    name: 'loop',
    description: 'Set or toggle the loop mode for the queue.',
    usage: '[song|queue|off]',
    aliases: ['repeat'],
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

        const input = args[0]?.toLowerCase();
        let mode;

        if (!input) {
            // If no argument, toggle the mode
            mode = (queue.repeatMode + 1) % 3;
        } else {
            // If argument is provided, set to a specific mode
            if (['song', 'track', '1'].includes(input)) {
                mode = 1;
            } else if (['queue', 'q', '2'].includes(input)) {
                mode = 2;
            } else if (['off', 'disable', '0'].includes(input)) {
                mode = 0;
            } else {
                return message.reply({ embeds: [createWarningEmbed('Invalid Mode', 'Please specify a valid loop mode: `song`, `queue`, or `off`.')] });
            }
        }

        try {
            await queue.setRepeatMode(mode);
            
            const modeText = mode === 0 ? 'Off' : mode === 1 ? 'Song' : 'Queue';
            const emoji = mode === 0 ? '🔁' : mode === 1 ? '🔂' : '🔁';

            const successEmbed = createSuccessEmbed(
                `${emoji} Loop Mode Updated`,
                `Loop mode has been set to: **${modeText}**`
            );
            message.reply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Loop error:', error);
            message.reply({ embeds: [createErrorEmbed('An Error Occurred', 'Failed to change the loop mode.')] });
        }
    }
};