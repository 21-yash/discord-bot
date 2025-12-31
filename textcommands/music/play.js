const { createArgEmbed, createErrorEmbed } = require('../../utils/embed');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'play',
    description: 'Play a song or add it to the queue',
    usage: '<song name>',
    aliases: ['p'],
    user_perm: [],
    bot_perm: [], // You can add required bot perms here like 'Connect', 'Speak'
    async execute(message, args, client, prefix) {
        const member = message.member;
        const voiceChannel = member.voice.channel;
        const query = args.join(' ');

        if (!args.length) {
            return await message.reply({ embeds: [createArgEmbed(prefix, this.name, this.usage)] });
        }

        if (!voiceChannel) {
            return await message.reply({ embeds: [createErrorEmbed('Not in a Voice Channel', 'You must be in a voice channel to play music.')] });
        }

        const queue = client.distube.getQueue(message.guild.id);
        if (queue && queue.voice.channel.id !== voiceChannel.id) {
            return await message.reply({ embeds: [createErrorEmbed('Bot in Use', 'I am already playing music in another voice channel.')] });
        }

        const botPermissions = voiceChannel.permissionsFor(client.user);
        if (!botPermissions.has(PermissionFlagsBits.Connect) || !botPermissions.has(PermissionFlagsBits.Speak)) {
            return await message.reply({ embeds: [createErrorEmbed('Missing Permissions', 'I need the permissions to join and speak in your voice channel!')] });
        }

        const searchingEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🔍 Searching...')
            .setDescription('Looking for: `' + query + '`')
            .setTimestamp();
        
        const searchMsg = await message.reply({ embeds: [searchingEmbed] });

        try {
            await client.distube.play(voiceChannel, query, {
                textChannel: message.channel,
                member: message.member
            });
            
            await searchMsg.delete();

        } catch (error) {
            console.error("Error playing song:", error);
            await searchMsg.edit({ embeds: [createErrorEmbed('An Error Occurred', 'There was an error trying to play that song.')] });
        }
    }
};