const express = require('express');
const router = express.Router();

// Home page
router.get('/', (req, res) => {
  res.render('index', { 
    title: 'Arrow API - Roblox Group Membership API',
    user: req.user 
  });
});

// Login page
router.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.render('login', { 
    title: 'Login - Arrow API' 
  });
});

// Documentation page
router.get('/docs', (req, res) => {
  res.render('docs', { 
    title: 'Documentation - Arrow API',
    user: req.user 
  });
});

// Authentication tutorial
router.get('/docs/auth', (req, res) => {
  res.render('auth-tutorial', { 
    title: 'Authentication Tutorial - Arrow API',
    user: req.user 
  });
});

module.exports = router;
