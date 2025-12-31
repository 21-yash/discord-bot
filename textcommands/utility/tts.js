const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
const { createErrorEmbed } = require('../../utils/embed');
const config = require('../../config/config.json');

// Per-guild TTS queues and state
const guildQueues = new Map();

// Supported languages
const LANGUAGES = {
    'en': 'English',
    'hi': 'Hindi',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'ja': 'Japanese',
    'ko': 'Korean',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'it': 'Italian'
};

module.exports = {
    name: 'tts',
    description: 'Text-to-speech in voice channel with queue support',
    usage: '[lang:code] <text> | Example: !tts Hello or !tts lang:hi नमस्ते',
    aliases: ['speak', 'say'],
    user_perm: [],
    bot_perm: [],
    async execute(message, args, client, prefix) {
        const voiceChannel = message.member.voice.channel;

        // Validation
        if (!args.length) {
            const langList = Object.entries(LANGUAGES).map(([code, name]) => `\`${code}\` - ${name}`).join('\n');
            const helpEmbed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setTitle('🔊 Text-to-Speech')
                .setDescription(`Speak text in your voice channel with queue support.`)
                .addFields(
                    { name: 'Usage', value: `\`${prefix}tts <text>\`\n\`${prefix}tts lang:hi <text>\``, inline: false },
                    { name: 'Supported Languages', value: langList, inline: false },
                    { name: 'Examples', value: `\`${prefix}tts Hello world!\`\n\`${prefix}tts lang:hi नमस्ते दुनिया\``, inline: false }
                )
                .setFooter({ text: 'Default language: English (en)' });
            return message.reply({ embeds: [helpEmbed] });
        }

        if (!voiceChannel) {
            return message.reply({ embeds: [createErrorEmbed('Not in Voice Channel', 'You must be in a voice channel to use TTS.')] });
        }

        // Check bot permissions
        const botPermissions = voiceChannel.permissionsFor(client.user);
        if (!botPermissions.has(PermissionFlagsBits.Connect) || !botPermissions.has(PermissionFlagsBits.Speak)) {
            return message.reply({ embeds: [createErrorEmbed('Missing Permissions', 'I need permissions to join and speak in your voice channel!')] });
        }

        // Check if bot is in a different VC
        const existingQueue = guildQueues.get(message.guild.id);
        if (existingQueue && existingQueue.voiceChannel.id !== voiceChannel.id) {
            return message.reply({ embeds: [createErrorEmbed('Bot in Use', 'I am already speaking in another voice channel.')] });
        }

        // Parse language option
        let lang = 'en'; // Default language
        let textArgs = [...args];
        
        if (args[0]?.toLowerCase().startsWith('lang:')) {
            const langCode = args[0].split(':')[1]?.toLowerCase();
            if (LANGUAGES[langCode]) {
                lang = langCode;
                textArgs = args.slice(1);
            } else {
                return message.reply({ embeds: [createErrorEmbed('Invalid Language', `Language \`${langCode}\` is not supported. Use \`${prefix}tts\` to see available languages.`)] });
            }
        }

        let text = textArgs.join(' ');

        if (!text) {
            return message.reply({ embeds: [createErrorEmbed('No Text', 'Please provide some text to speak.')] });
        }

        // Character limit
        if (text.length > 500) {
            return message.reply({ embeds: [createErrorEmbed('Text Too Long', 'Maximum 500 characters allowed per message.')] });
        }

        // ============ TEXT SANITIZATION ============
        const originalText = text;

        // 1. Replace custom Discord emojis with their names (animated and static)
        text = text.replace(/<a?:(\w+):\d+>/g, (match, emojiName) => {
            let name = emojiName.replace('_', ' ');
            return `emoji ${name}`;
        });
        
        // 2. Remove Unicode emojis
        text = text.replace(/\p{Extended_Pictographic}/gu, '');
        
        // 3. Replace user mentions with actual usernames
        text = text.replace(/<@!?(\d+)>/g, (match, userId) => {
            const member = message.guild.members.cache.get(userId);
            if (member) {
                return member.displayName; // Use nickname if available, otherwise username
            }
            const user = client.users.cache.get(userId);
            return user ? user.username : 'someone';
        });
        
        // 4. Replace role mentions with actual role names
        text = text.replace(/<@&(\d+)>/g, (match, roleId) => {
            const role = message.guild.roles.cache.get(roleId);
            return role ? role.name : 'some role';
        });
        
        // 5. Replace channel mentions with actual channel names
        text = text.replace(/<#(\d+)>/g, (match, channelId) => {
            const channel = message.guild.channels.cache.get(channelId);
            return channel ? channel.name : 'some channel';
        });
        
        // 6. Remove URLs
        text = text.replace(/https?:\/\/[^\s]+/gi, 'a link');
        
        // 7. Remove code blocks (``` and `)
        text = text.replace(/```[\s\S]*?```/g, 'code block');
        text = text.replace(/`[^`]+`/g, 'code');
        
        // 8. Remove spoiler tags
        text = text.replace(/\|\|[\s\S]*?\|\|/g, 'spoiler');
        
        // 9. Remove markdown formatting
        text = text.replace(/\*\*(.+?)\*\*/g, '$1'); // Bold
        text = text.replace(/\*(.+?)\*/g, '$1');     // Italic
        text = text.replace(/__(.+?)__/g, '$1');     // Underline
        text = text.replace(/~~(.+?)~~/g, '$1');     // Strikethrough
        
        // 10. Remove excessive whitespace
        text = text.replace(/\s+/g, ' ').trim();
        
        // 11. Remove special characters that break TTS
        text = text.replace(/[<>]/g, '');
        
        // If nothing left after sanitization
        if (!text || text.length < 1) {
            return message.reply({ embeds: [createErrorEmbed('Invalid Text', 'After removing emojis and special characters, there is nothing left to speak.')] });
        }

        // ============ QUEUE MANAGEMENT ============
        const ttsItem = {
            text,
            lang,
            requester: message.author,
            originalText: originalText.substring(0, 100) + (originalText.length > 100 ? '...' : '')
        };

        if (!guildQueues.has(message.guild.id)) {
            // Create new queue for this guild
            const queueData = {
                items: [ttsItem],
                voiceChannel: voiceChannel,
                textChannel: message.channel,
                connection: null,
                player: null,
                isPlaying: false
            };
            guildQueues.set(message.guild.id, queueData);
            
            // React to confirm
            message.react('🔊').catch(() => {});
            
            // Start playing
            playQueue(message.guild.id, client);
        } else {
            // Add to existing queue
            const queue = guildQueues.get(message.guild.id);
            queue.items.push(ttsItem);
            
            // React with queue position
            message.react('📥').catch(() => {});
            
            const queueEmbed = new EmbedBuilder()
                .setColor(config.colors.info)
                .setDescription(`📥 Added to TTS queue (Position: **#${queue.items.length}**)`)
                .setFooter({ text: `Requested by ${message.author.tag}` });
            message.reply({ embeds: [queueEmbed] }).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 5000);
            }).catch(() => {});
        }
    }
};

