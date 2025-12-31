const config = require('../config/config');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isButton()) return;
        
        if (!interaction.customId.startsWith('music_')) return;

        const guildId = interaction.guild.id;
        const member = interaction.member;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ 
                content: '❌ You need to be in a voice channel to use music controls!', 
                ephemeral: true 
            });
        }

        const queue = client.distube.getQueue(guildId);
        if (!queue) {
            return interaction.reply({ 
                content: '❌ Nothing is currently playing!', 
                ephemeral: true
            });
        }

        try {
            switch (interaction.customId) {
                case 'music_pause_resume':
                    if (queue.paused) {
                        queue.resume();
                        await interaction.reply({ 
                            content: '▶️ Resumed!', 
                            ephemeral: true // MessageFlags.EPHEMERAL
                        });
                    } else {
                        queue.pause();
                        await interaction.reply({ 
                            content: '⏸️ Paused!', 
                            ephemeral: true // MessageFlags.EPHEMERAL
                        });
                    }
                    
                    // Update the original message with new button state
                    try {
                        const updatedEmbed = new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('🎵 Now Playing')
                            .setDescription('**' + queue.songs[0].name + '**')
                            .addFields(
                                { name: 'Duration', value: queue.songs[0].formattedDuration, inline: true },
                                { name: 'Requested by', value: '<@' + queue.songs[0].user.id + '>', inline: true },
                                { name: 'Queue Position', value: '1 of ' + queue.songs.length, inline: true }
                            )
                            .setThumbnail(queue.songs[0].thumbnail)
                            .setTimestamp();

                        const updatedRow = new ActionRowBuilder()
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

                        await interaction.message.edit({ 
                            embeds: [updatedEmbed], 
                            components: [updatedRow] 
                        });
                    } catch (editError) {
                        console.log('Could not update button display:', editError);
                    }
                    break;

                case 'music_skip':
                    const voiceMembers = voiceChannel.members.filter(member => !member.user.bot);
                    const requiredVotes = Math.ceil(voiceMembers.size * config.voteThreshold);

                    if (!client.votes.has(guildId)) {
                        client.votes.set(guildId, { skip: new Set(), stop: new Set() });
                    }

                    const skipVotes = client.votes.get(guildId);
                    skipVotes.skip.add(interaction.user.id);

                    if (skipVotes.skip.size >= requiredVotes || interaction.user.id === queue.songs[0].user.id) {
                        skipVotes.skip.clear();
                        await queue.skip();
                        await interaction.reply({ content: '⏭️ Skipped!', flags: 1 << 6 });
                    } else {
                        await interaction.reply({ 
                            content: `⏭️ Skip vote registered! (${skipVotes.skip.size}/${requiredVotes} votes needed)`,
                            ephemeral: true 
                        });
                    }
                    break;

                case 'music_stop':
                    const stopVoiceMembers = voiceChannel.members.filter(member => !member.user.bot);
                    const stopRequiredVotes = Math.ceil(stopVoiceMembers.size * config.voteThreshold);

                    if (!client.votes.has(guildId)) {
                        client.votes.set(guildId, { skip: new Set(), stop: new Set() });
                    }

                    const stopVotes = client.votes.get(guildId);
                    stopVotes.stop.add(interaction.user.id);

                    if (stopVotes.stop.size >= stopRequiredVotes) {
                        stopVotes.stop.clear();
                        await queue.stop();
                        await interaction.reply({ content: '⏹️ Stopped and cleared queue!', flags: 1 << 6 });
                    } else {
                        await interaction.reply({ 
                            content: `⏹️ Stop vote registered! (${stopVotes.stop.size}/${stopRequiredVotes} votes needed)`, 
                            flags: 1 << 6 // MessageFlags.EPHEMERAL
                        });
                    }
                    break;

                case 'music_queue':
                    if (queue.songs.length === 0) {
                        return interaction.reply({ content: '❌ The queue is empty!', flags: 1 << 6 });
                    }

                    const queueList = queue.songs.slice(0, 10).map((song, index) => {
                        const current = index === 0 ? '🎵 ' : '';
                        return `${current}**${index + 1}.** ${song.name} - *${song.formattedDuration}*`;
                    }).join('\n');

                    await interaction.reply({ 
                        content: `**🎵 Current Queue:**\n${queueList}${queue.songs.length > 10 ? `\n*And ${queue.songs.length - 10} more...*` : ''}`, 
                        flags: 1 << 6 // MessageFlags.EPHEMERAL
                    });
                    break;

                default:
                    await interaction.reply({ content: '❌ Unknown interaction!', flags: 1 << 6 });
            }
        } catch (error) {
            console.error('Interaction error:', error);
            if (!interaction.replied) {
                await interaction.reply({ content: '❌ An error occurred!', flags: 1 << 6 });
            }
        }
    }
};
