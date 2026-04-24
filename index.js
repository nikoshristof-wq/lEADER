const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is alive");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

const TOKEN = process.env.DISCORD_TOKEN;

const ADMIN_ROLE_ID = "1497273062788436139";
const BYPASS_ROLE_IDS = [
  "1189268802890895470",
  "1189269691248681020"
];
const CIVILIAN_ROLE_ID = "1361747874731266169";
const CHANNEL_ID = "1382350689568821249";

// Μόνο όσους έκανε mute το bot
const botMutedUsers = new Set();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

function hasAnyRole(member, roleIds) {
  return roleIds.some(id => member.roles.cache.has(id));
}

async function updateVoiceMuteState(guild) {
  const channel = guild.channels.cache.get(CHANNEL_ID);
  if (!channel) return;

  const members = [...channel.members.values()];

  const hasAccessInside = members.some(member =>
    member.roles.cache.has(ADMIN_ROLE_ID) ||
    hasAnyRole(member, BYPASS_ROLE_IDS)
  );

  for (const member of members) {
    if (member.user.bot) continue;

    const isAdmin = member.roles.cache.has(ADMIN_ROLE_ID);
    const isBypass = hasAnyRole(member, BYPASS_ROLE_IDS);
    const isCivilian = member.roles.cache.has(CIVILIAN_ROLE_ID);

    const shouldAutoMute =
      isCivilian &&
      !isAdmin &&
      !isBypass &&
      !hasAccessInside;

    try {
      // Πρέπει να γίνει auto mute
      if (shouldAutoMute) {
        if (!member.voice.serverMute) {
          await member.voice.setMute(true, "Auto mute: no admin/bypass inside");
        }
        botMutedUsers.add(member.id);
      }

      // Πρέπει να γίνει auto unmute ΜΟΝΟ αν το bot τον είχε κάνει mute
      else {
        if (botMutedUsers.has(member.id)) {
          if (member.voice.serverMute) {
            await member.voice.setMute(false, "Auto unmute: admin/bypass inside");
          }
          botMutedUsers.delete(member.id);
        }
      }

    } catch (err) {
      console.error(`Error with ${member.user.tag}:`, err.message);
    }
  }
}

client.once("clientReady", async () => {
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

process.on("unhandledRejection", error => {
  console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("Uncaught exception:", error);
});

client.login(TOKEN);