// ============ PLAY QUEUE FUNCTION ============
async function playQueue(guildId, client) {
    const queue = guildQueues.get(guildId);
    if (!queue || queue.items.length === 0) {
        // Queue empty, cleanup
        if (queue?.connection) {
            queue.connection.destroy();
        }
        guildQueues.delete(guildId);
        return;
    }

    queue.isPlaying = true;
    const currentItem = queue.items[0];

    try {
        // Get audio URL from Google TTS
        const audioUrl = await googleTTS(currentItem.text, currentItem.lang, 1, 10000);

        // Create or reuse connection
        if (!queue.connection || queue.connection.state.status === VoiceConnectionStatus.Destroyed) {
            queue.connection = joinVoiceChannel({
                channelId: queue.voiceChannel.id,
                guildId: guildId,
                adapterCreator: queue.voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: true
            });

            // Handle disconnection
            queue.connection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(queue.connection, VoiceConnectionStatus.Signalling, 5000),
                        entersState(queue.connection, VoiceConnectionStatus.Connecting, 5000)
                    ]);
                } catch {
                    // Disconnected, cleanup
                    if (guildQueues.has(guildId)) {
                        guildQueues.delete(guildId);
                    }
                }
            });
        }

        // Create player if needed
        if (!queue.player) {
            queue.player = createAudioPlayer();
            queue.connection.subscribe(queue.player);

            // Handle player state changes
            queue.player.on(AudioPlayerStatus.Idle, () => {
                // Remove finished item and play next
                const q = guildQueues.get(guildId);
                if (q) {
                    q.items.shift();
                    playQueue(guildId, client);
                }
            });

            queue.player.on('error', (error) => {
                console.error('[TTS] Player error:', error);
                const q = guildQueues.get(guildId);
                if (q) {
                    q.items.shift();
                    playQueue(guildId, client);
                }
            });
        }

        // Create and play resource
        const resource = createAudioResource(audioUrl, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true 
        });
        queue.player.play(resource);

    } catch (error) {
        console.error('[TTS] Error:', error);
        
        // Send error to text channel
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setDescription(`❌ Failed to generate TTS audio: ${error.message}`);
        queue.textChannel.send({ embeds: [errorEmbed] }).catch(() => {});

        // Skip this item and continue
        queue.items.shift();
        playQueue(guildId, client);
    }
}

// ============ CLEANUP ON BOT SHUTDOWN ============
process.on('SIGINT', () => {
    for (const [guildId, queue] of guildQueues) {
        if (queue.connection) {
            queue.connection.destroy();
        }
    }
    guildQueues.clear();
});
