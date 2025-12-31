const { EmbedBuilder } = require('discord.js');
const CricketPointsTable = require('../../models/CricketPointsTable');
const config = require('../../config/config.json');

module.exports = {
    name: 'removeteam',
    description: 'Remove a team from the points table',
    aliases: ['rt', 'deleteteam', 'delteam'],
    usage: '<team_name>',
    user_perm: ['ManageGuild'],
    bot_perm: [],
    async execute(message, args, client, prefix) {
        if (args.length === 0) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.error)
                        .setDescription(`${config.emojis.error} Please provide a team name.\n**Usage:** \`${prefix}removeteam <team_name>\``)
                ]
            });
        }

        const teamName = args.join(' ');

        try {
            let pointsTable = await CricketPointsTable.findOne({ guildId: message.guild.id });
            
            if (!pointsTable) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.colors.error)
                            .setDescription(`${config.emojis.error} No points table found for this server.`)
                    ]
                });
            }

            // Find the team index
            const teamIndex = pointsTable.teams.findIndex(t => 
                t.teamName.toLowerCase() === teamName.toLowerCase()
            );

            if (teamIndex === -1) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.colors.error)
                            .setDescription(`${config.emojis.error} Team **${teamName}** not found in the points table.`)
                    ]
                });
            }

            const removedTeam = pointsTable.teams[teamIndex].teamName;
            pointsTable.teams.splice(teamIndex, 1);

            // Re-sort and save
            pointsTable.sortTeams();
            await pointsTable.save();

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.success)
                        .setDescription(`${config.emojis.success} Team **${removedTeam}** has been removed from the points table.`)
                ]
            });

        } catch (error) {
            console.error('[RemoveTeam] Error:', error);
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.error)
                        .setDescription(`${config.emojis.error} An error occurred while removing the team.`)
                ]
            });
        }
    },
};
