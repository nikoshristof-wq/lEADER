const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

// Web server για Railway / UptimeRobot
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is alive");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// CONFIG
const TOKEN = process.env.DISCORD_TOKEN;

const ADMIN_ROLE_ID = "1497273062788436139";
const BYPASS_ROLE_IDS = [
  "1189268802890895470",
  "1189269691248681020"
];
const CIVILIAN_ROLE_ID = "1361747874731266169";
const CHANNEL_ID = "1382350689568821249";

// Κρατάει όσους έγιναν manual server mute
const manualMutedUsers = new Set();

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

  // Admin ή Bypass μέσα = ξεκλειδώνει το voice
  const hasAccessInside = members.some(member =>
    member.roles.cache.has(ADMIN_ROLE_ID) ||
    hasAnyRole(member, BYPASS_ROLE_IDS)
  );

  for (const member of members) {
    if (member.user.bot) continue;

    const isAdmin = member.roles.cache.has(ADMIN_ROLE_ID);
    const isBypass = hasAnyRole(member, BYPASS_ROLE_IDS);
    const isCivilian = member.roles.cache.has(CIVILIAN_ROLE_ID);

    const shouldMute =
      manualMutedUsers.has(member.id) ||
      (
        isCivilian &&
        !isAdmin &&
        !isBypass &&
        !hasAccessInside
      );

    try {
      if (member.voice.serverMute !== shouldMute) {
        await member.voice.setMute(
          shouldMute,
          shouldMute
            ? "Auto/manual mute active"
            : "Auto unmute: admin/bypass present"
        );
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
  const member = newState.member || oldState.member;

  // Αν κάποιος έγινε server mute/unmute ενώ είναι ήδη μέσα στο συγκεκριμένο voice
  if (
    oldState.channelId === CHANNEL_ID &&
    newState.channelId === CHANNEL_ID &&
    oldState.serverMute !== newState.serverMute
  ) {
    if (newState.serverMute) {
      manualMutedUsers.add(member.id);
      console.log(`Manual mute saved: ${member.user.tag}`);
    } else {
      manualMutedUsers.delete(member.id);
      console.log(`Manual mute removed: ${member.user.tag}`);
    }
  }

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
