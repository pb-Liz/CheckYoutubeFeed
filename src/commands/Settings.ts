import { Interaction, CacheType } from "discord.js";
import fs from "fs";
import path from 'path';
import { fileURLToPath } from "url";
import { ADMIN } from "../main/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDir = process.env.NODE_ENV === "production"
  ? "/app/data"
  : path.join(__dirname, "../data");

const configPath = path.join(baseDir, "guildConfigs.json");
const loadConfig = (path: string) => JSON.parse(fs.readFileSync(path, "utf8"));
const saveConfig = (path: string, data: object) => fs.writeFileSync(path, JSON.stringify(data, null, 2));

const InitCommand = async (interaction: Interaction<CacheType>) => {
  if (!interaction.isChatInputCommand()) return;

    const guildId = interaction.guildId!;
    const channelId = interaction.channelId;

    const config = loadConfig(configPath);

    if (config[guildId] && config[guildId] === channelId) {
      await interaction.reply({ content: "⚠️ このチャンネルではすでに通知先が設定されています。"});
      return;
    } else if (config[guildId]) {
      const watchListPath = path.join(baseDir, "watchlist.json");
      const watchlist = loadConfig(watchListPath);
      if (watchlist[config[guildId]]) {
        watchlist[channelId] = watchlist[config[guildId]]; // 既存の通知先からフックを移動
        delete watchlist[config[guildId]]; // 古い通知先のフックを削除
        saveConfig(watchListPath, watchlist);
      }

      config[guildId] = channelId;
      saveConfig(configPath, config);
      
      await interaction.reply({ content: `✅ このチャンネル (<#${channelId}>) を通知先に変更しました！`});
      return;
    }
    
    config[guildId] = channelId;
      saveConfig(configPath, config);

    await interaction.reply({ content: `✅ このチャンネル (<#${channelId}>) を通知先に登録しました！`});
}

const RemoveSettingCommand = async (interaction: Interaction<CacheType>) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const config = loadConfig(configPath);
    delete config[interaction.guildId!];
    saveConfig(configPath, config);
  } catch (err) {
    console.error("通知先解除失敗:", err);
    await interaction.reply({ content: `<@${ADMIN}> ⚠️ 通知先の解除に失敗しました。`});
    return;
  }

  await interaction.reply({ content: `🗑️ 通知先の登録を解除しました。`});
}

export { InitCommand, RemoveSettingCommand };