const config = require("./config.json");

let lastYouTubeVideo = null;
let lastTikTokPost = null;

async function checkYouTube(client) {
    try {
        if (!config.youtubeChannelId) return;

        const response = await fetch(
            `https://www.youtube.com/feeds/videos.xml?channel_id=${config.youtubeChannelId}`
        );

        if (!response.ok) {
            throw new Error(`YouTube returned ${response.status}`);
        }

        const xml = await response.text();

        const videoIdMatch = xml.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
        const titleMatch = xml.match(/<media:title>(.*?)<\/media:title>/);

        if (!videoIdMatch || !titleMatch) return;

        const videoId = videoIdMatch[1];
        const title = titleMatch[1];

        if (lastYouTubeVideo === null) {
            lastYouTubeVideo = videoId;
            return;
        }

        if (videoId === lastYouTubeVideo) return;

        lastYouTubeVideo = videoId;

        const channel = await client.channels.fetch(
            config.discordAnnouncementChannelId
        );

        if (!channel) return;

        await channel.send(
            `📺 **C00lkiddStudios uploaded a new YouTube video!**\n\n` +
            `**${title}**\n` +
            `https://www.youtube.com/watch?v=${videoId}`
        );

        console.log(`📺 New YouTube video announced: ${title}`);
    } catch (error) {
        console.error("YouTube check failed:", error.message);
    }
}


async function checkTikTok(client) {
    try {
        if (!config.tiktokUsername) return;

        const rssUrl =
            `https://rsshub.app/tiktok/user/${config.tiktokUsername}`;

        const response = await fetch(rssUrl);

        if (!response.ok) {
            throw new Error(`RSSHub returned ${response.status}`);
        }

        const xml = await response.text();

        const itemMatch = xml.match(
            /<item>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<\/item>/
        );

        if (!itemMatch) return;

        const postUrl = itemMatch[1];
        const title = itemMatch[2];

        if (lastTikTokPost === null) {
            lastTikTokPost = postUrl;
            return;
        }

        if (postUrl === lastTikTokPost) return;

        lastTikTokPost = postUrl;

        const channel = await client.channels.fetch(
            config.discordAnnouncementChannelId
        );

        if (!channel) return;

        await channel.send(
            `🎵 **C00lkiddStudios posted a new TikTok!**\n\n` +
            `**${title}**\n${postUrl}`
        );

        console.log(`🎵 New TikTok announced: ${title}`);
    } catch (error) {
        console.error("TikTok check failed:", error.message);
    }
}


function startMonitoring(client) {
    console.log("🔎 Starting YouTube + TikTok monitoring...");

    checkYouTube(client);
    checkTikTok(client);

    setInterval(() => {
        checkYouTube(client);
        checkTikTok(client);
    }, 60 * 1000);
}


module.exports = {
    startMonitoring
};
