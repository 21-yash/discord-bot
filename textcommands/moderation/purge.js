const { createArgEmbed, createErrorEmbed, createSuccessEmbed, createInfoEmbed, createWarningEmbed } = require('../../utils/embed');
const { getMember } = require('../../utils/functions');
const config = require('../../config/config.json');
const { logModerationAction } = require('../../utils/logging');
const cd = new Map()

module.exports = {
    name: 'purge',
    description: 'Deletes messages with various advanced filters.',
    usage: '<amount> [user | -bots | -users | -links | -invites | -embeds | -images | -files | -mentions]',
    aliases: ['prune'],
    user_perm: ['ManageMessages'],
    bot_perm: ['ManageMessages'],
    async execute(message, args, client, prefix) {

        const feature = await client.isFeatureEnabled(message.guild.id, 'moderation');

        if (!feature) {
            if (cd.has(`${message.guild.id}-${message.author.id}`)) return;

            await message.reply({ embeds: [ 
                createWarningEmbed('Feature Disabled', 'Moderation commands are disabled in this server', 
                    { fields: [ {name: `${config.emojis.tip} Tip`, value: `Use \`${prefix}feature enable moderation\` to enable it.`} ]}) 
            ]})

            cd.set(`${message.guild.id}-${message.author.id}`);
            setTimeout(() => {
                cd.delete(`${message.guild.id}-${message.author.id}`);
            }, 10000);
            return;
        }
        // --- Argument Parsing ---
        const amountArg = args[0];
        const filterArg = args[1]?.toLowerCase();

        // 1. Check for amount
        if (!amountArg) {
            return message.reply({ embeds: [createArgEmbed(prefix, this.name, this.usage)] });
        }

        const amount = parseInt(amountArg);
        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply({ embeds: [createErrorEmbed('Invalid Amount', 'Please provide a number between 1 and 100.')] });
        }

        await message.delete().catch(() => {});

        const fetchedMessages = await message.channel.messages.fetch({ limit: amount });
        let messagesToDelete = fetchedMessages;
        let filterDescription = '';

        if (filterArg) {
            switch (filterArg) {
                case '-bots':
                    messagesToDelete = fetchedMessages.filter(m => m.author.bot);
                    filterDescription = ' from bots';
                    break;
                case '-users':
                    messagesToDelete = fetchedMessages.filter(m => !m.author.bot);
                    filterDescription = ' from users';
                    break;
                case '-links':
                    messagesToDelete = fetchedMessages.filter(m => /(https?:\/\/[^\s]+)/g.test(m.content));
                    filterDescription = ' containing links';
                    break;
                case '-invites':
                    messagesToDelete = fetchedMessages.filter(m => /(discord\.(gg|io|me|li)\/.+|discordapp\.com\/invite\/.+)/i.test(m.content));
                    filterDescription = ' containing invites';
                    break;
                case '-embeds':
                    messagesToDelete = fetchedMessages.filter(m => m.embeds.length > 0);
                    filterDescription = ' containing embeds';
                    break;
                case '-images':
                    messagesToDelete = fetchedMessages.filter(m => m.attachments.some(att => att.contentType?.startsWith('image')));
                    filterDescription = ' containing images';
                    break;
                case '-files':
                    messagesToDelete = fetchedMessages.filter(m => m.attachments.size > 0);
                    filterDescription = ' containing files';
                    break;
                case '-mentions':
                    messagesToDelete = fetchedMessages.filter(m => m.mentions.users.size > 0 || m.mentions.roles.size > 0 || m.mentions.everyone);
                    filterDescription = ' containing mentions';
                    break;
            }

            const targetUser = getMember(message, filterArg);

            if (targetUser) {
                messagesToDelete = fetchedMessages.filter(m => m.author.id === targetUser.id);
                filterDescription = ` from ${targetUser}`;
            }
        }

        if (messagesToDelete.size === 0) {
            const noMessagesEmbed = createInfoEmbed('No Messages Found', `No messages matched your filter criteria.${filterDescription}`);
            const reply = await message.channel.send({ embeds: [noMessagesEmbed] });
            return setTimeout(() => reply.delete().catch(() => {}), 5000);
        }

        try {
            const deleted = await message.channel.bulkDelete(messagesToDelete, true);

            if (deleted.size === 0) {
                return message.channel.send({ 
                    embeds: [createInfoEmbed('No Messages Deleted', 'All matched messages were too old to delete (over 14 days).')] 
                }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
            }
            
            const successEmbed = createSuccessEmbed(
                'Messages Purged',
                `Successfully deleted **${deleted.size}** message(s)${filterDescription}.`
            );
            const reply = await message.channel.send({ embeds: [successEmbed] });
            setTimeout(() => reply.delete().catch(() => {}), 5000); 

            logModerationAction({
                client,
                moderator: message.member,
                action: 'Message Purge',
                extras: [
                    { 
                        name: 'Action',
                        value: `Removed **${deleted.size}** message(s)${filterDescription} in <#${message.channel.id}>`
                    }
                ]
            });

        } catch (error) {
            console.error("Purge command error:", error);
            await message.channel.send({ embeds: [createErrorEmbed('An Error Occurred', 'I was unable to delete the messages. This may be because they are older than 14 days.')] });
        }
    }
};