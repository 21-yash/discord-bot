const { createErrorEmbed, createCustomEmbed } = require('../../utils/embed');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'nowplaying',
    description: 'Show information about the currently playing song',
    usage: '',
    aliases: ['np'],
    user_perm: [],
    bot_perm: [],
    async execute(message, args, client, prefix) {
        const queue = client.distube.getQueue(message.guild.id);
        const member = message.member;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return message.reply({ embeds: [createErrorEmbed('Not in a Voice Channel', 'You must be in a voice channel to use this command.')] });
        }

        if (!queue || !queue.songs[0]) {
            return message.reply({ embeds: [createErrorEmbed('No Music Playing', 'There is no music currently playing!')] });
        }

        if (queue.voice.channel.id !== voiceChannel.id) {
            return message.reply({ embeds: [createErrorEmbed('Wrong Voice Channel', 'You must be in the same voice channel as me to use this command.')] });
        }

        const song = queue.songs[0];

        const progress = queue.currentTime;
        const duration = song.duration;
        const progressPercentage = (progress / duration) * 100;
        const progressBar = '▬'.repeat(Math.floor(progressPercentage / 5)) + '🔘' + '▬'.repeat(20 - Math.floor(progressPercentage / 5));

        const fields = [
            { name: 'Progress', value: `${queue.formattedCurrentTime} / ${song.formattedDuration}`, inline: true },
            { name: 'Requested by', value: `<@${song.user.id}>`, inline: true },
            { name: 'Volume', value: `${queue.volume}%`, inline: true },
            { name: 'Loop Mode', value: queue.repeatMode ? (queue.repeatMode === 2 ? 'Queue' : 'Song') : 'Off', inline: true },
            { name: 'Autoplay', value: queue.autoplay ? 'On' : 'Off', inline: true },
            { name: '\u200B', value: progressBar, inline: false } // Using a zero-width space for an empty field name
        ];

        const nowPlayingEmbed = createCustomEmbed(
            '🎵 Now Playing',
            `**[${song.name}](${song.url})**`, // Link the song name to its URL
            '#0099ff', // A nice blue color for info
            {
                fields: fields,
                thumbnail: song.thumbnail,
                timestamp: true
            }
        );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('music_pause_resume')
                    .setLabel(queue.paused ? 'Resume' : 'Pause')
                    .setEmoji(queue.paused ? '▶️' : '⏸️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('music_skip')
                    .setLabel('Skip')
                    .setEmoji('⏭️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('music_stop')
                    .setLabel('Stop')
                    .setEmoji('⏹️')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('music_queue')
                    .setLabel('Queue')
                    .setEmoji('📜')
                    .setStyle(ButtonStyle.Secondary)
            );

        message.reply({ embeds: [nowPlayingEmbed], components: [row] });
    }
};