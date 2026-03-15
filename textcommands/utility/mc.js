const { exec } = require('child_process');
const cooldowns = new Set();

// 🔒 CONFIGURATION
// Your Admin IDs for basic commands (start/stop)
const ADMIN_IDS = ['528933845928771594', '676449565808787457', '934409996622528562'];
// The ONLY ID allowed to use raw !mc cmd
const OWNER_ID = '528933845928771594';
const SERVER_PATH = '/home/ubuntu/mc-server';

module.exports = {
    name: 'mc',
    description: 'Control the Minecraft Bedrock Server',
    execute(message, args) {

        const subCommand = args[0];
        const input = args.slice(1).join(' ');

        // --- COOLDOWN CHECK ---
        if (cooldowns.has(message.author.id)) {
            return message.reply("⏳ **Slow down!** Please wait 30 seconds between commands.");
        }
        cooldowns.add(message.author.id);
        setTimeout(() => cooldowns.delete(message.author.id), 30000); // 30 second cooldown

        // --- STATUS CHECK ---
        if (!subCommand || subCommand === 'status') {
            exec('screen -list | grep minecraft', (err, stdout) => {
                if (stdout && stdout.includes('minecraft')) {
                    message.channel.send("🟢 **Server Status:** ONLINE");
                } else {
                    message.channel.send("🔴 **Server Status:** OFFLINE");
                }
            });
            return;
        }

        // --- START SERVER ---
        if (subCommand === 'start') {  
            if (!ADMIN_IDS.includes(message.author.id)) {
                return message.reply("⛔ **Access Denied:** You are not allowed to use this command.");
            }

            // Check if already running first
            exec('screen -list | grep minecraft', (err, stdout) => {
                if (stdout && stdout.includes('minecraft')) {
                    return message.reply("⚠️ Server is already running!");
                }

                message.channel.send("🚀 **Booting up...** I will notify you when it's ready.");
                
                exec(`cd ${SERVER_PATH} && screen -dmS minecraft ./start.sh`, (error) => {
                    if (error) return message.reply(`❌ Failed to launch: \`\`\`${error.message}\`\`\``);

                    // --- POLLING FOR SUCCESS ---
                    let attempts = 0;
                    const maxAttempts = 15; // 15 checks * 4s = 60 seconds max wait
                    
                    const checkInterval = setInterval(() => {
                        attempts++;
                        const tempFile = `/tmp/mc_boot_check_${Date.now()}.txt`;

                        // Capture screen to see if "Server started" or "Player connected" style logs appear
                        exec(`screen -S minecraft -p 0 -X hardcopy ${tempFile}`, () => {
                            exec(`cat ${tempFile} && rm ${tempFile}`, (err2, output) => {
                                // Bedrock servers usually print "Server started." or "IPv4 supported" when ready
                                if (output && (output.includes("Server started") || output.includes("Level Name"))) {
                                    clearInterval(checkInterval);
                                    return message.channel.send("✅ **Server successfully booted up!** Enjoy your game.");
                                }

                                if (attempts >= maxAttempts) {
                                    clearInterval(checkInterval);
                                    return message.channel.send("⚠️ **Boot Update:** The server is taking a long time. It might be up, but I couldn't confirm it via logs.");
                                }
                            });
                        });
                    }, 4000); // Check every 4 seconds
                });
            });
            return;
        }

        // --- STOP SERVER ---
        if (subCommand === 'stop') {
            if (!ADMIN_IDS.includes(message.author.id)) {
                return message.reply("⛔ **Access Denied:** You are not allowed to use this command.");
            }

            message.channel.send("🛑 **Server Stopped**");
            exec(`screen -S minecraft -p 0 -X stuff "stop\n"`, (error) => {
                if (error) return message.reply("⚠️ Server is offline or screen not found.");
            });
            return;
        }

        // --- RAW COMMANDS (OWNER ONLY) ---
        if (subCommand === 'cmd') {
            // STRICT check for just YOU
            if (message.author.id !== OWNER_ID) {
                return message.reply("⛔ **Access Denied:** Only the owner can run raw commands.");
            }

            if (!input) return message.reply("⚠️ Type a command. Example: `!mc cmd time set day`");

            // First check if server is online
            exec('screen -list | grep minecraft', (err, stdout) => {
                if (!stdout || !stdout.includes('minecraft')) {
                    return message.reply("⚠️ Server is offline.");
                }

                // Send the command
                exec(`screen -S minecraft -p 0 -X stuff "${input}\n"`, (error) => {
                    if (error) return message.reply("⚠️ Failed to send command.");

                    // Wait and capture the response
                    setTimeout(() => {
                        const tempFile = `/tmp/mc_cmd_${Date.now()}.txt`;
                        
                        exec(`screen -S minecraft -p 0 -X hardcopy ${tempFile}`, () => {
                            exec(`tail -n 20 ${tempFile} && rm ${tempFile}`, (err2, output) => {
                                if (!output) {
                                    return message.reply("✅ Command sent! (Could not capture response)");
                                }

                                // Find relevant response lines (last few non-empty lines)
                                const lines = output.split('\n').filter(l => l.trim());
                                const relevantLines = lines.slice(-5).join('\n').trim();

                                if (relevantLines.length > 0 && relevantLines.length < 1900) {
                                    message.reply(`✅ **Command sent:** \`${input}\`\n\`\`\`\n${relevantLines}\n\`\`\``);
                                } else {
                                    message.reply(`✅ **Command sent:** \`${input}\``);
                                }
                            });
                        });
                    }, 2000); // Wait 2 second for server to process
                });
            });
            return;
        }

        // --- LIST PLAYERS ---
        if (subCommand === 'players' || subCommand === 'list') {
            exec('screen -list | grep minecraft', (err, stdout) => {
                if (!stdout || !stdout.includes('minecraft')) {
                    return message.channel.send("🔴 **Server is OFFLINE**");
                }

                // 1. Send "list" to console (using \n)
                exec(`screen -S minecraft -p 0 -X stuff "list\n"`);

                // 2. Wait 2 second for server to reply, then read the screen
                setTimeout(() => {
                    const tempFile = `/tmp/mc_screen_${Date.now()}.txt`;

                    // Capture the screen text to a file
                    exec(`screen -S minecraft -p 0 -X hardcopy ${tempFile}`, () => {
                        // Read that file
                        exec(`tail -n 50 ${tempFile} && rm ${tempFile}`, (err3, output) => {
                            if (!output) return message.channel.send("⚠️ Could not read console.");

                            // Parse the output to find "players online"
                            const lines = output.split('\n').reverse();
                            let result = "Could not find player list.";

                            for (let i = 0; i < lines.length; i++) {
                                const line = lines[i];
                                if (line.includes("players online")) {
                                    result = line.trim(); // Found the line!

                                    if (lines[i - 1] && !lines[i - 1].includes("INFO")) {
                                        result += "\n" + lines[i - 1].trim();
                                    }
                                    break;
                                }
                            }
                            message.channel.send(`🎮 **${result}**`);
                        });
                    });
                }, 2000); // Wait 2000ms (2 second)
            });
            return;
        }

        // --- HELP ---
        message.reply(`**Minecraft Server Commands:**\n\`!mc status\` - Check if online\n\`!mc start\` - Start server\n\`!mc stop\` - Stop server\n\`!mc players\` - List online players\n\`!mc cmd <command>\` - Run console command`);
    }
};