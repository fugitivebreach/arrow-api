const ApiKey = require('../models/ApiKey');
const User = require('../models/User');

const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['api-key'];
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'API Key is invalid or no longer exists' 
      });
    }

    // First check the old ApiKey collection for backward compatibility
    let validKey = await ApiKey.findOne({ 
      key: apiKey, 
      isActive: true 
    });

    let user = null;

    if (validKey) {
      // Record usage for old system
      await validKey.recordUsage();
    } else {
      // Check user's API keys
      user = await User.findOne({
        'apiKeys.key': apiKey,
        'apiKeys.isActive': true
      });

      if (!user) {
        return res.status(401).json({ 
          error: 'API Key is invalid or no longer exists' 
        });
      }

      // Find the specific API key and record usage
      const userApiKey = user.apiKeys.find(key => key.key === apiKey && key.isActive);
      if (!userApiKey) {
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
