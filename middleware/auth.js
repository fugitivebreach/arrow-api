const ApiKey = require('../models/ApiKey');
const User = require('../models/User');
const { connectToDatabase } = require('../config/database');

const validateApiKey = async (req, res, next) => {
  try {
    console.log(`API Key validation - Received key: ${req.headers['api-key'] ? req.headers['api-key'].substring(0, 8) + '...' : 'None'}`);
    
    const apiKey = req.headers['api-key'];
    
    if (!apiKey) {
      console.log('API Key validation - No API key provided');
      return res.status(401).json({ error: 'API Key is invalid or no longer exists' });
    }

    // Check database connection
    const db = await connectToDatabase();
    console.log(`API Key validation - Database connection: ${db ? 'Connected' : 'Failed'}`);

    let validKey = null;
    let user = null;

    try {
      // First, try to find in the old ApiKey collection
      validKey = await ApiKey.findByKey(apiKey);
      console.log(`API Key validation - Old ApiKey found: ${validKey ? 'Yes' : 'No'}`);
      
      if (validKey) {
        console.log(`API Key validation - Old ApiKey details:`, {
          isActive: validKey.isActive,
          usageCount: validKey.usageCount
        });
        
        // Check if the old API key is active (handle undefined as active for backward compatibility)
        if (validKey.isActive === false) {
          console.log('API Key validation - Old API key is inactive');
          return res.status(401).json({ error: 'API Key is invalid or no longer exists' });
        }
        
        await validKey.recordUsage();
        console.log('API Key validation - Old API key usage recorded');
      } else {
        // If not found in old collection, check user's embedded API keys
        console.log('API Key validation - Checking user API keys');
        
        // Debug: Check how many users have API keys
        const usersWithKeys = await db.collection('users').find({ 'apiKeys.0': { $exists: true } }).toArray();
        console.log(`API Key validation - Users with API keys in database: ${usersWithKeys.length}`);
        
        if (usersWithKeys.length > 0) {
          const sampleKeys = usersWithKeys[0].apiKeys.map(key => ({ 
            key: key.key.substring(0, 8) + '...', 
            isActive: key.isActive 
          }));
          console.log(`API Key validation - Sample user API keys:`, sampleKeys);
        }
        
        // Try to find user with this API key (any active state first)
        user = await db.collection('users').findOne({ 'apiKeys.key': apiKey });
        console.log(`API Key validation - User with API key found (any active state): ${user ? 'Yes (' + user.username + ')' : 'No'}`);
        
        if (!user) {
          console.log('API Key validation - No user found with this API key');
          return res.status(401).json({ error: 'API Key is invalid or no longer exists' });
        }

        // Check if user is blacklisted
        if (user.isBlacklisted) {
          console.log('API Key validation - User is blacklisted');
          return res.status(403).json({ error: 'User is blacklisted from using the API' });
        }
        
        // Find the specific API key in the user's keys array
        const userApiKey = user.apiKeys.find(key => key.key === apiKey);
        console.log(`API Key validation - User API key found in array (any state): ${userApiKey ? 'Yes' : 'No'}`);
        
        if (!userApiKey) {
          console.log('API Key validation - API key not found in user array');
          return res.status(401).json({ error: 'API Key is invalid or no longer exists' });
        }
        
        console.log(`API Key validation - API key details:`, {
          isActive: userApiKey.isActive,
          name: userApiKey.name,
          usageCount: userApiKey.usageCount
        });
        
        // Check if the API key is active (handle undefined as active for backward compatibility)
        if (userApiKey.isActive === false) {
          console.log('API Key validation - User API key is inactive');
          return res.status(401).json({ error: 'API Key is invalid or no longer exists' });
        }
        
        // Update usage
        userApiKey.lastUsed = new Date();
        userApiKey.usageCount = (userApiKey.usageCount || 0) + 1;
        await user.save();
        
        validKey = userApiKey;
        console.log('API Key validation - User API key usage updated');
      }
    } catch (dbError) {
      console.error('API Key validation - Database error:', dbError);
      return res.status(500).json({ error: 'Internal server error during API key validation' });
    }

    // Set request properties
    req.apiKey = validKey;
    req.apiKeyUser = user;
    req.apiKeyStatus = 'API Key is valid and exists';
    
    console.log('API Key validation - Success, proceeding to next middleware');
    next();
  } catch (error) {
    console.error('API Key validation - Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error during API key validation' });
  }
};

module.exports = { validateApiKey };
