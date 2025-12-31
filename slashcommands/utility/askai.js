const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// We need to load the dotenv package to access the API key
require('dotenv').config();

// Initialize the Generative AI client with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Define the character limit for each page
const PAGE_LIMIT = 4000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('askai')
        .setDescription('Ask the AI a question.')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('The question you want to ask the AI')
                .setRequired(true)),
    bot_perm: "EMBED_LINKS",
    async execute(interaction) {
        // Get the user's question from the command option
        const question = interaction.options.getString('question');

        try {
            // Defer the reply to show a "Bot is thinking..." message
            await interaction.deferReply();

            // Select the generative model
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            // Send the user's question to the AI model
            const result = await model.generateContent(question);
            const response = await result.response;
            const text = response.text();

            // If the text is within the limit, send a single embed
            if (text.length <= PAGE_LIMIT) {
                const embed = new EmbedBuilder()
                    .setTitle('🤖 AI Response')
                    .setDescription(text)
                    .setColor('Blue')
                    .setFooter({ text: `Asked by ${interaction.user.username}` })
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            // --- Pagination Logic for Long Responses ---

            // 1. Split the text into pages intelligently
            const pages = [];
            const lines = text.split('\n');
            let currentPageText = '';

            for (const line of lines) {
                // If adding the next line would exceed the limit, push the current page and start a new one.
                if (currentPageText.length + line.length + 1 > PAGE_LIMIT) {
                    pages.push(currentPageText);
                    currentPageText = '';
                }
                // Add the line and a newline character to the current page.
                currentPageText += line + '\n';
            }
            // Add the last remaining page
            pages.push(currentPageText);

            let currentPage = 0;

            // 2. Function to create the embed for the current page
            const generateEmbed = (pageIndex) => {
                return new EmbedBuilder()
                    .setTitle('🤖 AI Response')
                    .setDescription(pages[pageIndex])
                    .setColor('Blue')
                    .setFooter({ text: `Page ${pageIndex + 1} of ${pages.length} | Asked by ${interaction.user.username}` })
                    .setTimestamp();
            };

            // 3. Function to create the action row with buttons
            const generateButtons = (pageIndex) => {
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('previous_page')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(pageIndex === 0),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(pageIndex === pages.length - 1)
                );
            };

            // 4. Send the initial message with the first page and buttons
            const initialEmbed = generateEmbed(currentPage);
            const initialComponents = generateButtons(currentPage);
            const message = await interaction.editReply({
                embeds: [initialEmbed],
                components: [initialComponents],
                fetchReply: true
            });

            // 5. Create a component collector to listen for button clicks
            const collector = message.createMessageComponentCollector({
                time: 5 * 60 * 1000 // 5 minutes
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({ content: 'Only the person who asked can change pages.', ephemeral: true });
                    return;
                }

                if (i.customId === 'next_page') {
                    currentPage++;
                } else if (i.customId === 'previous_page') {
                    currentPage--;
                }

                const newEmbed = generateEmbed(currentPage);
                const newComponents = generateButtons(currentPage);

                await i.update({
                    embeds: [newEmbed],
                    components: [newComponents]
                });
            });

            // When the collector ends (e.g., after 5 minutes), disable the buttons
            collector.on('end', async () => {
                const finalComponents = new ActionRowBuilder().addComponents(
                     new ButtonBuilder()
                        .setCustomId('previous_page_disabled')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next_page_disabled')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
                await interaction.editReply({ components: [finalComponents] });
            });

        } catch (error) {
            console.error('Error with AI command:', error);
            await interaction.editReply({ content: 'Sorry, I ran into an error trying to answer that question.', ephemeral: true });
        }
    },
};
