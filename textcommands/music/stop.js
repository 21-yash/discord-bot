const { createErrorEmbed, createSuccessEmbed, createInfoEmbed } = require('../../utils/embed');
const config = require('../../config/config.json');

module.exports = {
    name: 'stop',
    description: 'Stop the music and clear the queue',
    usage: '',
    aliases: ['leave', 'disconnect'],
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

        // --- Vote Stop Logic ---
        const voiceMembers = voiceChannel.members.filter(m => !m.user.bot);

        if (voiceMembers.size <= 1) {
            try {
                await queue.stop();
                return message.reply({ embeds: [createSuccessEmbed('Music Stopped', 'Playback has been stopped and the queue has been cleared.')] });
            } catch (error) {
                console.error('Stop error:', error);
                return message.reply({ embeds: [createErrorEmbed('An Error Occurred', 'Failed to stop the music.')] });
            }
        }

        const requiredVotes = Math.ceil(voiceMembers.size * (config.voteThreshold || 0.5)); // Default to 50%

        if (!client.votes.has(message.guild.id)) {
            client.votes.set(message.guild.id, { skip: new Set(), stop: new Set() });
        }

        const votes = client.votes.get(message.guild.id);

        if (votes.stop.has(message.author.id)) {
            return message.reply({ embeds: [createInfoEmbed('Vote Already Registered', 'You have already voted to stop the music.')] });
        }
        votes.stop.add(message.author.id);

        if (votes.stop.size >= requiredVotes) {
            try {
                await queue.stop();
                votes.stop.clear(); // Clear votes after a successful stop
                message.channel.send({ embeds: [createSuccessEmbed('Vote Stop Successful', 'The required number of votes was reached. Stopping playback and clearing the queue.')] });
            } catch (error) {
                console.error('Stop error:', error);
                message.reply({ embeds: [createErrorEmbed('An Error Occurred', 'Failed to stop the music.')] });
            }
        } else {
            const voteEmbed = createInfoEmbed(
                'Vote Registered',
                `Your vote to stop has been registered.`,
                {
                    fields: [{ name: 'Votes', value: `\`${votes.stop.size} / ${requiredVotes}\`` }]
                }
            );
            message.reply({ embeds: [voteEmbed] });
        }
    }
};