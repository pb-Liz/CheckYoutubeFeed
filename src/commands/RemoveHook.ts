import { CacheType, Interaction } from "discord.js";
import { getChannelIdFromHandle } from "../main/index.js";
import fs from "fs";

const RemoveCommand = async (
  interaction: Interaction<CacheType>,
  list: Record<string, string[]>,
  watchlistPath: string,
) => {
  if (!interaction.isChatInputCommand()) return;
  const { options, channelId} = interaction;
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
    await interaction.reply({ content: "⚠️ 指定されたチャンネルは登録されていません。"});
    return;
  }

  list[channelId] = list[channelId].filter((id: string) => id !== channelIdMatch);
  fs.writeFileSync(watchlistPath, JSON.stringify(list, null, 2));
  await interaction.reply({ content: `🗑️ 削除しました: ${url}`});
}

export default RemoveCommand;