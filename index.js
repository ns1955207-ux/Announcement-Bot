
const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const fs = require("fs");
const crypto = require("crypto");
const config = require("./config.json");
const { startMonitoring } = require("./monitor");

require("dotenv").config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const POLL_FILE = "./polls.json";

if (!fs.existsSync(POLL_FILE)) {
    fs.writeFileSync(POLL_FILE, JSON.stringify({}, null, 2));
}

function loadPolls() {
    try {
        return JSON.parse(fs.readFileSync(POLL_FILE, "utf8"));
    } catch (error) {
        console.error("Could not load polls:", error);
        return {};
    }
}

let polls = loadPolls();

function savePolls() {
    fs.writeFileSync(POLL_FILE, JSON.stringify(polls, null, 2));
}

const commands = [
    new SlashCommandBuilder()
        .setName("testannouncement")
        .setDescription("Send a test announcement"),

    new SlashCommandBuilder()
        .setName("announce")
        .setDescription("Create a custom announcement")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(option =>
            option.setName("title")
                .setDescription("Announcement title")
                .setRequired(true)
                .setMaxLength(256)
        )
        .addStringOption(option =>
            option.setName("message")
                .setDescription("Announcement message")
                .setRequired(true)
                .setMaxLength(4000)
        ),

    new SlashCommandBuilder()
        .setName("poll")
        .setDescription("Create an interactive poll")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(option =>
            option.setName("question")
                .setDescription("What are you asking?")
                .setRequired(true)
                .setMaxLength(250)
        )
        .addStringOption(option =>
            option.setName("option1")
                .setDescription("First option")
                .setRequired(true)
                .setMaxLength(80)
        )
        .addStringOption(option =>
            option.setName("option2")
                .setDescription("Second option")
                .setRequired(true)
                .setMaxLength(80)
        )
        .addStringOption(option =>
            option.setName("option3")
                .setDescription("Third option (optional)")
                .setMaxLength(80)
        )
        .addStringOption(option =>
            option.setName("option4")
                .setDescription("Fourth option (optional)")
                .setMaxLength(80)
        )
        .addStringOption(option =>
            option.setName("option5")
                .setDescription("Fifth option (optional)")
                .setMaxLength(80)
        )
        .addIntegerOption(option =>
            option.setName("duration")
                .setDescription("Poll duration in minutes (default: 60)")
                .setMinValue(1)
                .setMaxValue(10080)
        ),

    new SlashCommandBuilder()
        .setName("endpoll")
        .setDescription("End an active poll")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(option =>
            option.setName("poll_id")
                .setDescription("The poll ID")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("pollresults")
        .setDescription("View poll results")
        .addStringOption(option =>
            option.setName("poll_id")
                .setDescription("The poll ID")
                .setRequired(true)
        )
];

function getVoteCount(poll, index) {
    return poll.votes[index]?.length || 0;
}

function getTotalVotes(poll) {
    return poll.options.reduce(
        (total, option, index) => total + getVoteCount(poll, index),
        0
    );
}

function buildPollEmbed(poll) {
    const total = getTotalVotes(poll);

    const embed = new EmbedBuilder()
        .setColor(poll.ended ? 0x747F8D : 0x5865F2)
        .setTitle("📊 " + poll.question)
        .setDescription(
            poll.options.map((option, index) => {
                const votes = getVoteCount(poll, index);
                const percent = total
                    ? Math.round((votes / total) * 100)
                    : 0;

                return `**${index + 1}. ${option}**\n` +
                    `${votes} votes • ${percent}%`;
            }).join("\n\n")
        )
        .addFields({
            name: "Total votes",
            value: String(total),
            inline: true
        })
        .addFields({
            name: "Status",
            value: poll.ended ? "🔒 Ended" : "🟢 Voting open",
            inline: true
        })
        .setFooter({
            text: `Poll ID: ${poll.id} • C00lkiddStudios`
        })
        .setTimestamp();

    return embed;
}

function buildPollButtons(poll, disabled = false) {
    const buttons = poll.options.map((option, index) =>
        new ButtonBuilder()
            .setCustomId(`pollvote:${poll.id}:${index}`)
            .setLabel(option)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled || poll.ended)
    );

    return [new ActionRowBuilder().addComponents(buttons)];
}

async function updatePollMessage(poll) {
    try {
        const channel = await client.channels.fetch(poll.channelId);
        if (!channel) return;

        const message = await channel.messages.fetch(poll.messageId);

        await message.edit({
            embeds: [buildPollEmbed(poll)],
            components: buildPollButtons(poll, poll.ended)
        });
    } catch (error) {
        console.error("Could not update poll message:", error.message);
    }
}

async function finishPoll(poll) {
    if (poll.ended) return;

    poll.ended = true;
    poll.endedAt = Date.now();

    savePolls();

    await updatePollMessage(poll);
    console.log(`🔒 Poll ${poll.id} ended.`);
}

async function checkExpiredPolls() {
    const now = Date.now();

    for (const poll of Object.values(polls)) {
        if (!poll.ended && now >= poll.endsAt) {
            await finishPoll(poll);
        }
    }
}

client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    try {
        const rest = new REST({ version: "10" })
            .setToken(process.env.DISCORD_TOKEN);

        const route = process.env.DISCORD_GUILD_ID
            ? Routes.applicationGuildCommands(
                client.user.id,
                process.env.DISCORD_GUILD_ID
            )
            : Routes.applicationCommands(client.user.id);

        await rest.put(route, {
            body: commands.map(command => command.toJSON())
        });

        console.log("✅ All slash commands registered!");
    } catch (error) {
        console.error("Command registration failed:", error);
    }

    await checkExpiredPolls();

    setInterval(checkExpiredPolls, 30000);

    startMonitoring(client);
});

