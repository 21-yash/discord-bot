const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const CricketPointsTable = require('../../models/CricketPointsTable');
const { generatePointsTable } = require('../../utils/generatePointsTable');
const config = require('../../config/config.json');

module.exports = {
    name: 'pointstable',
    description: 'View the cricket points table for the current tournament',
    aliases: ['pt', 'table', 'standings', 'leaderboard'],
    usage: '[tournament_name]',
    user_perm: [],
    bot_perm: [],
    async execute(message, args, client, prefix) {
        try {
            // Find the points table for this guild
            let pointsTable = await CricketPointsTable.findOne({ guildId: message.guild.id });
            
            if (!pointsTable || pointsTable.teams.length === 0) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.colors.error)
                            .setDescription(`${config.emojis.error} No points table found for this server.\nUse \`${prefix}addteam <team_name>\` to add teams.`)
                    ]
                });
            }

            // Sort teams before displaying
            pointsTable.sortTeams();
            await pointsTable.save();

            // Generate the points table image
            const imageBuffer = await generatePointsTable(pointsTable);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'pointstable.png' });

            // Build the embed with the image
            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setImage('attachment://pointstable.png')
                .setTimestamp()

            return message.reply({files: [attachment] });

        } catch (error) {
            console.error('[PointsTable] Error:', error);
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.error)
                        .setDescription(`${config.emojis.error} An error occurred while fetching the points table.`)
                ]
            });
        }
    },
};
