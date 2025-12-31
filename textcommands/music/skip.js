const { createErrorEmbed, createSuccessEmbed, createInfoEmbed } = require('../../utils/embed');
const config = require('../../config/config.json');

module.exports = {
    name: 'skip',
    description: 'Skip the currently playing song',
    usage: '',
    aliases: ['s'],
    user_perm: [],
    bot_perm: [],
    async execute(message, args, client, prefix) {
        
        const queue = client.distube.getQueue(message.guild.id);
        const member = message.member;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return message.reply({ embeds: [createErrorEmbed('Not in a Voice Channel', 'You must be in a voice channel to use this command.')] });
        }
        if (!queue) {
            return message.reply({ embeds: [createErrorEmbed('No Music Playing', 'There is no music currently playing!')] });
        }
        if (queue.voice.channel.id !== voiceChannel.id) {
            return message.reply({ embeds: [createErrorEmbed('Wrong Voice Channel', 'You must be in the same voice channel as me to use this command.')] });
        }

        const voiceMembers = voiceChannel.members.filter(m => !m.user.bot);
        if (voiceMembers.size <= 1) {
            try {
                await queue.skip();
                return message.reply({ embeds: [createSuccessEmbed('Song Skipped', 'The current song has been skipped.')] });
            } catch (error) {
                console.error('Skip error:', error);
                return message.reply({ embeds: [createErrorEmbed('An Error Occurred', 'Failed to skip the song.')] });
            }
        }
        
        const requiredVotes = Math.ceil(voiceMembers.size * (config.voteThreshold || 0.5)); // Default to 50% if not in config

        if (!client.votes.has(message.guild.id)) {
            client.votes.set(message.guild.id, { skip: new Set(), stop: new Set() });
        }

        const votes = client.votes.get(message.guild.id);

        if (message.author.id === queue.songs[0].user.id) {
             try {
                await queue.skip();
                votes.skip.clear(); 
                return message.reply({ embeds: [createSuccessEmbed('Song Skipped', 'Skipped by the song requester.')] });
            } catch (error) {
                console.error('Skip error:', error);
                return message.reply({ embeds: [createErrorEmbed('An Error Occurred', 'Failed to skip the song.')] });
            }
        }

        if (votes.skip.has(message.author.id)) {
            return message.reply({ embeds: [createInfoEmbed('Vote Already Registered', 'You have already voted to skip this song.')] });
        }
        votes.skip.add(message.author.id);

        if (votes.skip.size >= requiredVotes) {
            try {
                await queue.skip();
                votes.skip.clear(); 
                message.channel.send({ embeds: [createSuccessEmbed('Vote Skip Successful', `The required number of votes was reached. Skipping the current song.`)] });
            } catch (error) {
                console.error('Skip error:', error);
                message.reply({ embeds: [createErrorEmbed('An Error Occurred', 'Failed to skip the song.')] });
            }
        } else {

            const voteEmbed = createInfoEmbed(
                'Vote Registered', 
                `Your vote to skip has been registered.`,
                {
                    fields: [{ name: 'Votes', value: `\`${votes.skip.size} / ${requiredVotes}\`` }]
                }
            );
            message.reply({ embeds: [voteEmbed] });
        }
    }
};