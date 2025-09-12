const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('./auth');
const User = require('../models/User');
const crypto = require('crypto');

// Dashboard routes
router.get('/dashboard', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.render('dashboard', { 
      user: user,
      title: 'Dashboard - Arrow API'
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Internal server error');
  }
});

// Generate new API key
router.post('/dashboard/api-key/generate', ensureAuthenticated, async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.findById(req.user._id);
    
    const newKey = user.generateApiKey(name || 'New API Key');
    await user.save();
    
    res.json({ success: true, key: newKey });
  } catch (error) {
    console.error('API key generation error:', error);
    res.status(500).json({ error: 'Failed to generate API key' });
  }
});

// Delete API key
router.delete('/dashboard/api-key/:keyId', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const keyIndex = user.apiKeys.findIndex(key => key._id.toString() === req.params.keyId);
    
    if (keyIndex === -1) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    user.apiKeys.splice(keyIndex, 1);
    await user.save();
    
    res.json({ success: true });
  } catch (error) {
    console.error('API key deletion error:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// Update Roblox cookie
router.post('/dashboard/cookie/update', ensureAuthenticated, async (req, res) => {
  try {
    const { cookie } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user.canRegenerateCookie()) {
      return res.status(429).json({ 
        error: 'Cookie regeneration is on cooldown. Please wait 5 seconds.' 
      });
    }
    
    user.updateCookie(cookie);
    await user.save();
    
    res.json({ success: true, message: 'Cookie updated successfully' });
  } catch (error) {
    console.error('Cookie update error:', error);
    res.status(500).json({ error: 'Failed to update cookie' });
  }
});

// Get cookie cooldown status
router.get('/dashboard/cookie/cooldown', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const canRegenerate = user.canRegenerateCookie();
    
    let timeLeft = 0;
    if (!canRegenerate && user.robloxCookie.lastRegenerated) {
      const fiveSecondsFromLast = new Date(user.robloxCookie.lastRegenerated.getTime() + 5000);
      timeLeft = Math.max(0, fiveSecondsFromLast - new Date());
    }
    
    res.json({ 
      canRegenerate: canRegenerate,
      timeLeft: Math.ceil(timeLeft / 1000)
    });
  } catch (error) {
    console.error('Cookie cooldown check error:', error);
    res.status(500).json({ error: 'Failed to check cooldown status' });
  }
});

module.exports = router;
