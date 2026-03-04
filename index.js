// ============================
//       HUECO MUNDO BOT
// ============================

const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ]
});

// ============================
//       JSON DATA
// ============================
let inventory = {};
let souls = {};
let wins = {};
let warns = {};
let cooldowns = new Map();

if (fs.existsSync("./inventory.json")) inventory = JSON.parse(fs.readFileSync("./inventory.json"));
if (fs.existsSync("./souls.json")) souls = JSON.parse(fs.readFileSync("./souls.json"));
if (fs.existsSync("./wins.json")) wins = JSON.parse(fs.readFileSync("./wins.json"));
if (fs.existsSync("./warns.json")) warns = JSON.parse(fs.readFileSync("./warns.json"));

// ============================
//       SAVE FUNCTIONS
// ============================
function saveInventory(){fs.writeFileSync("./inventory.json", JSON.stringify(inventory, null, 2));}
function saveSouls(){fs.writeFileSync("./souls.json", JSON.stringify(souls, null, 2));}
function saveWins(){fs.writeFileSync("./wins.json", JSON.stringify(wins, null, 2));}
function saveWarns(){fs.writeFileSync("./warns.json", JSON.stringify(warns, null, 2));}

// ============================
//       CONSTANTS
// ============================
const OWNER_ID = "1282184993321255005";
const ESPADA_PARENT_ROLE_ID = "1475606720356290581";
const ANNOUNCEMENT_CHANNEL_ID = "1475913826443722906";
const ESPADA_ROLE_IDS = [
  "1476122833095491708","1476122728422445186","1476123034090995823",
  "1476124047216738388","1476122588953579680","1476123145466282014",
  "1476123319068524644","1476123481308401839","1476123588808409108",
  "1476123850000306176"
];
const COOLDOWN_TIME = 24*60*60*1000; // 1 day cooldown
const SOUL_EMOJI = "<:soul:1476731494868455565>";

