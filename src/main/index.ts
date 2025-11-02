import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, type CacheType, type Interaction } from "discord.js";
import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';
import startWatcher from "./watcher.js";
import dotenv from "dotenv";
import * as cheerio from "cheerio";
dotenv.config();

type Result =
  {
    type: "success";
    channelId: string;
  }
  | {
    type: "error";
    reason:
    | "COULD_NOT_FETCH"
    | "NOT_YOUTUBE_URL"
    | "COULD_NOT_PARSE"
    | "NOT_CHANNEL_URL";
  };

const TOKEN = process.env.DISCORD_TOKEN || "";
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const GUILD_ID = process.env.GUILD_ID || "";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const client = new Client({ intents: [GatewayIntentBits.Guilds] });

(async () => {
  console.log("Starting bot...");
  client.login(TOKEN).then(() => {
    console.log("Logged in successfully!");
    client.user?.setStatus("online");
  }).catch((err) => {
    console.error("Error logging in:", err);
  });
})();

// ===== スラッシュコマンド登録 =====
const commands = [
  new SlashCommandBuilder().setName("add").setDescription("YouTubeチャンネルをフックに追加")
    .addStringOption(o => o.setName("url").setDescription("チャンネルURL").setRequired(true)),
  new SlashCommandBuilder().setName("remove").setDescription("フックから削除")
    .addStringOption(o => o.setName("url").setDescription("チャンネルURL").setRequired(true)),
  new SlashCommandBuilder().setName("list").setDescription("現在のフックリストを表示")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log("✅ スラッシュコマンド登録完了");
})();

// ===== コマンド処理 =====
client.on("interactionCreate", async (interaction: Interaction<CacheType>) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, channelId } = interaction;
  const watchlistPath = path.join(__dirname, "../data/watchlist.json");
  const list = fs.existsSync(watchlistPath)
    ? JSON.parse(fs.readFileSync(watchlistPath, "utf8"))
    : {};

  if (commandName === "add") {
    const url = options.getString("url", true);
    let channelIdMatch: string | undefined = undefined;

    // 1. URLから直接channel_idを取得
    const match = url.match(/channel\/([A-Za-z0-9_-]+)/);
    if (match) {
      channelIdMatch = match[1];
    } else if (url.includes("@")) {
      // 2. @ユーザー名形式のURLなら変換
      try {
        const result = await getChannelIdFromHandle(url);
        if (result) channelIdMatch = result.type === "success" ? result.channelId : undefined;
      } catch (err) {
        console.error("チャンネルID取得失敗:", err);
      }
    }

    if (!channelIdMatch) {
      await interaction.reply("❌ チャンネルIDを取得できませんでした。URLを確認してください。");
      return;
    }

    if (!list[channelId]) list[channelId] = [];
    if (list[channelId].includes(channelIdMatch)) {
      await interaction.reply("⚠️ すでに登録されています。");
      return;
    }

    list[channelId].push(channelIdMatch);
    fs.writeFileSync(watchlistPath, JSON.stringify(list, null, 2));
    await interaction.reply(`✅ フックに追加しました！\nhttps://www.youtube.com/channel/${channelIdMatch}`);
  }


  if (commandName === "remove") {
    const url = options.getString("url", true);
    const match = url.match(/channel\/([A-Za-z0-9_-]+)/);
    let channelIdMatch = "";

    if (match) {
      channelIdMatch = match[1] ? match[1] : "";
    } else if (url.includes("@")) {
      // 2. @ユーザー名形式のURLなら変換
      try {
        const result = await getChannelIdFromHandle(url);
        if (result) channelIdMatch = result.type === "success" ? result.channelId ? result.channelId : "" : "";
      } catch (err) {
        console.error("チャンネルID取得失敗:", err);
      }
    }

    if (!channelIdMatch || !list[channelId]) {
      await interaction.reply("⚠️ 指定されたチャンネルは登録されていません。");
      return;
    }

    list[channelId] = list[channelId].filter((id: string) => id !== channelIdMatch);
    fs.writeFileSync(watchlistPath, JSON.stringify(list, null, 2));
    await interaction.reply(`🗑️ 削除しました: ${url}`);
  }

  if (commandName === "list") {
    const targets = list[channelId] || [];
    if (targets.length === 0) {
      await interaction.reply("📭 現在のフックはありません。");
    } else {
      await interaction.reply("📺 現在のフックリスト:\n" + targets.map((x: string) => `- https://www.youtube.com/channel/${x}`).join("\n"));
    }
  }
});

async function getChannelIdFromHandle(url: string): Promise<Result> {
  try {
    const urlObject = new URL(url);
    if (urlObject.hostname !== "www.youtube.com") {
      return { type: "error", reason: "NOT_YOUTUBE_URL" };
    }
  } catch (error) {
    // URL パースエラー
    return { type: "error", reason: "NOT_YOUTUBE_URL" };
  }

  const response = await fetch(url);
  if (!response.ok) {
    return { type: "error", reason: "COULD_NOT_FETCH" };
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const canonicalUrl = $('link[rel="canonical"]').attr("href");
  if (!canonicalUrl) {
    return { type: "error", reason: "COULD_NOT_PARSE" };
  }

  const channelId = canonicalUrl.match(/channel\/(.*)/)?.[1];
  if (!channelId) {
    return { type: "error", reason: "NOT_CHANNEL_URL" };
  }

  return { type: "success", channelId };
}

client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);
  startWatcher(client);
});

client.login(TOKEN);
