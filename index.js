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

// Discord config
const TOKEN = process.env.DISCORD_TOKEN;

const ADMIN_ROLE_ID = "1497273062788436139";

const BYPASS_ROLE_IDS = [
  "1189268802890895470",
  "1189269691248681020"
];

const CIVILIAN_ROLE_ID = "1361747874731266169";
const CHANNEL_ID = "1382350689568821249";

// Θυμάται ΜΟΝΟ όσους έκανε mute το bot
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

async function updateVoiceMuteState(guild) {
  try {
    const channel = guild.channels.cache.get(CHANNEL_ID);

    if (!channel) {
      console.log("Voice channel not found");
      return;
    }

    const members = [...channel.members.values()];

    console.log(`Checking voice channel. Members inside: ${members.length}`);

    const hasAccessInside = members.some(member => {
      const isAdmin = member.roles.cache.has(ADMIN_ROLE_ID);
      const isBypass = hasAnyRole(member, BYPASS_ROLE_IDS);
      return isAdmin || isBypass;
    });

    console.log(`Admin/Bypass inside: ${hasAccessInside}`);

    for (const member of members) {
      try {
        if (!member || !member.voice || !member.voice.channel) continue;
        if (member.user.bot) continue;

        const isAdmin = member.roles.cache.has(ADMIN_ROLE_ID);
        const isBypass = hasAnyRole(member, BYPASS_ROLE_IDS);
        const isCivilian = member.roles.cache.has(CIVILIAN_ROLE_ID);

        const shouldAutoMute =
          isCivilian &&
          !isAdmin &&
          !isBypass &&
          !hasAccessInside;

        console.log(
          `${member.user.tag} | civilian:${isCivilian} admin:${isAdmin} bypass:${isBypass} shouldAutoMute:${shouldAutoMute} serverMute:${member.voice.serverMute}`
        );

        // Αν πρέπει να τον κάνει mute το bot
        if (shouldAutoMute) {
          if (!member.voice.serverMute) {
            await member.voice.setMute(true, "Auto mute: no admin/bypass inside");
            console.log(`Auto muted: ${member.user.tag}`);
          }

          botMutedUsers.add(member.id);
          continue;
        }

        // Αν ΔΕΝ πρέπει να είναι auto-muted,
        // το bot βγάζει mute ΜΟΝΟ αν το είχε βάλει το ίδιο.
        if (botMutedUsers.has(member.id)) {
          if (member.voice.serverMute) {
            await member.voice.setMute(false, "Auto unmute: admin/bypass inside");
            console.log(`Auto unmuted: ${member.user.tag}`);
          }

          botMutedUsers.delete(member.id);
        }

      } catch (memberError) {
        console.error(`Member error for ${member?.user?.tag || "unknown"}:`, memberError);
      }
    }

  } catch (error) {
    console.error("updateVoiceMuteState error:", error);
  }
}

client.once("clientReady", async () => {
  console.log(`Bot online as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    await updateVoiceMuteState(guild);
  }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
    const guild = newState.guild || oldState.guild;

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    if (oldChannelId === CHANNEL_ID || newChannelId === CHANNEL_ID) {
      console.log("Voice state changed in target channel");
      await updateVoiceMuteState(guild);
    }

  } catch (error) {
    console.error("voiceStateUpdate error:", error);
  }
});

client.on("error", error => {
  console.error("Discord client error:", error);
});

client.on("warn", warning => {
  console.warn("Discord warning:", warning);
});

process.on("unhandledRejection", error => {
  console.error("UNHANDLED REJECTION:", error);
});

process.on("uncaughtException", error => {
  console.error("UNCAUGHT EXCEPTION:", error);
});

if (!TOKEN) {
  console.error("DISCORD_TOKEN is missing from Railway Variables");
  process.exit(1);
}

client.login(TOKEN);
client.login(TOKEN);
