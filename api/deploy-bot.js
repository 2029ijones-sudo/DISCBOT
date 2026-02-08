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
    const { botCode, botName, authToken } = req.body;
    
    if (!authToken) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    // Verify user via Supabase Auth (Discord OAuth)
    const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication. Please login with Discord first.' });
    }

    // Get user's Discord info from Supabase Auth
    const discordUsername = user.user_metadata?.full_name || user.user_metadata?.preferred_username || user.email || 'Discord User';
    const discordAvatar = user.user_metadata?.avatar_url || '';
    const discordId = user.user_metadata?.provider_id || user.id;

    // Create bot package files
    const packageJson = {
      name: botName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      version: '1.0.0',
      description: `Discord bot "${botName}" created with Discord Bot Maker`,
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        dev: 'node index.js'
      },
      dependencies: {
        'discord.js': '^14.14.1'
      },
      keywords: ['discord', 'bot', 'discord-bot', 'discord.js'],
      author: discordUsername,
      license: 'MIT'
    };

    // Add extra dependencies based on bot type
    if (botCode.includes('@discordjs/voice')) {
      packageJson.dependencies['@discordjs/voice'] = '^0.16.0';
      packageJson.dependencies['@discordjs/opus'] = '^0.9.0';
    }
    
    if (botCode.includes('ytdl-core')) {
      packageJson.dependencies['ytdl-core'] = '^4.11.5';
      packageJson.dependencies['ffmpeg-static'] = '^5.2.0';
    }

    const readmeContent = `# ${botName}

> Created by **${discordUsername}** using [Discord Bot Maker](https://your-site.com)

## 🚀 Quick Start

### 1. Get Your Discord Bot Token
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name it: **"${botName}"**
4. Go to "Bot" section → Click "Add Bot"
5. Copy the **TOKEN** (click "Reset" if needed)
6. **IMPORTANT:** Never share this token!

### 2. Invite Bot to Your Server
1. In Discord Developer Portal, go to "OAuth2" → "URL Generator"
2. Select scopes: **\`bot\`**, **\`applications.commands\`**
3. Select bot permissions (choose based on your needs):
   - **Read Messages / View Channels**
   - **Send Messages**
   - **Embed Links**
   - **Attach Files**
   - **Read Message History**
4. Copy the generated URL and open it in browser
5. Select your server → Click "Authorize"

### 3. Run the Bot
\`\`\`bash
# 1. Install dependencies
npm install

# 2. Edit index.js and add your token
# Replace 'YOUR_DISCORD_BOT_TOKEN' with your actual token

# 3. Start the bot
npm start
\`\`\`

### 4. Verify Bot is Online
If successful, you'll see:
\`\`\`
✅ ${botName} is online!
Logged in as YourBotName#1234
\`\`\`

## 📁 File Structure
\`\`\`
${botName}/
├── index.js          # Main bot code
├── package.json     # Dependencies
├── README.md       # This file
└── .env           # For storing token (create this)
\`\`\`

## ⚙️ Configuration

### Environment Variables (Recommended)
Create a \`.env\` file:
\`\`\`env
DISCORD_TOKEN=your_actual_token_here
PREFIX=!
\`\`\`

Then modify index.js to use:
\`\`\`javascript
const token = process.env.DISCORD_TOKEN;
client.login(token);
\`\`\`

### Bot Intents
Make sure these intents are enabled in Discord Developer Portal:
1. Go to your bot in Discord Developer Portal
2. Scroll to "Privileged Gateway Intents"
3. Enable:
   - **Message Content Intent** (Required for reading messages)
   - **Server Members Intent** (If using member data)

## 🛠️ Available Commands

${getAvailableCommands(botCode)}

## 🔧 Troubleshooting

### Common Issues:
1. **Bot doesn't respond to commands**
   - Check if bot has "Message Content Intent" enabled
   - Verify token is correct
   - Ensure bot is in the server

2. **"Missing Permissions" errors**
   - Re-invite bot with correct permissions
   - Check server role hierarchy

3. **Bot goes offline**
   - Check your internet connection
   - Ensure Node.js is running
   - Check for errors in console

### Need Help?
- Discord.js Documentation: https://discord.js.org
- Discord Developer Portal: https://discord.com/developers
- Create issue at: https://github.com/your-repo/issues

## 📝 License
MIT License - Free to use and modify

---

*This bot was generated with ❤️ using Discord Bot Maker*`;

    const envExample = `# Discord Bot Configuration
# Copy this to .env file and fill in your values

# REQUIRED: Your Discord bot token from https://discord.com/developers
DISCORD_TOKEN=your_token_here

# OPTIONAL: Bot prefix (default: !)
PREFIX=!

# OPTIONAL: Bot owner ID (for admin commands)
OWNER_ID=123456789012345678

# OPTIONAL: Logging channel ID
LOG_CHANNEL=123456789012345678

# OPTIONAL: MongoDB URI (if using database)
# MONGODB_URI=mongodb://localhost:27017/discord-bot

# ⚠️ SECURITY WARNING:
# - Never commit .env file to GitHub
# - Add .env to .gitignore
# - Keep your token secret!`;

    // Return all files
    res.status(200).json({
      success: true,
      message: `✅ Bot package generated successfully!`,
      user: {
        discordUsername,
        discordId,
        email: user.email,
        avatar: discordAvatar
      },
      bot: {
        name: botName,
        filesGenerated: 4,
        dependencies: Object.keys(packageJson.dependencies)
      },
      files: {
        'index.js': botCode,
        'package.json': JSON.stringify(packageJson, null, 2),
        'README.md': readmeContent,
        '.env.example': envExample
      },
      instructions: {
        step1: 'Download all files to a new folder',
        step2: 'Run: npm install',
        step3: 'Create .env file from .env.example',
        step4: 'Add your Discord bot token to .env',
        step5: 'Run: npm start',
        step6: 'Bot should be online!'
      },
      links: {
        discordDev: 'https://discord.com/developers/applications',
        discordJsDocs: 'https://discord.js.org',
        supportServer: 'https://discord.gg/your-invite'
      }
    });

  } catch (error) {
    console.error('Error deploying bot:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function to extract commands from bot code
function getAvailableCommands(botCode) {
  const commands = [];
  
  if (botCode.includes('!ping')) commands.push('**!ping** - Check bot latency');
  if (botCode.includes('!hello')) commands.push('**!hello** - Get a greeting');
  if (botCode.includes('!help')) commands.push('**!help** - Show help menu');
  if (botCode.includes('!kick')) commands.push('**!kick @user** - Kick a user (Mod only)');
  if (botCode.includes('!ban')) commands.push('**!ban @user** - Ban a user (Mod only)');
  if (botCode.includes('!clear')) commands.push('**!clear [amount]** - Clear messages (Mod only)');
  if (botCode.includes('!play')) commands.push('**!play [song]** - Play music');
  if (botCode.includes('!stop')) commands.push('**!stop** - Stop music');
  if (botCode.includes('!skip')) commands.push('**!skip** - Skip current song');
  if (botCode.includes('!balance')) commands.push('**!balance** - Check your coins');
  if (botCode.includes('!daily')) commands.push('**!daily** - Claim daily reward');
  if (botCode.includes('!work')) commands.push('**!work** - Earn coins by working');
  if (botCode.includes('!leaderboard')) commands.push('**!leaderboard** - Top users');
  if (botCode.includes('!level')) commands.push('**!level** - Check your level');
  if (botCode.includes('!setup-tickets')) commands.push('**!setup-tickets** - Create ticket panel (Admin only)');
  if (botCode.includes('!giveaway')) commands.push('**!giveaway <time> <winners> <prize>** - Start giveaway');
  
  if (commands.length === 0) {
    return 'No specific commands detected. Check the code for custom commands.';
  }
  
  return commands.map(cmd => `- ${cmd}`).join('\\n');
}
