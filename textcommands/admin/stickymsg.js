const { EmbedBuilder } = require('discord.js');
const config = require('../../config/config.json');
const Stickied = require('../../models/Stickied');

module.exports = {
    name: 'stickymsg',
    description: 'Manage sticky messages for channels',
    usage: '<set/remove/list> [#channel] [message]',
    aliases: ['sticky'],
    user_perm: ['ManageMessages'],
    bot_perm: ['SendMessages', 'ManageMessages'],
    async execute(message, args, client, prefix) {
        if (!args[0]) {
            const embed = new EmbedBuilder()
                .setColor(config.colors.error)
                .setTitle(`${config.emojis.error} Missing Arguments`)
                .setDescription(`Usage: \`${prefix}stickymsg <set/remove/list> [#channel] [message]\``)
                .addFields([
                    { name: 'Examples', value: `\`${prefix}stickymsg set #general Welcome to our server!\`\n\`${prefix}stickymsg remove #general\`\n\`${prefix}stickymsg list\``, inline: false }
                ]);
            
            return await message.reply({ embeds: [embed] });
        }

        const action = args[0].toLowerCase();

        try {
            if (action === 'set') {
                await setStickyMessage(message, args, client);
            } else if (action === 'remove') {
                await removeStickyMessage(message, args);
            } else if (action === 'list') {
                await listStickyMessages(message);
            } else {
                const embed = new EmbedBuilder()
                    .setColor(config.colors.error)
                    .setTitle(`${config.emojis.error} Invalid Action`)
                    .setDescription('Valid actions: `set`, `remove`, `list`');
                
                await message.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error in stickymsg command:', error);
            await client.handleMessageError(message, error, 'stickymsg');
        }
    },
};

async function setStickyMessage(message, args, client) {
    if (!args[1] || !args[2]) {
        const embed = new EmbedBuilder()
            .setColor(config.colors.error)
            .setTitle(`${config.emojis.error} Missing Arguments`)
            .setDescription(`Usage: \`${prefix}stickymsg set #channel <message>\``);
        
        return await message.reply({ embeds: [embed] });
    }

    // Extract channel ID from mention
    const channelId = args[1].replace(/[<#>]/g, '');
    const channel = message.guild.channels.cache.get(channelId);

    if (!channel) {
        const embed = new EmbedBuilder()
            .setColor(config.colors.error)
            .setTitle(`${config.emojis.error} Invalid Channel`)
            .setDescription('Please mention a valid text channel.');
        
        return await message.reply({ embeds: [embed] });
    }

    // Check if bot has permissions in target channel
    const botMember = message.guild.members.me;
    const permissions = channel.permissionsFor(botMember);
    
    if (!permissions.has(['SendMessages', 'ManageMessages'])) {
        const embed = new EmbedBuilder()
            .setColor(config.colors.error)
            .setTitle(`${config.emojis.error} Insufficient Permissions`)
            .setDescription(`I need Send Messages and Manage Messages permissions in ${channel}.`);
        
        return await message.reply({ embeds: [embed] });
    }

    // Get message content
    const stickyMessage = args.slice(2).join(' ');
    const useEmbed = stickyMessage.includes('--embed');
    const cleanMessage = stickyMessage.replace('--embed', '').trim();

    // Update or create sticky message in database
    await Stickied.findOneAndUpdate(
        { guildId: message.guild.id, channelId: channel.id },
        { 
            guildId: message.guild.id,
            channelId: channel.id,
            message: cleanMessage,
            useEmbed: useEmbed,
            lastMessageId: null
        },
        { upsert: true, new: true }
    );

    // Send initial sticky message
    await sendStickyMessage(channel, cleanMessage, useEmbed);

    const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle(`${config.emojis.success} Sticky Message Set`)
        .setDescription(`Successfully set sticky message for ${channel}`)
        .addFields([
            { name: 'Channel', value: `${channel}`, inline: true },
            { name: 'Format', value: useEmbed ? 'Embed' : 'Plain text', inline: true },
            { name: 'Message Preview', value: cleanMessage.substring(0, 100) + (cleanMessage.length > 100 ? '...' : ''), inline: false }
        ])
        .setTimestamp();

    await message.reply({ embeds: [embed] });
}

async function removeStickyMessage(message, args) {
    if (!args[1]) {
        const embed = new EmbedBuilder()
            .setColor(config.colors.error)
            .setTitle(`${config.emojis.error} Missing Channel`)
            .setDescription(`Usage: \`${prefix}stickymsg remove #channel\``);
        
        return await message.reply({ embeds: [embed] });
    }

    // Extract channel ID from mention
    const channelId = args[1].replace(/[<#>]/g, '');
    const channel = message.guild.channels.cache.get(channelId);

    if (!channel) {
        const embed = new EmbedBuilder()
            .setColor(config.colors.error)
            .setTitle(`${config.emojis.error} Invalid Channel`)
            .setDescription('Please mention a valid text channel.');
        
        return await message.reply({ embeds: [embed] });
    }

    const stickyData = await Stickied.findOneAndDelete({
        guildId: message.guild.id,
        channelId: channel.id
    });

    if (!stickyData) {
        const embed = new EmbedBuilder()
            .setColor(config.colors.error)
            .setTitle(`${config.emojis.error} No Sticky Message`)
            .setDescription(`There is no sticky message set for ${channel}.`);
        
        return await message.reply({ embeds: [embed] });
    }

    // Delete last sticky message if it exists
    if (stickyData.lastMessageId) {
        try {
            const lastMessage = await channel.messages.fetch(stickyData.lastMessageId);
            if (lastMessage && lastMessage.author.id === message.client.user.id) {
                await lastMessage.delete();
            }
        } catch (error) {
            console.log('Could not delete last sticky message:', error.message);
        }
    }

    const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle(`${config.emojis.success} Sticky Message Removed`)
        .setDescription(`Successfully removed sticky message from ${channel}`)
        .setTimestamp();

    await message.reply({ embeds: [embed] });
}

async function listStickyMessages(message) {
    const stickyMessages = await Stickied.find({ guildId: message.guild.id });

    if (stickyMessages.length === 0) {
        const embed = new EmbedBuilder()
            .setColor(config.colors.info)
            .setTitle(`${config.emojis.info} No Sticky Messages`)
            .setDescription('There are no sticky messages configured in this server.');
        
        return await message.reply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`📌 Sticky Messages in ${message.guild.name}`)
        .setDescription(`Found ${stickyMessages.length} sticky message(s)`)
        .setTimestamp();

    for (const sticky of stickyMessages) {
        const channel = message.guild.channels.cache.get(sticky.channelId);
        const channelName = channel ? `#${channel.name}` : 'Deleted Channel';
        
        embed.addFields([{
            name: `${channelName}`,
            value: `**Format:** ${sticky.useEmbed ? 'Embed' : 'Plain text'}\n**Message:** ${sticky.message.substring(0, 100)}${sticky.message.length > 100 ? '...' : ''}`,
            inline: false
        }]);
    }

    await message.reply({ embeds: [embed] });
}

async function sendStickyMessage(channel, message, useEmbed) {
    try {
        let sentMessage;
        
        if (useEmbed) {
            const embed = new EmbedBuilder()
                .setColor(config.colors.primary)
                .setDescription(message)
                .setFooter({ text: '📌 Sticky Message' });
            
            sentMessage = await channel.send({ embeds: [embed] });
        } else {
            sentMessage = await channel.send(`📌 ${message}`);
        }

        // Update database with new message ID
        await Stickied.findOneAndUpdate(
            { channelId: channel.id },
            { lastMessageId: sentMessage.id }
        );

        return sentMessage;
    } catch (error) {
        console.error('Error sending sticky message:', error);
    }
}