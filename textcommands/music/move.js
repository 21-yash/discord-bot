const { createErrorEmbed, createSuccessEmbed, createWarningEmbed, createArgEmbed } = require('../../utils/embed');
const config = require('../../config/config.json');

module.exports = {
    name: 'move',
    description: 'Move a song to a different position in the queue',
    usage: '<from_position> <to_position>',
    aliases: ['mv'],
    user_perm: [],
    bot_perm: [],
    async execute(message, args, client, prefix) {
        
        const queue = client.distube.getQueue(message.guild.id);
        const member = message.member;
        const voiceChannel = member.voice.channel;
        const from = parseInt(args[0]);
        const to = parseInt(args[1]);

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

        // Argument validation
        if (isNaN(from) || isNaN(to)) {
            return message.reply({ embeds: [createArgEmbed(prefix, this.name, this.usage)] });
        }
        
        if (from < 2 || to < 2 || from > queue.songs.length || to > queue.songs.length) {
             return message.reply({ embeds: [createWarningEmbed('Invalid Position', `Please provide positions between 2 and ${queue.songs.length}. You cannot move the currently playing song.`)] });
        }

        if (from === to) {
            return message.reply({ embeds: [createWarningEmbed('Same Position', 'The song is already at that position.')] });
        }

        try {
            // Move the song
            const songToMove = queue.songs[from - 1];
            queue.songs.splice(from - 1, 1);
            queue.songs.splice(to - 1, 0, songToMove);

            const successEmbed = createSuccessEmbed(
                '✅ Song Moved',
                `Successfully moved **${songToMove.name}** from position **${from}** to **${to}**.`,
            );
            message.reply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Move error:', error);
            message.reply({ embeds: [createErrorEmbed('An Error Occurred', 'Failed to move the song in the queue.')] });
        }
    }
};