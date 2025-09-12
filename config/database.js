const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Initialize default API keys if none exist
    await initializeApiKeys();
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const initializeApiKeys = async () => {
  try {
    const ApiKey = require('../models/ApiKey');
    
    const existingKeys = await ApiKey.countDocuments();
    
    if (existingKeys === 0) {
      const apiKeysString = process.env.API_KEYS;
      if (apiKeysString) {
        const apiKeys = apiKeysString.split(',');
        
        for (let i = 0; i < apiKeys.length; i++) {
          const key = apiKeys[i].trim();
          if (key) {
            await ApiKey.create({
              key: key,
              name: `Default Key ${i + 1}`,
              isActive: true
            });
          }
        }
        
        console.log(`Initialized ${apiKeys.length} API keys from environment`);
      }
    }
  } catch (error) {
    console.error('Error initializing API keys:', error);
  }
};

module.exports = connectDB;
