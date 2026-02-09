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

  try {
    if (req.method === 'GET') {
      // Get auth URL for Discord OAuth
      if (req.query.action === 'get-auth-url') {
        const redirectUrl = process.env.SUPABASE_REDIRECT_URL || `${req.headers.origin}/auth/callback`;
        
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'discord',
          options: {
            redirectTo: redirectUrl,
            scopes: 'identify email guilds'
          }
        });
        
        if (error) {
          return res.status(400).json({ error: error.message });
        }
        
        return res.status(200).json({ 
          success: true, 
          url: data.url 
        });
      }
      
      // Handle OAuth callback
      if (req.query.code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(req.query.code);
        
        if (error) {
          return res.redirect(`${req.headers.origin}/?error=auth_failed`);
        }
        
        const { session } = data;
        
        // Store session in a secure cookie or return token
        res.setHeader('Set-Cookie', `supabase-auth-token=${session.access_token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`);
        
        return res.redirect(`${req.headers.origin}/dashboard?auth=success`);
      }
      
      // Get current user
      if (req.query.action === 'get-user') {
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '') || req.cookies?.['supabase-auth-token'];
        
        if (!token) {
          return res.status(401).json({ error: 'No token provided' });
        }
        
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
          return res.status(401).json({ error: 'Invalid token' });
        }
        
        return res.status(200).json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            username: user.user_metadata?.preferred_username || user.user_metadata?.full_name || user.email?.split('@')[0],
            avatar: user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email?.split('@')[0] || 'User')}&background=5865F2&color=fff`,
            discordId: user.user_metadata?.provider_id,
            discriminator: user.user_metadata?.custom_claims?.global_name || '0000'
          },
          token: token
        });
      }
      
      // Logout
      if (req.query.action === 'logout') {
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '') || req.cookies?.['supabase-auth-token'];
        
        if (token) {
          await supabase.auth.signOut(token);
        }
        
        res.setHeader('Set-Cookie', 'supabase-auth-token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
        return res.status(200).json({ success: true });
      }
    }
    
    if (req.method === 'POST') {
      // Sign in with Discord OAuth
      if (req.body.action === 'signin') {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'discord',
          options: {
            redirectTo: process.env.SUPABASE_REDIRECT_URL || `${req.headers.origin}/api/discord-auth?callback=true`,
            scopes: 'identify email'
          }
        });
        
        if (error) {
          return res.status(400).json({ error: error.message });
        }
        
        return res.status(200).json({ 
          success: true, 
          url: data.url 
        });
      }
      
      // Sign out
      if (req.body.action === 'signout') {
        const { error } = await supabase.auth.signOut(req.body.token);
        
        if (error) {
          return res.status(400).json({ error: error.message });
        }
        
        return res.status(200).json({ success: true });
      }
      
      // Validate token
      if (req.body.action === 'validate') {
        const { token } = req.body;
        
        if (!token) {
          return res.status(401).json({ error: 'No token provided' });
        }
        
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
          return res.status(401).json({ error: 'Invalid token' });
        }
        
        return res.status(200).json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            username: user.user_metadata?.preferred_username || user.user_metadata?.full_name || user.email?.split('@')[0],
            avatar: user.user_metadata?.avatar_url,
            discordId: user.user_metadata?.provider_id
          }
        });
      }
    }
    
    return res.status(404).json({ error: 'Endpoint not found' });
    
  } catch (error) {
    console.error('Discord auth error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
