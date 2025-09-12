const express = require('express');
const passport = require('passport');
const router = express.Router();

// Discord OAuth login
router.get('/discord', passport.authenticate('discord'));

// Discord OAuth callback
router.get('/discord/callback', 
  passport.authenticate('discord', { failureRedirect: '/login' }),
  (req, res) => {
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
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

module.exports = { router, ensureAuthenticated };
