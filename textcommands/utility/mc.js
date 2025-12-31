const { exec } = require('child_process');

// 🔒 CONFIGURATION (Edit these!)
const ADMIN_ID = ['528933845928771594', '676449565808787457', '1040917333788606524', '934409996622528562', '865429497037324338']; // Copy your ID here so only YOU can use it
const SERVER_PATH = '/home/ubuntu/mc-server'; // The exact folder where bedrock_server is

module.exports = {
    name: 'mc', // The command trigger (e.g., !mc)
    description: 'Control the Minecraft Bedrock Server',
    execute(message, args) {
        
        // 1. Security Check
        if (!ADMIN_ID.includes(message.author.id)) {
            return message.reply("⛔ **Access Denied:** You are not allowed to use this command.");
        }

        const subCommand = args[0]; // e.g., 'start', 'stop', 'cmd'
        const input = args.slice(1).join(' '); // For commands like 'say hello'

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
            message.channel.send("🚀 **Booting up...** (Allow 30s)");
            // Runs the start.sh script inside a detached screen named 'minecraft'
            exec(`cd ${SERVER_PATH} && screen -dmS minecraft ./start.sh`, (error) => {
                if (error) return message.reply(`❌ Failed to start: \`\`\`${error.message}\`\`\``);
            });
            return;
        }

        // --- STOP SERVER ---
        if (subCommand === 'stop') {
            message.channel.send("🛑 **Stopping server...**");
            // Sends the 'stop' command + Enter key (\r) to the console
            exec(`screen -S minecraft -p 0 -X stuff "stop\r"`, (error) => {
                if (error) return message.reply("⚠️ Server is already offline or screen not found.");
            });
            return;
        }

        // --- RUN CONSOLE COMMANDS (e.g., !mc cmd op User) ---
        if (subCommand === 'cmd') {
            if (message.author.id !== '528933845928771594') return message.reply("⛔ **Access Denied:** You are not allowed to use this command.");
            
            if (!input) return message.reply("⚠️ You need to type a command. Example: `!mc cmd time set day`");
            
            exec(`screen -S minecraft -p 0 -X stuff "${input}\r"`, (error) => {
                if (error) return message.reply("⚠️ Server is offline.");
                message.react('✅'); // Reacts with checkmark if sent
            });
            return;
        }

        // --- LIST ONLINE PLAYERS ---
        if (subCommand === 'players' || subCommand === 'list' || subCommand === 'online') {
            // First check if server is online
            exec('screen -list | grep minecraft', (err, stdout) => {
                if (!stdout || !stdout.includes('minecraft')) {
                    return message.channel.send("🔴 **Server is OFFLINE** - No players to show.");
                }

                // Send 'list' command to the server console
                exec(`screen -S minecraft -p 0 -X stuff "list\r"`, (error) => {
                    if (error) return message.reply("⚠️ Failed to send command.");

                    // Wait a moment for the server to respond, then capture the screen
                    setTimeout(() => {
                        const tempFile = `/tmp/mc_screen_${Date.now()}.txt`;
                        
                        // Capture screen content to a file
                        exec(`screen -S minecraft -p 0 -X hardcopy ${tempFile}`, (err2) => {
                            if (err2) return message.reply("⚠️ Failed to read console output.");

                            // Read the captured output
                            exec(`cat ${tempFile} && rm ${tempFile}`, (err3, output) => {
                                if (err3 || !output) {
                                    return message.channel.send("⚠️ Could not read player list.");
                                }

                                // Find the line with player count (format: "There are X/Y players online:")
                                const lines = output.split('\n').filter(l => l.trim());
                                let playerInfo = null;
                                let playerNames = [];

                                for (let i = 0; i < lines.length; i++) {
                                    const line = lines[i];
                                    // Bedrock format: "There are 2/10 players online:"
                                    if (line.includes('players online')) {
                                        playerInfo = line.trim();
                                        // Next line might have player names
                                        if (lines[i + 1] && !lines[i + 1].includes('[')) {
                                            playerNames = lines[i + 1].split(',').map(n => n.trim()).filter(n => n);
                                        }
                                        break;
                                    }
                                }

                                if (playerInfo) {
                                    let response = `🎮 **${playerInfo}**`;
                                    if (playerNames.length > 0) {
                                        response += `\n👥 **Players:** ${playerNames.join(', ')}`;
                                    }
                                    message.channel.send(response);
                                } else {
                                    message.channel.send("🎮 **0 players online** (or couldn't parse output)");
                                }
                            });
                        });
                    }, 500); // 500ms delay to let server respond
                });
            });
            return;
        }

        // --- HELP ---
        message.reply(`**Minecraft Server Commands:**\n\`!mc status\` - Check if online\n\`!mc start\` - Start server\n\`!mc stop\` - Stop server\n\`!mc players\` - List online players\n\`!mc cmd <command>\` - Run console command`);
    }
};