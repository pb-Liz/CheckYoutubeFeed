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
const GUILD_ID = process.env.GUILD_ID  || "";
export const loggerLevel = () => process.env.LOGGER_LEVEL || "info";

export const ADMIN = process.env.ADMIN || "";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDir = process.env.NODE_ENV === "production"
  ? "/app/data"
  : path.join(__dirname, "../data");

export const client = new Client({ intents: [GatewayIntentBits.Guilds] });

if (loggerLevel() === "debug") {
  console.log(`Base Directory: ${baseDir}`);
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

const testCommands = [
  new SlashCommandBuilder().setName("addhook_test").setDescription("YouTubeチャンネルをフックに追加")
    .addStringOption(o => o.setName("url").setDescription("チャンネルURL").setRequired(true)),
  new SlashCommandBuilder().setName("removehook_test").setDescription("フックから削除")
    .addStringOption(o => o.setName("url").setDescription("チャンネルURL").setRequired(true)),
  new SlashCommandBuilder().setName("showhooks_test").setDescription("現在のフックリストを表示"),
  new SlashCommandBuilder().setName("init_test").setDescription("通知チャンネルを登録します"),
  new SlashCommandBuilder().setName("deletesetting_test").setDescription("通知チャンネルを削除します")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  
  if (process.env.NODE_ENV === "production") {
    const config = loadConfig();
    for (const gid of Object.keys(config)) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, gid), { body: [] });
      console.log(`コマンドを初期化しました。 Guild ID: ${gid}`);
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, gid), { body: commands });
    }
  } else {
    // 開発環境ではテストサーバーにのみ登録
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
    console.log(`コマンドを初期化しました。 Guild ID: ${GUILD_ID}（テストサーバー）`);
    // await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: testCommands });
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

  if (commandName.includes("addhook")) {
    try {
      await AddCommand(interaction, list, watchlistPath);
    } catch (err) {
      console.error("フック追加失敗:", err);
      await interaction.reply({ content: `<@${ADMIN}> ⚠️ フックの追加に失敗しました。` });
    }
  
  }

  if (commandName.includes("removehook")) {
    try {
      await RemoveCommand(interaction, list, watchlistPath);
    } catch (err) {
      console.error("フック削除失敗:", err);
      await interaction.followUp({ content: `<@${ADMIN}> ⚠️ フックの削除に失敗しました。` });
    }
    
  }

  if (commandName.includes("showhooks")) {
    try {
      await ListCommand(interaction, list);
    } catch (err) {
      console.error("フック表示失敗:", err);
      await interaction.followUp({ content: `<@${ADMIN}> ⚠️ フックの表示に失敗しました。` });
    }
  }

  if (commandName.includes("init")) {
    try {
      await InitCommand(interaction);
    } catch (err) {
      console.error("通知先登録失敗:", err);
      await interaction.followUp({ content: `<@${ADMIN}> ⚠️ 通知先の登録に失敗しました。` });
    }
  }

  if (commandName.includes("deletesetting")) {
    try {
      await RemoveSettingCommand(interaction);
    } catch (err) {
      console.error("通知先解除失敗:", err);
      await interaction.followUp({ content: `<@${ADMIN}> ⚠️ 通知先の解除に失敗しました。` });
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
