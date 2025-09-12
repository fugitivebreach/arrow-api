const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Initialize default API keys if none exist
    await initializeApiKeys();
  } catch (error) {
    console.error('Database connection error:', error);
    // Don't exit process in production, let app continue without DB
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
};

const initializeApiKeys = async () => {
  // API keys are now managed through user accounts via Discord OAuth
  // No need to initialize from environment variables
  console.log('API key management handled through user dashboard');
};

module.exports = connectDB;
