// index.js
const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");

/////////////////////////
// JSON Files & Storage
/////////////////////////

let inventory = {};
if (fs.existsSync("./inventory.json")) inventory = JSON.parse(fs.readFileSync("./inventory.json"));
function saveInventory() { fs.writeFileSync("./inventory.json", JSON.stringify(inventory, null, 2)); }

let souls = {};
if (fs.existsSync("./souls.json")) souls = JSON.parse(fs.readFileSync("./souls.json"));
function saveSouls() { fs.writeFileSync("./souls.json", JSON.stringify(souls, null, 2)); }

let wins = {};
if (fs.existsSync("./wins.json")) wins = JSON.parse(fs.readFileSync("./wins.json"));
function saveWins() { fs.writeFileSync("./wins.json", JSON.stringify(wins, null, 2)); }

let messageCounts = {};
if (fs.existsSync("./messageCount.json")) messageCounts = JSON.parse(fs.readFileSync("./messageCount.json"));
function saveMessageCounts() { fs.writeFileSync("./messageCount.json", JSON.stringify(messageCounts, null, 2)); }

/////////////////////////
// Client Setup
/////////////////////////

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const prefix = "sg";
const OWNER_ID = "1282184993321255005"; // your Discord ID
const ANNOUNCEMENT_CHANNEL_ID = "1475913826443722906";
const ESPADA_PARENT_ROLE_ID = "1475606720356290581";
const ESPADA_ROLE_IDS = [
  "1476122833095491708","1476122728422445186","1476123034090995823",
  "1476124047216738388","1476122588953579680","1476123145466282014",
  "1476123319068524644","1476123481308401839","1476123588808409108",
  "1476123850000306176"
];

const COOLDOWN_TIME = 24 * 60 * 60 * 1000; // 1 day
const cooldowns = new Map();
const giveaways = new Map();

/////////////////////////
// Express Server
/////////////////////////
const app = express();
app.get('/', (req, res) => res.send('Szayelaporro is alive!'));
app.listen(process.env.PORT || 3000, () => console.log('Web server running'));

/////////////////////////
// Ready Event
/////////////////////////
client.once('ready', () => console.log("Szayelaporro is online."));

