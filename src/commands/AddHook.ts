import { CacheType, Interaction } from "discord.js";
import { getChannelIdFromHandle } from "../main/index.js";
import fs from "fs";

const AddCommand = async (
  interaction: Interaction<CacheType>,
  list: Record<string, string[]>,
  watchlistPath: string
) => {
  if (!interaction.isChatInputCommand()) return;

  const { options, channelId } = interaction;
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
}

export default AddCommand;