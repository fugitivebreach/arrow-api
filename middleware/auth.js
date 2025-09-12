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
      
      // First, let's check if there are any users with API keys at all
      const { getDB } = require('../config/database');
      const db = getDB();
      const usersWithKeys = await db.collection('users').find({ 'apiKeys.0': { $exists: true } }).toArray();
      console.log('API Key validation - Users with API keys in database:', usersWithKeys.length);
      
      if (usersWithKeys.length > 0) {
        console.log('API Key validation - Sample user API keys:', usersWithKeys[0].apiKeys.map(k => ({ key: k.key.substring(0, 8) + '...', isActive: k.isActive })));
      }
      
      // Check user's API keys (try without isActive first)
      user = await User.findOne({
        'apiKeys.key': apiKey
      });
      console.log('API Key validation - User with API key found (any active state):', user ? `Yes (${user.username})` : 'No');
      
      if (!user) {
        // Try with isActive: true
        user = await User.findOne({
          'apiKeys.key': apiKey,
          'apiKeys.isActive': true
        });
        console.log('API Key validation - User with API key found (isActive=true):', user ? `Yes (${user.username})` : 'No');
      }

      if (!user) {
        console.log('API Key validation - No valid user found for API key');
        return res.status(401).json({ 
          error: 'API Key is invalid or no longer exists' 
        });
      }

      // Find the specific API key and record usage
      const userApiKey = user.apiKeys.find(key => key.key === apiKey);
      console.log('API Key validation - User API key found in array (any state):', userApiKey ? 'Yes' : 'No');
      
      if (userApiKey) {
        console.log('API Key validation - API key details:', { 
          isActive: userApiKey.isActive, 
          name: userApiKey.name,
          usageCount: userApiKey.usageCount 
        });
      }
      
      // Check if key exists but isn't active (treat undefined as active for backward compatibility)
      if (!userApiKey || (userApiKey.isActive === false)) {
        console.log('API Key validation - API key not found or not active');
        return res.status(401).json({ 
          error: 'API Key is invalid or no longer exists' 
        });
      }
      
      // Set isActive to true if undefined for backward compatibility
      if (userApiKey.isActive === undefined) {
        userApiKey.isActive = true;
        console.log('API Key validation - Set isActive to true for backward compatibility');
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
