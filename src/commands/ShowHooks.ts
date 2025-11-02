import { CacheType, Interaction } from "discord.js";

const ListCommand = async (interaction: Interaction<CacheType>, list: Record<string, string[]>) => {
  if (!interaction.isChatInputCommand()) return;
  const { channelId } = interaction;
  const targets = list[channelId] || [];
  if (targets.length === 0) {
    await interaction.reply("📭 現在のフックはありません。");
  } else {
    await interaction.reply("📺 現在のフックリスト:\n" + targets.map((x: string) => `- https://www.youtube.com/channel/${x}`).join("\n"));
  }
}

export default ListCommand;