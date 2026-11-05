const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once("ready", () => {
    console.log(`✅ Announcement Bot is online as ${client.user.tag}`);
});

client.on("error", (error) => {
    console.error("Discord error:", error);
});

client.login(process.env.DISCORD_TOKEN);
