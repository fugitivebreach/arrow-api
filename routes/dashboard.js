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


module.exports = router;
