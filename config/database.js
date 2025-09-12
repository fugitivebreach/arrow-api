const { MongoClient } = require('mongodb');

let db = null;
let client = null;

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.warn('MONGODB_URI environment variable is not set - running without database');
      return;
    }

    console.log('Attempting MongoDB connection...');
    client = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
    
    await client.connect();
    db = client.db();
    
    console.log('MongoDB Connected successfully');
    
    // Initialize default API keys if none exist
    await initializeApiKeys();
  } catch (error) {
    console.error('Database connection error:', error.message);
    console.warn('Continuing without database connection...');
    // Don't crash the app, just continue without DB
    db = null;
    client = null;
  }
};

const initializeApiKeys = async () => {
  // API keys are now managed through user accounts via Discord OAuth
  // No need to initialize from environment variables
  console.log('API key management handled through user dashboard');
};

const getDB = () => db;
const getClient = () => client;

module.exports = { connectDB, getDB, getClient };
