import { CacheType, Interaction, MessageFlags } from "discord.js";

const ListCommand = async (interaction: Interaction<CacheType>, list: Record<string, string[]>) => {
  if (!interaction.isChatInputCommand()) return;

  console.log(`ShowHooks by ${interaction.user.globalName} in guild ${interaction.guildId}`);

  const { channelId } = interaction;
  const targets = list[channelId] || [];
  if (targets.length === 0) {
    await interaction.reply({ content: "📭 現在のフックはありません。", flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({content: "📺 現在のフックリスト:\n" + targets.map((x: string) => `- https://www.youtube.com/channel/${x}`).join("\n"), flags: MessageFlags.Ephemeral });
  }
}

export default ListCommand;