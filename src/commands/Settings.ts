import { Interaction, CacheType } from "discord.js";
import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, "../data/guildConfigs.json");
const loadConfig = () => JSON.parse(fs.readFileSync(configPath, "utf8"));
const saveConfig = (data: object) => fs.writeFileSync(configPath, JSON.stringify(data, null, 2));

const InitCommand = async (interaction: Interaction<CacheType>) => {
  if (!interaction.isChatInputCommand()) return;

    const guildId = interaction.guildId!;
    const channelId = interaction.channelId;

    const config = loadConfig();
    config[guildId] = channelId;
    saveConfig(config);

    await interaction.reply(`✅ このチャンネル (<#${channelId}>) を通知先に登録しました！`);
}

const RemoveSettingCommand = async (interaction: Interaction<CacheType>) => {
  if (!interaction.isChatInputCommand()) return;

  const config = loadConfig();
  delete config[interaction.guildId!];
  saveConfig(config);

  await interaction.reply(`🗑️ 通知先の登録を解除しました。`);
}

export { InitCommand, RemoveSettingCommand };