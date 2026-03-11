// =====================
// Imports & JSON Setup
// =====================
const fs = require("fs");
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

let inventory = {};
if (fs.existsSync("./inventory.json")) inventory = JSON.parse(fs.readFileSync("./inventory.json"));
function saveInventory() { fs.writeFileSync("./inventory.json", JSON.stringify(inventory, null, 2)); }

let souls = {};
if (fs.existsSync("./souls.json")) souls = JSON.parse(fs.readFileSync("./souls.json"));
function saveSouls() { fs.writeFileSync("./souls.json", JSON.stringify(souls, null, 2)); }

let wins = {};
if (fs.existsSync("./wins.json")) wins = JSON.parse(fs.readFileSync("./wins.json"));
function saveWins() { fs.writeFileSync("./wins.json", JSON.stringify(wins, null, 2)); }

let messagesCount = {};
if (fs.existsSync("./messages.json")) messagesCount = JSON.parse(fs.readFileSync("./messages.json"));
function saveMessages() { fs.writeFileSync("./messages.json", JSON.stringify(messagesCount, null, 2)); }

let warnings = {};
if (fs.existsSync("./warnings.json")) warnings = JSON.parse(fs.readFileSync("./warnings.json"));
function saveWarnings() { fs.writeFileSync("./warnings.json", JSON.stringify(warnings, null, 2)); }

// =====================
// Client Setup
// =====================
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
const GIVEAWAY_ANNOUNCEMENT_CHANNEL_ID = "1478459705113313472";
const ESPADA_PARENT_ROLE_ID = "1475606720356290581";
const ESPADA_ROLE_IDS = [
  "1476122833095491708",
  "1476122728422445186",
  "1476123034090995823",
  "1476124047216738388",
  "1476122588953579680",
  "1476123145466282014",
  "1476123319068524644",
  "1476123481308401839",
  "1476123588808409108",
  "1476123850000306176"
];
const MESSAGE_CHANNEL_ID = "1475604095711576237"; // channel for message leaderboard
const MUTE_ROLE_NAME = "Muted";

// =====================
// Express server (keep alive)
// =====================
const app = express();
app.get('/', (req,res)=>res.send('Szayelaporro is alive!'));
app.listen(process.env.PORT||3000,()=>console.log('Web server running'));

// =====================
// Helper Functions
// =====================
function getMuteRole(guild) {
  let role = guild.roles.cache.find(r=>r.name===MUTE_ROLE_NAME);
  if(!role) {
    guild.roles.create({name:MUTE_ROLE_NAME,permissions:[],reason:"Mute role"}).then(r=>{
      guild.channels.cache.forEach(c=>{
        c.permissionOverwrites.create(r,{SendMessages:false,AddReactions:false});
      });
    });
  }
  return role;
}

// =====================
// Client Ready
// =====================
client.once('ready',()=>console.log("Szayelaporro is online."));