/////////////////////////
// Main Message Handler
/////////////////////////
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // ===== Messages Tracking for Leaderboard =====
  if (message.channel.id === "1475604095711576237") {
    const userId = message.author.id;
    messageCounts[userId] = (messageCounts[userId] || 0) + 1;
    saveMessageCounts();
  }

  // Ignore non-prefix messages
  if (!message.content.toLowerCase().startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  /////////////////////////
  // Espada Challenge Command
  /////////////////////////
  if (command === "challenge") {
    const now = Date.now();
    const userCooldown = cooldowns.get(message.author.id);
    if (userCooldown && now < userCooldown) {
      const remaining = Math.ceil((userCooldown - now) / (60*60*1000));
      return message.reply(`You must wait ${remaining} more hour(s) before challenging again.`);
    }

    const mentionedRoles = message.mentions.roles;
    if (mentionedRoles.size !== 1) return message.reply("You must mention exactly one Espada role.");

    const role = mentionedRoles.first();
    if (!ESPADA_ROLE_IDS.includes(role.id)) return message.reply("You can only challenge an official Espada.");

    const robloxUsername = args.slice(1).join(" ");
    if (!robloxUsername) return message.reply("You must provide your Roblox username after the role mention.");

    const membersWithRole = message.guild.members.cache.filter(m => m.roles.cache.has(role.id));
    if (membersWithRole.size === 0) return message.reply("No one currently holds that Espada rank.");

    membersWithRole.forEach(member => {
      member.send(`${message.author.tag} has challenged you for your Espada title (${role.name}).\nRoblox Username: ${robloxUsername}\n**Only the bot owner can confirm the winner.**`).catch(() => {});
    });

    message.reply("Challenge sent to the Espada. Waiting for owner confirmation.");
    cooldowns.set(message.author.id, now + COOLDOWN_TIME);
  }

  /////////////////////////
  // Confirm Espada Win
  /////////////////////////
  if (command === "confirm") {
    if (message.author.id !== OWNER_ID) return message.reply("Only the bot owner can confirm challenges.");

    const member = message.mentions.members.first();
    const role = message.mentions.roles.first();
    if (!member || !role || !ESPADA_ROLE_IDS.includes(role.id)) return message.reply("You must mention a valid member and Espada role.");

    // Remove role from current holder(s)
    message.guild.members.cache.filter(m => m.roles.cache.has(role.id)).forEach(m => m.roles.remove(role).catch(() => {}));
    // Assign new winner
    member.roles.add(role).catch(() => {});

    // Increment wins
    wins[member.id] = (wins[member.id] || 0) + 1;
    saveWins();

    message.reply(`${member.user.tag} is now the official ${role.name}! They have ${wins[member.id]} wins.`);
  }

  /////////////////////////
  // Announcements
  /////////////////////////
  if (command === "announce") {
    if (!message.member.roles.cache.has(ESPADA_PARENT_ROLE_ID)) return message.reply("Only Espadas can use this command.");
    const announcement = args.join(" ");
    if (!announcement) return message.reply("You must provide an announcement message.");
    const channel = client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
    if (!channel) return message.reply("Announcement channel not found.");
    channel.send(`📢 **ANNOUNCEMENT** 📢\n\n${announcement}`);
    const reply = await message.reply("Announcement sent successfully.");
    setTimeout(() => reply.delete().catch(() => {}), 3000);
  }

  /////////////////////////
  // Giveaway Command
  /////////////////////////
 if (command === "giveaway") {
  const ESPADA_PARENT_ROLE_ID = "1475606720356290581";

  // Only Espadas can start
  if (!message.member.roles.cache.has(ESPADA_PARENT_ROLE_ID)) {
    return message.reply("Only Espadas can start a giveaway.");
  }

  const timeArg = args[0];
  const winnerCount = parseInt(args[1]);
  const prize = args.slice(2).join(" ");

  if (!timeArg || isNaN(winnerCount) || !prize) {
    return message.reply("Usage: sggiveaway <time> <winner count> <prize>");
  }

  // Convert time to milliseconds
  let duration;
  if (timeArg.endsWith("m")) {
    duration = parseInt(timeArg) * 60 * 1000;
  } else if (timeArg.endsWith("h")) {
    duration = parseInt(timeArg) * 60 * 60 * 1000;
  } else if (timeArg.endsWith("d")) {
    duration = parseInt(timeArg) * 24 * 60 * 60 * 1000;
  } else {
    return message.reply("Time must end with m (minutes), h (hours), or d (days).");
  }

  // Send giveaway message
  const giveawayMessage = await message.channel.send(
    `🎉 **GIVEAWAY** 🎉\nPrize: **${prize}**\nWinners: **${winnerCount}**\nEnds in: **${timeArg}**\nReact with 🎉 to enter!`
  );

  // Bot reacts automatically
  await giveawayMessage.react("🎉");

  console.log(`Giveaway started for "${prize}" by ${message.author.tag}, duration: ${duration}ms`);

  // Wait until giveaway ends
  setTimeout(async () => {
    const fetchedMessage = await message.channel.messages.fetch(giveawayMessage.id);
    const reaction = fetchedMessage.reactions.cache.get("🎉");

    if (!reaction) return message.channel.send("No reactions. Giveaway cancelled.");

    const users = await reaction.users.fetch();
    const validUsers = users.filter(u => !u.bot).map(u => u);

    if (validUsers.length === 0) {
      return message.channel.send("No valid entries. Giveaway cancelled.");
    }

    const winners = [];
    while (winners.length < winnerCount && validUsers.length > 0) {
      const randomIndex = Math.floor(Math.random() * validUsers.length);
      const winner = validUsers.splice(randomIndex, 1)[0];
      winners.push(winner);
    }

    message.channel.send(
      `🎊 Congratulations ${winners.map(w => `<@${w.id}>`).join(", ")}!\nYou won **${prize}**!`
    );
    console.log(`Giveaway ended for "${prize}". Winners: ${winners.map(w => w.tag).join(", ")}`);
  }, duration);
}

  /////////////////////////
  // Souls Balance & Shop
  /////////////////////////
  if (message.content === "sgbalance") {
    const userId = message.author.id;
    if (!souls[userId]) souls[userId] = 0;
    message.reply(`You have ${souls[userId]} <:soul:1476731494868455565>.`);
  }

  if (message.content === "sgshop") {
    message.reply(`
:shopping_cart: Soul Shop
:one: challengepass - 1000 Souls  
   :zap: Allows you to PvP with any Espada outside cooldown. Max 2 uses.  
:two: customrole - 3000 Souls  
   :art: Gives you a custom role. Contact staff to set it.
`);
  }

  if (message.content.startsWith("sgbuy")) {
    const item = args[0];
    const userId = message.author.id;
    if (!souls[userId]) souls[userId] = 0;
    if (!inventory[userId]) inventory[userId] = { challengepass: 0, customrole: 0 };

    if (item === "challengepass") {
      if (souls[userId] < 1000) return message.reply("Not enough Souls.");
      souls[userId] -= 1000;
      inventory[userId].challengepass += 1;
      saveSouls(); saveInventory();
      return message.reply("You purchased 1 Challenge Pass. Check your inventory with `sginventory`.");
    }
    if (item === "customrole") {
      if (souls[userId] < 3000) return message.reply("Not enough Souls.");
      souls[userId] -= 3000;
      inventory[userId].customrole += 1;
      saveSouls(); saveInventory();
      return message.reply("You purchased 1 Custom Role. Check your inventory with `sginventory` and use it with `sgusecustomrole`.");
    }
  }

  if (message.content === "sginventory") {
    const userId = message.author.id;
    if (!inventory[userId]) inventory[userId] = { challengepass: 0, customrole: 0 };
    return message.reply(`Your Inventory:\n:dagger: Challenge Passes: ${inventory[userId].challengepass}\n:art: Custom Roles: ${inventory[userId].customrole}`);
  }

  /////////////////////////
  // Use Challenge Pass
  /////////////////////////
  if (message.content.startsWith("sgusechallengepass")) {
    const userId = message.author.id;
    if (!inventory[userId] || inventory[userId].challengepass < 1) return message.reply("You have no Challenge Passes.");

    const espadaRoleId = args[0];
    const robloxUsername = args[1];
    if (!espadaRoleId || !robloxUsername) return message.reply("Usage: sguse <EspadaRoleID> <RobloxUsername>");

    inventory[userId].challengepass -= 1;
    saveInventory();

    const role = message.guild.roles.cache.get(espadaRoleId);
    if (!role) return message.reply("Invalid Espada role.");

    role.members.forEach(member => {
      member.send(`⚡ Challenge Pass Used!\nUser: ${message.author.tag}\nRoblox: ${robloxUsername}\nThey are requesting a 1v1 outside cooldown.`).catch(() => {});
    });

    return message.reply("Your Challenge Pass has been used and the Espada has been notified.");
  }

  /////////////////////////
  // Use Custom Role
  /////////////////////////
  if (message.content === "sgusecustomrole") {
    const userId = message.author.id;
    if (!inventory[userId] || inventory[userId].customrole < 1) return message.reply("You have no Custom Roles to use.");
    inventory[userId].customrole -= 1;
    saveInventory();
    return message.reply("Enter the command to set your custom role like this:\n`sgcustomrole <Role Name> & <Hex Code>`");
  }

  if (message.content.startsWith("sgcustomrole")) {
    const userId = message.author.id;

    if (!inventory[userId] || inventory[userId].customrole < 1)
      return message.reply("You have no Custom Roles to use.");

    const args = message.content.slice("sgcustomrole".length).trim().split("&");
    if (args.length !== 2)
      return message.reply("Usage: sgcustomrole <Role Name> & <Hex Code>");

    const roleName = args[0].trim();
    const hexCode = args[1].trim();

    const targetUserId = "1282184993321255005"; // send to this user
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);

    if (!targetUser) return message.reply("Cannot find the target user.");

    inventory[userId].customrole -= 1;
    saveInventory();

    targetUser.send(
      `:art: Custom Role Request
  User: ${message.author.tag}
  Role Name: ${roleName}
  Color: ${hexCode}`
    ).catch(() => {});

    message.reply("Your custom role request has been sent.");
  }

  /////////////////////////
  // Messages Leaderboard
  /////////////////////////
  if (command === "sgmessagesboard") {
    await message.guild.members.fetch();

    const sorted = Object.entries(messageCounts).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 10);

    let replyText = "**Messages Leaderboard:**\n";
    top.forEach(([userId, count], i) => {
      const member = message.guild.members.cache.get(userId);
      replyText += `${i+1}. ${member ? member.user.tag : "Unknown User"} - ${count} messages\n`;
    });

    return message.reply(replyText);
  }

  if (command === "defeat") {

  if (message.author.id !== OWNER_ID)
    return message.reply("Only the bot owner can use this command.");

  const role = message.mentions.roles.first();
  const challenger = message.mentions.members.last();

  if (!role || !ESPADA_ROLE_IDS.includes(role.id))
    return message.reply("You must mention a valid Espada role.");

  if (!challenger)
    return message.reply("You must mention the challenger who lost.");

  // Find current Espada holder
  const espadaHolder = message.guild.members.cache.find(m =>
    m.roles.cache.has(role.id)
  );

  if (!espadaHolder)
    return message.reply("No one currently holds that Espada role.");

  // Give 200 Souls to defender
  if (!souls[espadaHolder.id]) souls[espadaHolder.id] = 0;
  souls[espadaHolder.id] += 200;
  saveSouls();

  // Increase win count
  if (!wins[espadaHolder.id]) wins[espadaHolder.id] = 0;
  wins[espadaHolder.id] += 1;
  saveWins();

  message.channel.send(
    `🛡️ ${espadaHolder.user.tag} defeated ${challenger.user.tag} and earned 200 Souls!`
  );
  }

  const fs = require("fs");

