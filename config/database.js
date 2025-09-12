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
  // API keys are now managed through user accounts via Discord OAuth
  // No need to initialize from environment variables
  console.log('API key management handled through user dashboard');
};

module.exports = connectDB;
