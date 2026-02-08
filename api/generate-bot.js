const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { botName, template, customCode, authToken } = req.body;
    
    if (!authToken) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    // Verify user using the auth token
    const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    // Generate bot code based on template
    let botCode;
    if (template === 'custom' && customCode) {
      botCode = customCode;
    } else {
      botCode = generateBotCode(botName, template);
    }

    // Return the bot code
    res.status(200).json({
      success: true,
      code: botCode,
      downloadLink: `/api/deploy-bot?botName=${encodeURIComponent(botName)}&userId=${user.id}`,
      instructions: `1. Copy this code to a file named 'bot.js'\n2. Run 'npm install discord.js'\n3. Add your bot token\n4. Run 'node bot.js'`
    });

  } catch (error) {
    console.error('Error generating bot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

function generateBotCode(botName, template) {
  const templates = {
    basic: `const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

client.once('ready', () => {
  console.log(\`✅ \${botName} is online!\`);
  console.log(\`Logged in as \${client.user.tag}\`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!ping') {
    await message.reply('Pong! 🏓');
  }

  if (message.content === '!hello') {
    await message.reply(\`Hello \${message.author.username}! 👋\`);
  }

  if (message.content === '!help') {
    const embed = {
      color: 0x7289da,
      title: '🤖 Bot Commands',
      description: 'Here are my available commands:',
      fields: [
        { name: '!ping', value: 'Check if bot is alive' },
        { name: '!hello', value: 'Get a friendly greeting' },
        { name: '!help', value: 'Show this help message' }
      ],
      timestamp: new Date()
    };
    await message.reply({ embeds: [embed] });
  }
});

// ADD YOUR BOT TOKEN HERE (from Discord Developer Portal)
client.login('YOUR_DISCORD_BOT_TOKEN');`,

    moderation: `const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ] 
});

client.once('ready', () => {
  console.log(\`✅ \${botName} Moderation Bot is online!\`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Kick command
  if (message.content.startsWith('!kick')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return message.reply('❌ You need Kick Members permission!');
    }
    
    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ Please mention a user to kick');
    
    try {
      await member.kick();
      message.reply(\`✅ Kicked \${member.user.tag}\`);
    } catch (err) {
      message.reply('❌ Could not kick user');
    }
  }

  // Clear messages
  if (message.content.startsWith('!clear')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply('❌ You need Manage Messages permission!');
    }
    
    const args = message.content.split(' ');
    const amount = parseInt(args[1]) || 10;
    
    if (amount < 1 || amount > 100) {
      return message.reply('❌ Please provide a number between 1 and 100');
    }
    
    try {
      await message.channel.bulkDelete(amount);
      message.reply(\`✅ Cleared \${amount} messages\`).then(msg => {
        setTimeout(() => msg.delete(), 3000);
      });
    } catch (err) {
      message.reply('❌ Error clearing messages');
    }
  }

  // Ban command
  if (message.content.startsWith('!ban')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply('❌ You need Ban Members permission!');
    }
    
    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ Please mention a user to ban');
    
    try {
      await member.ban();
      message.reply(\`✅ Banned \${member.user.tag}\`);
    } catch (err) {
      message.reply('❌ Could not ban user');
    }
  }

  // Warn command
  if (message.content.startsWith('!warn')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return message.reply('❌ You need Kick Members permission to warn!');
    }
    
    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ Please mention a user to warn');
    
    const reason = message.content.split(' ').slice(2).join(' ') || 'No reason provided';
    message.reply(\`⚠️ Warned \${member.user.tag} for: \${reason}\`);
  }

  // Server info
  if (message.content === '!serverinfo') {
    const embed = {
      color: 0x7289da,
      title: '📊 Server Information',
      fields: [
        { name: 'Server Name', value: message.guild.name, inline: true },
        { name: 'Total Members', value: message.guild.memberCount.toString(), inline: true },
        { name: 'Created', value: message.guild.createdAt.toDateString(), inline: true },
        { name: 'Owner', value: (await message.guild.fetchOwner()).user.tag, inline: true }
      ],
      thumbnail: { url: message.guild.iconURL() },
      timestamp: new Date()
    };
    await message.reply({ embeds: [embed] });
  }
});

// ADD YOUR BOT TOKEN HERE (from Discord Developer Portal)
client.login('YOUR_DISCORD_BOT_TOKEN');`,

    music: `const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ] 
});

const queues = new Map();

client.once('ready', () => {
  console.log(\`✅ \${botName} Music Bot is ready! 🎵\`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  if (message.content.startsWith('!play')) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.reply('❌ You need to be in a voice channel!');
    }

    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
      return message.reply('❌ I need permissions to join and speak in your voice channel!');
    }

    // Join voice channel
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    message.reply('🎵 Joined voice channel! Add music service like ytdl-core to play actual music.');
  }

  if (message.content === '!stop') {
    if (!message.member.voice.channel) {
      return message.reply('❌ You need to be in a voice channel!');
    }
    
    message.reply('⏹️ Music stopped!');
  }

  if (message.content === '!skip') {
    if (!message.member.voice.channel) {
      return message.reply('❌ You need to be in a voice channel!');
    }
    
    message.reply('⏭️ Song skipped!');
  }

  if (message.content === '!queue') {
    message.reply('📋 Queue system would be implemented here!');
  }

  if (message.content === '!volume') {
    message.reply('🔊 Volume control would be implemented here!');
  }
});

// ADD YOUR BOT TOKEN HERE (from Discord Developer Portal)
client.login('YOUR_DISCORD_BOT_TOKEN');

// Note: To make this work, install these packages:
// npm install discord.js @discordjs/voice
// Optional for actual music: ytdl-core @discordjs/opus ffmpeg-static`,

    economy: `const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

const userBalances = new Map();
const userCooldowns = new Map();

client.once('ready', () => {
  console.log(\`✅ \${botName} Economy Bot is online! 💰\`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;
  
  // Initialize user balance
  if (!userBalances.has(userId)) {
    userBalances.set(userId, 100);
  }

  // Balance command
  if (message.content === '!balance' || message.content === '!bal') {
    const balance = userBalances.get(userId);
    await message.reply(\`💰 Your balance: \${balance} coins\`);
  }

  // Daily reward
  if (message.content === '!daily') {
    const now = Date.now();
    const lastDaily = userCooldowns.get(userId + '_daily') || 0;
    const cooldown = 24 * 60 * 60 * 1000;

    if (now - lastDaily < cooldown) {
      const remaining = Math.ceil((cooldown - (now - lastDaily)) / (1000 * 60 * 60));
      return message.reply(\`⏳ You can claim your daily reward in \${remaining} hours\`);
    }

    const reward = Math.floor(Math.random() * 100) + 50;
    const currentBalance = userBalances.get(userId);
    userBalances.set(userId, currentBalance + reward);
    userCooldowns.set(userId + '_daily', now);

    await message.reply(\`🎉 You claimed \${reward} coins! New balance: \${currentBalance + reward} coins\`);
  }

  // Work command
  if (message.content === '!work') {
    const now = Date.now();
    const lastWork = userCooldowns.get(userId + '_work') || 0;
    const cooldown = 30 * 60 * 1000;

    if (now - lastWork < cooldown) {
      const remaining = Math.ceil((cooldown - (now - lastWork)) / (1000 * 60));
      return message.reply(\`⏳ You can work again in \${remaining} minutes\`);
    }

    const earnings = Math.floor(Math.random() * 50) + 25;
    const currentBalance = userBalances.get(userId);
    userBalances.set(userId, currentBalance + earnings);
    userCooldowns.set(userId + '_work', now);

    const jobs = ['as a developer', 'as a chef', 'as a driver', 'at a store', 'as a freelancer'];
    const job = jobs[Math.floor(Math.random() * jobs.length)];

    await message.reply(\`💼 You worked \${job} and earned \${earnings} coins! New balance: \${currentBalance + earnings} coins\`);
  }

  // Gamble command
  if (message.content.startsWith('!gamble')) {
    const args = message.content.split(' ');
    const amount = parseInt(args[1]);
    
    if (!amount || amount < 1) {
      return message.reply('❌ Please specify an amount to gamble! Example: !gamble 50');
    }
    
    const balance = userBalances.get(userId);
    if (amount > balance) {
      return message.reply(\`❌ You don't have enough coins! Your balance: \${balance}\`);
    }
    
    const win = Math.random() > 0.5;
    if (win) {
      const winnings = amount * 2;
      userBalances.set(userId, balance + winnings);
      await message.reply(\`🎰 You won \${winnings} coins! New balance: \${balance + winnings} coins\`);
    } else {
      userBalances.set(userId, balance - amount);
      await message.reply(\`💸 You lost \${amount} coins... New balance: \${balance - amount} coins\`);
    }
  }

  // Give command
  if (message.content.startsWith('!give')) {
    const args = message.content.split(' ');
    const amount = parseInt(args[1]);
    const targetUser = message.mentions.users.first();
    
    if (!amount || amount < 1 || !targetUser) {
      return message.reply('❌ Usage: !give <amount> @user');
    }
    
    if (targetUser.bot) {
      return message.reply('❌ You cannot give coins to bots!');
    }
    
    const senderBalance = userBalances.get(userId);
    if (amount > senderBalance) {
      return message.reply(\`❌ You don't have enough coins! Your balance: \${senderBalance}\`);
    }
    
    const targetBalance = userBalances.get(targetUser.id) || 100;
    userBalances.set(userId, senderBalance - amount);
    userBalances.set(targetUser.id, targetBalance + amount);
    
    await message.reply(\`🎁 You gave \${amount} coins to \${targetUser.username}! Your new balance: \${senderBalance - amount} coins\`);
  }

  // Leaderboard
  if (message.content === '!leaderboard' || message.content === '!lb') {
    const sorted = Array.from(userBalances.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    let leaderboard = '🏆 **Top 10 Richest Users:**\\n';
    sorted.forEach(([id, balance], index) => {
      const user = client.users.cache.get(id) || { username: 'Unknown' };
      leaderboard += \`\${index + 1}. \${user.username}: \${balance} coins\\n\`;
    });

    await message.reply(leaderboard);
  }
});

// ADD YOUR BOT TOKEN HERE (from Discord Developer Portal)
client.login('YOUR_DISCORD_BOT_TOKEN');`,

    ticket: `const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ] 
});

const activeTickets = new Map();

client.once('ready', () => {
  console.log(\`✅ \${botName} Ticket Bot is online! 🎫\`);
  console.log('Use !setup-tickets in your server to create the ticket panel');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Setup tickets command (admin only)
  if (message.content === '!setup-tickets') {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ You need Administrator permission!');
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🎫 Support Ticket System')
      .setDescription('Click the button below to create a support ticket!\\n\\nSupport will assist you in a private channel.')
      .addFields(
        { name: 'How it works', value: '• Click the "Create Ticket" button\\n• A private channel will be created\\n• Support team will assist you\\n• Use !close to close the ticket' }
      )
      .setFooter({ text: 'Support will be with you shortly!' });

    const button = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('Create Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫')
      );

    await message.channel.send({ embeds: [embed], components: [button] });
    await message.delete();
  }

  // Close ticket command
  if (message.content === '!close' && message.channel.name.startsWith('ticket-')) {
    const userId = message.channel.topic;
    if (userId && (userId === message.author.id || message.member.permissions.has('ManageChannels'))) {
      try {
        await message.channel.send('Closing ticket in 5 seconds...');
        setTimeout(async () => {
          await message.channel.delete();
          activeTickets.delete(userId);
        }, 5000);
      } catch (err) {
        console.error('Error closing ticket:', err);
      }
    } else {
      message.reply('❌ You can only close your own ticket!');
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'create_ticket') {
    const userId = interaction.user.id;
    
    if (activeTickets.has(userId)) {
      return interaction.reply({ 
        content: '❌ You already have an active ticket! Close it first before creating a new one.', 
        ephemeral: true 
      });
    }

    try {
      const channel = await interaction.guild.channels.create({
        name: \`ticket-\${interaction.user.username.toLowerCase()}\`,
        type: 0,
        parent: interaction.channel.parentId,
        topic: userId,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: ['ViewChannel']
          },
          {
            id: userId,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
          },
          {
            id: interaction.client.user.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels', 'ManageMessages']
          }
        ]
      });

      activeTickets.set(userId, channel.id);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎫 Ticket Created')
        .setDescription(\`Hello \${interaction.user.username}! Support will be with you shortly.\\n\\nPlease describe your issue in detail.\\n\\nUse \`!close\` to close this ticket when resolved.\`)
        .addFields(
          { name: 'User', value: \`\${interaction.user.tag} (\${interaction.user.id})\` },
          { name: 'Created', value: new Date().toLocaleString() }
        )
        .setFooter({ text: 'Support Ticket System' });

      const closeButton = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
        );

      await channel.send({ 
        content: \`\${interaction.user} welcome to your ticket!\`,
        embeds: [embed],
        components: [closeButton]
      });

      await interaction.reply({ 
        content: \`✅ Ticket created: \${channel}\`, 
        ephemeral: true 
      });

    } catch (err) {
      console.error('Error creating ticket:', err);
      await interaction.reply({ 
        content: '❌ Error creating ticket. Please try again.', 
        ephemeral: true 
      });
    }
  }

  if (interaction.customId === 'close_ticket') {
    const userId = interaction.user.id;
    const channel = interaction.channel;
    
    if (channel.topic === userId || interaction.member.permissions.has('ManageChannels')) {
      try {
        await interaction.reply('Closing ticket in 5 seconds...');
        setTimeout(async () => {
          await channel.delete();
          activeTickets.delete(userId);
        }, 5000);
      } catch (err) {
        console.error('Error closing ticket:', err);
      }
    } else {
      await interaction.reply({ 
        content: '❌ You can only close your own ticket!', 
        ephemeral: true 
      });
    }
  }
});

// ADD YOUR BOT TOKEN HERE (from Discord Developer Portal)
client.login('YOUR_DISCORD_BOT_TOKEN');`,

    giveaway: `const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ] 
});

const activeGiveaways = new Map();

client.once('ready', () => {
  console.log(\`✅ \${botName} Giveaway Bot is online! 🎁\`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Create giveaway
  if (message.content.startsWith('!giveaway')) {
    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply('❌ You need Manage Messages permission to create giveaways!');
    }

    const args = message.content.split(' ');
    const duration = args[1];
    const winners = parseInt(args[2]);
    const prize = args.slice(3).join(' ');

    if (!duration || !winners || !prize) {
      return message.reply('❌ Usage: !giveaway <duration> <winners> <prize>\\nExample: !giveaway 1h 1 Discord Nitro');
    }

    let durationMs;
    if (duration.endsWith('h')) {
      durationMs = parseInt(duration) * 60 * 60 * 1000;
    } else if (duration.endsWith('m')) {
      durationMs = parseInt(duration) * 60 * 1000;
    } else if (duration.endsWith('s')) {
      durationMs = parseInt(duration) * 1000;
    } else {
      durationMs = parseInt(duration) * 60 * 1000; // Default to minutes
    }

    const endTime = Date.now() + durationMs;
    const giveawayId = Date.now().toString();

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('🎉 GIVEAWAY 🎉')
      .setDescription(\`**Prize:** \${prize}\\n**Winners:** \${winners}\\n**Hosted by:** \${message.author}\\n\\nReact with 🎁 to enter!\\n\\nTime remaining: **\${formatTime(durationMs)}**\`)
      .setFooter({ text: 'Ends at' })
      .setTimestamp(endTime);

    const giveawayMessage = await message.channel.send({ embeds: [embed] });
    await giveawayMessage.react('🎁');

    activeGiveaways.set(giveawayId, {
      messageId: giveawayMessage.id,
      channelId: message.channel.id,
      endTime,
      winners,
      prize,
      hostId: message.author.id,
      participants: new Set()
    });

    // Start countdown
    const countdown = setInterval(async () => {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        clearInterval(countdown);
        await endGiveaway(giveawayId);
        return;
      }

      const updatedEmbed = EmbedBuilder.from(embed)
        .setDescription(\`**Prize:** \${prize}\\n**Winners:** \${winners}\\n**Hosted by:** \${message.author}\\n\\nReact with 🎁 to enter!\\n\\nTime remaining: **\${formatTime(remaining)}**\`);

      try {
        await giveawayMessage.edit({ embeds: [updatedEmbed] });
      } catch (err) {
        clearInterval(countdown);
      }
    }, 15000);

    await message.delete();
  }

  // Reroll giveaway
  if (message.content.startsWith('!reroll')) {
    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply('❌ You need Manage Messages permission to reroll giveaways!');
    }

    const args = message.content.split(' ');
    const giveawayId = args[1];
    
    if (!giveawayId) {
      return message.reply('❌ Please provide a giveaway ID to reroll!');
    }

    message.reply('🔄 Rerolling giveaway...');
  }
});

async function endGiveaway(giveawayId) {
  const giveaway = activeGiveaways.get(giveawayId);
  if (!giveaway) return;

  try {
    const channel = await client.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(giveaway.messageId);
    
    const reaction = message.reactions.cache.get('🎁');
    if (!reaction) return;

    const users = await reaction.users.fetch();
    const participants = Array.from(users.values()).filter(user => !user.bot);
    
    if (participants.length === 0) {
      const noWinnersEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🎉 GIVEAWAY ENDED 🎉')
        .setDescription(\`**Prize:** \${giveaway.prize}\\n\\n❌ No one entered the giveaway!\\n\\nGiveaway ended!\`)
        .setFooter({ text: 'No winners' })
        .setTimestamp();

      await message.edit({ embeds: [noWinnersEmbed] });
      await message.reactions.removeAll();
      activeGiveaways.delete(giveawayId);
      return;
    }

    const winners = [];
    for (let i = 0; i < Math.min(giveaway.winners, participants.length); i++) {
      const randomIndex = Math.floor(Math.random() * participants.length);
      winners.push(participants[randomIndex]);
      participants.splice(randomIndex, 1);
    }

    const winnersText = winners.map(winner => \`\${winner}\`).join(', ');

    const endedEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🎉 GIVEAWAY ENDED 🎉')
      .setDescription(\`**Prize:** \${giveaway.prize}\\n**Winners:** \${winnersText}\\n**Hosted by:** <@\${giveaway.hostId}>\\n\\nCongratulations to the winners! 🎊\`)
      .setFooter({ text: \`\${giveaway.winners} winner(s)\` })
      .setTimestamp();

    await message.edit({ embeds: [endedEmbed] });
    await message.reply(\`🎉 **GIVEAWAY ENDED** 🎉\\nCongratulations \${winnersText}! You won **\${giveaway.prize}**!\\nPlease contact the host to claim your prize.\`);
    
    activeGiveaways.delete(giveawayId);
  } catch (err) {
    console.error('Error ending giveaway:', err);
  }
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return \`\${hours}h \${minutes % 60}m\`;
  } else if (minutes > 0) {
    return \`\${minutes}m \${seconds % 60}s\`;
  } else {
    return \`\${seconds}s\`;
  }
}

// ADD YOUR BOT TOKEN HERE (from Discord Developer Portal)
client.login('YOUR_DISCORD_BOT_TOKEN');`,

    leveling: `const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ] 
});

// In-memory storage (use a database in production)
const userXP = new Map();
const userLevels = new Map();
const cooldowns = new Map();

client.once('ready', () => {
  console.log(\`✅ \${botName} Leveling Bot is online! ⭐\`);
  console.log('Users earn XP by sending messages. Every 100 XP = 1 level up!');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.content.length < 3) return; // Minimum message length

  const userId = message.author.id;
  const now = Date.now();

  // Check cooldown (1 minute between XP gains)
  if (cooldowns.has(userId) && now - cooldowns.get(userId) < 60000) {
    return;
  }

  cooldowns.set(userId, now);

  // Initialize user data
  if (!userXP.has(userId)) {
    userXP.set(userId, 0);
    userLevels.set(userId, 1);
  }

  // Award XP (1-5 XP per message)
  const xpGained = Math.floor(Math.random() * 5) + 1;
  const currentXP = userXP.get(userId);
  const currentLevel = userLevels.get(userId);
  
  userXP.set(userId, currentXP + xpGained);

  // Check for level up (100 XP per level)
  const xpForNextLevel = currentLevel * 100;
  if (currentXP + xpGained >= xpForNextLevel) {
    const newLevel = currentLevel + 1;
    userLevels.set(userId, newLevel);
    
    // Level up message
    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('🎉 LEVEL UP! 🎉')
      .setDescription(\`Congratulations \${message.author.username}!\\nYou leveled up to **Level \${newLevel}**! 🎊\`)
      .addFields(
        { name: 'New Level', value: \`\${newLevel}\`, inline: true },
        { name: 'Total XP', value: \`\${currentXP + xpGained}\`, inline: true },
        { name: 'XP to Next', value: \`\${newLevel * 100}\`, inline: true }
      )
      .setThumbnail(message.author.displayAvatarURL())
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  // Commands
  if (message.content === '!level' || message.content === '!rank') {
    const xp = userXP.get(userId) || 0;
    const level = userLevels.get(userId) || 1;
    const xpNeeded = level * 100;
    const progress = Math.min((xp / xpNeeded) * 100, 100);
    
    const progressBar = createProgressBar(progress);

    const embed = new EmbedBuilder()
      .setColor(0x7289da)
      .setTitle(\`\${message.author.username}'s Level\`)
      .setThumbnail(message.author.displayAvatarURL())
      .addFields(
        { name: 'Level', value: \`\${level}\`, inline: true },
        { name: 'XP', value: \`\${xp}/\${xpNeeded}\`, inline: true },
        { name: 'Progress', value: \`\${progressBar} \${Math.round(progress)}%\`, inline: false }
      )
      .setFooter({ text: 'Keep chatting to level up!' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  if (message.content === '!leaderboard' || message.content === '!lb') {
    const sortedUsers = Array.from(userLevels.entries())
      .sort((a, b) => {
        const levelDiff = b[1] - a[1];
        if (levelDiff !== 0) return levelDiff;
        return (userXP.get(b[0]) || 0) - (userXP.get(a[0]) || 0);
      })
      .slice(0, 10);

    let leaderboardText = '🏆 **TOP 10 LEVEL LEADERBOARD**\\n\\n';
    
    for (let i = 0; i < sortedUsers.length; i++) {
      const [userId, level] = sortedUsers[i];
      const xp = userXP.get(userId) || 0;
      const user = await client.users.fetch(userId).catch(() => ({ username: 'Unknown' }));
      
      const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : \`\${i + 1}.\`;
      leaderboardText += \`\${rankEmoji} **\${user.username}** - Level \${level} (\${xp} XP)\\n\`;
    }

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('⭐ Level Leaderboard')
      .setDescription(leaderboardText)
      .setFooter({ text: 'Updated just now' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  if (message.content === '!xphelp') {
    const embed = new EmbedBuilder()
      .setColor(0x7289da)
      .setTitle('📖 Level System Help')
      .setDescription('How the leveling system works:')
      .addFields(
        { name: 'Earning XP', value: '• Send messages (3+ characters)\\n• 1-5 XP per message\\n• 1 minute cooldown' },
        { name: 'Leveling Up', value: '• 100 XP needed per level\\n• Level up notification\\n• Prestige system available' },
        { name: 'Commands', value: '• !level - Check your level\\n• !leaderboard - Top 10 users\\n• !xphelp - This help message' }
      )
      .setFooter({ text: 'Keep chatting to climb the leaderboard!' });

    await message.reply({ embeds: [embed] });
  }
});

function createProgressBar(percentage) {
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;
  return \`[\${'█'.repeat(filled)}\${'░'.repeat(empty)}]\`;
}

// ADD YOUR BOT TOKEN HERE (from Discord Developer Portal)
client.login('YOUR_DISCORD_BOT_TOKEN');`
  };
  
  return templates[template] || templates.basic;
}