// ===== Warns JSON =====
let warns = {};
if (fs.existsSync("./warns.json")) {
  warns = JSON.parse(fs.readFileSync("./warns.json"));
}

function saveWarns() {
  fs.writeFileSync("./warns.json", JSON.stringify(warns, null, 2));
}

// ===== Offensive words list =====
const offensiveWords = [
  // Rape variations
  "r*pe","r4p3","rape","r a p e","r.a.p.e","r@pe","raep","r4p","r@p3",
  // N-word variations
  "n**ga","nga","nihga","nugga","n1gga","n1ga","n!gga","n!ga",
  "n-i-g-g-a","niqqa","niggah","n!qq@","n1qq@","n1q@","niqq@","n!q@"
];

// ===== Moderation & Auto-Mute =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const prefix = "sg";
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();
  const modRoleId = "1475606720356290581"; // Espada role

  // ===== AUTO MUTE + WARN FOR OFFENSIVE WORDS =====
  const msgLower = message.content.toLowerCase().replace(/\s/g, "");
  const matchedWords = offensiveWords.filter(word => msgLower.includes(word.replace(/\*/g,"")));
  if (matchedWords.length > 0) {
    const userId = message.author.id;
    if (!warns[userId]) warns[userId] = { count: 0, reasons: [] };

    // Add a warning for each matched word
    matchedWords.forEach(word => {
      warns[userId].count += 1;
      warns[userId].reasons.push(`Auto-mute for saying "${word}"`);
    });
    saveWarns();

    // Mute for 1 min
    let mutedRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (!mutedRole)
      mutedRole = await message.guild.roles.create({ name: "Muted", permissions: [] });

    message.member.roles.add(mutedRole).catch(() => {});
    message.channel.send(`${message.author.tag} got auto-muted for 1 minute for saying: ${matchedWords.join(", ")}. Warning added.`);

    setTimeout(() => {
      message.member.roles.remove(mutedRole).catch(() => {});
      message.channel.send(`${message.author.tag} is now unmuted.`);
    }, 60 * 1000);

    return; // Stop processing further commands
  }

  // ===== Moderation Commands =====
  if (
    ["kick","ban","mute","unmute","clear","warn","sgwarnings"].includes(command) &&
    !message.member.roles.cache.has(modRoleId)
  ) return message.reply("Only Espadas can use moderation commands.");

  // ===== Kick =====
  if (command === "kick") {
    const member = message.mentions.members.first();
    const reason = args.slice(1).join(" ") || "No reason provided";
    if (!member) return message.reply("Mention a user to kick.");
    if (member.roles.cache.has(modRoleId)) return message.reply("Cannot kick another Espada.");
    member.kick(reason).catch(() => {});
    return message.reply(`${member.user.tag} was kicked. Reason: ${reason}`);
  }

  // ===== Ban =====
  if (command === "ban") {
    const member = message.mentions.members.first();
    const reason = args.slice(1).join(" ") || "No reason provided";
    if (!member) return message.reply("Mention a user to ban.");
    if (member.roles.cache.has(modRoleId)) return message.reply("Cannot ban another Espada.");
    member.ban({ reason }).catch(() => {});
    return message.reply(`${member.user.tag} was banned. Reason: ${reason}`);
  }

  // ===== Mute =====
  if (command === "mute") {
    const member = message.mentions.members.first();
    const time = args[1] ? parseInt(args[1]) * 60 * 1000 : null;
    if (!member) return message.reply("Mention a user to mute.");
    let mutedRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (!mutedRole)
      mutedRole = await message.guild.roles.create({ name: "Muted", permissions: [] });
    member.roles.add(mutedRole).catch(() => {});
    message.reply(`${member.user.tag} was muted${time ? ` for ${args[1]} minutes` : ""}.`);
    if (time) {
      setTimeout(() => {
        member.roles.remove(mutedRole).catch(() => {});
        message.channel.send(`${member.user.tag} is now unmuted.`);
      }, time);
    }
  }

  // ===== Unmute =====
  if (command === "unmute") {
    const member = message.mentions.members.first();
    if (!member) return message.reply("Mention a user to unmute.");
    const mutedRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (mutedRole) member.roles.remove(mutedRole).catch(() => {});
    message.reply(`${member.user.tag} has been unmuted.`);
  }

  // ===== Clear / Purge Messages =====
  if (command === "clear") {
    const count = parseInt(args[0]);
    if (isNaN(count)) return message.reply("Specify number of messages to clear.");
    message.channel.bulkDelete(count + 1, true).catch(() => {});
    message.reply(`Cleared ${count} messages.`).then(msg => {
      setTimeout(() => msg.delete().catch(() => {}), 3000);
    });
  }

  // ===== Warn =====
  if (command === "warn") {
    const member = message.mentions.members.first();
    const reason = args.slice(1).join(" ") || "No reason provided";
    if (!member) return message.reply("Mention a user to warn.");
    if (!warns[member.id]) warns[member.id] = { count: 0, reasons: [] };
    warns[member.id].count += 1;
    warns[member.id].reasons.push(reason);
    saveWarns();
    return message.reply(`${member.user.tag} has been warned. Reason: ${reason}. Total warnings: ${warns[member.id].count}`);
  }

  // ===== Check Warnings =====
  if (command === "sgwarnings") {
    const member = message.mentions.members.first() || message.member;
    if (!warns[member.id]) return message.reply(`${member.user.tag} has no warnings.`);
    const userWarns = warns[member.id];
    let text = `${member.user.tag} has ${userWarns.count} warning(s):\n`;
    userWarns.reasons.forEach((r, i) => {
      text += `${i+1}. ${r}\n`;
    });
    return message.reply(text);
  }
});
  
}); // end messageCreate

/////////////////////////
// Login
/////////////////////////
client.login(process.env.TOKEN);
