const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

// 🌐 Web server
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is alive");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// 🔑 CONFIG
const TOKEN = process.env.DISCORD_TOKEN;

const ADMIN_ROLE_ID = "1497273062788436139";
const BYPASS_ROLE_IDS = [
  "1189268802890895470",
  "1189269691248681020"
];
const CIVILIAN_ROLE_ID = "1361747874731266169";
const CHANNEL_ID = "1382350689568821249";

// 🔒 Ποιον έκανε mute το bot
const botMutedUsers = new Set();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

// 🔍 Helper
function hasAnyRole(member, roleIds) {
  return roleIds.some(id => member.roles.cache.has(id));
}

// 🔊 Core Logic
async function updateVoice(guild) {
  const channel = guild.channels.cache.get(CHANNEL_ID);
  if (!channel) return;

  const members = [...channel.members.values()];

  // ΜΟΝΟ admin ξεκλειδώνει
  const hasAdmin = members.some(m =>
    m.roles.cache.has(ADMIN_ROLE_ID)
  );

  for (const member of members) {
    try {
      if (!member.voice.channel) continue;
      if (member.user.bot) continue;

      const isAdmin = member.roles.cache.has(ADMIN_ROLE_ID);
      const isBypass = hasAnyRole(member, BYPASS_ROLE_IDS);
      const isCivilian = member.roles.cache.has(CIVILIAN_ROLE_ID);

      const shouldAutoMute =
        isCivilian &&
        !isAdmin &&
        !isBypass &&
        !hasAdmin;

      // 🔴 AUTO MUTE
      if (shouldAutoMute) {
        if (!member.voice.serverMute) {
          await member.voice.setMute(true, "Auto mute");
        }
        botMutedUsers.add(member.id);
        continue;
      }

      // 🟢 AUTO UNMUTE (ΜΟΝΟ αν το bot τον είχε κάνει mute)
      if (botMutedUsers.has(member.id)) {
        if (member.voice.serverMute) {
          await member.voice.setMute(false, "Auto unmute");
        }
        botMutedUsers.delete(member.id);
      }

    } catch (err) {
      console.error("Member error:", err);
    }
  }
}

// 🚀 READY
client.once("clientReady", async () => {
  console.log(`Bot online as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    await updateVoice(guild);
  }
});

// 🔄 EVENTS
client.on("voiceStateUpdate", async (oldState, newState) => {
  const guild = newState.guild || oldState.guild;

  if (
    oldState.channelId === CHANNEL_ID ||
    newState.channelId === CHANNEL_ID
  ) {
    await updateVoice(guild);
  }
});

// 🛑 ERRORS
process.on("unhandledRejection", e => console.error(e));
process.on("uncaughtException", e => console.error(e));

client.login(TOKEN);
