
const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder
} = require("discord.js");

const config = require("./config.json");
const { startMonitoring } = require("./monitor");

require("dotenv").config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const commands = [
    new SlashCommandBuilder()
        .setName("testannouncement")
        .setDescription("Send a test announcement")
];

client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    try {
        const rest = new REST({ version: "10" })
            .setToken(process.env.DISCORD_TOKEN);

        await rest.put(
            process.env.DISCORD_GUILD_ID
                ? Routes.applicationGuildCommands(
                    client.user.id,
                    process.env.DISCORD_GUILD_ID
                )
                : Routes.applicationCommands(client.user.id),
            { body: commands.map(command => command.toJSON()) }
        );

        console.log("✅ Slash commands registered!");
    } catch (error) {
        console.error("Command registration failed:", error);
    }

    startMonitoring(client);
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "testannouncement") {
        await interaction.deferReply({ ephemeral: true });

        try {
            const channel = await client.channels.fetch(
                config.discordAnnouncementChannelId
            );

            if (!channel || !channel.isTextBased()) {
                return interaction.editReply(
                    "❌ Announcement channel not found!"
                );
            }

            await channel.send(
                "🧪 **TEST ANNOUNCEMENT**\n\n" +
                "Announcement Bot is working correctly! 🎉"
            );

            await interaction.editReply(
                "✅ Test announcement sent!"
            );
        } catch (error) {
            console.error(error);

            await interaction.editReply(
                "❌ Couldn't send the test announcement. Check bot permissions."
            );
        }
    }
});

client.on("error", console.error);

client.login(process.env.DISCORD_TOKEN);
