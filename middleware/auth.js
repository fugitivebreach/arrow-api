const ApiKey = require('../models/ApiKey');
const User = require('../models/User');

const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['api-key'];
    console.log('API Key validation - Received key:', apiKey ? `${apiKey.substring(0, 8)}...` : 'undefined');
    
    if (!apiKey) {
      console.log('API Key validation - No API key provided');
      return res.status(401).json({ 
        error: 'API Key is invalid or no longer exists' 
      });
    }

    const { getDB } = require('../config/database');
    const db = getDB();
    console.log('API Key validation - Database connection:', db ? 'Connected' : 'Not connected');

    // First check the old ApiKey collection for backward compatibility
    let validKey = await ApiKey.findByKey(apiKey);
    console.log('API Key validation - Old ApiKey found:', validKey ? 'Yes' : 'No');

    let user = null;

    if (validKey) {
      console.log('API Key validation - Using old ApiKey system');
      // Record usage for old system
      await validKey.recordUsage();
    } else {
      console.log('API Key validation - Checking user API keys');
      // Check user's API keys
      user = await User.findOne({
        'apiKeys.key': apiKey,
        'apiKeys.isActive': true
      });
      console.log('API Key validation - User with API key found:', user ? `Yes (${user.username})` : 'No');

      if (!user) {
        console.log('API Key validation - No valid user found for API key');
        return res.status(401).json({ 
          error: 'API Key is invalid or no longer exists' 
        });
      }

      // Find the specific API key and record usage
      const userApiKey = user.apiKeys.find(key => key.key === apiKey && key.isActive);
      console.log('API Key validation - User API key found in array:', userApiKey ? 'Yes' : 'No');
      if (!userApiKey) {
        console.log('API Key validation - API key not found in user\'s active keys');
        return res.status(401).json({ 
          error: 'API Key is invalid or no longer exists' 
        });
      }

      // Update usage statistics
      userApiKey.lastUsed = new Date();
      userApiKey.usageCount += 1;
      await user.save();

      validKey = userApiKey;
    }
    
    console.log('API Key validation - Success, proceeding to next middleware');
    req.apiKey = validKey;
    req.apiKeyUser = user;
    req.apiKeyStatus = 'API Key is valid and exists';
    next();
  } catch (error) {
    console.error('API Key validation error:', error);
    return res.status(500).json({ 
      error: 'Internal server error during API key validation' 
    });
  }
};

module.exports = { validateApiKey };
