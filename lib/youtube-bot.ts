"use server";

import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import duration from "dayjs/plugin/duration";

dayjs.extend(utc);
dayjs.extend(duration);

// Configuration - Replace these with your actual values
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";
const YOUTUBE_API_KEY_2 = process.env.YOUTUBE_API_KEY_2 || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const REGION_CODE = "IN";
const YOUTUBE_CATEGORY_ID = "28"; // Science & Technology
const HOURS_TO_SEARCH = 72;

interface VideoData {
  id: string;
  title: string;
  channelTitle: string;
  viewCount: number;
  publishedAt: string;
  url: string;
  durationSeconds: number;
  isShort: boolean;
  indianScore: number;
  techScore: number;
  viewsPerHour: number;
  hoursSincePublished: number;
}

function parseDuration(durationStr: string): number {
  try {
    const duration = dayjs.duration(durationStr);
    return duration.asSeconds();
  } catch {
    return 0;
  }
}

async function findTrendingVideos(): Promise<VideoData[]> {
  const allVideoDetails: Record<string, VideoData> = {};
  let currentApiKey = YOUTUBE_API_KEY;

  const youtube = axios.create({
    baseURL: "https://www.googleapis.com/youtube/v3",
    params: {
      key: currentApiKey,
    },
  });

  const rotateApiKey = () => {
    currentApiKey =
      currentApiKey === YOUTUBE_API_KEY ? YOUTUBE_API_KEY_2 : YOUTUBE_API_KEY;
    youtube.defaults.params.key = currentApiKey;
  };

  try {
    // Strategy 1: Get trending videos in Science & Tech category
    const trendingResponse = await youtube.get("/videos", {
      params: {
        part: "snippet,statistics,contentDetails",
        chart: "mostPopular",
        regionCode: REGION_CODE,
        videoCategoryId: YOUTUBE_CATEGORY_ID,
        maxResults: 50,
      },
    });

    await processVideos(trendingResponse.data.items, allVideoDetails);

    // Strategy 2: Search for tech videos with Indian language keywords
    const techKeywords = [
      "tech news india",
      "tech india",
      "indian tech news",
      "tech review india",
      "tech hindi",
      "tech tamil",
      "tech telugu",
      "tech kannada",
      "indian tech channel",
    ];

    for (const keyword of techKeywords) {
      try {
        const searchResponse = await youtube.get("/search", {
          params: {
            part: "id",
            q: keyword,
            type: "video",
            regionCode: REGION_CODE,
            maxResults: 10,
            order: "viewCount",
            publishedAfter: dayjs()
              .subtract(HOURS_TO_SEARCH, "hours")
              .toISOString(),
          },
        });

        const videoIds = searchResponse.data.items.map(
          (item: any) => item.id.videoId
        );

        if (videoIds.length > 0) {
          const videoResponse = await youtube.get("/videos", {
            params: {
              part: "snippet,statistics,contentDetails",
              id: videoIds.join(","),
            },
          });

          await processVideos(videoResponse.data.items, allVideoDetails);
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          rotateApiKey();
          continue;
        }
        console.error(`Error searching for keyword '${keyword}':`, error);
      }
    }
  } catch (error) {
    console.error("Error fetching videos:", error);
    throw new Error("Failed to fetch trending videos");
  }

  return Object.values(allVideoDetails);
}

async function processVideos(
  items: any[],
  allVideoDetails: Record<string, VideoData>
) {
  const indianIndicators = [
    "india",
    "indian",
    "bharat",
    "hindustan",
    "delhi",
    "mumbai",
    "bangalore",
    "hyderabad",
    "chennai",
    "hindi",
    "tamil",
    "telugu",
    "bengali",
    "marathi",
    "rupees",
    "rs.",
    "rs ",
    "₹",
  ];

  const techIndicators = [
    "tech",
    "technology",
    "gadget",
    "smartphone",
    "laptop",
    "review",
    "unboxing",
    "comparison",
    "vs",
    "launch",
    "mobile",
    "computer",
    "software",
    "hardware",
    "digital",
    "android",
    "ios",
    "windows",
    "apple",
    "samsung",
    "xiaomi",
  ];

  for (const item of items) {
    try {
      const snippet = item.snippet || {};
      const stats = item.statistics || {};
      const contentDetails = item.contentDetails || {};

      const title = snippet.title?.toLowerCase() || "";
      const description = snippet.description?.toLowerCase() || "";
      const channelTitle = snippet.channelTitle?.toLowerCase() || "";

      const indianScore = indianIndicators.reduce(
        (score, keyword) =>
          score +
          (title.includes(keyword) ||
          description.includes(keyword) ||
          channelTitle.includes(keyword)
            ? 1
            : 0),
        0
      );

      const techScore = techIndicators.reduce(
        (score, keyword) =>
          score +
          (title.includes(keyword) ||
          description.includes(keyword) ||
          channelTitle.includes(keyword)
            ? 1
            : 0),
        0
      );

      if (indianScore >= 1 && techScore >= 1) {
        const durationSeconds = parseDuration(
          contentDetails.duration || "PT0S"
        );
        const isShort = durationSeconds <= 60;
        const videoUrl = isShort
          ? `https://www.youtube.com/shorts/${item.id}`
          : `https://www.youtube.com/watch?v=${item.id}`;

        allVideoDetails[item.id] = {
          id: item.id,
          title: snippet.title || "N/A",
          channelTitle: snippet.channelTitle || "N/A",
          viewCount: parseInt(stats.viewCount || "0", 10),
          publishedAt: snippet.publishedAt,
          url: videoUrl,
          durationSeconds,
          isShort,
          indianScore,
          techScore,
          viewsPerHour: 0,
          hoursSincePublished: 0,
        };
      }
    } catch (error) {
      console.error(`Error processing video ${item.id}:`, error);
    }
  }
}

