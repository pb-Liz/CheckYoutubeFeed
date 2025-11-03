import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, type CacheType, type Interaction } from "discord.js";
import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';
import startWatcher from "./watcher.js";
import dotenv from "dotenv";
import * as cheerio from "cheerio";
import AddCommand from "../commands/AddHook.js";
import RemoveCommand from "../commands/RemoveHook.js";
import ListCommand from "../commands/ShowHooks.js";
import {InitCommand, RemoveSettingCommand} from "../commands/Settings.js";

dotenv.config({ quiet: true });

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
const GUILD_IDs = process.env.GUILD_ID  || "";
export const loggerLevel = () => process.env.LOGGER_LEVEL || "info";

export const ADMIN = process.env.ADMIN || "";

const GUILD_ID = GUILD_IDs.split(",");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDir = process.env.NODE_ENV === "production"
  ? "/app/data"
  : path.join(__dirname, "../data");

export const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const date = new Date().toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" });

export const ephemeraled = !(date < "05:00:00" || date > "23:00:00");

if (loggerLevel() === "debug") {
  console.log("===== Debug Info =====");
  console.log(`Base Directory: ${baseDir}`);
  console.log(`Readed GUILD_IDs: ${GUILD_ID}`);
  console.log(`Ephemeral Messages: ${ephemeraled ? "No" : "Yes"}`);
  console.log("======================");
}

const configPath = path.join(baseDir, "guildConfigs.json");
const loadConfig = () => JSON.parse(fs.readFileSync(configPath, "utf8"));

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
  new SlashCommandBuilder().setName("addhook").setDescription("YouTubeチャンネルをフックに追加")
    .addStringOption(o => o.setName("url").setDescription("チャンネルURL").setRequired(true)),
  new SlashCommandBuilder().setName("removehook").setDescription("フックから削除")
    .addStringOption(o => o.setName("url").setDescription("チャンネルURL").setRequired(true)),
  new SlashCommandBuilder().setName("showhooks").setDescription("現在のフックリストを表示"),
  new SlashCommandBuilder().setName("init").setDescription("通知チャンネルを登録します"),
  new SlashCommandBuilder().setName("deletesetting").setDescription("通知チャンネルを削除します")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  
  const config = loadConfig();
  for (const gid of Object.keys(config)) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, gid), { body: [] });
    console.log(`コマンドを初期化しました。 Guild ID: ${gid}`);
    // await rest.put(Routes.applicationGuildCommands(CLIENT_ID, gid), { body: commands });
  }
  console.log("✅ スラッシュコマンド登録完了");
})();

// ===== コマンド処理 =====
client.on("interactionCreate", async (interaction: Interaction<CacheType>) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const watchlistPath = path.join(baseDir, "watchlist.json");
  const list = fs.existsSync(watchlistPath)
    ? JSON.parse(fs.readFileSync(watchlistPath, "utf8"))
    : {};

  if (commandName === "addhook") {
    try {
      await AddCommand(interaction, list, watchlistPath);
    } catch (err) {
      console.error("フック追加失敗:", err);
      await interaction.reply({ content: `<@${ADMIN}> ⚠️ フックの追加に失敗しました。` });
    }
  
  }

  if (commandName === "removehook") {
    try {
      await RemoveCommand(interaction, list, watchlistPath);
    } catch (err) {
      console.error("フック削除失敗:", err);
      await interaction.reply({ content: `<@${ADMIN}> ⚠️ フックの削除に失敗しました。` });
    }
    
  }

  if (commandName === "showhooks") {
    try {
      await ListCommand(interaction, list);
    } catch (err) {
      console.error("フック表示失敗:", err);
      await interaction.reply({ content: `<@${ADMIN}> ⚠️ フックの表示に失敗しました。` });
    }
  }

  if (commandName === "init") {
    try {
      await InitCommand(interaction);
    } catch (err) {
      console.error("通知先登録失敗:", err);
      await interaction.reply({ content: `<@${ADMIN}> ⚠️ 通知先の登録に失敗しました。` });
    }
  }

  if (commandName === "deletesetting") {
    try {
      await RemoveSettingCommand(interaction);
    } catch (err) {
      console.error("通知先解除失敗:", err);
      await interaction.reply({ content: `<@${ADMIN}> ⚠️ 通知先の解除に失敗しました。` });
    }
  }
});

export async function getChannelIdFromHandle(url: string): Promise<Result> {
  // 参考：https://zenn.dev/chot/articles/get-youtube-channel-id
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
