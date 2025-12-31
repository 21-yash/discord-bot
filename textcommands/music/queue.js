const { createErrorEmbed, createInfoEmbed } = require('../../utils/embed');

module.exports = {
    name: 'queue',
    description: 'Show the current music queue',
    usage: '',
    aliases: ['q'],
    user_perm: [],
    bot_perm: [],
    async execute(message, args, client, prefix) {
        const queue = client.distube.getQueue(message.guild.id);
        
        if (!queue || queue.songs.length === 0) {
            return message.reply({ embeds: [createErrorEmbed('Empty Queue', 'There are no songs in the queue!')] });
        }

        // Format the list of songs
        const queueList = queue.songs.slice(0, 10).map((song, index) => {
            const isCurrent = index === 0 ? '🎵 ' : '';
            return `${isCurrent}**${index + 1}.** ${song.name} - *${song.formattedDuration}*`;
        }).join('\n');

        const fields = [
            { name: 'Total Songs', value: queue.songs.length.toString(), inline: true },
            { name: 'Loop Mode', value: queue.repeatMode ? (queue.repeatMode === 2 ? 'Queue' : 'Song') : 'Off', inline: true },
            { name: 'Autoplay', value: queue.autoplay ? 'On' : 'Off', inline: true }
        ];

        const footer = queue.songs.length > 10 ? { text: `And ${queue.songs.length - 10} more songs...` } : null;

        const queueEmbed = createInfoEmbed(
            'Current Queue',
            queueList,
            { fields, footer }
        );

        message.reply({ embeds: [queueEmbed] });
    }
};