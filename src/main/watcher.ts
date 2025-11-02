import Parser from "rss-parser";
import schedule from "node-schedule";
import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';
import { Client, TextChannel } from "discord.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`__dirname ${__dirname}`);
const cachePath = path.join(__dirname, "../data/cache.json");
console.log(`cachePath ${cachePath}`);

const parser = new Parser();
let cache: Record<string, string> = {};
if (fs.existsSync(cachePath)) {
  try {
    cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch (e) {
    console.error("⚠️ cache.jsonの読み込みに失敗:", e);
    cache = {};
  }
}

// キャッシュ更新関数
function updateCache(key: string, value: string) {
  cache[key] = value;
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

const startWatcher = (client: Client) => {
  const job = schedule.scheduleJob("*/1 * * * *", async () => {
    const watchlistPath = path.join(__dirname, "../data/watchlist.json");
    if (!fs.existsSync(watchlistPath)) return;
    const list = JSON.parse(fs.readFileSync(watchlistPath, "utf8"));

    for (const [discordChannelId, youtubeIds] of Object.entries(list)) {
      for (const ytId of youtubeIds as string[]) {
        const rss = `https://www.youtube.com/feeds/videos.xml?channel_id=${ytId}`;
        try {
          const feed = await parser.parseURL(rss);
          const latest = feed.items[0];
          if (!latest || !latest.link) continue;

          const videoId = latest.link.split("v=")[1] || latest.link.split("/").pop() || "";

          const cacheKey = `${discordChannelId}_${ytId}`;
          if (cache[cacheKey] === videoId) continue; // 同じならスキップ

          const isFirst = !(cacheKey in cache);
          if (isFirst) {
            console.log(`初回検出: ${cacheKey} - ${videoId}`);
            updateCache(cacheKey, videoId); // 初回はキャッシュ更新のみ
            continue;
          }
          updateCache(cacheKey, videoId); // 新しい動画なら更新

          const channel = client.channels.cache.get(discordChannelId) as TextChannel;
          await channel.send(`📢 **${feed.title}** が新しい動画を投稿しました！\n${latest.link}`);
        } catch (err) {
          console.error(`RSS取得失敗 (${ytId}):`, err);
        }
      }
    }
  });

  console.log("🔔 YouTube監視ジョブ開始 (1分ごと)");
  job.invoke();
}

export default startWatcher;