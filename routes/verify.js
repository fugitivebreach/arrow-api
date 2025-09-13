const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('./auth');
const VerificationCode = require('../models/VerificationCode');

// Verify page
router.get('/verify', ensureAuthenticated, async (req, res) => {
  try {
    const { getDB } = require('../config/database');
    
    // Handle temporary users (when database is unavailable)
    if (req.user.isTemporary) {
      return res.render('verify', { 
        user: req.user,
        title: 'Verify - Arrow API',
        dbUnavailable: true
      });
    }
    
    // Check if database is available
    if (!getDB()) {
      return res.render('verify', { 
        user: req.user,
        title: 'Verify - Arrow API',
        dbUnavailable: true
      });
    }

    // Check for existing active code
    const existingCode = await VerificationCode.getUserActiveCode(req.user.discordId);
    
    res.render('verify', { 
      user: req.user,
      title: 'Verify - Arrow API',
      existingCode: existingCode
    });
  } catch (error) {
    console.error('Verify page error:', error);
    res.status(500).send('Internal server error');
  }
});

// Generate new verification code
router.post('/verify/generate', ensureAuthenticated, async (req, res) => {
  try {
    const { getDB } = require('../config/database');
    
    // Check if database is available
    if (!getDB() || req.user.isTemporary) {
      return res.status(503).json({ 
        error: 'Database unavailable', 
        message: 'Cannot generate verification codes without database connection' 
      });
    }

    const code = await VerificationCode.createCode(req.user.discordId, req.user.username);
    
    if (code) {
      res.json({ success: true, code: code });
    } else {
      res.status(500).json({ error: 'Failed to generate verification code' });
    }
  } catch (error) {
    console.error('Code generation error:', error);
    res.status(500).json({ error: 'Failed to generate verification code' });
  }
});

module.exports = router;
