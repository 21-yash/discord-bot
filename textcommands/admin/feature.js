const { createArgEmbed, createSuccessEmbed, createErrorEmbed } = require('../../utils/embed');
const { getChannel } = require('../../utils/functions');
const Config = require('../../models/Config');
const { ChannelType } = require('discord.js');

module.exports = {
    name: 'feature',
    description: 'Enable, disable a category or configure logging for categories in the server.',
    usage: '<enable|disable|log> <feature> [off | #channel | channelID] \n\nEg:1. feature log <feature name> off\n   2. feature enable <feature name> #channel',
    aliases: ['features', 'config'],
    user_perm: ['ManageGuild'],
    bot_perm: [],
    async execute(message, args, client, prefix) {
        const [subcommand, featureName] = args.map(arg => arg?.toLowerCase());
        const validFeatures = ['moderation', 'economy', 'levels'];

        if (!subcommand || !['enable', 'disable', 'log'].includes(subcommand)) {
            const usageEmbed = createArgEmbed(prefix, this.name, this.usage)
                .addFields({ name: 'Available Features', value: `\`${validFeatures.join('`, `')}\`` });
            return message.reply({ embeds: [usageEmbed] });
        }

        if (!featureName || !validFeatures.includes(featureName)) {
            return message.reply({ embeds: [createErrorEmbed('Invalid Feature', `Please provide a valid feature to configure. Available features: \`${validFeatures.join('`, `')}\`.`)] });
        }

        try {
            switch (subcommand) {
                case 'enable': {
                    await Config.findOneAndUpdate(
                        { guildId: message.guild.id },
                        { $set: { [`${featureName}.enabled`]: true } },
                        { upsert: true }
                    );
                    return message.reply({ embeds: [createSuccessEmbed('Feature Enabled', `The **${featureName}** module has been successfully enabled.`)] });
                }

                case 'disable': {
                    await Config.findOneAndUpdate(
                        { guildId: message.guild.id },
                        { $set: { [`${featureName}.enabled`]: false, [`${featureName}.logEnabled`]: false } }, // Also disable logging when the feature is disabled
                        { upsert: true }
                    );
                    return message.reply({ embeds: [createSuccessEmbed('Feature Disabled', `The **${featureName}** module has been successfully disabled.`)] });
                }

                case 'log': {
                    const channelInput = args[2];
                    if (!channelInput) {
                        return message.reply({ embeds: [createArgEmbed(prefix, 'feature log', `${featureName} <#channel|channelID|disable>`)] });
                    }

                    if (['disable', 'off', 'none'].includes(channelInput.toLowerCase())) {
                        await Config.findOneAndUpdate(
                            { guildId: message.guild.id },
                            { $set: { [`${featureName}.logEnabled`]: false, [`${featureName}.logChannel`]: null } },
                            { upsert: true }
                        );
                        return message.reply({ embeds: [createSuccessEmbed('Logging Disabled', `Logging for the **${featureName}** module has been disabled.`)] });
                    }

                    const logChannel = getChannel(message, channelInput);
                    if (!logChannel || logChannel.type !== ChannelType.GuildText) {
                        return message.reply({ embeds: [createErrorEmbed('Invalid Channel', 'You must provide a valid text channel for the logs.')] });
                    }

                    await Config.findOneAndUpdate(
                        { guildId: message.guild.id },
                        { $set: { [`${featureName}.logEnabled`]: true, [`${featureName}.logChannel`]: logChannel.id } },
                        { upsert: true }
                    );
                    return message.reply({ embeds: [createSuccessEmbed('Log Channel Set', `Logs for the **${featureName}** module will now be sent to ${logChannel}.`)] });
                }
            }
        } catch (error) {
            console.error('Feature command error:', error);
            return message.reply({ embeds: [createErrorEmbed('Database Error', 'An error occurred while updating the configuration.')] });
        }
    }
};