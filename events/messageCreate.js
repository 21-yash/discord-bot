const config = require('../config/config.json');
const { checkBlacklist, checkUserPermissions, checkBotPermissions, isCommandDisabled } = require('../utils/permissions');
const Stickied = require('../models/Stickied');
const { EmbedBuilder } = require('discord.js');
const { PermissionFlagsBits } = require('discord.js');

// Store timers for sticky messages (channelId -> timeout)
const stickyTimers = new Map();

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // Handle sticky messages for all messages (including bot messages for the sticky system)
        if (message.guild && !message.author.bot) {
            await handleStickyMessage(message, client);
        }
        
        // Ignore bots and messages without content for command processing
        if (message.author.bot || !message.content || !message.guild) return;

        const prefix = await client.getPrefix(message.guild.id);

        // Check if message starts with prefix
        if (!message.content.startsWith(prefix)) return;

        // Parse command and arguments
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Get command
        const command = client.textCommands.get(commandName) || 
                       client.textCommands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

        if (!command) return;

        if (!message.guild.members.cache.get(client.user.id).permissionsIn(message.channel).has(PermissionFlagsBits.SendMessages)) return;

        try {
            // Check if user is blacklisted
            const blacklistCheck = await checkBlacklist(message.author.id, message.guild?.id);
            if (blacklistCheck.isBlacklisted) {
                if (blacklistCheck.shouldNotify) {
                    await message.reply(`${config.emojis.banned} You are blacklisted and cannot use commands. Reason: ${blacklistCheck.reason}`);
                }
                return;
            }

            // Check if command is disabled
            if (message.guild && await isCommandDisabled(commandName, message.guild.id)) {
                await message.reply(`${config.emojis.disabled} This command is currently disabled in this server.`);
                return;
            }

            // Check if command is owner only
            if (command.ownerOnly && message.author.id !== config.ownerId) {
                await message.reply(`${config.emojis.error} This command is only available to the bot owner.`);
                return;
            }

            // Check user permissions
            if (command.user_perm && !checkUserPermissions(message.member, command.user_perm)) {
                await message.reply(`${config.emojis.error} You don't have the required permissions to use this command. \n\`${command.user_perm}\``);
                return;
            }

            // Check bot permissions
            if (command.bot_perm && !checkBotPermissions(message.guild, command.bot_perm)) {
                await message.reply(`${config.emojis.error} I don't have the required permissions to execute this command. \n\`${command.bot_perm}\``);
                return;
            }

            // Execute command
            await command.execute(message, args, client, prefix);

        } catch (error) {
            await client.handleMessageError(message, error, commandName);
        }
    },
};

async function handleStickyMessage(message, client) {
    try {
        // Check if there's a sticky message configured for this channel
        const stickyData = await Stickied.findOne({
            guildId: message.guild.id,
            channelId: message.channel.id
        });

        if (!stickyData) return;

        // Check if bot has permission to manage messages in this channel
        const botMember = message.guild.members.me;
        const permissions = message.channel.permissionsFor(botMember);
        
        if (!permissions.has(['SendMessages', 'ManageMessages'])) {
            return;
        }

        const channelId = message.channel.id;
        
        // Clear any existing timer for this channel
        if (stickyTimers.has(channelId)) {
            clearTimeout(stickyTimers.get(channelId));
        }

        // Set a new timer - wait 5 seconds after the last message
        const timer = setTimeout(async () => {
            try {
                // Delete the previous sticky message if it exists
                if (stickyData.lastMessageId) {
                    try {
                        const lastStickyMessage = await message.channel.messages.fetch(stickyData.lastMessageId);
                        if (lastStickyMessage && lastStickyMessage.author.id === client.user.id) {
                            await lastStickyMessage.delete();
                        }
                    } catch (error) {
                        // Message might have been already deleted or doesn't exist
                        console.log('Could not delete previous sticky message:', error.message);
                    }
                }

                // Send new sticky message
                let newStickyMessage;
                if (stickyData.useEmbed) {
                    const embed = new EmbedBuilder()
                        .setColor(config.colors.primary)
                        .setDescription(stickyData.message)
                        .setFooter({ text: '📌 Sticky Message' });
                    
                    newStickyMessage = await message.channel.send({ embeds: [embed] });
                } else {
                    newStickyMessage = await message.channel.send(`📌 ${stickyData.message}`);
                }

                // Update database with new message ID
                await Stickied.findByIdAndUpdate(stickyData._id, {
                    lastMessageId: newStickyMessage.id
                });

                // Remove timer from map
                stickyTimers.delete(channelId);

            } catch (error) {
                console.error('Error posting delayed sticky message:', error);
                stickyTimers.delete(channelId);
            }
        }, 5000); // 5 second delay

        // Store the timer
        stickyTimers.set(channelId, timer);

    } catch (error) {
        console.error('Error handling sticky message:', error);
    }
}
