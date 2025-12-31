const { EmbedBuilder } = require('discord.js');
const CricketPointsTable = require('../../models/CricketPointsTable');
const config = require('../../config/config.json');

module.exports = {
    name: 'updateteam',
    description: 'Update a team\'s stats in the points table',
    aliases: ['ut', 'editteam', 'setteam'],
    usage: '<team_name> <matches> <wins> <losses> <points> <nrr>',
    user_perm: ['ManageGuild'],
    bot_perm: [],
    async execute(message, args, client, prefix) {
        if (args.length < 6) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.error)
                        .setDescription(
                            `${config.emojis.error} Invalid arguments.\n` +
                            `**Usage:** \`${prefix}updateteam <team_name> <matches> <wins> <losses> <points> <nrr>\`\n` +
                            `**Example:** \`${prefix}updateteam Yash 5 5 0 10 16.98\``
                        )
                ]
            });
        }

        // Parse arguments - last 5 are stats, rest is team name
        const nrr = parseFloat(args.pop());
        const points = parseInt(args.pop());
        const losses = parseInt(args.pop());
        const wins = parseInt(args.pop());
        const matches = parseInt(args.pop());
        const teamName = args.join(' ');

        // Validate numbers
        if (isNaN(matches) || isNaN(wins) || isNaN(losses) || isNaN(points) || isNaN(nrr)) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.error)
                        .setDescription(`${config.emojis.error} Please provide valid numbers for stats.`)
                ]
            });
        }

        try {
            let pointsTable = await CricketPointsTable.findOne({ guildId: message.guild.id });
            
            if (!pointsTable) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.colors.error)
                            .setDescription(`${config.emojis.error} No points table found. Use \`${prefix}addteam\` first.`)
                    ]
                });
            }

            // Find the team
            const team = pointsTable.teams.find(t => 
                t.teamName.toLowerCase() === teamName.toLowerCase()
            );

            if (!team) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.colors.error)
                            .setDescription(`${config.emojis.error} Team **${teamName}** not found in the points table.`)
                    ]
                });
            }

            // Update the team stats
            team.matches = matches;
            team.wins = wins;
            team.losses = losses;
            team.points = points;
            team.nrr = nrr;

            // Re-sort and save
            pointsTable.sortTeams();
            await pointsTable.save();

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.success)
                        .setDescription(
                            `${config.emojis.success} Updated **${team.teamName}**'s stats:\n` +
                            `**M:** ${matches} | **W:** ${wins} | **L:** ${losses} | **P:** ${points} | **NRR:** ${nrr.toFixed(2)}`
                        )
                ]
            });

        } catch (error) {
            console.error('[UpdateTeam] Error:', error);
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.error)
                        .setDescription(`${config.emojis.error} An error occurred while updating the team.`)
                ]
            });
        }
    },
};
