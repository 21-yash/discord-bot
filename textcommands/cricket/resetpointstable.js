const { EmbedBuilder } = require('discord.js');
const CricketPointsTable = require('../../models/CricketPointsTable');
const config = require('../../config/config.json');

module.exports = {
    name: 'resetpointstable',
    description: 'Reset the entire points table for this server',
    aliases: ['resetpt', 'cleartable'],
    usage: '',
    user_perm: ['Administrator'],
    bot_perm: [],
    async execute(message, args, client, prefix) {
        try {
            const pointsTable = await CricketPointsTable.findOne({ guildId: message.guild.id });
            
            if (!pointsTable) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.colors.error)
                            .setDescription(`${config.emojis.error} No points table found for this server.`)
                    ]
                });
            }

            // Ask for confirmation
            const confirmEmbed = new EmbedBuilder()
                .setColor(config.colors.warning)
                .setDescription(
                    `${config.emojis.warning} **Are you sure you want to reset the points table?**\n` +
                    `This will delete all ${pointsTable.teams.length} teams and their stats.\n\n` +
                    `Type \`confirm\` within 30 seconds to proceed.`
                );

            await message.reply({ embeds: [confirmEmbed] });

            // Wait for confirmation
            const filter = m => m.author.id === message.author.id && m.content.toLowerCase() === 'confirm';
            const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] })
                .catch(() => null);

            if (!collected) {
                return message.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.colors.secondary)
                            .setDescription(`${config.emojis.info} Reset cancelled - timed out.`)
                    ]
                });
            }

            // Delete the points table
            await CricketPointsTable.deleteOne({ guildId: message.guild.id });

            return message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.success)
                        .setDescription(`${config.emojis.success} Points table has been reset successfully.`)
                ]
            });

        } catch (error) {
            console.error('[ResetPointsTable] Error:', error);
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.error)
                        .setDescription(`${config.emojis.error} An error occurred while resetting the points table.`)
                ]
            });
        }
    },
};
