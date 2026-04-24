const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

// Web server για UptimeRobot / Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Discord bot is alive.");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// Discord bot config
const TOKEN = process.env.DISCORD_TOKEN;

const ADMIN_ROLE_ID = "1497273062788436139";
const BYPASS_ROLE_IDS = [
  "1189268802890895470",
  "1189269691248681020"
];
const CIVILIAN_ROLE_ID = "1361747874731266169";
const CHANNEL_ID = "1382350689568821249";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

function hasAnyRole(member, roleIds) {
  return roleIds.some(roleId => member.roles.cache.has(roleId));
}

async function updateVoiceMuteState(guild) {
  const channel = guild.channels.cache.get(CHANNEL_ID);
  if (!channel || !channel.members) return;

  const members = [...channel.members.values()];

  const hasAdminInside = members.some(member =>
    member.roles.cache.has(ADMIN_ROLE_ID)
  );

  for (const member of members) {
    if (member.user.bot) continue;

    const isAdmin = member.roles.cache.has(ADMIN_ROLE_ID);
    const isBypass = hasAnyRole(member, BYPASS_ROLE_IDS);
    const isCivilian = member.roles.cache.has(CIVILIAN_ROLE_ID);

    const shouldMute =
      isCivilian &&
      !isAdmin &&
      !isBypass &&
      !hasAdminInside;

    try {
      if (member.voice.mute !== shouldMute) {
        await member.voice.setMute(
          shouldMute,
          shouldMute
            ? "Auto mute: no admin inside voice channel"
            : "Auto unmute: admin inside voice channel or bypass/admin role"
        );
      }
    } catch (err) {
      console.error(`Failed to update ${member.user.tag}:`, err.message);
    }
  }
}

client.once("ready", async () => {
  console.log(`Bot online as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    await updateVoiceMuteState(guild);
  }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  const guild = newState.guild || oldState.guild;

  if (
    oldState.channelId === CHANNEL_ID ||
    newState.channelId === CHANNEL_ID
  ) {
    await updateVoiceMuteState(guild);
  }
});

client.login(TOKEN);
