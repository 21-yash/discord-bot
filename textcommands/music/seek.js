const { createErrorEmbed, createSuccessEmbed, createWarningEmbed, createArgEmbed } = require('../../utils/embed');
const config = require('../../config/config.json');

module.exports = {
    name: 'seek',
    description: 'Seek to a specific time in the current song',
    usage: '<time_in_seconds>',
    aliases: [],
    user_perm: [],
    bot_perm: [],
    async execute(message, args, client, prefix) {
        
        const queue = client.distube.getQueue(message.guild.id);
        const member = message.member;
        const voiceChannel = member.voice.channel;
        const time = parseInt(args[0]);

        // Standard voice channel and queue checks
        if (!voiceChannel) {
            return message.reply({ embeds: [createErrorEmbed('Not in a Voice Channel', 'You must be in a voice channel to use this command.')] });
        }
        if (!queue) {
            return message.reply({ embeds: [createErrorEmbed('No Music Playing', 'There is no music currently playing!')] });
        }
        if (queue.voice.channel.id !== voiceChannel.id) {
            return message.reply({ embeds: [createErrorEmbed('Wrong Voice Channel', 'You must be in the same voice channel as me to use this command.')] });
        }

        // Argument validation
        if (isNaN(time)) {
            const usageEmbed = createArgEmbed(prefix, this.name, this.usage);
            usageEmbed.addFields({ name: 'Current Song Duration', value: `\`${queue.songs[0].formattedDuration}\`` });
            return message.reply({ embeds: [usageEmbed] });
        }

        if (time < 0 || time > queue.songs[0].duration) {
            return message.reply({ embeds: [createWarningEmbed('Invalid Time', `Please provide a time between 0 and ${queue.songs[0].duration} seconds.`)] });
        }

        try {
            await queue.seek(time);
            
            const minutes = Math.floor(time / 60);
            const seconds = time % 60;
            const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            const successEmbed = createSuccessEmbed(
                '⏩ Song Seeked',
                `Seeked to **${formattedTime}** in the current song.`
            );
            message.reply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Seek error:', error);
            const errorEmbed = createErrorEmbed(
                'An Error Occurred', 
                'Failed to seek in the song.',
                {
                    fields: [{ name: 'Possible Reason', value: 'Live streams and some audio formats do not support seeking.' }]
                }
            );
            message.reply({ embeds: [errorEmbed] });
        }
    }
};