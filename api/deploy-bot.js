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
    const discordUsername = user.user_metadata?.full_name || user.user_metadata?.preferred_username || 'Discord User';
    const discordAvatar = user.user_metadata?.avatar_url || '';
    const discordId = user.user_metadata?.provider_id || user.id;

    // Create bot package
    const packageJson = {
      name: botName.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      main: 'index.js',
      scripts: {
        start: 'node index.js'
      },
      dependencies: {
        'discord.js': '^14.14.1'
      }
    };

    const readmeContent = `# ${botName}
Created by: ${discordUsername}
Created with: Discord Bot Maker (Free)

## 🔧 SETUP INSTRUCTIONS:

### 1. CREATE YOUR DISCORD BOT:
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name it: "${botName}"
4. Go to "Bot" section
5. Click "Add Bot"
6. Copy the "Token" (click "Reset Token" if needed)

### 2. INVITE BOT TO SERVER:
1. Go to "OAuth2" → "URL Generator"
2. Select scopes: "bot", "applications.commands"
3. Select bot permissions (choose based on your bot type):
   - Basic: Send Messages, Read Messages, Embed Links
   - Moderation: Kick Members, Ban Members, Manage Messages
   - Admin: Administrator (not recommended)
4. Copy the generated URL and open it in browser
5. Select your server and click "Authorize"

### 3. RUN YOUR BOT:
1. Replace 'YOUR_DISCORD_BOT_TOKEN' in index.js with your token
2. Open terminal in bot folder
3. Run: \`npm install\`
4. Run: \`node index.js\`
5. Bot should say "✅ ${botName} is online!"

## ⚠️ IMPORTANT:
- NEVER share your bot token with anyone!
- Keep token secret in .env file in production
- Bot needs proper intents enabled in Discord Developer Portal
- Add bot to server with proper permissions`;

    // Return files
    res.status(200).json({
      success: true,
      message: '✅ Bot package ready!',
      user: {
        discordUsername,
        discordId,
        email: user.email
      },
      files: {
        'index.js': botCode,
        'package.json': JSON.stringify(packageJson, null, 2),
        'README.md': readmeContent,
        '.env.example': `# Copy this to .env and add your token
DISCORD_TOKEN=your_token_here
`
      },
      discordDevLink: 'https://discord.com/developers/applications'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
