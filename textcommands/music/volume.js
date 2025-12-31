const { createErrorEmbed, createSuccessEmbed, createWarningEmbed, createInfoEmbed } = require('../../utils/embed');
const config = require('../../config/config.json');

module.exports = {
    name: 'volume',
    description: 'Check or change the music volume',
    usage: '[level (1-100)]',
    aliases: ['vol'],
    user_perm: [],
    bot_perm: [],
    async execute(message, args, client, prefix) {

        const queue = client.distube.getQueue(message.guild.id);
        const member = message.member;
        const voiceChannel = member.voice.channel;
        const volume = parseInt(args[0]);

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

        // If no volume level is provided, show the current volume
        if (isNaN(volume)) {
            const currentVolumeEmbed = createInfoEmbed(
                'Current Volume',
                `The current volume is set to **${queue.volume}%**`,
                {
                    fields: [{ name: 'How to Change', value: `Use \`${config.prefix}volume <0-100>\` to set a new volume.` }]
                }
            );
            return message.reply({ embeds: [currentVolumeEmbed] });
        }

        // Check if the provided volume is valid
        if (volume < 0 || volume > 100) {
            return message.reply({ embeds: [createWarningEmbed('Invalid Volume', 'Please provide a volume level between 0 and 100.')] });
        }

        try {
            queue.setVolume(volume);
            
            const volumeIcon = volume === 0 ? '🔇' : volume < 30 ? '🔈' : volume < 70 ? '🔉' : '🔊';

            const successEmbed = createSuccessEmbed(
                `${volumeIcon} Volume Changed`,
                `The volume has been set to **${volume}%**`
            );
            message.reply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Volume error:', error);
            message.reply({ embeds: [createErrorEmbed('An Error Occurred', 'Failed to change the volume.')] });
        }
    }
};