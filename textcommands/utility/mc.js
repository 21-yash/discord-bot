const { exec } = require('child_process');

// 🔒 CONFIGURATION
// Your Admin IDs for basic commands (start/stop)
const ADMIN_IDS = ['528933845928771594', '676449565808787457', '1040917333788606524', '934409996622528562', '865429497037324338'];
// The ONLY ID allowed to use raw !mc cmd
const OWNER_ID = '528933845928771594';
const SERVER_PATH = '/home/ubuntu/mc-server';

module.exports = {
    name: 'mc',
    description: 'Control the Minecraft Bedrock Server',
    execute(message, args) {

        // 1. General Security Check (Anyone in the list can start/stop)
        if (!ADMIN_IDS.includes(message.author.id)) {
            return message.reply("⛔ **Access Denied:** You are not allowed to use this command.");
        }

        const subCommand = args[0];
        const input = args.slice(1).join(' ');

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
            exec(`cd ${SERVER_PATH} && screen -dmS minecraft ./start.sh`, (error) => {
                if (error) return message.reply(`❌ Failed to start: \`\`\`${error.message}\`\`\``);
            });
            return;
        }

        // --- STOP SERVER ---
        if (subCommand === 'stop') {
            message.channel.send("🛑 **Stopping server...**");
            // FIXED: Using \n instead of \r
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

            // FIXED: Using \n
            exec(`screen -S minecraft -p 0 -X stuff "${input}\n"`, (error) => {
                if (error) return message.reply("⚠️ Server is offline.");
                message.react('✅');
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