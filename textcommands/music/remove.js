const { createErrorEmbed, createSuccessEmbed, createWarningEmbed, createArgEmbed } = require('../../utils/embed');

module.exports = {
    name: 'remove',
    description: 'Remove a specific song from the queue',
    usage: '<position>',
    aliases: ['rm'],
    user_perm: [],
    bot_perm: [],
    async execute(message, args, client, prefix) {
        
        const queue = client.distube.getQueue(message.guild.id);
        const member = message.member;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return message.reply({ embeds: [createErrorEmbed('Not in a Voice Channel', 'You must be in a voice channel to use this command.')] });
        }
        if (!queue || queue.songs.length === 0) {
            return message.reply({ embeds: [createErrorEmbed('Empty Queue', 'The music queue is currently empty.')] });
        }
        if (queue.voice.channel.id !== voiceChannel.id) {
            return message.reply({ embeds: [createErrorEmbed('Wrong Voice Channel', 'You must be in the same voice channel as me to use this command.')] });
        }

        if (!args.length) {
            return message.reply({ embeds: [createArgEmbed(prefix, this.name, this.usage)] });
        }

        const position = parseInt(args[0]);

        if (isNaN(position) || position < 1 || position > queue.songs.length) {
            return message.reply({ embeds: [
                createErrorEmbed('Invalid Position', `Please provide a valid song number between 1 and ${queue.songs.length}.`)
            ]});
        }

        if (position === 1) {
            return message.reply({ embeds: [
                createWarningEmbed('Cannot Remove Current Song', 'You cannot remove the song that is currently playing. Use the `skip` command instead.')
            ]});
        }

        try {
            const removedSong = queue.songs.splice(position - 1, 1)[0];
            
            const successEmbed = createSuccessEmbed(
                'Song Removed',
                `Successfully removed **[${removedSong.name}](${removedSong.url})** from the queue.`,
                {
                    fields: [
                        { name: 'Removed Position', value: `\`${position}\``, inline: true },
                        { name: 'Requested by', value: `<@${removedSong.user.id}>`, inline: true }
                    ]
                }
            );

            message.reply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Remove error:', error);
            message.reply({ embeds: [createErrorEmbed('An Error Occurred', 'Failed to remove the song from the queue.')] });
        }
    }
};