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
    if (!message.member.roles.cache.has(ESPADA_PARENT_ROLE_ID)) return message.reply("Only Espadas can start a giveaway.");

    const timeArg = args[0];
    const winnerCount = parseInt(args[1]);
    const prize = args.slice(2).join(" ");
    if (!timeArg || isNaN(winnerCount) || !prize) return message.reply("Usage: sggiveaway <time> <winner count> <prize>");

    let duration;
    if (timeArg.endsWith("m")) duration = parseInt(timeArg) * 60000;
    else if (timeArg.endsWith("h")) duration = parseInt(timeArg) * 60 * 60000;
    else return message.reply("Time must end with m (minutes) or h (hours).");

    const giveawayMessage = await message.channel.send(`🎉 **GIVEAWAY** 🎉\nPrize: **${prize}**\nWinners: **${winnerCount}**\nEnds in: **${timeArg}**\nReact with 🎉 to enter!`);
    await giveawayMessage.react("🎉");

    setTimeout(async () => {
      const fetchedMessage = await message.channel.messages.fetch(giveawayMessage.id);
      const reaction = fetchedMessage.reactions.cache.get("🎉");
      if (!reaction) return;
      const users = (await reaction.users.fetch()).filter(u => !u.bot).map(u => u);
      if (users.length === 0) return message.channel.send("No valid entries. Giveaway cancelled.");
      const winners = [];
      for (let i = 0; i < winnerCount; i++) winners.push(users[Math.floor(Math.random() * users.length)]);
      message.channel.send(`🎊 Congratulations ${winners.map(w => `<@${w.id}>`).join(", ")}!\nYou won **${prize}**!`);
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
  
}); // end messageCreate

/////////////////////////
// Login
/////////////////////////
client.login(process.env.TOKEN);