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
    
    // Wrap the connection attempt to prevent unhandled promise rejections
    const connectionPromise = new Promise(async (resolve, reject) => {
      try {
        client = new MongoClient(process.env.MONGODB_URI, {
          serverSelectionTimeoutMS: 3000,
          connectTimeoutMS: 5000,
        });
        
        await client.connect();
        db = client.db();
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    await connectionPromise;
    console.log('MongoDB Connected successfully');
    await initializeApiKeys();
    
  } catch (error) {
    console.error('Database connection failed:', error.message);
    console.warn('Continuing without database connection...');
    db = null;
    client = null;
    
    // Ensure any partial connections are cleaned up
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        // Ignore close errors
      }
      client = null;
    }
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
