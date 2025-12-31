const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const CricketPointsTable = require('../../models/CricketPointsTable');
const { generatePointsTable } = require('../../utils/generatePointsTable');
const config = require('../../config/config.json');
const axios = require('axios');

// Initialize Gemini with the VISION_API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = {
    name: 'result',
    description: 'Update points table by uploading a match summary image',
    aliases: ['um', 'matchupdate', 'addmatch', 'updatematch'],
    usage: '<attach match summary image>',
    user_perm: ['ManageGuild'],
    bot_perm: [],
    async execute(message, args, client, prefix) {
        try {
            // Check for attachment
            const attachment = message.attachments.first();
            if (!attachment) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.colors.error)
                            .setDescription(`${config.emojis.error} Please attach a match summary image.\n**Usage:** \`${prefix}updatematch\` with an image attached`)
                    ]
                });
            }

            // Check if it's an image
            if (!attachment.contentType?.startsWith('image/')) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.colors.error)
                            .setDescription(`${config.emojis.error} Please attach a valid image file.`)
                    ]
                });
            }

            // Send processing message
            const processingMsg = await message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.info)
                        .setDescription(`${config.emojis.loading} Reading match summary image...`)
                ]
            });

            // 1. Download the image
            let imageBase64;
            let mimeType;
            try {
                const imageResponse = await axios.get(attachment.url, { responseType: 'arraybuffer' });
                imageBase64 = Buffer.from(imageResponse.data).toString('base64');
                mimeType = attachment.contentType;
            } catch (downloadError) {
                console.error('[UpdateMatch] Image Download Error:', downloadError.message);
                return processingMsg.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.colors.error)
                            .setDescription(`${config.emojis.error} Failed to download image. Error: ${downloadError.message}`)
                    ]
                });
            }

            // 2. Use Gemini to analyze the image
            try {
                // Helper to try generation with multiple models
                const generateWithFallback = async (prompt, imagePart) => {
                    // Use verified available models from user's key
                    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
                    
                    let lastError;
                    for (const modelName of modelsToTry) {
                        try {
                            const model = genAI.getGenerativeModel({ model: modelName });
                            const result = await model.generateContent([
                                prompt,
                                imagePart
                            ]);
                            return result;
                        } catch (error) {
                            console.error(`[UpdateMatch] Model ${modelName} failed:`, error.message);
                            lastError = error;
                            // If it's not a 404/400 (Bad Request/Not Found), it might be another issue, but we continue trying
                            if (!error.message.includes('404') && !error.message.includes('400')) {
                                throw error; // Re-throw strict errors like Auth failure
                            }
                        }
                    }
                    throw lastError;
                };

                const prompt = `Analyze this cricket match summary image and extract the following information in JSON format:
{
    "team1": {
        "name": "team name",
        "runs": number,
        "wickets": number,
        "overs": number (decimal format like 19.2 means 19 overs 2 balls)
    },
    "team2": {
        "name": "team name", 
        "runs": number,
        "wickets": number,
        "overs": number (decimal format)
    },
    "winner": "winning team name exactly as shown",
    "matchNumber": "match number if visible, otherwise null"
}

Important:
- Extract team names exactly as shown in the image (case insensitive matching will be done later)
- Convert overs like "19.2/20.0" to just the balls faced: 19.2
- If wickets are not shown (like for winning team chasing), estimate from context or put 0 if unknown but NOT 10 unless all out.
- Return ONLY the JSON, no other text`;

                const result = await generateWithFallback(prompt, {
                    inlineData: {
                        mimeType: mimeType,
                        data: imageBase64
                    }
                });

                const responseText = result.response.text();
                
                // Extract and Parse the JSON
                let matchData;
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error('No JSON data found in API response');
                matchData = JSON.parse(jsonMatch[0]);

                // 3. Update Metrics logic start
                let pointsTable = await CricketPointsTable.findOne({ guildId: message.guild.id });
                if (!pointsTable) {
                    pointsTable = new CricketPointsTable({
                        guildId: message.guild.id,
                        teams: []
                    });
                }

                // Helper function to convert overs to balls
                const oversToBalls = (overs) => {
                    const fullOvers = Math.floor(overs);
                    const balls = Math.round((overs - fullOvers) * 10);
                    return (fullOvers * 6) + balls;
                };

                // Process both teams
                const team1Data = matchData.team1;
                const team2Data = matchData.team2;
                const winnerName = matchData.winner?.toUpperCase();

                // Find teams (case insensitive)
                let team1 = pointsTable.teams.find(t => 
                    t.teamName.toUpperCase() === team1Data.name.toUpperCase()
                );
                let team2 = pointsTable.teams.find(t => 
                    t.teamName.toUpperCase() === team2Data.name.toUpperCase()
                );

                // Add teams if they don't exist
                if (!team1) {
                    pointsTable.teams.push({ 
                        teamName: team1Data.name, 
                        matches: 0, wins: 0, losses: 0, points: 0, nrr: 0,
                        runsScored: 0, runsConceded: 0, ballsFaced: 0, ballsBowled: 0
                    });
                    team1 = pointsTable.teams[pointsTable.teams.length - 1];
                }
                if (!team2) {
                    pointsTable.teams.push({ 
                        teamName: team2Data.name, 
                        matches: 0, wins: 0, losses: 0, points: 0, nrr: 0,
                        runsScored: 0, runsConceded: 0, ballsFaced: 0, ballsBowled: 0
                    });
                    team2 = pointsTable.teams[pointsTable.teams.length - 1];
                }

                // Calculate balls
                const team1Balls = oversToBalls(team1Data.overs);
                const team2Balls = oversToBalls(team2Data.overs);

                // Update match stats
                team1.matches += 1;
                team2.matches += 1;

                // Determine winner
                const team1IsWinner = winnerName.includes(team1Data.name.toUpperCase());
                const team2IsWinner = winnerName.includes(team2Data.name.toUpperCase());

                if (team1IsWinner) {
                    team1.wins += 1;
                    team1.points += 2;
                    team2.losses += 1;
                } else if (team2IsWinner) {
                    team2.wins += 1;
                    team2.points += 2;
                    team1.losses += 1;
                } else {
                    // Fallback based on runs if name match fails
                    if (team1Data.runs > team2Data.runs) {
                         team1.wins += 1; team1.points += 2; team2.losses += 1;
                    } else {
                         team2.wins += 1; team2.points += 2; team1.losses += 1;
                    }
                }

                // Update NRR Stats (Runs & Balls)
                // Logic: If a team is All Out (10 wickets), they are deemed to have faced the full quota (assume 20 overs = 120 balls for standard T20/Short format implies)
                // If you run mixed formats, we might need a config, but assuming T20 for now since typicalDiscord bot usage.
                
                const getAdjustedBalls = (overs, wickets) => {
                    if (wickets >= 10) return 120; // Force 20 overs (120 balls) if all out
                    return oversToBalls(overs);
                };

                const team1BallsFaced = getAdjustedBalls(team1Data.overs, team1Data.wickets);
                const team2BallsFaced = getAdjustedBalls(team2Data.overs, team2Data.wickets);

                // Team 1 Batting (Scored) / Team 2 Bowling (Conceded)
                team1.runsScored = (team1.runsScored || 0) + team1Data.runs;
                team1.ballsFaced = (team1.ballsFaced || 0) + team1BallsFaced;
                
                team2.runsConceded = (team2.runsConceded || 0) + team1Data.runs;
                team2.ballsBowled = (team2.ballsBowled || 0) + team1BallsFaced; // Balls bowled by T2 is same as faced by T1

                // Team 2 Batting (Scored) / Team 1 Bowling (Conceded)
                team2.runsScored = (team2.runsScored || 0) + team2Data.runs;
                team2.ballsFaced = (team2.ballsFaced || 0) + team2BallsFaced;
                
                team1.runsConceded = (team1.runsConceded || 0) + team2Data.runs;
                team1.ballsBowled = (team1.ballsBowled || 0) + team2BallsFaced;

                // NRR Calculation
                const calculateNRR = (team) => {
                    const oversFaced = team.ballsFaced / 6;
                    const oversBowled = team.ballsBowled / 6;
                    if (oversFaced === 0 || oversBowled === 0) return 0;
                    return (team.runsScored / oversFaced) - (team.runsConceded / oversBowled);
                };

                team1.nrr = calculateNRR(team1);
                team2.nrr = calculateNRR(team2);

                // Sort and Save
                pointsTable.sortTeams();
                pointsTable.markModified('teams'); // Critical: Ensure mixed/array changes are detected
                await pointsTable.save();

                // Generate Result Image
                const imageBuffer = await generatePointsTable(pointsTable);
                const tableAttachment = new AttachmentBuilder(imageBuffer, { name: 'pointstable.png' });

                await processingMsg.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.colors.success)
                            .setTitle(`${config.emojis.success} Match Updated Successfully`)
                            .setDescription(`Analyzed Data from Image:\n**${team1Data.name}**: ${team1Data.runs}/${team1Data.wickets}\n**${team2Data.name}**: ${team2Data.runs}/${team2Data.wickets}`)
                            .setImage('attachment://pointstable.png')
                            .setFooter({ text: `Winner: ${matchData.winner}` })
                    ],
                    files: [tableAttachment]
                });

            } catch (aiError) {
                console.error('[UpdateMatch] AI Error:', aiError);
                // Check for 404 from Google API
                if (aiError.message?.includes('404')) {
                    return processingMsg.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(config.colors.error)
                                .setDescription(`${config.emojis.error} AI Model Error (404). The 'gemini-1.5-flash' model might not be available for this API key.`)
                        ]
                    });
                }
                
                return processingMsg.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(config.colors.error)
                            .setDescription(`${config.emojis.error} Failed to analyze image: ${aiError.message}`)
                    ]
                });
            }

        } catch (error) {
            console.error('[UpdateMatch] General Error:', error);
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.colors.error)
                        .setDescription(`${config.emojis.error} Unexpected error: ${error.message}`)
                ]
            });
        }
    },
};
