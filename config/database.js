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
    
    // Parse the MongoDB URI to check if it's a local connection
    const isLocalConnection = process.env.MONGODB_URI.includes('localhost') || 
                             process.env.MONGODB_URI.includes('127.0.0.1');
    
    const connectionOptions = {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000
    };

    // Only add auth options for remote connections
    if (!isLocalConnection) {
      connectionOptions.retryWrites = true;
      connectionOptions.w = 'majority';
    }

    // Create client with URI that includes proper encoding
    const mongoUri = process.env.MONGODB_URI;
    client = new MongoClient(mongoUri, connectionOptions);
    
    await client.connect();
    
    // Test the connection
    await client.db().admin().ping();
    
    db = client.db();
    console.log('MongoDB Connected successfully');
    await initializeApiKeys();
    
  } catch (error) {
    console.error('Database connection failed:', error.message);
    console.warn('Continuing without database connection...');
    db = null;
    
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
