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
const GUILD_IDs = process.env.GUILD_ID  || "";

const GUILD_ID = GUILD_IDs.split(",");

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
  new SlashCommandBuilder().setName("addhook").setDescription("YouTubeチャンネルをフックに追加")
    .addStringOption(o => o.setName("url").setDescription("チャンネルURL").setRequired(true)),
  new SlashCommandBuilder().setName("removehook").setDescription("フックから削除")
    .addStringOption(o => o.setName("url").setDescription("チャンネルURL").setRequired(true)),
  new SlashCommandBuilder().setName("showhooks").setDescription("現在のフックリストを表示"),
  new SlashCommandBuilder().setName("init").setDescription("通知チャンネルを登録します"),
  new SlashCommandBuilder().setName("revokesetting").setDescription("通知チャンネルを削除します")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  // await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  
  for (const gid of GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, gid), { body: commands });
  }
  console.log("✅ スラッシュコマンド登録完了");
})();

// ===== コマンド処理 =====
client.on("interactionCreate", async (interaction: Interaction<CacheType>) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const watchlistPath = path.join(__dirname, "../data/watchlist.json");
  const list = fs.existsSync(watchlistPath)
    ? JSON.parse(fs.readFileSync(watchlistPath, "utf8"))
    : {};

  if (commandName === "addhook") {
    await AddCommand(interaction, list, watchlistPath);
  }

  if (commandName === "removehook") {
    await RemoveCommand(interaction, list, watchlistPath);
  }

  if (commandName === "showhooks") {
    await ListCommand(interaction, list);
  }

  if (commandName === "init") {
    await InitCommand(interaction);
  }

  if (commandName === "revokesetting") {
    await RemoveSettingCommand(interaction);
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
