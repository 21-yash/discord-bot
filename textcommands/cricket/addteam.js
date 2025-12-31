const { EmbedBuilder } = require('discord.js');
const CricketPointsTable = require('../../models/CricketPointsTable');
const config = require('../../config/config.json');

module.exports = {
    name: 'addteam',
    description: 'Add a team to the points table',
    aliases: ['at', 'newteam'],
    usage: '<team_name>',
    user_perm: ['ManageGuild'],
    bot_perm: [],
    async execute(message, args, client, prefix) {
        if (args.length === 0) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.error)
                        .setDescription(`${config.emojis.error} Please provide a team name.\n**Usage:** \`${prefix}addteam <team_name>\``)
                ]
            });
        }

        const teamName = args.join(' ');

        try {
            // Find or create the points table for this guild
            let pointsTable = await CricketPointsTable.findOne({ guildId: message.guild.id });
            
            if (!pointsTable) {
                pointsTable = new CricketPointsTable({
                    guildId: message.guild.id,
                    teams: []
                });
            }

            // Check if team already exists
            const existingTeam = pointsTable.teams.find(t => 
                t.teamName.toLowerCase() === teamName.toLowerCase()
            );

            if (existingTeam) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.colors.error)
                            .setDescription(`${config.emojis.error} Team **${teamName}** already exists in the points table.`)
                    ]
                });
            }

            // Add the new team
            pointsTable.teams.push({
                teamName: teamName,
                matches: 0,
                wins: 0,
                losses: 0,
                points: 0,
                nrr: 0,
                position: pointsTable.teams.length + 1
            });

            await pointsTable.save();

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.success)
                        .setDescription(`${config.emojis.success} Team **${teamName}** has been added to the points table.\nUse \`${prefix}pointstable\` to view the table.`)
                ]
            });

        } catch (error) {
            console.error('[AddTeam] Error:', error);
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.error)
                        .setDescription(`${config.emojis.error} An error occurred while adding the team.`)
                ]
            });
        }
    },
};