// =====================
// Message Create Event
// =====================
client.on('messageCreate', async message=>{
  if(message.author.bot) return;

  const userId = message.author.id;

  // ---------- Message Tracking ----------
  if(message.channel.id === MESSAGE_CHANNEL_ID){
    if(!messagesCount[userId]) messagesCount[userId]=0;
    messagesCount[userId]++;
    saveMessages();
  }

  // ---------- Auto-Moderation ----------
  const forbiddenWords = [
    /n[i1!|]gga/i,
    /r[a@4]pe/i,
    /f[a@]ggot/i,
    /sl[uü]t/i,
    /c[o0]ck/i,
    /d[i1!]ck/i,
    /b[i1!]tch/i
  ];

  const found = forbiddenWords.some(regex=>regex.test(message.content));
  if(found){
    if(!warnings[userId]) warnings[userId]=0;
    warnings[userId]++;
    saveWarnings();

    const warnCount = warnings[userId];

    message.reply(`⚠️ Warning ${warnCount}: Please avoid using prohibited words.`);

    const muteRole = getMuteRole(message.guild);
    const member = message.member;

    if(warnCount===3) member.roles.add(muteRole).catch(()=>{}); // 1 hour mute
    if(warnCount===5) member.roles.add(muteRole).catch(()=>{}); // 10 hours mute
    if(warnCount===7) member.kick("Reached 7 warnings").catch(()=>{});
    if(warnCount===10) member.ban({reason:"Reached 10 warnings"}).catch(()=>{});
  }

  // ---------- Commands ----------
  if(!message.content.toLowerCase().startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ---------- Balance ----------
  if(command==="balance"||command==="sgbalance"){
    if(!souls[userId]) souls[userId]=0;
    message.reply(`You have ${souls[userId]} <:soul:1476731494868455565>`);
  }

  // ---------- Add Souls ----------
  if(command==="add"||command==="sgadd"){
    if(!message.member.roles.cache.has(ESPADA_PARENT_ROLE_ID)) return message.reply("No permission.");
    const user = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if(!user||isNaN(amount)) return message.reply("Usage: sgadd @user amount");
    if(!souls[user.id]) souls[user.id]=0;
    souls[user.id]+=amount;
    saveSouls();
    message.reply(`Added ${amount} <:soul:1476731494868455565> to ${user.username}`);
  }

  // ---------- Shop ----------
  if(command==="shop"||command==="sgshop"){
    message.reply(`
:shopping_cart: Soul Shop

:one: challengepass - 1000 Souls  
  :zap: Allows you to PvP with any espada outside cooldown. Max 2 uses.  

:two: customrole - 3000 Souls  
  :art: Gives you a custom role. Request via bot.
    `);
  }

  if(command==="buy"||command==="sgbuy"){
    const item = args[0];
    if(!souls[userId]) souls[userId]=0;
    if(item==="challengepass"){
      if(souls[userId]<1000) return message.reply("Not enough Souls.");
      souls[userId]-=1000;
      if(!inventory[userId]) inventory[userId]={challengepass:0,customrole:0};
      inventory[userId].challengepass++;
      saveSouls(); saveInventory();
      return message.reply("Purchased 1 Challenge Pass.");
    }
    if(item==="customrole"){
      if(souls[userId]<3000) return message.reply("Not enough Souls.");
      souls[userId]-=3000;
      if(!inventory[userId]) inventory[userId]={challengepass:0,customrole:0};
      inventory[userId].customrole++;
      saveSouls(); saveInventory();
      return message.reply("Purchased 1 Custom Role. Use sgusecustomrole to request.");
    }
  }

  if(command==="inventory"||command==="sginventory"){
    if(!inventory[userId]) inventory[userId]={challengepass:0,customrole:0};
    message.reply(`Inventory:
:dagger: Challenge Passes: ${inventory[userId].challengepass}
:art: Custom Roles: ${inventory[userId].customrole}`);
  }

  if(command==="usecustomrole"||command==="sgusecustomrole"){
    if(!inventory[userId]||inventory[userId].customrole<1) return message.reply("No Custom Roles to use.");
    inventory[userId].customrole--;
    saveInventory();
    message.reply("Send: sgcustomrole <Role Name> & <Hex Code>");
  }

  if(command==="customrole"||command==="sgcustomrole"){
    const split = message.content.slice(prefix.length+"customrole".length).trim().split("&");
    if(split.length!==2) return message.reply("Usage: sgcustomrole <Role Name> & <Hex Code>");
    const roleName = split[0].trim();
    const hexCode = split[1].trim();
    const owner = await client.users.fetch(OWNER_ID);
    owner.send(`Custom Role Request:
User: ${message.author.tag}
Role Name: ${roleName}
Color: ${hexCode}`);
    message.reply("Request sent to owner.");
  }

  // ---------- Challenge System ----------
  const COOLDOWN = 24*60*60*1000;
  const cooldowns = new Map();

  if(command==="challenge"){
    const now = Date.now();
    if(cooldowns.has(userId)&&now<cooldowns.get(userId)) return message.reply("Wait for cooldown.");
    const mentionedRoles = message.mentions.roles;
    if(mentionedRoles.size!==1) return message.reply("Mention 1 Espada role.");
    const role = mentionedRoles.first();
    if(!ESPADA_ROLE_IDS.includes(role.id)) return message.reply("Not an official Espada.");
    const robloxUsername = args.slice(1).join(" ");
    if(!robloxUsername) return message.reply("Provide Roblox username.");
    const holders = message.guild.members.cache.filter(m=>m.roles.cache.has(role.id));
    holders.forEach(m=>{
      m.send(`${message.author.tag} challenged your Espada ${role.name}.\nRoblox: ${robloxUsername}`).catch(()=>{});
    });
    message.reply("Challenge sent.");
    cooldowns.set(userId, now+COOLDOWN);
  }

  if(command==="confirm"||command==="sgconfirm"){
    if(message.author.id!==OWNER_ID) return message.reply("Only owner can confirm.");
    const member = message.mentions.members.first();
    const role = message.mentions.roles.first();
    if(!member||!role||!ESPADA_ROLE_IDS.includes(role.id)) return message.reply("Mention valid member & Espada role.");
    const oldHolders = message.guild.members.cache.filter(m=>m.roles.cache.has(role.id));
    oldHolders.forEach(m=>m.roles.remove(role).catch(()=>{}));
    member.roles.add(role).catch(()=>{});
    if(!wins[member.id]) wins[member.id]=0;
    wins[member.id]++;
    saveWins();
    message.reply(`${member.user.tag} is now the official ${role.name}! Win counted.`);
  }

  if(command==="defeat"||command==="sgdefeat"){
    const espadaRoleId = args[0];
    const challenger = message.mentions.members.first();
    if(!espadaRoleId||!challenger) return message.reply("Usage: sgdefeat <EspadaRoleID> <Challenger>");
    const role = message.guild.roles.cache.get(espadaRoleId);
    if(!role) return message.reply("Invalid Espada role.");
    if(!wins[role.id]) wins[role.id]=0;
    wins[role.id]++;
    if(!souls[role.id]) souls[role.id]=0;
    souls[role.id]+=200;
    saveWins(); saveSouls();
    message.reply(`${role.name} got 1 win and 200 Souls.`);
  }

  // ---------- Message Leaderboard ----------
  if(command==="messagesboard"||command==="sgmessagesboard"){
    const top = Object.entries(messagesCount).sort((a,b)=>b[1]-a[1]).slice(0,10);
    let text="📊 Top 10 Messages:\n";
    for(let i=0;i<top.length;i++){
      const u = await client.users.fetch(top[i][0]).catch(()=>({tag:"Unknown User"}));
      text+=`${i+1}. ${u.tag}: ${top[i][1]}\n`;
    }
    message.channel.send(text);
  }

  // ---------- Moderation ----------
  if(command==="kick"||command==="sgkick"){
    if(!message.member.roles.cache.has(ESPADA_PARENT_ROLE_ID)) return;
    const m = message.mentions.members.first();
    if(m) m.kick("Manual kick").catch(()=>{});
  }
  if(command==="ban"||command==="sgban"){
    if(!message.member.roles.cache.has(ESPADA_PARENT_ROLE_ID)) return;
    const m = message.mentions.members.first();
    if(m) m.ban({reason:"Manual ban"}).catch(()=>{});
  }
  if(command==="unban"||command==="sgunban"){
    if(!message.member.roles.cache.has(ESPADA_PARENT_ROLE_ID)) return;
    const id = args[0];
    if(id) message.guild.members.unban(id).catch(()=>{});
  }
  if(command==="mute"||command==="sgmute"){
    if(!message.member.roles.cache.has(ESPADA_PARENT_ROLE_ID)) return;
    const m = message.mentions.members.first();
    if(m) m.roles.add(getMuteRole(message.guild)).catch(()=>{});
  }
  if(command==="unmute"||command==="sgunmute"){
    if(!message.member.roles.cache.has(ESPADA_PARENT_ROLE_ID)) return;
    const m = message.mentions.members.first();
    if(m) m.roles.remove(getMuteRole(message.guild)).catch(()=>{});
  }
  if(command==="warn"||command==="sgwarn"){
    if(!message.member.roles.cache.has(ESPADA_PARENT_ROLE_ID)) return;
    const m = message.mentions.members.first();
    if(!m) return;
    if(!warnings[m.id]) warnings[m.id]=0;
    warnings[m.id]++;
    saveWarnings();
    message.reply(`${m.user.tag} warned. Total warnings: ${warnings[m.id]}`);
  }

  // Rigged GA Win Command
if (command === "gawin") {
  if (message.author.id !== OWNER_ID) return message.reply("Only the owner can use this.");

  const winner = message.mentions.members.first();
  if (!winner) return message.reply("Mention a user to rig the win.");

  const announceChannel = await client.channels.fetch(GIVEAWAY_ANNOUNCEMENT_CHANNEL_ID);
  if (!announceChannel) return message.reply("Announcement channel not found.");

  announceChannel.send(`:tada: **Giveaway Winner!** :tada:

Congratulations ${winner} for winning the giveaway! :trophy:
Please open a ticket to claim your reward.`);
}
  
});

client.login(process.env.TOKEN);
