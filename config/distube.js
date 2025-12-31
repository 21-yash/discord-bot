const {
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
} = require("discord.js");
const { DisTube } = require("distube");
const { YtDlpPlugin } = require("@distube/yt-dlp");
const { YouTubePlugin } = require("@distube/youtube");
const { SoundCloudPlugin } = require("@distube/soundcloud");
const { SpotifyPlugin } = require("@distube/spotify");

module.exports = (client) => {
  client.votes = new Collection();

  client.distube = new DisTube(client, {
    plugins: [
      new YouTubePlugin(),
      new SoundCloudPlugin(),
      new SpotifyPlugin(),
      new YtDlpPlugin(),
    ],
  });

  // DisTube events
  client.distube
    .on("playSong", (queue, song) => {
      const channel = queue.textChannel;
      if (channel) {
        const autoplayText = queue.autoplay ? " | 🎵 Autoplay: ON" : "";
        channel.send(
          `🎵 **Now playing:** \`${song.name}\` - \`${song.formattedDuration}\`\nRequested by: <@${song.user.id}>${autoplayText}`
        );
      }
    })
    .on("addSong", (queue, song) => {
      const channel = queue.textChannel;
      if (channel) {
        channel.send(
          `✅ **Added to queue:** \`${song.name}\` - \`${song.formattedDuration}\`\nRequested by: <@${song.user.id}>`
        );
      }
    })
    .on("addList", (queue, playlist) => {
      const channel = queue.textChannel;
      if (channel) {
        channel.send(
          `✅ **Added playlist:** \`${playlist.name}\` (${playlist.songs.length} songs)\nRequested by: <@${playlist.user.id}>`
        );
      }
    })
    .on("error", (channel, error) => {
      if (channel) {
        channel.send(`❌ **Error:** ${error.toString().slice(0, 1000)}`);
      }
      console.error("DisTube Error:", error);
    })
    .on("empty", (queue) => {
      const channel = queue.textChannel;
      if (channel) {
        channel.send("❌ Voice channel is empty! Leaving...");
      }
    })
    .on("finish", (queue) => {
      const channel = queue.textChannel;
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor("#00ff00")
          .setTitle("✅ Queue Finished")
          .setDescription("All songs have been played! The queue is now empty.")
          .addFields(
            {
              name: "🎵 Want more music?",
              value: "Use `play <song>` to add new songs!",
              inline: false,
            },
            {
              name: "🤖 Autoplay",
              value: queue.autoplay
                ? "Autoplay was enabled but no similar songs were found"
                : "Use `autoplay` to enable automatic song suggestions",
              inline: false,
            }
          )
          .setTimestamp();

        channel.send({ embeds: [embed] });
      }
    })
    .on("disconnect", (queue) => {
      const channel = queue.textChannel;
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor("#ffaa00")
          .setTitle("👋 Disconnected")
          .setDescription("Left the voice channel. Thanks for listening!")
          .setTimestamp();

        channel.send({ embeds: [embed] });
      }
    })
    .on("searchNoResult", (message, query) => {
      message.channel.send(`❌ No result found for \`${query}\`!`);
    })
    .on("searchInvalidAnswer", (message) => {
      message.channel.send("❌ Invalid number of result.");
    })
    .on("noRelated", (queue) => {
      const channel = queue.textChannel;
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor("#ffaa00")
          .setTitle("🎵 Autoplay - No Related Songs")
          .setDescription(
            "Autoplay is enabled but no related songs were found."
          )
          .addFields({
            name: "💡 Suggestion",
            value: "Try adding a new song with `play <song>`",
            inline: false,
          })
          .setTimestamp();

        channel.send({ embeds: [embed] });
      }
    });
};
