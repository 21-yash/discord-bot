const { EmbedBuilder } = require('discord.js');
const CricketPointsTable = require('../../models/CricketPointsTable');
const config = require('../../config/config.json');

module.exports = {
    name: 'settournament',
    description: 'Set the tournament name and qualify count for the points table',
    aliases: ['st', 'tournament'],
    usage: '<name> [qualify_count]',
    user_perm: ['ManageGuild'],
    bot_perm: [],
    async execute(message, args, client, prefix) {
        if (args.length === 0) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.error)
                        .setDescription(
                            `${config.emojis.error} Please provide a tournament name.\n` +
                            `**Usage:** \`${prefix}settournament <name> [qualify_count]\`\n` +
                            `**Example:** \`${prefix}settournament IPL Season 2 4\``
                        )
                ]
            });
        }

        // Check if last arg is a number (qualify count)
        let qualifyCount = null;
        let tournamentName = args.join(' ');
        
        const lastArg = args[args.length - 1];
        if (!isNaN(parseInt(lastArg)) && args.length > 1) {
            qualifyCount = parseInt(lastArg);
            args.pop();
            tournamentName = args.join(' ');
        }

        try {
            let pointsTable = await CricketPointsTable.findOne({ guildId: message.guild.id });
            
            if (!pointsTable) {
                pointsTable = new CricketPointsTable({
                    guildId: message.guild.id,
                    teams: [],
                    tournamentName: tournamentName
                });
            } else {
                pointsTable.tournamentName = tournamentName;
            }

            if (qualifyCount !== null) {
                pointsTable.qualifyCount = qualifyCount;
            }

            await pointsTable.save();

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.success)
                        .setDescription(
                            `${config.emojis.success} Tournament settings updated!\n` +
                            `**Name:** ${tournamentName}\n` +
                            `**Qualify Count:** Top ${pointsTable.qualifyCount} players`
                        )
                ]
            });

        } catch (error) {
            console.error('[SetTournament] Error:', error);
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.error)
                        .setDescription(`${config.emojis.error} An error occurred while setting the tournament.`)
                ]
            });
        }
    },
};
