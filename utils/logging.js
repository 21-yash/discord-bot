const { EmbedBuilder } = require('discord.js');
const Config = require('../models/Config');

/**
 * Logs a moderation action to the designated log channel if enabled.
 * @param {object} options The options for the log entry.
 * @param {import('discord.js').Client} options.client The Discord client instance.
 * @param {import('discord.js').GuildMember} options.moderator The moderator who performed the action.
 * @param {string} options.action The name of the action (e.g., 'Kicked', 'Banned', 'Purged').
 * @param {import('discord.js').GuildMember} [options.target] The user who was the target of the action.
 * @param {Array<object>} [options.extras] Extra fields to add to the embed (e.g., [{ name: 'Amount', value: '50' }]).
 */
async function logModerationAction({ client, moderator, action, target, extras }) {
    try {
        const config = await Config.findOne({ guildId: moderator.guild.id });

        // 1. Check if moderation logging is enabled in the database
        if (!config || !config.moderation || !config.moderation.logEnabled || !config.moderation.logChannel) {
            return; // Logging is disabled or not configured, so we do nothing.
        }

        // 2. Fetch the log channel
        const logChannel = await client.channels.fetch(config.moderation.logChannel).catch(() => null);
        if (!logChannel) {
            console.warn(`[Logging] Could not find log channel with ID ${config.moderation.logChannel} for guild ${moderator.guild.id}`);
            return;
        }

        // 3. Create the log embed
        const logEmbed = new EmbedBuilder()
            .setColor('#FFA500') // A neutral orange color for logs
            .setAuthor({ name: moderator.guild.name, iconURL: moderator.guild.iconURL() })
            .setTitle(`${action}`)
            .setTimestamp();
        
        const fields = [
            { name: 'Moderator', value: `${moderator.user.tag} (\`${moderator.id}\`)`, inline: true }
        ];

        if (target) {
            fields.push({ name: 'Target', value: `${target.user.tag} (\`${target.id}\`)`, inline: true });
        }
        
        // Add an empty field to align the layout if there's no target
        if (fields.length % 3 === 2) {
            fields.push({ name: '\u200B', value: '\u200B', inline: true });
        }

        // Add any extra fields provided by the command
        if (extras) {
            fields.push(...extras);
        }

        logEmbed.addFields(fields);

        // 4. Send the log message
        await logChannel.send({ embeds: [logEmbed] });

    } catch (error) {
        console.error('[Logging] Failed to send moderation log:', error);
    }
}

module.exports = { logModerationAction };