// ============================
//       MESSAGE CREATE
// ============================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const prefix = "sg";
  if (!message.content.toLowerCase().startsWith(prefix)) return;
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();
  const userId = message.author.id;

  // ============================
  // INIT USER DATA
  // ============================
  if (!inventory[userId]) inventory[userId] = { challengepass:0, customrole:0 };
  if (!souls[userId]) souls[userId] = 0;
  if (!wins[userId]) wins[userId] = 0;
  if (!warns[userId]) warns[userId] = { count:0, reasons:[] };

  // ============================
  // MODERATION AUTO-MUTE + WARN
  // ============================
  const offensiveWords = [
    "r*pe","r4p3","rape","r a p e","r.a.p.e","r@pe","raep","r4p","r@p3",
    "n**ga","nga","nihga","nugga","n1gga","n1ga","n!gga","n!ga","n-i-g-g-a",
    "niqqa","niggah","n!qq@","n1qq@","n1q@","niqq@","n!q@"
  ];
  const msgLower = message.content.toLowerCase().replace(/\s/g,"");
  const matchedWords = offensiveWords.filter(w => msgLower.includes(w.replace(/\*/g,"")));
  if (matchedWords.length>0){
    matchedWords.forEach(word=>{
      warns[userId].count += 1;
      warns[userId].reasons.push(`Auto-mute for saying "${word}"`);
    });
    saveWarns();
    let mutedRole = message.guild.roles.cache.find(r=>r.name==="Muted");
    if (!mutedRole) mutedRole = await message.guild.roles.create({name:"Muted", permissions:[]});
    await message.member.roles.add(mutedRole).catch(()=>{});
    message.channel.send(`${message.author.tag} got auto-muted for 1 minute for saying: ${matchedWords.join(", ")}. Warning added.`);
    setTimeout(()=>{ message.member.roles.remove(mutedRole).catch(()=>{}); message.channel.send(`${message.author.tag} is now unmuted.`); },60*1000);
    return;
  }

  // ============================
  // ANNOUNCEMENT
  // ============================
  if (command==="announce"){
    if (!message.member.roles.cache.has(ESPADA_PARENT_ROLE_ID)) return message.reply("Only Espadas can use this command.");
    const announcement = args.join(" ");
    if (!announcement) return message.reply("You must provide a message.");
    const channel = client.channels.cache.get(ANNOUNCEMENT_CHANNEL_ID);
    if (!channel) return message.reply("Announcement channel not found.");
    channel.send(`📢 **ANNOUNCEMENT** 📢\n\n${announcement}`);
    const reply = await message.reply("Announcement sent.");
    setTimeout(()=>reply.delete().catch(()=>{}),3000);
    return;
  }

  // ============================
  // PvP CHALLENGE
  // ============================
  if (command==="challenge"){
    if (inventory[userId].challengepass<1) return message.reply("You need a Challenge Pass to challenge.");
    const now = Date.now();
    const userCooldown = cooldowns.get(userId);
    if (userCooldown && now<userCooldown){
      const remaining = Math.ceil((userCooldown-now)/(60*60*1000));
      return message.reply(`Wait ${remaining} more hour(s) before challenging again.`);
    }
    const roleMention = message.mentions.roles.first();
    if (!roleMention || !ESPADA_ROLE_IDS.includes(roleMention.id)) return message.reply("Mention a valid Espada to challenge.");
    const robloxUsername = args.slice(1).join(" ");
    if (!robloxUsername) return message.reply("Provide your Roblox username after the role mention.");
    const holders = message.guild.members.cache.filter(m=>m.roles.cache.has(roleMention.id));
    if (holders.size===0) return message.reply("No one currently holds that Espada rank.");
    holders.forEach(m=>m.send(`${message.author.tag} challenged you for ${roleMention.name}. Roblox: ${robloxUsername}`).catch(()=>{}));
    message.reply("Challenge sent. Waiting owner confirmation.");
    inventory[userId].challengepass -=1;
    saveInventory();
    cooldowns.set(userId, now+COOLDOWN_TIME);
  }

  // ============================
  // CONFIRM CHALLENGE
  // ============================
  if (command==="confirm"){
    if (userId!==OWNER_ID) return message.reply("Only owner can confirm.");
    const member = message.mentions.members.first();
    const role = message.mentions.roles.first();
    if (!member || !role || !ESPADA_ROLE_IDS.includes(role.id)) return message.reply("Mention a valid member & role.");
    message.guild.members.cache.filter(m=>m.roles.cache.has(role.id)).forEach(m=>m.roles.remove(role).catch(()=>{}));
    member.roles.add(role).catch(()=>{});
    message.reply(`${member.user.tag} is now ${role.name}!`);
    wins[member.id] = (wins[member.id]||0)+1;
    saveWins();
  }

  // ============================
  // DEFEAT
  // ============================
  if (command==="sgdefeat"){
    const espadaRole = message.mentions.roles.first();
    const challenger = message.mentions.members.last();
    if (!espadaRole || !challenger) return message.reply("Usage: sgdefeat <EspadaRole> <Challenger>");
    souls[userId] = (souls[userId]||0)+200;
    saveSouls();
    message.reply(`${message.author.tag} defeated ${challenger.user.tag}! Awarded 200${SOUL_EMOJI}.`);
  }

  // ============================
  // SHOP / BUY / INVENTORY
  // ============================
  if (command==="shop") return message.reply(`
:shopping_cart: Soul Shop
:one: challengepass - 1000${SOUL_EMOJI}
:two: customrole - 3000${SOUL_EMOJI}
`);
  if (command==="buy"){
    const item=args[0];
    if (item==="challengepass"){
      if (souls[userId]<1000) return message.reply(`Not enough ${SOUL_EMOJI}.`);
      souls[userId]-=1000; inventory[userId].challengepass+=1; saveSouls(); saveInventory();
      return message.reply(`Bought 1 Challenge Pass for 1000${SOUL_EMOJI}.`);
    }
    if (item==="customrole"){
      if (souls[userId]<3000) return message.reply(`Not enough ${SOUL_EMOJI}.`);
      souls[userId]-=3000; inventory[userId].customrole+=1; saveSouls(); saveInventory();
      return message.reply(`Bought 1 Custom Role for 3000${SOUL_EMOJI}.`);
    }
  }
  if (command==="inventory") return message.reply(`Inventory:
Challenge Passes: ${inventory[userId].challengepass}
Custom Roles: ${inventory[userId].customrole}`);
  if (command==="usecustomrole"){
    if (!inventory[userId] || inventory[userId].customrole<1) return message.reply("No Custom Roles to use.");
    inventory[userId].customrole-=1; saveInventory();
    const roleManager = await message.guild.members.fetch(OWNER_ID);
    return roleManager.send(`User ${message.author.tag} wants a custom role.`).catch(()=>{});
  }

  // ============================
  // GIVEAWAY
  // ============================
  if (command==="giveaway"){
    if (!message.member.roles.cache.has(ESPADA_PARENT_ROLE_ID)) return message.reply("Only Espadas can start giveaways.");
    const timeArg=args[0]; const winnerCount=parseInt(args[1]); const prize=args.slice(2).join(" ");
    if (!timeArg || isNaN(winnerCount) || !prize) return message.reply("Usage: sggiveaway <time> <winner count> <prize>");
    let duration;
    if (timeArg.endsWith("m")) duration=parseInt(timeArg)*60*1000;
    else if (timeArg.endsWith("h")) duration=parseInt(timeArg)*60*60*1000;
    else if (timeArg.endsWith("d")) duration=parseInt(timeArg)*24*60*60*1000;
    else return message.reply("Time must end with m/h/d.");
    const gMsg = await message.channel.send(`🎉 Giveaway: ${prize} | Winners: ${winnerCount} | Ends in: ${timeArg}`);
    await gMsg.react("🎉");
    setTimeout(async ()=>{
      const fetched = await message.channel.messages.fetch(gMsg.id);
      const reaction = fetched.reactions.cache.get("🎉");
      if (!reaction) return message.channel.send("No entries, giveaway cancelled.");
      const users = await reaction.users.fetch();
      const validUsers = users.filter(u=>!u.bot).map(u=>u);
      if (!validUsers.length) return message.channel.send("No valid entries, giveaway cancelled.");
      const winners=[];
      for(let i=0;i<winnerCount;i++) winners.push(validUsers[Math.floor(Math.random()*validUsers.length)]);
      message.channel.send(`🎊 Congrats ${winners.map(w=>`<@${w.id}>`).join(", ")}! You won **${prize}**!`);
    },duration);
  }

  // ============================
  // LEADERBOARD
  // ============================
  if (command==="leaderboard"){
    const sortedWins = Object.entries(wins).sort((a,b)=>b[1]-a[1]).slice(0,10);
    let reply="🏆 PvP Wins Leaderboard:\n";
    for(const [id,count] of sortedWins){
      const member = await message.guild.members.fetch(id).catch(()=>({user:{tag:"Unknown"}}));
      reply+=`${member.user.tag} - ${count} wins\n`;
    }
    message.channel.send(reply);
  }

  // ============================
  // BALANCE CHECK
  // ============================
  if (command==="balance"){
    if (!souls[userId]) souls[userId]=0;
    message.reply(`You have **${souls[userId]}${SOUL_EMOJI}**`);
  }

});

// ============================
//       LOGIN
// ============================
client.login(process.env.TOKEN);
