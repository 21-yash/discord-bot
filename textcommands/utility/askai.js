const { createArgEmbed, createErrorEmbed, createLoadingEmbed } = require('../../utils/embed'); // Make sure you have createLoadingEmbed
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const PAGE_LIMIT = 4000;

module.exports = {
    name: 'askai',
    description: 'ask a query to gemini ai',
    usage: '<question>',
    aliases: ['ai'],
    user_perm: [],
    bot_perm: [],
    async execute(message, args, client, prefix) {
        
        if (!args[0]) {
            return await message.reply({ embeds: [
                createArgEmbed(prefix, this.name, this.usage)
            ]});
        }
        
        const question = args.join(' ');

        try {
            // Send a "thinking" message first
            const thinkingMsg = await message.reply({ embeds: [createLoadingEmbed('AI is thinking...')] });

            // Helper to try generation with multiple models
            const generateWithFallback = async (prompt) => {
                // Use verified available models from user's key
                const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-pro-latest'];
                
                let lastError;
                for (const modelName of modelsToTry) {
                    try {
                        const model = genAI.getGenerativeModel({ model: modelName });
                        const result = await model.generateContent(prompt);
                        return result;
                    } catch (error) {
                        console.error(`[AskAI] Model ${modelName} failed:`, error.message);
                        lastError = error;
                        if (!error.message.includes('404') && !error.message.includes('400')) {
                            throw error; 
                        }
                    }
                }
                throw lastError;
            };

            // Send the user's question to the AI model
            const result = await generateWithFallback(question);
            const response = await result.response;
            const text = response.text();

            // If the text is within the limit, edit the original message
            if (text.length <= PAGE_LIMIT) {
                const embed = new EmbedBuilder()
                    .setTitle('🤖 AI Response')
                    .setDescription(text)
                    .setColor('Blue')
                    .setFooter({ text: `Asked by ${message.author.username}` })
                    .setTimestamp();
                await thinkingMsg.edit({ embeds: [embed] });
                return;
            }

            // --- Pagination Logic for Long Responses ---

            const pages = [];
            const lines = text.split('\n');
            let currentPageText = '';

            for (const line of lines) {
                if (currentPageText.length + line.length + 1 > PAGE_LIMIT) {
                    pages.push(currentPageText);
                    currentPageText = '';
                }
                currentPageText += line + '\n';
            }
            pages.push(currentPageText);

            let currentPage = 0;

            const generateEmbed = (pageIndex) => {
                return new EmbedBuilder()
                    .setTitle('🤖 AI Response')
                    .setDescription(pages[pageIndex])
                    .setColor('Blue')
                    .setFooter({ text: `Page ${pageIndex + 1} of ${pages.length} | Asked by ${message.author.username}` })
                    .setTimestamp();
            };

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
            
            // Edit the "thinking" message with the first page and buttons
            const initialEmbed = generateEmbed(currentPage);
            const initialComponents = generateButtons(currentPage);
            await thinkingMsg.edit({
                embeds: [initialEmbed],
                components: [initialComponents]
            });

            // Create a component collector on the bot's reply
            const collector = thinkingMsg.createMessageComponentCollector({
                time: 5 * 60 * 1000 // 5 minutes
            });

            collector.on('collect', async i => {
                // Check if the interactor is the original author
                if (i.user.id !== message.author.id) {
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
                // Edit the bot's reply, not the user's message
                await thinkingMsg.edit({ components: [finalComponents] });
            });

        } catch (error) {
            console.error('Error with AI command:', error);
            await message.reply({ content: 'Sorry, I ran into an error trying to answer that question.' });
        }
    }
};
