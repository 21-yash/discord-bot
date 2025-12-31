const { readdirSync } = require('fs');
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { createInfoEmbed, createErrorEmbed } = require('../../utils/embed');
const DisabledCommand = require('../../models/DisabledCommand');
const config = require('../../config/config.json');

module.exports = {
    name: 'help',
    aliases: ['h'],
    description: 'Shows all available bot commands.',
    async execute(message, args, client, prefix) {
        
        // --- Command Details Logic ---
        if (args[0]) {
            const commandName = args[0].toLowerCase();
            const command = client.textCommands.get(commandName) || client.textCommands.find(c => c.aliases && c.aliases.includes(commandName));

            if (!command) {
                const embed = createErrorEmbed('Command Not Found', `No command called \`${commandName}\` exists.`);
                return message.reply({ embeds: [embed] });
            }

            const embed = createInfoEmbed(
                `Command: ${command.name}`,
                command.description || 'No description provided.', {
                    fields: [
                        { name: 'Usage', value: `\`${prefix}${command.name} ${command.usage || ''}\``, inline: true },
                        { name: 'Aliases', value: command.aliases ? `\`${command.aliases.join('`, `')}\`` : 'None', inline: false }
                    ],
                    footer: { text: '<> = required, [] = optional' }
                }
            );
            return message.reply({ embeds: [embed] });
        }

        // --- Main Help Menu Logic ---
        const disabledCommands = (await DisabledCommand.find({ guildId: message.guild.id })).map(c => c.commandName);
        let categories = [];
        const categoryDirs = readdirSync('./textcommands/'); // Adjust path

        for (const dir of categoryDirs) {
            // Skip the owner category so it doesn't show up in the help menu
            if (dir.toLowerCase() === 'owner') continue;

            const commands = readdirSync(`./textcommands/${dir}/`).filter(file => file.endsWith('.js'));
            // Store the full command object for later use
            const availableCmds = commands.map(file => {
                const command = require(`../../textcommands/${dir}/${file}`);
                return command.name && !disabledCommands.includes(command.name) ? command : null;
            }).filter(Boolean);

            if (availableCmds.length > 0) {
                categories.push({
                    directory: dir.charAt(0).toUpperCase() + dir.slice(1),
                    commands: availableCmds
                });
            }
        }

        const homeEmbed = createInfoEmbed(
            `${client.user.username} Help Menu`,
            `Welcome to the help menu! Please choose a category from the dropdown below to see the list of available commands.\n\nUse \`${prefix}help <command>\` for more details on a specific command.`
        );

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_menu_select')
            .setPlaceholder('Choose a command category...')
            .addOptions([{
                label: 'Home',
                description: 'Return to the main help menu',
                value: 'home',
                emoji: '🏠'
            }]);

        for (const cat of categories) {
            selectMenu.addOptions({
                label: cat.directory,
                description: `Commands from the ${cat.directory} category.`,
                value: cat.directory.toLowerCase()
            });
        }

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const reply = await message.reply({ embeds: [homeEmbed], components: [row] });

        const collector = reply.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id,
            time: 60000 // 60 seconds
        });

        collector.on('collect', async i => {
            const selection = i.values[0];

            if (selection === 'home') {
                await i.update({ embeds: [homeEmbed] });
                return;
            }

            const category = categories.find(cat => cat.directory.toLowerCase() === selection);
            
            // Format the command list as requested
            const commandList = category.commands.map(cmd => 
                `**${cmd.name}**\n\`${cmd.description || 'No description available.'}\``
            ).join('\n');

            const categoryEmbed = createInfoEmbed(
                `${category.directory} Commands`,
                commandList
            );

            await i.update({ embeds: [categoryEmbed] });
        });

        collector.on('end', () => {
            const disabledRow = new ActionRowBuilder().addComponents(
                selectMenu.setDisabled(true)
            );
            reply.edit({ components: [disabledRow] });
        });
    },
};