function filterByAge(videos: VideoData[]): VideoData[] {
  const now = dayjs.utc();
  const timeLimit = HOURS_TO_SEARCH;

  return videos.filter((video) => {
    const publishedDate = dayjs(video.publishedAt);
    const hoursSincePublished = now.diff(publishedDate, "hour", true);
    video.hoursSincePublished = hoursSincePublished;
    return hoursSincePublished <= timeLimit;
  });
}

function filterByVirality(videos: VideoData[]): VideoData[] {
  const RECENT_VIEWS_PER_HOUR = 10000;
  const MINIMUM_TOTAL_VIEWS = 72000;

  return videos
    .filter((video) => {
      const viewsPerHour = video.viewCount / video.hoursSincePublished;
      video.viewsPerHour = Math.round(viewsPerHour);

      if (video.hoursSincePublished <= 24) {
        return viewsPerHour >= RECENT_VIEWS_PER_HOUR;
      } else {
        return video.viewCount >= MINIMUM_TOTAL_VIEWS && viewsPerHour >= 1000;
      }
    })
    .sort((a, b) => b.viewsPerHour - a.viewsPerHour);
}

async function sendTelegramReport(videos: VideoData[]): Promise<void> {
  if (!videos.length) {
    console.log("No new viral videos to report on Telegram.");
    return;
  }

  try {
    const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

    const escapeHtml = (text: string): string => {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    };

    let message = "🎯 <b>YouTube Trending Videos Report</b> 🎯\n\n";
    message += "<b>Search Criteria:</b>\n";
    message += `🌍 Region: <code>${escapeHtml(REGION_CODE)}</code>\n`;
    message += `📺 Category ID: <code>${escapeHtml(
      YOUTUBE_CATEGORY_ID
    )}</code>\n`;
    message += `⏰ Time Window: <code>${HOURS_TO_SEARCH}</code> hours\n`;
    message += `📈 Minimum Views/Hour: <code>10,000</code>\n\n`;
    message += `🔥 <b>Results:</b>\n`;
    message += `Found <b>${videos.length}</b> viral video(s) matching criteria\n\n`;
    message += "〰️〰️〰️〰️〰️〰️〰️〰️〰️〰️\n\n";

    for (const [idx, video] of videos.entries()) {
      const section =
        `<b>#${idx + 1}</b>\n` +
        `🎬 <b>Title:</b> ${escapeHtml(video.title)}\n` +
        `📺 <b>Channel:</b> ${escapeHtml(video.channelTitle)}\n` +
        `🚀 <b>Views/Hour:</b> ${video.viewsPerHour.toLocaleString()}\n` +
        `👀 <b>Total Views:</b> ${video.viewCount.toLocaleString()}\n` +
        `⏰ <b>Hours Since Upload:</b> ${video.hoursSincePublished.toFixed(
          1
        )}\n` +
        `🔗 <b>Link:</b> ${video.url}\n\n`;

      if ((message + section).length <= 4096) {
        message += section;
      } else {
        break;
      }
    }

    await bot.sendMessage(TELEGRAM_CHAT_ID, message, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    console.log("✅ Successfully sent Telegram report.");
  } catch (error) {
    console.error("❌ Error sending Telegram report:", error);
    throw new Error("Failed to send Telegram report");
  }
}

export async function startYouTubeBot() {
  console.log("--- Starting YouTube Viral Video Tracker ---");

  // 1. Find all trending videos in the specified category
  const trendingVideos = await findTrendingVideos();

  // 2. Filter that list for videos published in our time window
  const recentTrendingVideos = filterByAge(trendingVideos);

  // 3. From that recent list, filter for videos meeting our virality threshold
  const viralVideos = filterByVirality(recentTrendingVideos);

  console.log(`Found ${viralVideos.length} videos meeting all criteria.`);

  // 4. Send Telegram report
  await sendTelegramReport(viralVideos);

  // 5. Return the videos for UI display
  return {
    videos: viralVideos.map((video) => ({
      title: video.title,
      channelTitle: video.channelTitle,
      viewCount: video.viewCount,
      viewsPerHour: video.viewsPerHour,
      hoursSincePublished: video.hoursSincePublished,
      url: video.url,
    })),
  };
}
