import { CacheType, Interaction } from "discord.js";
import { getChannelIdFromHandle } from "../main/index.js";
import fs from "fs";
import path from 'path';
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDir = process.env.NODE_ENV === "production"
  ? "/app/data"
  : path.join(__dirname, "../data");

const configPath = path.join(baseDir, "guildConfigs.json");
const loadConfig = () => JSON.parse(fs.readFileSync(configPath, "utf8"));

const AddCommand = async (
  interaction: Interaction<CacheType>,
  list: Record<string, string[]>,
  watchlistPath: string
) => {
  if (!interaction.isChatInputCommand()) return;

  console.log(`AddHook by ${interaction.user.globalName} in guild ${interaction.guildId}`);

  const { options } = interaction;
  const config = loadConfig();
  const channelId = config[interaction.guildId!];

  if (!channelId) {
    await interaction.reply({ content: "❌ このサーバーでは通知先が設定されていません。先に /init コマンドを実行してください。" });
    return;
  }

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

  if (interaction) {
    if (!channelIdMatch) {
      await interaction.reply({ content: "❌ チャンネルIDを取得できませんでした。URLを確認してください。" });
      return;
    }

    if (!list[channelId]) list[channelId] = [];
    if (list[channelId].includes(channelIdMatch)) {
      await interaction.reply({ content: "⚠️ すでに登録されています。" });
      return;
    }

    list[channelId].push(channelIdMatch);
    fs.writeFileSync(watchlistPath, JSON.stringify(list, null, 2));
    await interaction.reply({ content: `✅ フックに追加しました！\nhttps://www.youtube.com/channel/${channelIdMatch}`});
  }
}

export default AddCommand;