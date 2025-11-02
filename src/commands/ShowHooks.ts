import { CacheType, Interaction, MessageFlags } from "discord.js";
import { ephemeraled } from "../main/index.js";

const ListCommand = async (interaction: Interaction<CacheType>, list: Record<string, string[]>) => {
  if (!interaction.isChatInputCommand()) return;
  const { channelId } = interaction;
  const targets = list[channelId] || [];
  if (targets.length === 0) {
    await interaction.reply({ content: "📭 現在のフックはありません。", flags: ephemeraled ?  MessageFlags.Ephemeral : undefined });
  } else {
    await interaction.reply({content: "📺 現在のフックリスト:\n" + targets.map((x: string) => `- https://www.youtube.com/channel/${x}`).join("\n"), flags: ephemeraled ?  MessageFlags.Ephemeral : undefined });
  }
}

export default ListCommand;