client.on("interactionCreate", async interaction => {

    // Handle poll voting buttons
    if (interaction.isButton() &&
        interaction.customId.startsWith("pollvote:")) {

        const [, pollId, indexString] = interaction.customId.split(":");
        const poll = polls[pollId];
        const index = Number(indexString);

        if (!poll || poll.ended) {
            return interaction.reply({
                content: "🔒 This poll has ended or no longer exists.",
                ephemeral: true
            });
        }

        if (Date.now() >= poll.endsAt) {
            await finishPoll(poll);

            return interaction.reply({
                content: "🔒 This poll has expired.",
                ephemeral: true
            });
        }

        if (!Number.isInteger(index) ||
            index < 0 ||
            index >= poll.options.length) {
            return interaction.reply({
                content: "Invalid poll option.",
                ephemeral: true
            });
        }

        const userId = interaction.user.id;

        // Remove the user's previous vote, if any.
        for (const votes of poll.votes) {
            const oldIndex = votes.indexOf(userId);

            if (oldIndex !== -1) {
                votes.splice(oldIndex, 1);
            }
        }

        // Save the new vote.
        poll.votes[index].push(userId);

        savePolls();

        return interaction.update({
            embeds: [buildPollEmbed(poll)],
            components: buildPollButtons(poll)
        });
    }

    if (!interaction.isChatInputCommand()) return;

    // TEST ANNOUNCEMENT
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

            await channel.send({
                content: "🧪 **TEST ANNOUNCEMENT**\n\nAnnouncement Bot is working! 🎉",
                allowedMentions: { parse: [] }
            });

            await interaction.editReply("✅ Test announcement sent!");
        } catch (error) {
            console.error(error);
            await interaction.editReply("❌ Could not send announcement.");
        }
    }

    // CUSTOM ANNOUNCEMENT
    if (interaction.commandName === "announce") {
        await interaction.deferReply({ ephemeral: true });

        try {
            const title = interaction.options.getString("title");
            const message = interaction.options.getString("message");

            const channel = await client.channels.fetch(
                config.discordAnnouncementChannelId
            );

            if (!channel || !channel.isTextBased()) {
                return interaction.editReply(
                    "❌ Announcement channel not found!"
                );
            }

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(title)
                .setDescription(message)
                .setFooter({
                    text: "C00lkiddStudios • Announcement Bot"
                })
                .setTimestamp();

            await channel.send({
                embeds: [embed],
                allowedMentions: { parse: [] }
            });

            await interaction.editReply(
                "✅ Your announcement has been published!"
            );

            console.log(`📢 Published: ${title}`);
        } catch (error) {
            console.error(error);
            await interaction.editReply("❌ Announcement failed.");
        }
    }

    // CREATE POLL
    if (interaction.commandName === "poll") {
        await interaction.deferReply({ ephemeral: true });

        try {
            const question = interaction.options.getString("question");

            const options = [1, 2, 3, 4, 5]
                .map(number =>
                    interaction.options.getString(`option${number}`)
                )
                .filter(Boolean);

            const duration =
                interaction.options.getInteger("duration") || 60;

            if (options.length < 2) {
                return interaction.editReply(
                    "❌ A poll needs at least two options."
                );
            }

            const channel = await client.channels.fetch(
                config.discordAnnouncementChannelId
            );

            if (!channel || !channel.isTextBased() ||
                !channel.messages) {
                return interaction.editReply(
                    "❌ Announcement channel not found!"
                );
            }

            const id = crypto.randomUUID().slice(0, 8);

            const poll = {
                id,
                question,
                options,
                votes: options.map(() => []),
                channelId: channel.id,
                messageId: null,
                creatorId: interaction.user.id,
                createdAt: Date.now(),
                endsAt: Date.now() + duration * 60000,
                ended: false
            };

            const message = await channel.send({
                embeds: [buildPollEmbed(poll)],
                components: buildPollButtons(poll),
                allowedMentions: { parse: [] }
            });

            poll.messageId = message.id;
            polls[id] = poll;
            savePolls();

            await interaction.editReply(
                `✅ Poll published!\nPoll ID: \`${id}\`\n` +
                `It will close in ${duration} minutes.`
            );

            console.log(`📊 Poll created: ${id}`);

        } catch (error) {
            console.error("Poll creation failed:", error);
            await interaction.editReply(
                "❌ Could not create the poll."
            );
        }
    }

    // END POLL
    if (interaction.commandName === "endpoll") {
        await interaction.deferReply({ ephemeral: true });

        const id = interaction.options.getString("poll_id");
        const poll = polls[id];

        if (!poll) {
            return interaction.editReply("❌ Poll not found.");
        }

        if (poll.ended) {
            return interaction.editReply("This poll has already ended.");
        }

        await finishPoll(poll);

        await interaction.editReply(
            `🔒 Poll ${id} has been closed!\n` +
            `Final votes: ${getTotalVotes(poll)}`
        );
    }

    // POLL RESULTS
    if (interaction.commandName === "pollresults") {
        const id = interaction.options.getString("poll_id");
        const poll = polls[id];

        if (!poll) {
            return interaction.reply({
                content: "❌ Poll not found.",
                ephemeral: true
            });
        }

        return interaction.reply({
            embeds: [buildPollEmbed(poll)],
            ephemeral: true
        });
    }
});

client.on("error", error => {
    console.error("Discord error:", error);
});

client.login(process.env.DISCORD_TOKEN);
