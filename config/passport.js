const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const User = require('../models/User');

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_REDIRECT_URI,
  scope: ['identify', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const { getDB } = require('./database');
    
    // Check if database is available
    if (!getDB()) {
      console.warn('Database not available during OAuth callback, creating temporary user session');
      // Create a temporary user object for the session
      const tempUser = {
        _id: `temp_${profile.id}`,
        discordId: profile.id,
        username: profile.username,
        discriminator: profile.discriminator,
        avatar: profile.avatar,
        email: profile.email,
        lastLogin: new Date(),
        isTemporary: true
      };
      return done(null, tempUser);
    }
    
    let user = await User.findOne({ discordId: profile.id });
    
    if (user) {
      // Update existing user
      user.username = profile.username;
      user.discriminator = profile.discriminator;
      user.avatar = profile.avatar;
      user.email = profile.email;
      user.lastLogin = new Date();
      await user.save();
    } else {
      // Create new user
      user = new User({
        discordId: profile.id,
        username: profile.username,
        discriminator: profile.discriminator,
        avatar: profile.avatar,
        email: profile.email,
        lastLogin: new Date()
      });
      
      // Generate initial API key
      user.generateApiKey('Default API Key');
      await user.save();
    }
    
    return done(null, user);
  } catch (error) {
    console.error('Discord authentication error:', error);
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    // Handle temporary users (when database is unavailable)
    if (typeof id === 'string' && id.startsWith('temp_')) {
      const tempUser = {
        _id: id,
        discordId: id.replace('temp_', ''),
        isTemporary: true
      };
      return done(null, tempUser);
    }
    
    const { getDB } = require('./database');
    if (!getDB()) {
      console.warn('Database not available during user deserialization');
      return done(null, null);
    }
    
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
