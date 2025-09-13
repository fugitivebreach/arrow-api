const express = require('express');
const passport = require('passport');
const router = express.Router();

// Discord OAuth login
router.get('/discord', passport.authenticate('discord'));

// Discord OAuth callback
router.get('/discord/callback', 
  passport.authenticate('discord', { failureRedirect: '/login' }),
  (req, res) => {
    console.log('OAuth callback successful, user:', req.user ? req.user.username : 'undefined');
    console.log('Session ID:', req.sessionID);
    console.log('Is authenticated:', req.isAuthenticated());
    res.redirect('/dashboard');
  }
);

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

// Check if user is authenticated middleware
const ensureAuthenticated = (req, res, next) => {
  console.log('ensureAuthenticated check - Session ID:', req.sessionID);
  console.log('ensureAuthenticated check - User:', req.user ? req.user.username : 'undefined');
  console.log('ensureAuthenticated check - Is authenticated:', req.isAuthenticated());
  
  if (req.isAuthenticated()) {
    return next();
  }
  console.log('Authentication failed, redirecting to /login');
  res.redirect('/login');
};

module.exports = router;
module.exports.ensureAuthenticated = ensureAuthenticated;
