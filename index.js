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

// Θυμάται μόνο όσους έκανε mute το bot
const botMutedUsers = new Set();

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

async function updateVoice(guild) {
  const channel = guild.channels.cache.get(CHANNEL_ID);
  if (!channel) return;

  const members = [...channel.members.values()];

  // ΜΟΝΟ admin ξεκλειδώνει το voice
  const hasAdmin = members.some(member =>
    member.roles.cache.has(ADMIN_ROLE_ID)
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

      // Auto mute όταν δεν υπάρχει admin
      if (shouldAutoMute) {
        if (!member.voice.serverMute) {
          await member.voice.setMute(true, "Auto mute: no admin inside");
        }

        botMutedUsers.add(member.id);
        continue;
      }

      // Auto unmute ΜΟΝΟ αν το bot τον είχε κάνει mute
      if (botMutedUsers.has(member.id)) {
        if (member.voice.serverMute) {
          await member.voice.setMute(false, "Auto unmute: admin inside");
        }

        botMutedUsers.delete(member.id);
      }

    } catch (err) {
      console.error(`Member error ${member?.user?.tag || "unknown"}:`, err.message);
    }
  }
}

client.once("clientReady", async () => {
  console.log(`Bot online as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    await updateVoice(guild);
  }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
    const guild = newState.guild || oldState.guild;

    const joinedTarget =
      oldState.channelId !== CHANNEL_ID &&
      newState.channelId === CHANNEL_ID;

    const leftTarget =
      oldState.channelId === CHANNEL_ID &&
      newState.channelId !== CHANNEL_ID;

    const affectedTarget =
      oldState.channelId === CHANNEL_ID ||
      newState.channelId === CHANNEL_ID;

    // Όταν βγει κάποιος, καθαρίζουμε τη μνήμη του bot για αυτόν
    if (leftTarget && oldState.member) {
      botMutedUsers.delete(oldState.member.id);
    }

    // Αν μπήκε/βγήκε/άλλαξε voice state στο target channel
    if (joinedTarget || leftTarget || affectedTarget) {
      await updateVoice(guild);
    }

  } catch (err) {
    console.error("voiceStateUpdate error:", err.message);
  }
});

client.on("error", err => {
  console.error("Discord client error:", err);
});

process.on("unhandledRejection", err => {
  console.error("Unhandled rejection:", err);
});

process.on("uncaughtException", err => {
  console.error("Uncaught exception:", err);
});

if (!TOKEN) {
  console.error("DISCORD_TOKEN is missing");
  process.exit(1);
}

client.login(TOKEN);
